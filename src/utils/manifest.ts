/**
 * Utilities for generating manifest.csv and credits.txt.
 * Follows specifications in docs/features/feature-04-download-export.md.
 */

import { normalizeScriptText } from './filenames';
import { CandidateLabel } from '../types';

export interface ManifestEntry {
  sequence: number;
  candidateLabel: CandidateLabel;
  filename: string;
  scriptText: string;
  searchQuery: string;
  pexelsVideoId: number;
  sourceUrl: string;
  creator: string;
  creatorUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
  voiceFilename?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;
  audioOutputFormat?: string;
  audioDurationSeconds?: number | null;
}

/**
 * Escapes a single CSV field value according to RFC 4180 rules.
 * If the value contains commas, quotes, or newlines, it is enclosed in double quotes,
 * and any internal double quotes are escaped by doubling them ("").
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  const needsEscaping = str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (!needsEscaping) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates the contents of `manifest.csv`.
 * Header row:
 * scene_sequence,candidate_label,filename,script_text,search_query,pexels_video_id,source_url,creator,creator_url,duration_seconds,width,height,voice_filename,elevenlabs_voice_id,elevenlabs_model_id,audio_output_format,audio_duration_seconds
 */
export function generateManifestCsv(entries: ManifestEntry[]): string {
  const header = [
    'scene_sequence',
    'candidate_label',
    'filename',
    'script_text',
    'search_query',
    'pexels_video_id',
    'source_url',
    'creator',
    'creator_url',
    'duration_seconds',
    'width',
    'height',
    'voice_filename',
    'elevenlabs_voice_id',
    'elevenlabs_model_id',
    'audio_output_format',
    'audio_duration_seconds',
  ].join(',');

  const rows = entries.map((entry) => {
    const fields = [
      entry.sequence,
      entry.candidateLabel,
      entry.filename,
      normalizeScriptText(entry.scriptText),
      entry.searchQuery,
      entry.pexelsVideoId,
      entry.sourceUrl,
      entry.creator,
      entry.creatorUrl,
      entry.durationSeconds,
      entry.width,
      entry.height,
      entry.voiceFilename || '',
      entry.elevenLabsVoiceId || '',
      entry.elevenLabsModelId || '',
      entry.audioOutputFormat || '',
      entry.audioDurationSeconds !== undefined && entry.audioDurationSeconds !== null
        ? Number(entry.audioDurationSeconds.toFixed(2))
        : '',
    ];
    return fields.map(escapeCsvField).join(',');
  });

  return [header, ...rows].join('\n') + '\n';
}

export interface CreditsEntry {
  sequence: number;
  candidateLabel?: CandidateLabel;
  filename: string;
  creator: string;
  creatorUrl: string;
  sourceUrl: string;
}

/**
 * Generates the contents of `credits.txt`.
 * Requirements:
 * - Clear "Videos provided by Pexels" attribution
 * - One entry per exported clip with sequence number, candidate letter, creator name, profile link, and Pexels source link
 * - Never includes API keys, local paths, or temporary object URLs
 */
export function generateCreditsText(entries: CreditsEntry[]): string {
  const sections: string[] = [
    'Videos provided by Pexels (https://www.pexels.com)',
    '',
    'All video footage in this package is licensed under the Pexels License.',
    'For more information on the license terms, visit: https://www.pexels.com/license/',
    '',
    '----------------------------------------',
    'Clip Attributions',
    '----------------------------------------',
    '',
  ];

  entries.forEach((entry) => {
    const labelPart = entry.candidateLabel ? ` Option ${entry.candidateLabel}` : '';
    sections.push(`[${entry.filename}] (Scene #${entry.sequence}${labelPart})`);
    sections.push(`Creator: ${entry.creator}`);
    sections.push(`Creator Profile: ${entry.creatorUrl}`);
    sections.push(`Pexels Source: ${entry.sourceUrl}`);
    sections.push('');
  });

  return sections.join('\n');
}
