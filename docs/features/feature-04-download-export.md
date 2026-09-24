# Feature 4 — Download and Export

## 1. Purpose

Download all six Pexels clips for every included scene in the browser and generate one ordered ZIP containing scene-and-letter-numbered MP4 files, numbered script segments, source metadata, and credits.

## 2. User Outcome

The user receives six video alternatives per script scene. Every MP4 uses the scene number plus an `A`–`F` suffix, making the alternatives easy to compare during editing while preserving exact script alignment.

## 3. Scope

### Included

- Final candidate-set validation
- MP4 variant selection
- Browser-based video downloading
- Limited download concurrency
- Per-clip progress
- Cancellation and individual retry
- Scene-and-letter MP4 naming
- Numbered `script-segments.txt`
- `manifest.csv`
- `credits.txt`
- Browser-based ZIP generation
- Final ZIP download
- Memory cleanup

### Excluded

- Video trimming, cropping, transcoding, or upscaling
- Timeline or project-file generation
- Final video rendering
- Captions, music, or sound effects (voice files are added by Feature 5)
- Uploading to YouTube
- Saving generated packages inside the application
- Resume after refresh or application restart

## 4. Preconditions

- At least one scene is included.
- Every included scene has exactly six ordered Pexels candidates.
- Every candidate has at least one usable MP4 file variant.
- Final scene order is known.
- Job orientation and preferred quality are known.

Excluded scenes do not block export and receive no video or script-segment number.

## 5. User Flow

1. Select **Generate ZIP** from the clip-review screen.
2. Validate included scenes and six-candidate sets.
3. Assign final zero-padded scene numbers and candidate letters `A`–`F`.
4. Select the best MP4 file variant for each of the six clips.
5. Download all clips with limited concurrency.
6. Retry individual failed clips or cancel the operation.
7. Generate the text and metadata files.
8. Build the ZIP in browser memory.
9. Download the ZIP to the computer.
10. Release temporary blobs and object URLs.

## 6. Final Numbering

- Number only included scenes.
- Use the current final scene order.
- Do not leave gaps after excluded scenes.
- Determine padding from the included-scene count, with a minimum of three digits.
- Assign `A` through `F` from the final candidate rank within each scene.
- Use the scene number for the script and voice file. Use the scene number plus candidate letter for MP4 files.

Example:

| Scene | Video files | Script line |
| --- | --- | --- |
| First included scene | `001-A.mp4` … `001-F.mp4` | `001. First included script segment` |
| Second included scene | `002-A.mp4` … `002-F.mp4` | `002. Second included script segment` |
| Third included scene | `003-A.mp4` … `003-F.mp4` | `003. Third included script segment` |

## 7. MP4 Variant Selection

For each of the six Pexels candidates:

1. Keep valid MP4 variants only.
2. Prefer the requested orientation.
3. Choose the closest available resolution to the requested quality.
4. Prefer a lower resolution over a much larger file when both satisfy the requested quality.
5. Do not upscale or transform the file.
6. Fail that clip clearly when no usable variant exists.

The selected variant metadata must be used in `manifest.csv`.

## 8. Download Processing

- Fetch all candidate MP4 URLs directly in the browser.
- Validate successful HTTP status.
- Validate a non-empty response body.
- Validate the MIME type when supplied.
- Use limited concurrency, initially two or three downloads at a time, because total download count is six times the number of included scenes.
- Track progress per clip when the browser provides a readable content length.
- Show indeterminate progress when total size is unknown.
- Support `AbortController` cancellation.
- Allow an individual failed clip to be retried without repeating successful downloads.
- Keep successful blobs only until ZIP creation completes or the user cancels.

## 9. Export Files

### 9.1 MP4 files

```text
001-A.mp4
001-B.mp4
001-C.mp4
001-D.mp4
001-E.mp4
001-F.mp4
002-A.mp4
...
002-F.mp4
```

- The numeric prefix follows final included-scene order.
- The suffix `A`–`F` follows final candidate rank for that scene.
- Use no titles or user-provided text in MP4 filenames.
- Use lowercase `.mp4` extensions.

### 9.2 `script-segments.txt`

- Encode as UTF-8.
- Include every included script segment once, not once per video alternative.
- Use exactly one segment per line.
- Prefix each line with its matching zero-padded video number and a period.
- Replace internal line breaks and repeated whitespace with single spaces.
- Do not add a heading, blank lines, or excluded scenes.

Example:

```text
001. Regular walking can improve balance and confidence.
002. A balanced evening meal can support better sleep.
003. Small daily habits add up over time.
```

### 9.3 `manifest.csv`

Include one row per exported MP4 (six rows per included scene) with these columns:

```text
scene_sequence,candidate_label,filename,script_text,search_query,pexels_video_id,source_url,creator,creator_url,duration_seconds,width,height
```

Requirements:

- Use the same scene sequence, candidate label, and filename as the MP4.
- Escape commas, quotes, and line breaks using valid CSV rules.
- Normalize script line breaks before export.
- Include the query that produced each candidate.
- Use the actual downloaded variant's resolution.

### 9.4 `credits.txt`

Include:

- A clear “Videos provided by Pexels” attribution
- One entry per exported clip
- Scene number and candidate label
- Creator name and profile link
- Pexels source-video link

Do not include API keys, local paths, or temporary object URLs.

## 10. ZIP Structure

```text
youtube-video-clips.zip
├── 001-A.mp4
├── 001-B.mp4
├── ...
├── 001-F.mp4
├── 002-A.mp4
├── ...
├── 002-F.mp4
├── script-segments.txt
├── manifest.csv
└── credits.txt
```

The exported ZIP filename is strictly `youtube-video-clips.zip`.

## 11. Processing Interface

Show:

- Overall stage: validating, downloading, preparing files, compressing, complete, cancelled, or failed
- Overall progress
- Per-clip status
- Per-clip retry action
- **Cancel** action
- **Download ZIP** action when complete
- **Start Over** action after completion

The UI must not claim completion until all required files have been added successfully.

## 12. State Model

```ts
type ClipDownloadStatus = {
  sceneId: string;
  sequence: number;
  candidateLabel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  filename: string;
  state: 'pending' | 'downloading' | 'complete' | 'failed' | 'cancelled';
  receivedBytes?: number;
  totalBytes?: number;
  error?: string;
};

type ExportState = {
  stage:
    | 'idle'
    | 'validating'
    | 'downloading'
    | 'preparing-files'
    | 'compressing'
    | 'complete'
    | 'cancelled'
    | 'failed';
  clips: ClipDownloadStatus[];
  zipBlobUrl: string | null;
  error: string | null;
};
```

This state and all blobs remain in memory only (within the Zustand workflow store).

## 13. Cleanup Rules

- Revoke preview and ZIP object URLs when replaced or no longer needed.
- Release clip blobs after ZIP generation or cancellation.
- Abort active fetch requests when the user cancels or starts over.
- Clear export state on refresh.
- Do not write files to application-managed directories.
- The browser's normal file download is the only persistent output.

## 14. Error Handling

| Condition | Expected response |
| --- | --- |
| Included scene has fewer than six valid candidates | Block export and identify the scene |
| No valid MP4 variant | Fail only that clip and return to scene re-search or retry |
| Download `4xx` or expired URL | Refresh that scene's candidate set or retry after metadata refresh |
| Download `5xx` or timeout | Allow individual retry |
| Browser CORS failure | Explain that the video could not be fetched directly |
| Cancellation | Abort pending requests and release temporary data |
| ZIP generation failure | Keep downloaded blobs when safe and allow packaging retry |
| Browser memory pressure | Stop cleanly, release temporary data, and recommend fewer or smaller clips |

## 15. Acceptance Criteria

1. Export is blocked until every included scene has exactly six valid exportable candidates.
2. Excluded scenes do not receive numbers or export files.
3. Every included scene exports exactly six MP4 files labelled `A` through `F` with no missing or repeated suffix.
4. `script-segments.txt` contains exactly one numbered line per included scene.
5. Every script-line number matches the numeric prefix of all six corresponding MP4 filenames.
6. Internal line breaks do not create extra script lines.
7. `manifest.csv` contains one valid row per MP4 and therefore six rows per included scene.
8. `credits.txt` identifies Pexels and the creators of exported clips.
9. A failed clip can be retried without repeating successful downloads.
10. Cancelling stops active requests and removes temporary export data.
11. The completed ZIP contains all expected files and can be downloaded.
12. API keys never appear in exported files.
13. Refreshing the page removes the export state and generated ZIP from the app.

## 16. Implementation Tasks

- [ ] Validate six-candidate sets and assign scene numbers plus `A`–`F` labels
- [ ] Implement MP4 variant selection
- [ ] Implement limited-concurrency browser downloads
- [ ] Add progress, cancellation, and individual retry
- [ ] Implement MP4 filename generation
- [ ] Generate numbered `script-segments.txt`
- [ ] Generate escaped `manifest.csv`
- [ ] Generate `credits.txt`
- [ ] Build ZIP with JSZip or equivalent
- [ ] Trigger the browser download
- [ ] Release blobs and object URLs
- [ ] Add unit, integration, and end-to-end tests

## 17. Dependencies

- Feature 2 for final scene text and order
- Feature 3 for six ordered Pexels candidates per included scene and their file variants
- Browser support for Fetch, Blob, object URLs, and ZIP generation
