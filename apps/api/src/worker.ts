// ============================================================
// Analysis Worker — runs in a Worker Thread
// Receives an AnalysisRequest, runs the full pipeline,
// posts progress + final result back via parentPort.
// ============================================================

import { workerData, parentPort } from 'worker_threads';
import type { AnalysisRequest, WorkerMessage, ResourceAnalysis } from '@five-map/shared';
import { generateJobId } from '@five-map/shared';
import { analyzeResource } from '@five-map/parser';
import { locateResource } from '@five-map/locator';

const request = workerData as AnalysisRequest;
const cancelToken = { cancelled: false };

function post(msg: WorkerMessage) {
  parentPort?.postMessage(msg);
}

async function run() {
  try {
    const partial = await analyzeResource(
      request.inputPath,
      request.inputType,
      (processed, total, currentFile) => {
        post({
          type: 'progress',
          jobId: request.jobId,
          data: {
            jobId: request.jobId,
            progress: total > 0 ? Math.round((processed / total) * 90) : 0,
            currentFile,
            filesProcessed: processed,
            totalFiles: total,
          },
        });
      },
      cancelToken
    );

    if (cancelToken.cancelled) {
      post({ type: 'cancelled', jobId: request.jobId });
      return;
    }

    // Run location engine
    post({ type: 'progress', jobId: request.jobId, data: {
      jobId: request.jobId, progress: 92, currentFile: 'Running location engine...', filesProcessed: 0, totalFiles: 0
    }});

    const locationResult = locateResource(partial);

    const full: ResourceAnalysis = {
      ...partial,
      id: request.jobId,
      timestamp: Date.now(),
      locationResult,
      status: cancelToken.cancelled ? 'cancelled' : 'done',
      progress: 100,
    };

    post({ type: 'done', jobId: request.jobId, data: full });
  } catch (e) {
    post({ type: 'error', jobId: request.jobId, data: (e as Error).message });
  }
}

// Allow parent to cancel
parentPort?.on('message', (msg: any) => {
  if (msg?.type === 'cancel') {
    cancelToken.cancelled = true;
  }
});

run();
