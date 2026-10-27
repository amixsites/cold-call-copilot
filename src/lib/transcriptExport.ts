import { LiveTranscriptSegment } from '../types';
import { formatDuration } from './dateUtils';

export interface TranscriptExportOptions {
  callId: string;
  companyName: string;
  contactName?: string;
  callDate?: string;
  durationSeconds?: number;
  segments: LiveTranscriptSegment[];
  notes?: string;
  outcome?: string;
}

/**
 * Format a timestamp into [HH:MM:SS] display string
 */
function formatSegmentTime(isoOrTimestampStr?: string): string {
  if (!isoOrTimestampStr) return '00:00:00';
  try {
    const d = new Date(isoOrTimestampStr);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }
  } catch (_) {}

  // Fallback: if already in HH:MM:SS format
  if (/^\d{2}:\d{2}:\d{2}$/.test(isoOrTimestampStr)) {
    return isoOrTimestampStr;
  }
  return '00:00:00';
}

/**
 * Format speaker label to title-case (Agent / Prospect)
 */
function formatSpeakerLabel(speaker?: string): string {
  if (!speaker) return 'Agent';
  const lower = speaker.toLowerCase().trim();
  if (lower === 'prospect') return 'Prospect';
  if (lower === 'agent' || lower === 'rep' || lower === 'user') return 'Agent';
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
}

/**
 * Sanitize filename to be filesystem-safe across all operating systems
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate formatted plain text for call transcript download
 */
export function generateTranscriptText(options: TranscriptExportOptions): string {
  const {
    callId,
    companyName,
    contactName,
    callDate,
    durationSeconds,
    segments,
    notes,
    outcome,
  } = options;

  const prospectDisplay = contactName
    ? `${companyName} (${contactName})`
    : companyName;

  const dateDisplay = callDate
    ? new Date(callDate).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : new Date().toLocaleString();

  const durationDisplay = durationSeconds !== undefined
    ? formatDuration(durationSeconds)
    : undefined;

  let text = `Cold Call Copilot — Call Transcript\n\n`;
  text += `Prospect: ${prospectDisplay}\n`;
  text += `Call ID: ${callId}\n`;
  text += `Call Date: ${dateDisplay}\n`;
  if (durationDisplay) {
    text += `Duration: ${durationDisplay}\n`;
  }

  text += `\n----------------------------------------\n\n`;

  // Sort segments chronologically
  const sortedSegments = [...segments].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  if (sortedSegments.length === 0) {
    text += `(No transcript segments recorded)\n`;
  } else {
    for (const seg of sortedSegments) {
      const timeStr = formatSegmentTime(seg.timestamp || seg.createdAt);
      const speaker = formatSpeakerLabel(seg.speaker);
      text += `[${timeStr}] ${speaker}: ${seg.text.trim()}\n\n`;
    }
  }

  text += `----------------------------------------\n\n`;

  if (notes && notes.trim().length > 0) {
    text += `Call Notes:\n${notes.trim()}\n\n`;
  }

  if (outcome && outcome.trim().length > 0) {
    text += `Call Outcome:\n${outcome.trim()}\n\n`;
  }

  return text;
}

/**
 * Trigger download of plain-text transcript file in desktop/mobile browser
 */
export function downloadTranscriptAsTxt(options: TranscriptExportOptions): { success: boolean; message?: string } {
  if (!options.segments || options.segments.length === 0) {
    return {
      success: false,
      message: 'No transcript recorded yet to download. Start listening or speaking to record a transcript first.',
    };
  }

  const fileContent = generateTranscriptText(options);
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });

  // Format date component: YYYY-MM-DD
  const dateObj = options.callDate ? new Date(options.callDate) : new Date();
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const sanitizedCompany = sanitizeFilename(options.companyName || 'Unknown-Prospect') || 'Prospect';
  const filename = `cold-call-transcript-${sanitizedCompany}-${dateStr}.txt`;

  // Browser download trigger
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);

  return { success: true };
}
