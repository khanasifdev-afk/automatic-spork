/**
 * Browser-based video downloading service.
 * Implements direct fetching, concurrency limiting, progress tracking, and cancellation.
 * Follows specifications in docs/features/feature-04-download-export.md section 8.
 */

export class DownloadError extends Error {
  isAborted?: boolean;
  isCorsOrNetwork?: boolean;
  status?: number;

  constructor(
    message: string,
    options?: { isAborted?: boolean; isCorsOrNetwork?: boolean; status?: number }
  ) {
    super(message);
    this.name = 'DownloadError';
    this.isAborted = options?.isAborted;
    this.isCorsOrNetwork = options?.isCorsOrNetwork;
    this.status = options?.status;
  }
}

export type DownloadProgressCallback = (receivedBytes: number, totalBytes?: number) => void;

/**
 * Downloads a single video file directly in the browser as a Blob.
 * Handles progress calculation when Content-Length is available.
 */
export async function downloadClipBlob(
  url: string,
  signal: AbortSignal,
  onProgress?: DownloadProgressCallback
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err: unknown) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DownloadError('Download was cancelled.', { isAborted: true });
    }
    throw new DownloadError(
      'Network or CORS failure downloading video file. The provider may restrict direct browser access.',
      { isCorsOrNetwork: true }
    );
  }

  if (!response.ok) {
    throw new DownloadError(`Failed to download video file. Server responded with status ${response.status}.`, {
      status: response.status,
    });
  }

  // Validate MIME type when supplied
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new DownloadError(
      `Unexpected content type "${contentType}" received instead of video file.`
    );
  }

  // Parse Content-Length if exposed
  const contentLengthHeader = response.headers.get('content-length');
  const totalBytes =
    contentLengthHeader && !isNaN(parseInt(contentLengthHeader, 10))
      ? parseInt(contentLengthHeader, 10)
      : undefined;

  // Stream chunks to track progress
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          if (onProgress) {
            onProgress(receivedBytes, totalBytes);
          }
        }
      }
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new DownloadError('Download was cancelled.', { isAborted: true });
      }
      throw err;
    }

    const mime = contentType.includes('video/') ? contentType : 'video/mp4';
    const blob = new Blob(chunks as BlobPart[], { type: mime });

    if (blob.size === 0) {
      throw new DownloadError('Downloaded video file is empty.');
    }

    return blob;
  }

  // Fallback for environments without ReadableStream reader
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new DownloadError('Downloaded video file is empty.');
  }
  if (onProgress) {
    onProgress(blob.size, blob.size);
  }
  return blob;
}

export interface ClipDownloadTask {
  sceneId: string;
  url: string;
  candidateLabel?: string;
  taskId?: string;
}

export interface DownloadTaskResult {
  sceneId: string;
  blob?: Blob;
  error?: string;
  cancelled?: boolean;
}

/**
 * Downloads multiple clips with a concurrency limit (default: 2-3).
 * Invokes per-clip progress and completion callbacks.
 */
export async function downloadClipsWithConcurrency(
  tasks: ClipDownloadTask[],
  concurrencyLimit: number,
  signal: AbortSignal,
  onClipProgress: (taskId: string, receivedBytes: number, totalBytes?: number) => void,
  onClipComplete: (taskId: string, blob: Blob) => void,
  onClipError: (taskId: string, error: string) => void
): Promise<void> {
  const limit = Math.max(1, concurrencyLimit);
  let currentIndex = 0;

  async function runWorker(): Promise<void> {
    while (currentIndex < tasks.length) {
      if (signal.aborted) {
        return;
      }
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      const key =
        task.taskId ||
        (task.candidateLabel ? `${task.sceneId}-${task.candidateLabel}` : task.sceneId);

      try {
        const blob = await downloadClipBlob(task.url, signal, (received, total) => {
          onClipProgress(key, received, total);
        });
        if (!signal.aborted) {
          onClipComplete(key, blob);
        }
      } catch (err: unknown) {
        if (signal.aborted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Download failed.';
        onClipError(key, message);
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(runWorker());
  }

  await Promise.all(workers);
}
