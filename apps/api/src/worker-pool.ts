// ============================================================
// Asynchronous Job Queue & Analysis Engine
// Manages concurrent analysis tasks with real progress streaming,
// cancellation support, and zero external script resolution issues.
// ============================================================

import type { AnalysisRequest, WorkerMessage, ResourceAnalysis } from '@five-map/shared';
import { analyzeResource } from '@five-map/parser';
import { locateResource } from '@five-map/locator';

export type JobCallback = (msg: WorkerMessage) => void;

interface Job {
  request: AnalysisRequest;
  cancelToken: { cancelled: boolean };
  callback: JobCallback;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  lastMessage?: WorkerMessage;
}

const MAX_CONCURRENT = 4;
const jobs = new Map<string, Job>();
const queue: string[] = [];
let runningCount = 0;

async function executeJob(job: Job) {
  const { request, cancelToken, callback } = job;
  const { jobId, inputPath, inputType } = request;

  job.status = 'running';
  runningCount++;

  try {
    const notify = (msg: WorkerMessage) => {
      job.lastMessage = msg;
      callback(msg);
    };

    notify({
      type: 'progress',
      jobId,
      data: {
        jobId,
        progress: 10,
        currentFile: 'Scanning resource files...',
        filesProcessed: 0,
        totalFiles: 0,
      },
    });

    const partial = await analyzeResource(
      inputPath,
      inputType,
      (processed, total, currentFile) => {
        const percent = total > 0 ? Math.min(90, Math.round((processed / total) * 90)) : 10;
        notify({
          type: 'progress',
          jobId,
          data: {
            jobId,
            progress: Math.max(10, percent),
            currentFile,
            filesProcessed: processed,
            totalFiles: total,
          },
        });
      },
      cancelToken,
      { skipGeometry: true }
    );

    if (cancelToken.cancelled) {
      job.status = 'cancelled';
      notify({ type: 'cancelled', jobId });
      return;
    }

    notify({
      type: 'progress',
      jobId,
      data: {
        jobId,
        progress: 92,
        currentFile: 'Pinpointing 3D world coordinates & matching GTA V regions...',
        filesProcessed: partial.totalFiles,
        totalFiles: partial.totalFiles,
      },
    });

    const locationResult = locateResource(partial);

    const fullResult: ResourceAnalysis = {
      ...partial,
      id: jobId,
      timestamp: Date.now(),
      locationResult,
      status: 'done',
      progress: 100,
    };

    job.status = 'done';
    notify({ type: 'done', jobId, data: fullResult });

  } catch (err) {
    job.status = 'error';
    const errorMsg = (err as Error).message || String(err);
    const msg: WorkerMessage = { type: 'error', jobId, data: errorMsg };
    job.lastMessage = msg;
    callback(msg);
  } finally {
    runningCount = Math.max(0, runningCount - 1);
    tryStartNext();
  }
}

function tryStartNext() {
  while (runningCount < MAX_CONCURRENT && queue.length > 0) {
    const jobId = queue.shift()!;
    const job = jobs.get(jobId);
    if (!job || job.status === 'cancelled') continue;
    executeJob(job);
  }
}

export function enqueueJob(request: AnalysisRequest, callback: JobCallback): void {
  const cancelToken = { cancelled: false };
  const job: Job = {
    request,
    cancelToken,
    callback,
    status: 'queued',
  };
  jobs.set(request.jobId, job);
  queue.push(request.jobId);
  tryStartNext();
}

export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;

  job.cancelToken.cancelled = true;
  job.status = 'cancelled';

  const qIdx = queue.indexOf(jobId);
  if (qIdx >= 0) queue.splice(qIdx, 1);

  return true;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}
