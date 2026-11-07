// ============================================================
// Fastify API Server — Local HTTP backend
// Runs on http://localhost:3847
// All routes are local-only (127.0.0.1 binding)
// ============================================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import type { AnalysisRequest, ResourceAnalysis, WorkerMessage } from '@five-map/shared';
import { generateJobId } from '@five-map/shared';
import { initDb, saveAnalysis, getAnalysis, listAnalyses, deleteAnalysis, getStats } from './db';
import { enqueueJob, cancelJob, getJob } from './worker-pool';

// Active SSE clients for real-time progress
const sseClients = new Map<string, Set<any>>();

// In-memory job results & last messages cache
const liveResults = new Map<string, ResourceAnalysis>();
const lastJobMessages = new Map<string, WorkerMessage>();

export async function buildServer(dataDir: string) {
  initDb(dataDir);

  const app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  });

  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024 * 1024 } });

  // ---- Health check ----
  app.get('/api/health', async () => ({ status: 'ok', version: '1.0.0' }));

  // ---- Stats ----
  app.get('/api/stats', async () => getStats());

  // ---- Upload file or ZIP from browser ----
  app.post('/api/upload', async (request, reply) => {
    const parts = request.parts();
    const uploadId = generateJobId();
    const uploadDir = path.join(os.tmpdir(), 'fml_uploads', uploadId);
    fs.mkdirSync(uploadDir, { recursive: true });

    let firstFilePath = '';
    let isZip = false;
    let fileCount = 0;

    for await (const part of parts) {
      if (part.type === 'file') {
        const relPath = part.filename.replace(/\\/g, '/');
        if (relPath.includes('../')) continue;

        const targetPath = path.join(uploadDir, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        await new Promise<void>((resolve, reject) => {
          const writeStream = fs.createWriteStream(targetPath);
          part.file.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
        });

        fileCount++;
        if (!firstFilePath) {
          firstFilePath = targetPath;
          if (part.filename.toLowerCase().endsWith('.zip')) {
            isZip = true;
          }
        }
      }
    }

    if (fileCount === 0) {
      return reply.status(400).send({ error: 'Nenhum arquivo enviado.' });
    }

    if (fileCount === 1 && isZip) {
      return { inputPath: firstFilePath, inputType: 'zip' };
    } else if (fileCount === 1 && !isZip) {
      return { inputPath: firstFilePath, inputType: 'file' };
    } else {
      return { inputPath: uploadDir, inputType: 'folder' };
    }
  });

  // ---- Start analysis ----
  app.post<{ Body: { inputPath: string; inputType: 'file' | 'folder' | 'zip' } }>(
    '/api/analyze',
    async (request, reply) => {
      const { inputPath, inputType } = request.body;

      if (!inputPath || !inputType) {
        return reply.status(400).send({ error: 'inputPath e inputType sao obrigatorios' });
      }

      if (!fs.existsSync(inputPath)) {
        return reply.status(400).send({ error: `Caminho nao existe no disco: ${inputPath}` });
      }

      const jobId = generateJobId();
      const req: AnalysisRequest = { jobId, inputPath, inputType };

      enqueueJob(req, (msg) => {
        lastJobMessages.set(jobId, msg);

        // Broadcast to SSE clients watching this job
        const clients = sseClients.get(jobId);
        if (clients) {
          const payload = `data: ${JSON.stringify(msg)}\n\n`;
          for (const client of clients) {
            try { client.raw.write(payload); } catch { /* client disconnected */ }
          }
        }

        if (msg.type === 'done' && msg.data) {
          const result = msg.data as ResourceAnalysis;
          liveResults.set(jobId, result);
          saveAnalysis(result);
        }
      });

      return reply.status(202).send({ jobId });
    }
  );

  // ---- SSE progress stream ----
  app.get<{ Params: { jobId: string } }>(
    '/api/analyze/:jobId/stream',
    async (request, reply) => {
      const { jobId } = request.params;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      reply.raw.flushHeaders();

      // Immediately send last buffered message if available (prevents missing initial status)
      const lastMsg = lastJobMessages.get(jobId);
      if (lastMsg) {
        reply.raw.write(`data: ${JSON.stringify(lastMsg)}\n\n`);
        if (lastMsg.type === 'done' || lastMsg.type === 'error' || lastMsg.type === 'cancelled') {
          reply.raw.end();
          return;
        }
      }

      const done = liveResults.get(jobId);
      if (done) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'done', jobId, data: done })}\n\n`);
        reply.raw.end();
        return;
      }

      if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
      sseClients.get(jobId)!.add(reply);

      request.raw.on('close', () => {
        sseClients.get(jobId)?.delete(reply);
      });

      const ping = setInterval(() => {
        try { reply.raw.write(': ping\n\n'); } catch { clearInterval(ping); }
      }, 10_000);
    }
  );

  // ---- Polling Status Fallback ----
  app.get<{ Params: { jobId: string } }>(
    '/api/analyze/:jobId/status',
    async (request, reply) => {
      const { jobId } = request.params;
      const done = liveResults.get(jobId) ?? getAnalysis(jobId);
      if (done) return { status: 'done', data: done };

      const lastMsg = lastJobMessages.get(jobId);
      if (lastMsg) return { status: lastMsg.type, message: lastMsg };

      const job = getJob(jobId);
      if (job) return { status: job.status };

      return reply.status(404).send({ error: 'Job not found' });
    }
  );

  // ---- Cancel job ----
  app.post<{ Params: { jobId: string } }>(
    '/api/analyze/:jobId/cancel',
    async (request) => {
      const { jobId } = request.params;
      const cancelled = cancelJob(jobId);
      return { jobId, cancelled };
    }
  );

  // ---- Get single analysis ----
  app.get<{ Params: { id: string } }>(
    '/api/analyses/:id',
    async (request, reply) => {
      const result = liveResults.get(request.params.id) ?? getAnalysis(request.params.id);
      if (!result) return reply.status(404).send({ error: 'Analysis not found' });
      return result;
    }
  );

  // ---- List analyses ----
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/analyses',
    async (request) => {
      const limit = parseInt(request.query.limit ?? '50');
      const offset = parseInt(request.query.offset ?? '0');
      return listAnalyses(limit, offset);
    }
  );

  // ---- Delete analysis ----
  app.delete<{ Params: { id: string } }>(
    '/api/analyses/:id',
    async (request) => {
      deleteAnalysis(request.params.id);
      liveResults.delete(request.params.id);
      lastJobMessages.delete(request.params.id);
      return { deleted: true };
    }
  );

  // ---- Export report ----
  app.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/api/analyses/:id/export',
    async (request, reply) => {
      const result = liveResults.get(request.params.id) ?? getAnalysis(request.params.id);
      if (!result) return reply.status(404).send({ error: 'Not found' });

      const fmt = request.query.format ?? 'json';
      if (fmt === 'json') {
        reply.header('Content-Disposition', `attachment; filename="${result.name}-report.json"`);
        reply.header('Content-Type', 'application/json');
        return JSON.stringify(result, null, 2);
      }

      if (fmt === 'html') {
        reply.header('Content-Disposition', `attachment; filename="${result.name}-report.html"`);
        reply.header('Content-Type', 'text/html');
        return generateHtmlReport(result);
      }

      return reply.status(400).send({ error: 'Formato invalido. Use json ou html' });
    }
  );

  return app;
}

export async function startServer(port: number, dataDir: string) {
  const app = await buildServer(dataDir);
  await app.listen({ port, host: '127.0.0.1' });
  return app;
}

function generateHtmlReport(r: ResourceAnalysis): string {
  const loc = r.locationResult;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Five Map Locator — ${r.name}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 2rem; }
  h1 { color: #7c3aed; } h2 { color: #a78bfa; border-bottom: 1px solid #333; padding-bottom: .5rem; }
  .badge { display:inline-block; padding:.2rem .6rem; border-radius:4px; font-size:.85rem; }
  .confirmed { background:#14532d; color:#4ade80; }
  .estimated { background:#78350f; color:#fbbf24; }
  .unidentified { background:#3f1515; color:#f87171; }
  table { width:100%; border-collapse:collapse; margin: 1rem 0; }
  td, th { padding:.5rem; border:1px solid #333; font-size:.9rem; }
  th { background:#1f1f1f; color:#a78bfa; text-align:left; }
  .coord { font-family: monospace; color:#34d399; }
</style></head>
<body>
<h1>🗺 Five Map Locator Report</h1>
<p><strong>Resource:</strong> ${r.name}</p>
<p><strong>Analyzed:</strong> ${new Date(r.timestamp).toLocaleString()}</p>
<p><strong>Files:</strong> ${r.totalFiles} | <strong>Entities:</strong> ${r.totalEntities}</p>

<h2>Location Result</h2>
<p>Status: <span class="badge ${(loc?.status ?? 'unidentified').toLowerCase()}">${loc?.status ?? 'UNIDENTIFIED'}</span></p>
${loc?.primaryCoordinates ? `
<p>Coordinates: <span class="coord">X: ${loc.primaryCoordinates.x.toFixed(2)}, Y: ${loc.primaryCoordinates.y.toFixed(2)}, Z: ${loc.primaryCoordinates.z.toFixed(2)}</span></p>
<p>Region: <strong>${loc.primaryRegion?.name ?? 'Unknown'}</strong></p>
<p>Confidence: <strong>${(loc.confidence * 100).toFixed(1)}%</strong></p>
` : '<p>No coordinates identified.</p>'}

<h2>Evidence</h2>
<table><tr><th>Type</th><th>Description</th><th>Weight</th></tr>
${(loc?.evidence ?? []).map(e => `<tr><td>${e.type}</td><td>${e.description}</td><td>${(e.weight * 100).toFixed(0)}%</td></tr>`).join('')}
</table>
</body></html>`;
}
