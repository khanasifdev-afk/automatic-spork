import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadClipBlob,
  downloadClipsWithConcurrency,
  DownloadError,
} from './downloader';

describe('downloader service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadClipBlob', () => {
    it('successfully downloads a blob and tracks progress with ReadableStream', async () => {
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5]);

      let readStep = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (readStep === 0) {
            readStep++;
            return { done: false, value: chunk1 };
          }
          if (readStep === 1) {
            readStep++;
            return { done: false, value: chunk2 };
          }
          return { done: true, value: undefined };
        }),
      };

      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': '5',
          'content-type': 'video/mp4',
        }),
        body: {
          getReader: () => mockReader,
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

      const progressSpy = vi.fn();
      const controller = new AbortController();

      const blob = await downloadClipBlob('https://example.com/video.mp4', controller.signal, progressSpy);

      expect(blob).toBeDefined();
      expect(blob.size).toBe(5);
      expect(progressSpy).toHaveBeenCalledWith(3, 5);
      expect(progressSpy).toHaveBeenCalledWith(5, 5);
    });

    it('rejects with error when server responds with 404', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Headers(),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

      const controller = new AbortController();
      await expect(
        downloadClipBlob('https://example.com/missing.mp4', controller.signal)
      ).rejects.toThrow(DownloadError);
    });

    it('rejects when content-type is HTML error page', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/html; charset=utf-8',
        }),
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse as unknown as Response);

      const controller = new AbortController();
      await expect(
        downloadClipBlob('https://example.com/blocked.mp4', controller.signal)
      ).rejects.toThrow(DownloadError);
    });

    it('handles cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
        const error = new DOMException('The operation was aborted', 'AbortError');
        return Promise.reject(error);
      });

      await expect(
        downloadClipBlob('https://example.com/video.mp4', controller.signal)
      ).rejects.toMatchObject({ isAborted: true });
    });
  });

  describe('downloadClipsWithConcurrency', () => {
    it('downloads multiple clips and calls onClipComplete and onClipError', async () => {
      const mockBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });

      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('fail')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: new Headers(),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '3', 'content-type': 'video/mp4' }),
          body: {
            getReader: () => {
              let done = false;
              return {
                read: () => {
                  if (done) return Promise.resolve({ done: true, value: undefined });
                  done = true;
                  return Promise.resolve({ done: false, value: new Uint8Array([1, 2, 3]) });
                },
              };
            },
          },
          blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);
      });

      const tasks = [
        { sceneId: 's1', url: 'https://example.com/s1.mp4' },
        { sceneId: 's2', url: 'https://example.com/fail.mp4' },
        { sceneId: 's3', url: 'https://example.com/s3.mp4' },
      ];

      const completed = new Map<string, Blob>();
      const errors = new Map<string, string>();
      const controller = new AbortController();

      await downloadClipsWithConcurrency(
        tasks,
        2,
        controller.signal,
        () => {},
        (sceneId, blob) => completed.set(sceneId, blob),
        (sceneId, err) => errors.set(sceneId, err)
      );

      expect(completed.has('s1')).toBe(true);
      expect(errors.has('s2')).toBe(true);
      expect(completed.has('s3')).toBe(true);
    });
  });
});
