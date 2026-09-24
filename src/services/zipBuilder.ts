/**
 * Browser-based ZIP archive generator using JSZip.
 * Assembles video files, script segments, manifest, and credits into youtube-video-clips.zip.
 * Follows specifications in docs/features/feature-04-download-export.md section 10.
 */

import JSZip from 'jszip';

export const EXPORT_ZIP_FILENAME = 'youtube-video-clips.zip';

export interface ZipVideoFile {
  filename: string;
  blob: Blob;
}

export interface ZipAudioFile {
  filename: string;
  blob: Blob;
}

export interface ZipPackageFiles {
  videos: ZipVideoFile[];
  voices?: ZipAudioFile[];
  scriptSegmentsText: string;
  manifestCsvText: string;
  creditsText: string;
}

export type ZipProgressCallback = (percent: number) => void;

/**
 * Builds the export ZIP package directly in browser memory.
 * Files are arranged flat at the root of the archive:
 * - 001.mp4, 002.mp4...
 * - 001.mp3, 002.mp3...
 * - script-segments.txt
 * - manifest.csv
 * - credits.txt
 */
export async function buildZipPackage(
  packageFiles: ZipPackageFiles,
  onProgress?: ZipProgressCallback
): Promise<Blob> {
  const zip = new JSZip();

  // Add video MP4 files
  for (const video of packageFiles.videos) {
    zip.file(video.filename, video.blob);
  }

  // Add voice MP3 files
  if (packageFiles.voices) {
    for (const voice of packageFiles.voices) {
      zip.file(voice.filename, voice.blob);
    }
  }

  // Add text files
  zip.file('script-segments.txt', packageFiles.scriptSegmentsText);
  zip.file('manifest.csv', packageFiles.manifestCsvText);
  zip.file('credits.txt', packageFiles.creditsText);

  // Generate archive
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 4 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    }
  );

  return zipBlob;
}

/**
 * Triggers a standard browser download using a temporary object URL and an anchor tag.
 */
export function triggerBrowserDownload(
  objectUrl: string,
  filename: string = EXPORT_ZIP_FILENAME
): void {
  if (typeof document === 'undefined') return;
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Safely releases a previously created object URL.
 */
export function revokeBlobUrl(url: string | null): void {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
