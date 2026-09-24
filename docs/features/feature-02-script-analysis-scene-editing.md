# Feature 2 — Script Analysis and Scene Editing

## 1. Purpose

Turn one pasted YouTube script into an editable, ordered list of visual scenes that can be used to search for stock footage.

## 2. User Outcome

The user can paste a script, adjust the current job's video options, let Gemini create visual segments, and correct the generated scenes before searching for clips.

## 3. Scope

### Included

- Script input
- Word and character counts
- Per-job orientation, quality, and scene-length settings
- Defaults loaded from Feature 1
- Gemini-based segmentation
- Visual description and search-query generation
- Structured-response validation
- Scene editing
- Scene splitting and merging
- Scene deletion and reordering
- Automatic renumbering
- Start-over confirmation

### Excluded

- Saving scripts or scenes
- Multiple jobs
- Job history or recovery
- Pexels searches
- Clip previews or candidate-set review
- Download and ZIP generation

## 4. User Flow

1. Open the Workspace page.
2. The app initializes job options from saved defaults.
3. Paste a script.
4. Optionally change orientation, quality, or target scene length for this job.
5. Select **Analyze Script**.
6. Gemini returns structured scenes.
7. Review and edit the scene list.
8. Select **Find Clips** to continue to Feature 3.

Changes to job options do not change the defaults saved in Settings.

## 5. Workspace — Script Step

### Inputs

- Script text area
- Live character count
- Live word count
- Output orientation
- Preferred quality
- Target scene length

### Actions

- **Analyze Script**
- **Clear Script**
- **Start Over**
- Link to Settings when the Gemini key is missing

### Validation

- Reject an empty or whitespace-only script.
- Apply a configurable initial maximum of 5,000 words.
- Show the current word count and maximum.
- Preserve the original pasted text in memory.
- Disable analysis while a request is active.

## 6. Gemini Segmentation

Gemini (`gemini-2.0-flash` called via direct browser REST `fetch`) divides the script by visual idea rather than by a fixed sentence count.

Each scene must contain:

```ts
type Scene = {
  id: string;
  sequence: number;
  scriptText: string;
  visualDescription: string;
  primaryQuery: string;
  fallbackQueries: string[];
  avoidTerms: string[];
  estimatedSeconds: number;
};
```

Example:

```json
{
  "id": "scene-1",
  "sequence": 1,
  "scriptText": "Regular walking can improve balance and confidence.",
  "visualDescription": "An active senior walking confidently in a sunny park",
  "primaryQuery": "active senior walking park",
  "fallbackQueries": [
    "older adult outdoor exercise",
    "senior fitness walking"
  ],
  "avoidTerms": ["wheelchair", "hospital"],
  "estimatedSeconds": 6
}
```

### Segmentation rules

- Preserve the complete script meaning and order.
- Prefer concrete visual ideas.
- Keep related sentences together when they need the same visual.
- Do not create segments containing only transitions such as “however.”
- Estimate duration using approximately 140–160 spoken words per minute.
- Aim for the selected scene-length range.
- Avoid rewriting the user's narration unnecessarily.
- Generate concise, visible-action Pexels queries.
- Generate one primary query and up to two fallback queries.

## 7. Response Validation

Before updating the UI:

- Confirm that the response is valid JSON.
- Confirm that it contains a non-empty array of scenes.
- Confirm that all required properties exist.
- Reject empty `scriptText`, `visualDescription`, or `primaryQuery` values.
- Normalize whitespace.
- Create client-side stable IDs when the response lacks them.
- Replace returned sequence values with the actual array order.
- Reject invalid or unreasonable duration values.

If validation fails, keep the original script and job options intact and show a retry action.

## 8. Scene Review Interface

Each scene card shows:

- Sequence number
- Script text
- Visual description
- Primary query
- Fallback queries
- Avoid terms
- Estimated duration

Available actions:

- Edit any text field
- Split scene
- Merge with previous scene
- Merge with next scene
- Delete scene
- Move up or down (accessible button-based reordering for MVP)

Page actions:

- **Find Clips**
- **Analyze Again**
- **Start Over**

## 9. Editing Rules

### Edit

- Save edits immediately to in-memory state.
- Prevent an empty script segment from being accepted.
- Mark related clip results stale if the scene was already searched.

### Split

- Let the user choose or edit the text placed in both resulting scenes.
- Create new stable IDs for both scenes.
- Copy the original job options.
- Clear any search results and candidate sets belonging to the original scene.

### Merge

- Join script text with a single space.
- Let the user revise the merged visual description and query.
- Create one new stable ID.
- Remove stale search results and candidate sets from the source scenes.

### Delete

- Confirm deletion when the scene already has search results or a candidate set.
- Remove all state belonging to that scene.

### Reorder

- Renumber every scene immediately after movement.
- Preserve scene identity and existing scene-specific state.
- Final export numbering follows this order.

## 10. State Model

```ts
type WorkflowOptions = {
  orientation: 'landscape' | 'portrait';
  quality: '720p' | '1080p' | '4k';
  sceneLength: 'short' | 'standard' | 'long';
};

type ScriptAnalysisState = {
  script: string;
  options: WorkflowOptions;
  scenes: Scene[];
  status: 'idle' | 'analyzing' | 'ready' | 'error';
  error: string | null;
};
```

All values remain in memory in the active Zustand workflow store. Refreshing the page clears them.

## 11. Error Handling

| Condition | Expected response |
| --- | --- |
| Missing Gemini key | Direct the user to Settings |
| Empty script | Show inline validation; do not call Gemini |
| Script over limit | Show the limit and block analysis |
| Invalid Gemini response | Preserve input and allow retry |
| Gemini `429` | Explain that the quota or rate limit was reached |
| Timeout | Preserve input and allow retry |
| Network or CORS failure | Explain that the browser request failed |
| User cancels | Abort the request and return to editable input |
| All scenes deleted | Disable **Find Clips** |

## 12. Acceptance Criteria

1. New job settings are initialized from saved defaults.
2. Changing job options does not change saved defaults.
3. Empty and oversized scripts cannot be submitted.
4. A valid script produces ordered, editable scenes.
5. Every scene contains script text, a visual description, a primary query, and an estimated duration.
6. Invalid Gemini responses do not replace the current script.
7. The user can edit, split, merge, delete, and reorder scenes.
8. Scene numbers update after structural changes.
9. Search results belonging to a materially changed scene are cleared or marked stale.
10. **Find Clips** is enabled only when at least one valid scene exists.
11. Refreshing the page removes the script and generated scenes.

## 13. Implementation Tasks

- [ ] Build script input and live counters
- [ ] Initialize job options from saved settings
- [ ] Add job-option override controls
- [ ] Define Gemini request and structured-response schema
- [ ] Implement Gemini request cancellation and timeout
- [ ] Validate and normalize Gemini responses
- [ ] Build the scene list and editable scene card
- [ ] Implement split, merge, delete, and reorder operations
- [ ] Implement renumbering and stale-result invalidation
- [ ] Add empty, loading, error, and retry states
- [ ] Add unit, integration, and interaction tests

## 14. Dependencies

- Feature 1 for saved settings and Gemini API key
- Supplies approved scenes and job options to Feature 3
