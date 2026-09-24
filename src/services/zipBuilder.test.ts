import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import JSZip from 'jszip';
import {
  buildZipPackage,
  EXPORT_ZIP_FILENAME,
  triggerBrowserDownload,
  revokeBlobUrl,
} from './zipBuilder';

describe('zipBuilder service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly builds a zip containing mp4 files, mp3 voice files, and text files', async () => {
    const videoBlob1 = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' });
    const videoBlob2 = new Blob([new Uint8Array([4, 5, 6])], { type: 'video/mp4' });
    const voiceBlob1 = new Blob([new Uint8Array([7, 8, 9])], { type: 'audio/mpeg' });
    const voiceBlob2 = new Blob([new Uint8Array([10, 11, 12])], { type: 'audio/mpeg' });

    const packageFiles = {
      videos: [
        { filename: '001.mp4', blob: videoBlob1 },
        { filename: '002.mp4', blob: videoBlob2 },
      ],
      voices: [
        { filename: '001.mp3', blob: voiceBlob1 },
        { filename: '002.mp3', blob: voiceBlob2 },
      ],
      scriptSegmentsText: '001. First segment\n002. Second segment\n',
      manifestCsvText: 'sequence,filename\n1,001.mp4\n2,002.mp4\n',
      creditsText: 'Videos provided by Pexels\n',
    };

    const progressSpy = vi.fn();
    const zipBlob = await buildZipPackage(packageFiles, progressSpy);

    expect(zipBlob).toBeDefined();
    expect(zipBlob.size).toBeGreaterThan(0);
    expect(EXPORT_ZIP_FILENAME).toBe('youtube-video-clips.zip');

    // Read back the zip to verify contents
    const unzipped = await JSZip.loadAsync(zipBlob);
    expect(unzipped.file('001.mp4')).not.toBeNull();
    expect(unzipped.file('002.mp4')).not.toBeNull();
    expect(unzipped.file('001.mp3')).not.toBeNull();
    expect(unzipped.file('002.mp3')).not.toBeNull();
    expect(unzipped.file('script-segments.txt')).not.toBeNull();
    expect(unzipped.file('manifest.csv')).not.toBeNull();
    expect(unzipped.file('credits.txt')).not.toBeNull();

    const scriptContent = await unzipped.file('script-segments.txt')?.async('string');
    expect(scriptContent).toBe('001. First segment\n002. Second segment\n');
  });

  it('triggers browser download using anchor element', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    triggerBrowserDownload('blob:http://localhost/test', 'youtube-video-clips.zip');

    expect(appendSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('safely revokes blob URLs', () => {
    const mockRevoke = vi.fn();
    globalThis.URL.revokeObjectURL = mockRevoke;

    revokeBlobUrl('blob:http://localhost/test');
    expect(mockRevoke).toHaveBeenCalledWith('blob:http://localhost/test');

    revokeBlobUrl(null);
    expect(mockRevoke).toHaveBeenCalledTimes(1);
  });
});
