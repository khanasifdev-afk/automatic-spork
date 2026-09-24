# Feature 3 — Pexels Video Search and Review

## 1. Purpose

Find six relevant Pexels videos for every approved scene, display all six for review, and pass all six to export without requiring the user to select one.

## 2. User Outcome

The user receives six relevant stock-video clips for each scene, can preview the complete set, and exports every clip without making a per-scene selection.

## 3. Scope

### Included

- Direct browser requests to the Pexels Video API
- Search based on approved scene queries
- Orientation filtering
- Resolution and duration filtering
- Primary and fallback queries
- In-memory request cache
- Candidate normalization and deduplication
- Six exportable candidates per scene
- Automatic ranking and ordering
- Video previews
- Custom-query re-search
- Scene exclusion
- Search progress and retry states

### Excluded

- Additional stock providers
- AI-generated video
- Vision-based frame analysis
- Saved search history
- Persistent candidate-set data
- Video trimming, cropping, or upscaling

## 4. User Flow

1. Receive approved scenes and job options from Feature 2.
2. Select **Find Clips**.
3. Search each scene using its primary query.
4. Use fallback queries when the primary query has insufficient results.
5. Normalize, filter, deduplicate, and rank candidates.
6. Keep the six highest-ranked unique candidates per scene.
7. Display all six in rank order; do not preselect or ask the user to choose one.
8. Review every scene and optionally re-search or exclude it.
9. Continue to Feature 4 when every included scene has six exportable candidates.

## 5. Pexels Search Requirements

- Use the saved Pexels API key from Feature 1.
- Call the Pexels Video API (`https://api.pexels.com/videos/search`) directly from the browser using `fetch` with the `Authorization: {API_KEY}` header.
- Request enough results to produce six usable unique candidates. Start with `per_page=6`; fallback searches may request additional results when filtering or deduplication leaves fewer than six.
- Apply the job's requested orientation (`landscape` or `portrait`).
- Request video results only.
- Keep a small query cache for the current session.
- Cache by normalized query and relevant filters.
- Never persist the cache.

### Fallback behavior

- Search the primary query first.
- Use fallback queries only when the primary results are insufficient or unusable.
- Merge all returned candidates.
- Deduplicate by Pexels video ID.
- Filter and rank the combined list.
- Retain and display the best six candidates overall.
- Never export more than six candidates for a scene, even when multiple queries were used.
- If fewer than six usable candidates remain after all fallback queries, mark the scene **Incomplete** and allow a scene-specific retry or query edit. Do not silently duplicate a video to reach six.

## 6. Candidate Model

```ts
type ClipCandidate = {
  id: string;
  pexelsVideoId: number;
  sourceUrl: string;
  creatorName: string;
  creatorUrl: string;
  previewImageUrl: string;
  previewVideoUrl?: string;
  durationSeconds: number;
  width: number;
  height: number;
  files: ClipFileVariant[];
  matchedQuery: string;
  score: number;
  confidence: 'strong' | 'fair' | 'weak';
};

type ClipFileVariant = {
  url: string;
  mimeType: string;
  width: number;
  height: number;
  quality?: string;
  fileSize?: number;
};
```

Only normalized fields used by the interface, ranking, or export should be retained.

## 7. Filtering and Ranking

Apply hard filters before scoring:

- Valid Pexels video ID
- At least one usable MP4 file
- Correct orientation when available
- Non-zero duration
- Valid preview or poster URL

Rank remaining candidates using:

1. Query and metadata relevance
2. Orientation match
3. Resolution suitability
4. Duration suitability
5. Duplicate avoidance within and across scenes

### Duplicate handling

- Deduplicate candidates within a scene by Pexels video ID.
- Penalize a video already included for another scene when another reasonable result exists.
- Cross-scene reuse is allowed only when the available catalogue cannot provide six stronger unique results per scene.

### Confidence labels

- **Strong:** High relevance and good technical match
- **Fair:** Acceptable relevance with minor compromises
- **Weak:** Limited relevance or technical mismatch

Confidence is a helpful ranking label, not a guarantee of semantic accuracy.

## 8. Review Interface

Each scene card contains:

- Scene number
- Script text
- Visual description
- Current query
- Six ranked clip previews labelled **A** through **F**
- Creator and Pexels source link
- Duration
- Resolution
- Orientation
- Confidence label
- Export label (`A`–`F`) and rank for every candidate

Available actions:

- Play or pause preview
- Edit search query
- Search again
- Retry failed search
- Exclude scene
- Restore excluded scene

Page actions:

- **Confirm Clip Sets**
- **Generate ZIP**
- **Back to Scenes**
- **Start Over**

## 9. Candidate-Set Rules

- Sort the six candidates from strongest to weakest match and assign export labels `A` through `F` in that order.
- Store the ordered candidate IDs for each included scene; there is no `selectedCandidateId`.
- Re-searching one scene replaces only that scene's candidate set and does not clear other scenes.
- After re-search or ranking changes, recompute labels `A` through `F` from the new final order.
- Excluded scenes do not require candidates.
- Returning to Feature 2 preserves results for unchanged scenes.
- Material scene or query edits clear or mark that scene's prior candidate set as stale.

## 10. State Model

```ts
type SceneSearchState = {
  status: 'idle' | 'searching' | 'ready' | 'empty' | 'error';
  query: string;
  candidates: ClipCandidate[];
  error: string | null;
};

type VideoSelectionState = {
  bySceneId: Record<string, SceneSearchState>;
  excludedSceneIds: string[];
};
```

The state exists only for the active browser session inside the Zustand workflow store.

## 11. Error Handling

| Condition | Expected response |
| --- | --- |
| Missing Pexels key | Direct the user to Settings |
| Empty primary result | Try fallback queries, then show **No results** |
| Invalid key | Show an actionable credential message |
| `429` | Stop new searches and show the quota/rate-limit message |
| Provider `5xx` | Keep completed scenes and allow retry |
| Timeout | Mark only the affected scene and allow retry |
| Network or CORS failure | Explain that the browser could not complete the request |
| Preview cannot play | Show poster metadata; the candidate remains exportable only if it has a usable MP4 variant |
| No usable MP4 variant | Remove the candidate before ranking |
| Fewer than six usable candidates | Mark the scene incomplete and allow query editing or retry |

## 12. Acceptance Criteria

1. Every valid scene can be searched independently.
2. A ready included scene displays exactly six candidates.
3. Combined primary and fallback results are deduplicated and capped at six.
4. Results respect the requested orientation when Pexels provides matching media.
5. Candidates are ordered by rank and labelled `A` through `F`.
6. The user can preview all six; no candidate-selection control is shown.
7. The user can re-search one scene without affecting other scenes.
8. The user can exclude and restore a scene.
9. The same video is not duplicated within one scene and is avoided across scenes when reasonable alternatives exist.
10. Feature 4 cannot begin while an included scene has fewer than six valid exportable candidates.
11. Search results disappear after refresh.

## 13. Implementation Tasks

- [ ] Implement Pexels request and response normalization
- [ ] Add orientation and file-variant filtering
- [ ] Add primary and fallback query handling
- [ ] Add in-memory query caching
- [ ] Implement deduplication and six-result cap
- [ ] Implement ranking and confidence labels
- [ ] Build scene review and video preview cards
- [ ] Add `A`–`F` candidate labels and custom re-search
- [ ] Add scene exclusion and restoration
- [ ] Add per-scene loading, empty, error, and retry states
- [ ] Add unit, integration, and interaction tests

## 14. Dependencies

- Feature 1 for the Pexels key
- Feature 2 for approved scenes and job options
- Supplies six ordered Pexels candidates per included scene to Feature 4
