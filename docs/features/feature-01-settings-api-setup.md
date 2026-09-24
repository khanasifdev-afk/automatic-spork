# Feature 1 — Settings and API Setup

## 1. Purpose

Provide a dedicated Settings page where the user can save, test, and manage Gemini, Pexels, ElevenLabs, and AI33 Pro API keys and configure the default video and voice options used by each new workflow.

## 2. User Outcome

The user can configure the application once, verify each external service independently, choose a default voice provider, and start each workflow without re-entering the same information.

## 3. Scope

### Included

- Dedicated `/settings` route
- Gemini API key input
- Pexels API key input
- ElevenLabs API key input
- AI33 Pro API key input
- Masked key fields with show/hide controls
- Independent API-key testing
- Combined **Test All Keys** action
- Pexels request-limit information when available
- Link to Google AI Studio when Gemini usage cannot be retrieved
- Default output orientation
- Default preferred quality
- Default target scene length
- Default voice service: ElevenLabs or AI33 Pro
- Separate provider-specific default voice settings
- Saving and loading settings through `localStorage`
- Clearing API keys
- Resetting video defaults

### Excluded

- User accounts or authentication
- Server-side secret storage
- Encrypted browser storage
- Billing management
- Job, script, or search-result persistence
- Automatic synchronization across computers or browsers

## 4. Settings Page

### API connections section

Each provider row contains:

- Provider name
- Masked API-key field
- Show/hide control
- Test button
- Inline connection status
- Available quota or usage information

Supported test states:

- **Not tested**
- **Testing**
- **Valid**
- **Invalid**
- **Quota exhausted**
- **Timed out**
- **Blocked or unavailable**

Changing a tested key immediately resets its result to **Not tested**.

### Default video settings section

- Output orientation:
  - Landscape 16:9
  - Portrait 9:16
- Preferred quality:
  - 720p
  - 1080p
  - 4K when available
- Target scene length:
  - Short: 3–5 seconds
  - Standard: 5–8 seconds
  - Long: 8–12 seconds

Initial fallback defaults:

```ts
{
  defaultOrientation: 'landscape',
  defaultQuality: '1080p',
  defaultSceneLength: 'standard'
}
```

### Page actions

- **Test Gemini Key**
- **Test Pexels Key**
- **Test ElevenLabs Key**
- **Test AI33 Pro Key**
- **Test All Keys**
- **Save Settings**
- **Clear API Keys**
- **Reset Video Defaults**
- **Reset Voice Defaults**

Destructive actions require confirmation when they would replace or remove saved values.

## 5. Functional Requirements

### 5.1 Load settings

- Read settings when the application starts.
- Use a versioned storage key: `youtube-stock-video-generator.settings.v3`.
- Migrate `.settings.v1` and `.settings.v2` data without losing existing keys or defaults.
- Validate the parsed object before using it.
- Fall back to the initial defaults when data is missing, malformed, or unsupported.
- Never allow a storage parsing error to block the application.

### 5.2 Save settings

- Save API keys and default video/voice settings only after the user selects **Save Settings**.
- Use the current field values, including values that have not been tested.
- Show a short success message after saving.
- Keep active job settings unchanged if defaults are edited during a job.
- Do not store API-test results or timestamps.

### 5.3 Test Gemini key

- Test the current field value, even when it has not been saved.
- Use direct browser `fetch` to call the Google Generative Language REST API for `gemini-2.0-flash` (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={KEY}`) with a minimal prompt payload (or model get) to confirm authentication and model availability.
- Apply a short request timeout (e.g. 5–8 seconds) via `AbortController`.
- Report authentication, model-access, quota, timeout, network, CORS, and provider errors separately.
- Show remaining quota or billing information only if Google exposes it through the accessible response.
- Otherwise show: **Usage details are available in Google AI Studio** with a link.
- Never estimate a remaining Gemini balance.

### 5.4 Test Pexels key

- Test the current field value, even when it has not been saved.
- Use a lightweight one-result video request.
- Explain that the test consumes one Pexels request.
- On a successful response, read these headers when browser-accessible:
  - `X-Ratelimit-Limit`
  - `X-Ratelimit-Remaining`
  - `X-Ratelimit-Reset`
- Display the total monthly limit, remaining requests, and reset date and time.
- If the request succeeds but the headers cannot be read, show the key as valid and usage details as unavailable.

### 5.5 Test voice-provider keys

- Test ElevenLabs with its lightweight subscription/account request without generating speech.
- Test AI33 Pro with the lightest verified official authenticated health/account/credit request without generating speech.
- Load provider voices and models/engines only after valid authentication, when the provider API supports discovery.
- Display only usage or credit information actually returned by the provider; never estimate missing balances.
- Keep key validity separate from an unavailable saved voice or model.
- Verify AI33 Pro's current official endpoints, authentication headers, response shapes, and browser CORS behavior before implementation; keep those details in the AI33 Pro service adapter.

### 5.6 Test all keys

- Start the Gemini, Pexels, ElevenLabs, and AI33 Pro tests independently.
- Show each provider's result as soon as it completes.
- A failure for one provider must not cancel or replace the other result.
- Disable only the action currently being processed.

### 5.7 Clear and reset

- **Clear API Keys** removes all four saved keys and clears their fields.
- **Reset Video Defaults** restores only the initial video defaults.
- **Reset Voice Defaults** restores the provider-default configuration without clearing any API key or video default.
- Neither action clears the active job.
- The active job is not written back to settings automatically.

## 6. State Model

```ts
type SavedSettings = {
  geminiApiKey: string;
  pexelsApiKey: string;
  elevenLabsApiKey: string;
  ai33ProApiKey: string;
  defaultOrientation: 'landscape' | 'portrait';
  defaultQuality: '720p' | '1080p' | '4k';
  defaultSceneLength: 'short' | 'standard' | 'long';
  defaultVoiceProvider: 'elevenlabs' | 'ai33pro';
  defaultElevenLabs: ElevenLabsOptions;
  defaultAi33Pro: Ai33ProOptions;
};

type KeyTestStatus =
  | { state: 'not-tested' }
  | { state: 'testing' }
  | { state: 'valid'; message: string; usage?: UsageInfo }
  | { state: 'invalid'; message: string }
  | { state: 'quota-exhausted'; message: string }
  | { state: 'timeout'; message: string }
  | { state: 'unavailable'; message: string };

type UsageInfo = {
  limit?: number;
  remaining?: number;
  resetsAt?: string;
};
```

`SavedSettings` is persistent. `KeyTestStatus` and `UsageInfo` are temporary page state.

## 7. Suggested Modules

```text
src/
├── pages/SettingsPage.tsx
├── components/settings/
│   ├── ApiKeyField.tsx
│   ├── ApiTestStatus.tsx
│   ├── VideoDefaultsForm.tsx
│   ├── VoiceProviderSelect.tsx
│   ├── ElevenLabsDefaultsForm.tsx
│   └── Ai33ProDefaultsForm.tsx
├── services/
│   ├── gemini.ts
│   ├── pexels.ts
│   ├── elevenLabs.ts
│   └── ai33Pro.ts
├── storage/settingsStorage.ts
└── types/settings.ts
```

## 8. Error Handling

| Condition | Expected response |
| --- | --- |
| Empty key | Do not call the provider; show “Enter an API key first.” |
| `401` or `403` | Show **Invalid** and a provider-specific message |
| `429` | Show **Quota exhausted** or **Rate limit reached** |
| Timeout | Show **Timed out** and allow retry |
| Network or CORS failure | Show **Blocked or unavailable** |
| Provider `5xx` | Show a temporary provider error and allow retry |
| Missing Pexels headers | Keep status **Valid**; label usage unavailable |
| Invalid saved JSON | Ignore it and restore fallback defaults |

## 9. Acceptance Criteria

1. The Settings page is accessible at `/settings`.
2. The user can save all four API keys, all three video defaults, a default voice provider, and separate defaults for both voice providers.
3. Saved settings are restored after refresh.
4. No job or script data is written to `localStorage`.
5. The user can test a key before saving it.
6. Editing a tested key resets its test state.
7. Gemini testing reports key and model-access validity.
8. Gemini usage is never estimated when unavailable.
9. Pexels testing displays limit, remaining requests, and reset time when readable.
10. A valid Pexels key remains valid when usage headers are unavailable.
11. One provider's failed test does not block any other provider.
12. Clearing keys does not reset saved video defaults.
13. Resetting video defaults does not clear saved API keys.
14. The selected workflow voice provider is not blocked by a missing key for the unselected provider.
15. Existing v1/v2 settings migrate to v3 without losing saved values.

## 10. Implementation Tasks

- [ ] Add the Settings route and navigation link
- [ ] Define saved-settings types and fallback values
- [ ] Implement validated `localStorage` read/write helpers
- [ ] Build masked API-key fields
- [ ] Build default video-setting controls
- [ ] Implement Gemini key testing
- [ ] Implement Pexels key testing and header parsing
- [ ] Implement ElevenLabs key testing and provider-option loading
- [ ] Implement AI33 Pro key testing and provider-option loading
- [ ] Add default voice-provider and provider-specific settings controls
- [ ] Add v1/v2-to-v3 migration
- [ ] Implement combined key testing
- [ ] Add clear/reset confirmations
- [ ] Add status, timeout, and error handling
- [ ] Add unit and integration tests

## 11. Dependencies

- Required before Feature 2 can initialize new-job defaults
- Gemini browser API access
- Pexels browser API access
- ElevenLabs browser API access
- Verified AI33 Pro browser API access
- Browser access to Pexels rate-limit headers when supported
