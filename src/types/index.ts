/**
 * Core type definitions for YouTube Stock Video Generator.
 * These interfaces reflect the contracts established in docs/project-plan.md.
 */

export type OutputOrientation = 'landscape' | 'portrait';
export type VideoQuality = '720p' | '1080p' | '4k';
export type TargetSceneLength = '2.5s' | 'short' | 'standard' | 'long';

/**
 * Which type(s) of Pexels stock media to fetch per scene.
 * 'videos'  — only MP4 clips (original behaviour, 6 per scene)
 * 'images'  — only JPEG/PNG stills (up to 5 per scene per project-plan)
 * 'both'    — both videos and images
 */
export type StockMediaType = 'videos' | 'images' | 'both';

export type ElevenLabsOutputFormat =
  | 'mp3_44100_64'
  | 'mp3_44100_96'
  | 'mp3_44100_128'
  | 'mp3_44100_192';

export type ElevenLabsOptions = {
  voiceId: string;
  modelId: string;
  outputFormat: ElevenLabsOutputFormat;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  useSpeakerBoost: boolean;
};

export type VoiceProvider = 'elevenlabs' | 'ai33pro';

export type Ai33SourceProvider =
  | 'elevenlabs'
  | 'minimax'
  | 'clone'
  | 'edge'
  | 'kokoro'
  | 'vbee'
  | 'fishaudio';

export type Ai33ProOptions = {
  sourceProvider: Ai33SourceProvider;
  voiceId: string;
  speed: number;
};

export type SavedSettings = {
  geminiApiKey: string;
  pexelsApiKey: string;
  elevenLabsApiKey: string;
  ai33ProApiKey: string;
  defaultOrientation: OutputOrientation;
  defaultQuality: VideoQuality;
  defaultSceneLength: TargetSceneLength;
  defaultVoiceProvider: VoiceProvider;
  defaultElevenLabs: ElevenLabsOptions;
  defaultAi33Pro: Ai33ProOptions;
  /** Which Pexels media type(s) to fetch: videos, images, or both. Default: 'videos'. */
  defaultStockMediaType: StockMediaType;
};

export type KeyTestState =
  | 'not-tested'
  | 'testing'
  | 'valid'
  | 'invalid'
  | 'quota-exhausted'
  | 'timeout'
  | 'unavailable';

export type UsageInfo = {
  limit?: number;
  remaining?: number;
  resetsAt?: string;
  // ElevenLabs subscription metadata
  tier?: string;
  characterCount?: number;
  characterLimit?: number;
  remainingIncludedCharacters?: number;
  isOveragesEnabled?: boolean;
  // AI33 Pro metadata
  credits?: number;
};

export type KeyTestStatus = {
  state: KeyTestState;
  message?: string;
  usage?: UsageInfo;
};

export type Ai33Voice = {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  tags?: string[];
  preview_url?: string;
};

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
  preview_url?: string;
  labels?: Record<string, string>;
};

export type ElevenLabsModel = {
  model_id: string;
  name: string;
  can_do_text_to_speech?: boolean;
  can_be_finetuned?: boolean;
  description?: string;
};

export type VoiceSegmentStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'stale';

export type GeneratedVoiceResult = {
  audioBlob: Blob;
  durationSeconds: number | null;
  requestId?: string | null;
  taskId?: string | null;
  creditCost?: number | null;
};

export type GenerateSceneSpeechParams = {
  scriptText: string;
  voiceId: string;
  options: ElevenLabsOptions | Ai33ProOptions;
  apiKey: string;
  previousText?: string;
  nextText?: string;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

export type NormalizedVoice = {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  language?: string;
  gender?: string;
  tags?: string[];
  labels?: Record<string, string>;
};

export type NormalizedModel = {
  model_id: string;
  name: string;
  description?: string;
};

export type VoiceSegmentState = {
  sceneId: string;
  provider: VoiceProvider;
  status: VoiceSegmentStatus;
  sourceTextFingerprint: string;
  settingsFingerprint: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
  durationSeconds: number | null;
  requestId?: string | null;
  taskId?: string | null;
  creditCost?: number | null;
  error: string | null;
};

export type VoiceGenerationState = {
  options: ElevenLabsOptions;
  bySceneId: Record<string, VoiceSegmentState>;
  isBatchRunning: boolean;
};

export type WorkflowOptions = {
  orientation: OutputOrientation;
  quality: VideoQuality;
  sceneLength: TargetSceneLength;
  voiceProvider?: VoiceProvider;
  elevenLabs: ElevenLabsOptions;
  ai33Pro?: Ai33ProOptions;
  /** Which stock media Pexels should fetch for each scene. Defaults to 'videos'. */
  stockMediaType?: StockMediaType;
};

export type Scene = {
  id: string;
  sequence: number;
  scriptText: string;
  visualDescription: string;
  primaryQuery: string;
  fallbackQueries: string[];
  avoidTerms: string[];
  estimatedSeconds: number;
};

// ---------------------------------------------------------------------------
// Image candidate types (Pexels Photos API, capped at 5 per scene)
// ---------------------------------------------------------------------------

export type ImageCandidateLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export type ImageFileVariant = {
  url: string;
  width: number;
  height: number;
  label: 'original' | 'large2x' | 'large' | 'medium' | 'small';
};

export type ImageCandidate = {
  id: string;
  pexelsPhotoId: number;
  sourceUrl: string;
  creatorName: string;
  creatorUrl: string;
  previewImageUrl: string;
  width: number;
  height: number;
  files: ImageFileVariant[];
  matchedQuery: string;
  score: number;
  confidence: 'strong' | 'fair' | 'weak';
  candidateLabel?: ImageCandidateLabel;
};

export type ImageSearchState = {
  status: 'idle' | 'searching' | 'ready' | 'empty' | 'error';
  query: string;
  candidates: ImageCandidate[];
  error: string | null;
};

// ---------------------------------------------------------------------------
// Bulk workflow status
// ---------------------------------------------------------------------------

export type BulkWorkflowStage =
  | 'idle'
  | 'analyzing'
  | 'generating-voices'
  | 'searching-media'
  | 'packaging'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type BulkWorkflowStatus = {
  stage: BulkWorkflowStage;
  /** 0–100 overall progress percentage */
  progress: number;
  /** Human-readable status message */
  message: string;
  error: string | null;
};

export type ClipFileVariant = {
  url: string;
  mimeType: string;
  width: number;
  height: number;
  quality?: string;
  fileSize?: number;
};

export type CandidateLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type ClipCandidate = {
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
  candidateLabel?: CandidateLabel;
};

export type SceneSearchState = {
  status: 'idle' | 'searching' | 'ready' | 'empty' | 'error';
  query: string;
  candidates: ClipCandidate[];
  selectedCandidateId?: string | null;
  isFallbackToImage?: boolean;
  error: string | null;
};

export type ClipDownloadStatus = {
  sceneId: string;
  sequence: number;
  candidateLabel: CandidateLabel;
  filename: string;
  state: 'pending' | 'downloading' | 'complete' | 'failed' | 'cancelled';
  receivedBytes?: number;
  totalBytes?: number;
  error?: string;
};

export type ExportState = {
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

export type WorkflowStep = 'setup' | 'scenes' | 'voices' | 'clips' | 'packaging' | 'complete';

export type ScriptAnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'error';

export type ScriptAnalysisState = {
  script: string;
  options: WorkflowOptions;
  scenes: Scene[];
  status: ScriptAnalysisStatus;
  error: string | null;
};
