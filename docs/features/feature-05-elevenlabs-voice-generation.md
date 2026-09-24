# Feature 5 — Multi-Provider Voice Generation (ElevenLabs + AI33 Pro)

## 1. Purpose

Extend the completed single-session workflow with automatic voice creation through either ElevenLabs or AI33 Pro so every included script scene has one matching, reviewable audio segment.

This feature extends Settings with separate ElevenLabs and AI33 Pro API keys and provider-specific defaults. The user chooses one voice provider for each workflow and may override that provider's defaults for the active session.

## 2. User Outcome

The user can configure both providers once, select ElevenLabs or AI33 Pro when starting a workflow, generate narration automatically for every script scene, review or regenerate individual segments, and receive numbered audio files aligned with the scene number used by the six corresponding MP4 alternatives and `script-segments.txt`.

## 3. Compatibility With Existing Features

This is an additive feature for the completed four-feature MVP.

- **Feature 1 — Settings and API Setup:** Extended to support four provider keys—Gemini, Pexels, ElevenLabs, and AI33 Pro—and provider-specific voice defaults. Gemini and Pexels behavior remains unchanged.
- **Feature 2 — Script Analysis and Scene Editing:** Supplies final scene `scriptText`. Voice state is invalidated only when an edit changes spoken text or scene structure.
- **Feature 3 — Pexels Video Search and Review:** Remains responsible for producing six ranked candidates per scene. Voice generation can run before or alongside clip review.
- **Feature 4 — Download and Export:** Remains responsible for downloading all six MP4 alternatives per scene and building the ZIP. Feature 5 adds one scene-level audio file and provider-neutral voice metadata.

Where the older documents list voice-over as excluded, this feature supersedes only that exclusion. It does not add a backend, database, saved jobs, final video rendering, audio/video synchronization, voice cloning, or project management.

## 4. Scope

### Included

- ElevenLabs and AI33 Pro API keys on `/settings`
- Masked key fields, show/hide controls, independent testing, and **Test All Keys** integration
- ElevenLabs subscription and character-usage information when returned by the API
- AI33 Pro account/credit information when returned by its documented API
- Loading available voices and text-to-speech-capable models
- Separate default settings for ElevenLabs and AI33 Pro
- Current-workflow voice-service selection and provider-specific overrides
- One text-to-speech request per included scene
- Automatic limited-concurrency batch generation
- Per-scene playback, measured duration, retry, and regeneration
- Scene-specific stale-audio handling
- In-memory audio blobs and object URLs
- Matching numbered MP3 files in the existing ZIP
- Selected-provider generation metadata in `manifest.csv`
- Cancellation, cleanup, and error feedback

### Excluded

- Backend proxy or server-side secret storage
- Database, IndexedDB, or persistent generated audio
- Voice cloning, voice design, or voice training
- Uploading custom voice samples
- Pronunciation-dictionary management
- Multiple voices within one scene
- Timeline creation or automatic synchronization of audio and video
- Combining scene audio into one master track
- Audio editing, trimming, normalization, noise removal, or mastering
- Captions, music, and sound effects
- Provider history or remote task management beyond what is required to retrieve the current generation
- Background jobs or recovery after refresh

## 5. User Flow

1. Open **Settings** and enter an ElevenLabs key, an AI33 Pro key, or both.
2. Test each configured voice-provider key independently.
3. On success, view available account usage/credits and load the provider's voices and models when supported.
4. Save a default voice service and separate defaults for each provider.
5. Start a workflow and select **ElevenLabs** or **AI33 Pro**.
6. The matching provider settings are prefilled; optionally change them for this workflow only.
7. Paste and analyze the script through Feature 2.
8. Approve the ordered scene text.
9. Start voice generation; the app automatically queues one request per included scene.
10. Review each generated segment in an audio player.
11. Retry failures or intentionally regenerate an unsatisfactory segment.
12. Search and review Pexels clips through Feature 3 before, during, or after voice review.
13. Generate the ZIP when every included scene has a current voice segment and six exportable videos.

Changing the selected voice service or any current provider setting after audio exists marks all generated segments stale and requires confirmation before regeneration because new requests can consume provider credits or characters.

## 6. Settings Page Extension

### 6.1 API connection

Add separate ElevenLabs and AI33 Pro provider rows using the existing Feature 1 pattern:

- Provider name
- Masked API-key field
- Show/hide control
- Provider-specific test button
- Inline connection status
- Available usage, quota, or credit information

Supported test states remain:

- **Not tested**
- **Testing**
- **Valid**
- **Invalid**
- **Quota exhausted**
- **Timed out**
- **Blocked or unavailable**

Editing either key resets only that provider's result and clears voices/models loaded with the previous value.

### 6.2 Key testing and usage

- Test the current field value, even when it has not been saved.
- Use a lightweight authenticated `GET https://api.elevenlabs.io/v1/user/subscription` request.
- Do not synthesize sample speech during key testing.
- On success, show **Valid** and display these returned fields when available:
  - Subscription tier
  - Characters used: `character_count`
  - Character allowance: `character_limit`
  - Remaining included characters: `max(character_limit - character_count, 0)`
  - Next reset: `next_character_count_reset_unix`, formatted as local date and time
- If usage-based overages are enabled, label the calculated remainder as **included characters remaining**, not a hard spending limit.
- If some usage fields are absent, keep the key valid and label only those details unavailable.
- Handle invalid credentials, quota or subscription problems, timeouts, CORS/network failures, and provider errors using the existing Feature 1 status model.

For AI33 Pro, validate the current key with the lightest documented authenticated health/account/credit request. Do not synthesize speech merely to test the key. Display returned credits or usage without estimating missing values. Because the public product page does not expose a stable API contract, endpoint paths, authentication headers, request fields, task polling, and CORS behavior must be verified against the user's current official AI33 Pro API documentation before implementation.

The combined **Test All Keys** action starts Gemini, Pexels, ElevenLabs, and AI33 Pro tests independently and displays each result as it completes.

### 6.3 Default voice-service settings

Add a **Default voice service** control with `ElevenLabs` and `AI33 Pro`. Also add separate, collapsible provider-default sections.

#### ElevenLabs defaults

| Setting | Control | Fallback |
| --- | --- | --- |
| Voice | Searchable select populated from `GET /v2/voices` | No hardcoded voice; selection required |
| Model | Select populated from `GET /v1/models`, filtered to text-to-speech capable models | `eleven_multilingual_v2` when available |
| Output format | MP3 select: 64, 96, 128, or 192 kbps at 44.1 kHz; label plan-restricted options | `mp3_44100_128` |
| Stability | Slider plus numeric value, 0–1 | `0.5` |
| Similarity boost | Slider plus numeric value, 0–1 | `0.75` |
| Style | Slider plus numeric value, 0–1 | `0` |
| Speed | Slider plus numeric value using the API-supported range | `1` |
| Speaker boost | Toggle | `true` |

Show the voice name in the interface, but store and submit the stable `voiceId`. Store the `modelId`, not its display label.

Only show models that the provider reports as capable of text-to-speech. If the saved voice or model is no longer returned, preserve the unavailable ID for explanation, do not silently substitute another selection, and require the user to choose a replacement.

#### AI33 Pro defaults

Persist only fields supported by the verified AI33 Pro API. At minimum, plan for:

| Setting | Control | Rule |
| --- | --- | --- |
| Voice | Searchable provider-loaded select | Stable voice ID required |
| Model/engine | Provider-loaded select when the API exposes it | No invented fallback |
| Output format | Provider-supported audio formats | Prefer MP3 when available |
| Speed | Numeric/slider control when supported | Hide when unsupported |
| Additional options | Generated from an explicit allowlist in the adapter | Never forward arbitrary UI values |

Provider-specific controls must be shown only when that provider is selected. Do not force ElevenLabs-only settings such as stability, similarity boost, style, or speaker boost onto AI33 Pro unless the verified AI33 Pro endpoint explicitly supports them.

### 6.4 Saving and migration

- Extend the saved-settings schema without changing the rule that only configuration belongs in `localStorage`.
- Migrate the existing `.settings.v2` data to `.settings.v3` while preserving Gemini, Pexels, ElevenLabs, video, and ElevenLabs-default values.
- Initialize `ai33ProApiKey` as empty, `defaultVoiceProvider` as `elevenlabs` for backward compatibility, and AI33 Pro defaults without inventing a voice or model.
- **Clear API Keys** now clears all four keys but does not reset video or voice defaults.
- Add **Reset Voice Defaults**, which does not clear any API key or video default.
- Editing saved defaults during an active workflow must not change that workflow's current settings.

## 7. Workflow Setup Extension

Add a collapsible **Voice settings** section to the existing script-and-job setup step.

It contains:

- Voice service: **ElevenLabs** or **AI33 Pro**
- The selected provider's voice, model/engine, output format, and supported tuning controls

Rules:

- Initialize the values once from saved defaults when a new workflow starts.
- Allow changes for the current workflow without writing them to Settings.
- Do not show or edit the API key on the Workspace page.
- Missing Gemini or Pexels keys continue to block only their existing operations.
- Only the selected provider's key and required settings are needed. Missing configuration for the unselected provider must not block the workflow.
- Switching providers after audio exists requires confirmation, invalidates all current audio, and loads the new provider's saved defaults without overwriting either defaults section.
- Show the total script character count as a planning estimate before generation. Explain that actual billing and credit behavior is controlled by the selected provider.

## 8. Voice Generation

Implement a provider-neutral adapter so orchestration, retry, cancellation, playback, stale-state handling, and export do not depend on one service.

```ts
type VoiceProvider = 'elevenlabs' | 'ai33pro';

interface VoiceProviderAdapter<TOptions> {
  testKey(apiKey: string, signal: AbortSignal): Promise<ProviderTestResult>;
  listVoices(apiKey: string, signal: AbortSignal): Promise<VoiceOption[]>;
  listModels?(apiKey: string, signal: AbortSignal): Promise<ModelOption[]>;
  generate(input: GenerateVoiceInput<TOptions>): Promise<GeneratedVoiceResult>;
}
```

### 8.1 ElevenLabs request

For every included scene, call:

```text
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format={selected_mp3_format}
```

Send the API key in the `xi-api-key` header and a JSON body shaped from current workflow settings:

```json
{
  "text": "Regular walking can improve balance and confidence.",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0,
    "speed": 1,
    "use_speaker_boost": true
  }
}
```

Use the complete normalized `scene.scriptText` as `text`. Do not paraphrase it, add labels, or include the scene number in the spoken content.

### 8.2 AI33 Pro request

- Use AI33 Pro's verified official text-to-speech endpoint and authentication scheme.
- Send the complete normalized `scene.scriptText` unchanged.
- Submit only options explicitly supported by the selected AI33 Pro voice/model.
- If generation is asynchronous, retain the returned task ID in memory, poll at a bounded interval, stop polling on completion, failure, or cancellation, and fetch the completed audio from the provider-returned location.
- Never expose the API key in URLs, logs, exported metadata, or error messages.
- Verify endpoint paths, request/response schemas, terminal task statuses, audio retrieval, credits, and browser CORS behavior during the technical proof of concept. Keep verified details inside `ai33Pro.ts`.

### 8.3 Continuity

When supported by the selected model and request size:

- Send the preceding scene's script as `previous_text`.
- Send the following scene's script as `next_text`.
- If readable from the response, retain the provider request ID for possible continuity during regeneration.
- Treat request IDs and continuity fields as optional enhancements. Their absence must not fail otherwise valid audio generation.

These fields apply only to a provider/model that explicitly supports them and must not be sent to AI33 Pro by assumption.

### 8.4 Batch behavior

- Queue all scenes automatically after the user starts voice generation.
- Use limited concurrency, initially two requests at a time.
- Update each scene independently as soon as its request completes.
- Do not regenerate successful segments when retrying failed ones.
- Allow cancellation through `AbortController`.
- Do not silently retry a billable generation request after an ambiguous network failure; let the user choose **Retry**.
- Before intentional **Regenerate**, show the scene character count and selected provider, then require confirmation because it can consume additional usage.

### 8.5 Response handling

- Require a successful HTTP response and a non-empty audio body.
- Validate an audio MIME type when the header is available.
- Store the result as an in-memory `Blob`.
- Create an object URL for playback.
- Load audio metadata in the browser to measure duration when possible.
- Revoke the previous object URL when a segment is replaced.
- Preserve other successful scene audio when one request fails.
- Normalize direct binary responses and asynchronous task downloads into one `GeneratedVoiceResult` shape.

## 9. Voice Review Interface

Each scene row or card shows:

- Final scene sequence
- Script text
- Character count
- Status
- Audio player when ready
- Measured duration when available
- Provider, voice, and model/engine summary
- **Retry** for a failed or cancelled segment
- **Regenerate** for a ready but unsatisfactory segment

Page-level information:

- Ready count, failed count, stale count, and total count
- Approximate characters queued for the initial batch
- Overall generation progress
- **Retry Failed**
- **Cancel Generation**
- Navigation to scene editing and clip review

The app must never claim that generation is free or that displayed included characters are a guaranteed billing cap.

## 10. Scene Change and Invalidation Rules

| Scene action | Voice result |
| --- | --- |
| Edit `scriptText` | Mark that scene's audio stale |
| Edit only visual description or Pexels query | Preserve audio |
| Split scene | Remove original audio; both new scenes need generation |
| Merge scenes | Remove source audio; merged scene needs generation |
| Delete scene | Abort its request and revoke/remove its audio |
| Reorder scene | Preserve audio; assign filenames from final order during export |
| Exclude scene | Preserve audio in memory for possible restore, but omit it from export |
| Restore excluded scene | Reuse its current audio when script text and voice settings are unchanged |
| Change provider or any active provider setting | Mark all scene audio stale |

Stale audio may remain temporarily available for comparison, but it cannot satisfy export validation and must be removed when the scene is regenerated, deleted, or the workflow is cleared.

## 11. State Model

```ts
type ElevenLabsOptions = {
  voiceId: string;
  modelId: string;
  outputFormat:
    | 'mp3_44100_64'
    | 'mp3_44100_96'
    | 'mp3_44100_128'
    | 'mp3_44100_192';
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  useSpeakerBoost: boolean;
};

type Ai33ProOptions = {
  voiceId: string;
  modelId?: string;
  outputFormat: string;
  speed?: number;
  supportedOptions: Record<string, string | number | boolean>;
};

type WorkflowVoiceOptions =
  | { provider: 'elevenlabs'; options: ElevenLabsOptions }
  | { provider: 'ai33pro'; options: Ai33ProOptions };

type VoiceSegmentState = {
  sceneId: string;
  status:
    | 'idle'
    | 'queued'
    | 'generating'
    | 'ready'
    | 'failed'
    | 'cancelled'
    | 'stale';
  sourceTextFingerprint: string;
  settingsFingerprint: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  provider: 'elevenlabs' | 'ai33pro';
  requestId: string | null;
  taskId: string | null;
  error: string | null;
};

type VoiceGenerationState = {
  selection: WorkflowVoiceOptions;
  bySceneId: Record<string, VoiceSegmentState>;
  isBatchRunning: boolean;
};
```

`VoiceGenerationState`, all blobs, object URLs, request/task IDs, errors, and progress remain only in the active Zustand workflow store. Only both voice-provider keys, `defaultVoiceProvider`, and the two provider-default objects are persisted as part of `SavedSettings`.

## 12. Export Extension

Feature 5 extends Feature 4 without changing its six-MP4-per-scene download logic.

### 12.1 Preconditions

Before ZIP generation, every included scene must have:

- Six valid Pexels candidates
- One usable MP4 variant for each candidate
- One `ready` voice segment whose text and settings fingerprints match the current scene and workflow settings

Excluded scenes need neither candidate clips nor exported audio.

### 12.2 Filenames

Use the final included-scene order and Feature 4's existing zero-padding rule:

| Sequence | Videos | Voice | Script line prefix |
| --- | --- | --- | --- |
| 1 | `001-A.mp4` … `001-F.mp4` | `001.mp3` | `001.` |
| 2 | `002-A.mp4` … `002-F.mp4` | `002.mp3` | `002.` |
| 3 | `003-A.mp4` … `003-F.mp4` | `003.mp3` | `003.` |

Keep the existing ZIP filename `youtube-video-clips.zip` for backward compatibility.

### 12.3 ZIP contents

```text
youtube-video-clips.zip
├── 001-A.mp4
├── ...
├── 001-F.mp4
├── 001.mp3
├── 002-A.mp4
├── ...
├── 002-F.mp4
├── 002.mp3
├── script-segments.txt
├── manifest.csv
└── credits.txt
```

`credits.txt` remains limited to Pexels attribution. Do not add API keys or unnecessary account information to any export file.

Extend `manifest.csv` with provider-neutral voice columns while preserving Feature 4's one-row-per-MP4 structure:

```text
voice_filename,voice_provider,voice_id,voice_model_id,audio_output_format,audio_duration_seconds
```

Each row represents one MP4 candidate, so the scene's same voice filename and voice metadata repeat across its six rows. This maps every alternative to the one narration segment for that scene.

## 13. Cleanup Rules

- Abort active provider requests and AI33 Pro polling when the user cancels, starts over, or deletes the corresponding scene.
- Revoke audio object URLs when replaced or no longer needed.
- Release voice blobs after ZIP generation when it is safe to do so, or on cancellation and **Start Over**.
- Clear all generated audio on refresh.
- Never write generated audio to `localStorage`, IndexedDB, a database, or an application-managed directory.
- The browser's final ZIP download is the only persistent audio output.

## 14. Error Handling

| Condition | Expected response |
| --- | --- |
| Missing selected-provider key | Direct the user to Settings; preserve all other workflow state |
| Missing or unavailable voice/model | Block generation and require a valid selection |
| Invalid key (`401` or `403`) | Show an actionable credential or permission message |
| Quota/subscription limit (`429` or provider-specific limit response) | Stop starting new requests, preserve completed audio, and show the provider message |
| Validation error (`422`) | Mark only the affected scene failed and explain which setting or text needs attention |
| Timeout | Mark the scene failed; do not automatically repeat a possibly billable request |
| Network or CORS failure | Preserve completed audio and explain that the browser request could not finish |
| Provider `5xx` | Preserve completed audio and allow manual retry |
| Empty or invalid audio body | Mark only that scene failed and allow retry |
| Duration cannot be measured | Keep valid audio ready and show duration unavailable |
| Scene becomes stale during generation | Discard and revoke the late response instead of attaching it to changed text |
| User cancels | Abort queued/active requests; keep previously completed segments unless starting over |
| AI33 Pro task remains pending too long | Stop polling at the configured timeout, preserve its task ID in memory for the current session, and offer a manual status retry |
| Browser memory pressure | Stop cleanly, release temporary data, and recommend fewer or shorter scenes |

## 15. Acceptance Criteria

1. The Settings page accepts, masks, saves, loads, clears, and independently tests ElevenLabs and AI33 Pro API keys.
2. **Test All Keys** includes Gemini, Pexels, ElevenLabs, and AI33 Pro without one failure cancelling the other tests.
3. A successful ElevenLabs test shows available subscription and character-usage fields without generating speech.
4. Available voices and text-to-speech models/engines load for the selected provider when supported.
5. The user can save a default provider and separate defaults for ElevenLabs and AI33 Pro.
6. Existing v2 settings migrate to v3 without losing Gemini, Pexels, ElevenLabs, video, or voice defaults.
7. A new workflow is initialized from the saved default provider and that provider's defaults.
8. Current-workflow voice changes do not overwrite saved defaults.
9. Starting generation automatically queues one request for every included scene.
10. Each request uses the scene's complete script text and the current workflow's settings.
11. Successful audio can be played and its duration is shown when measurable.
12. A failed segment can be retried without regenerating successful segments.
13. A ready segment can be intentionally regenerated after a usage warning.
14. Text edits, split, and merge operations invalidate only affected audio; query-only edits and reordering preserve it.
15. Changing provider or a current provider setting invalidates all generated scene audio.
16. ZIP generation is blocked when any included scene has missing, failed, cancelled, or stale audio.
17. Every included scene exports one numbered audio file shared by its six `A`–`F` MP4 alternatives and its numbered script line.
18. The manifest preserves one row per MP4 and adds the correct provider-neutral voice metadata to all six rows for that scene.
19. Excluded scenes produce no MP4, MP3, script line, or manifest row.
20. Cancellation, replacement, **Start Over**, and refresh clean up active requests, object URLs, and blobs as defined.
21. No generated audio, request state, or workflow data is persisted by the application.
22. Gemini analysis and six-candidate Pexels search/export continue to work with either voice provider.
23. Selecting ElevenLabs never requires an AI33 Pro key, and selecting AI33 Pro never requires an ElevenLabs key.

## 16. Implementation Tasks

- [ ] Extend and migrate the saved-settings schema from v2 to v3
- [ ] Add the AI33 Pro API-key field and independent test status to Settings
- [ ] Add default-provider selection and separate provider-default forms
- [ ] Implement subscription lookup and usage formatting
- [ ] Implement voice listing and searchable selection
- [ ] Implement model listing and text-to-speech capability filtering
- [ ] Build default voice-setting controls and validation
- [ ] Add current-workflow provider selection and provider-specific overrides
- [ ] Define the provider adapter and normalized request/result/state types
- [ ] Implement and verify the AI33 Pro adapter, including task polling when required
- [ ] Implement text-to-speech orchestration with limited concurrency and cancellation
- [ ] Add optional adjacent-text/request-ID continuity support
- [ ] Implement Blob validation, object URLs, playback, and duration measurement
- [ ] Build batch progress, per-scene status, retry, and confirmed regeneration
- [ ] Implement text/settings fingerprints and scene-change invalidation
- [ ] Extend final export validation
- [ ] Add aligned MP3 files to the existing JSZip build
- [ ] Extend `manifest.csv` without removing existing columns
- [ ] Implement cleanup for replacement, cancellation, start over, and refresh
- [ ] Add unit, integration, interaction, and end-to-end tests

## 17. Suggested Modules

```text
src/
├── components/settings/
│   ├── ElevenLabsDefaultsForm.tsx
│   ├── Ai33ProDefaultsForm.tsx
│   ├── VoiceProviderSelect.tsx
│   ├── ModelSelect.tsx
│   └── VoiceSelect.tsx
├── components/voice/
│   ├── VoiceGenerationPanel.tsx
│   └── VoiceSegmentCard.tsx
├── services/
│   ├── voiceProvider.ts
│   ├── elevenLabs.ts
│   └── ai33Pro.ts
├── utils/
│   ├── audio.ts
│   └── fingerprints.ts
└── types/
    └── voice.ts
```

Reuse Feature 1's generic API-key field and test-status components rather than creating a separate Settings pattern.

## 18. Test Plan

### Unit tests

- Saved-settings v2-to-v3 migration
- Provider selection and provider-specific validation
- ElevenLabs option ranges and fallback validation
- Subscription remaining-character calculation and reset formatting
- Model capability filtering
- Request-payload mapping
- AI33 Pro task-response normalization and polling-state transitions
- Text and settings fingerprints
- Scene-action invalidation matrix
- MP3 numbering and manifest extension

### Integration tests

- Valid, invalid, limited, timed-out, CORS-failed, and provider-failed key tests for both voice providers
- Voice and model loading with pagination or unavailable saved IDs
- Successful multi-scene text-to-speech batch
- AI33 Pro asynchronous task completion, failure, timeout, and cancellation when applicable
- Mixed success/failure batch and failed-only retry
- Cancellation without automatic resubmission
- Late response after scene text changes
- Browser audio metadata and cleanup behavior
- Export validation with ready, failed, missing, and stale audio

### End-to-end tests

- Existing settings migrate and a new workflow loads the saved provider and its defaults
- Provider switching invalidates existing audio and does not overwrite saved defaults
- Workflow overrides leave saved defaults unchanged
- Script analysis followed by automatic voice generation and playback
- One failed scene retried successfully
- One scene regenerated intentionally
- Scene text edited after generation and correctly blocked until regeneration
- Scene reordered without unnecessary regeneration
- Excluded scene omitted from every exported asset mapping
- Final ZIP contains six `A`–`F` MP4 files and one audio file per included scene with aligned text and manifest entries
- Start over and browser refresh remove all generated audio

## 19. Dependencies

- Feature 1 for Settings layout, storage helpers, and API-test status patterns
- Feature 2 for stable scene IDs, final script text, editing, and ordering
- Feature 3 for included/excluded scene state and six-candidate clip sets
- Feature 4 for final numbering, manifest generation, JSZip packaging, cancellation, and cleanup
- ElevenLabs browser access to subscription, voices, models, and text-to-speech endpoints
- Verified AI33 Pro browser access to account/credits, voices/models, generation, task status, and audio retrieval endpoints
- Browser support for Fetch, `AbortController`, `Blob`, object URLs, and audio metadata

## 20. Definition of Done

Feature 5 is complete when the user can save and test both voice-provider keys, select ElevenLabs or AI33 Pro for a workflow, configure and override provider-specific settings, automatically generate and review one current audio segment per included scene, and download a ZIP containing one numbered audio file plus six `A`–`F` MP4 alternatives for each numbered script segment without introducing a backend or persisting workflow data.
