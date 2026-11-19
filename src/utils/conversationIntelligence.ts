import { IncidentRecord, TranscriptMessage } from '../types/responda';

export interface TurnPlaybackWindow {
  id: string;
  startSec: number;
  endSec: number;
}

export interface TalkRatioSummary {
  totalTurns: number;
  callerWords: number;
  aiWords: number;
  operatorWords: number;
  callerPct: number;
  aiPct: number;
  operatorPct: number;
  estimatedDurationSec: number;
  turnWindows: TurnPlaybackWindow[];
}

export interface IntakeCompletenessItem {
  key: string;
  label: string;
  captured: boolean;
  detail: string;
}

export interface IntakeCompletenessSummary {
  scorePct: number;
  capturedCount: number;
  totalChecks: number;
  items: IntakeCompletenessItem[];
}

export interface AiCallSummaryStructured {
  whatHappened: string;
  whereItHappened: string;
  peopleAffectedLabel: string;
  dangersAndInjuries: string;
  landmarks: string;
  missingInfo: string[];
  followUpQuestions: string[];
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function formatSecondsClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeTalkRatio(
  transcript: TranscriptMessage[]
): TalkRatioSummary {
  let callerWords = 0;
  let aiWords = 0;
  let operatorWords = 0;
  const turnWindows: TurnPlaybackWindow[] = [];
  let cursorSec = 0;

  for (const msg of transcript) {
    const words = Math.max(1, countWords(msg.text));
    if (msg.speaker === 'CALLER') callerWords += words;
    else if (msg.speaker === 'AI') aiWords += words;
    else operatorWords += words;

    // Estimated spoken duration (~2.3 words/sec + 1.5s turn pause) for simulated playback timeline
    const duration = Math.max(4, Math.round(words / 2.3) + 2);
    turnWindows.push({
      id: msg.id,
      startSec: cursorSec,
      endSec: cursorSec + duration,
    });
    cursorSec += duration;
  }

  const totalWords = callerWords + aiWords + operatorWords;
  if (totalWords === 0) {
    return {
      totalTurns: 0,
      callerWords: 0,
      aiWords: 0,
      operatorWords: 0,
      callerPct: 0,
      aiPct: 0,
      operatorPct: 0,
      estimatedDurationSec: 0,
      turnWindows: [],
    };
  }

  const callerPct = Math.round((callerWords / totalWords) * 100);
  const aiPct = Math.round((aiWords / totalWords) * 100);
  const operatorPct = Math.max(0, 100 - callerPct - aiPct);

  return {
    totalTurns: transcript.length,
    callerWords,
    aiWords,
    operatorWords,
    callerPct,
    aiPct,
    operatorPct,
    estimatedDurationSec: cursorSec,
    turnWindows,
  };
}

export function computeIntakeCompleteness(
  incident: IncidentRecord
): IntakeCompletenessSummary {
  const items: IntakeCompletenessItem[] = [
    {
      key: 'category',
      label: 'Emergency category',
      captured: Boolean(incident.category && incident.category !== 'Other urgent incident'),
      detail: incident.category,
    },
    {
      key: 'locationDescription',
      label: 'Location description',
      captured: Boolean(
        (incident.location.correctedDescription || incident.location.description || '').trim()
      ),
      detail:
        incident.location.correctedDescription ||
        incident.location.description ||
        'Missing location details',
    },
    {
      key: 'locationVerified',
      label: 'Operator-verified coordinates',
      captured:
        incident.location.verificationStatus === 'VERIFIED' &&
        typeof incident.location.lat === 'number' &&
        typeof incident.location.lng === 'number',
      detail:
        incident.location.verificationStatus === 'VERIFIED'
          ? 'Verified by human operator'
          : 'Awaiting human verification',
    },
    {
      key: 'landmark',
      label: 'Nearest Lagos landmark',
      captured: Boolean(incident.location.landmark && incident.location.landmark.trim()),
      detail: incident.location.landmark || 'Not yet recorded',
    },
    {
      key: 'peopleAffected',
      label: 'People affected count',
      captured: incident.peopleAffected !== null,
      detail:
        incident.peopleAffected !== null
          ? `${incident.peopleAffected} person(s)`
          : 'Unknown count',
    },
    {
      key: 'callerContact',
      label: 'Caller callback contact',
      captured: Boolean(incident.callerPhone && incident.callerPhone.trim()),
      detail: incident.callerPhone || 'No phone number recorded',
    },
    {
      key: 'operatorControl',
      label: 'Human operator review',
      captured: Boolean(incident.assignedOperator) || !incident.aiIntakeActive,
      detail: incident.assignedOperator
        ? `Assigned to ${incident.assignedOperator}`
        : 'Still awaiting operator takeover',
    },
  ];

  const capturedCount = items.filter((item) => item.captured).length;
  const totalChecks = items.length;
  const scorePct = Math.round((capturedCount / totalChecks) * 100);

  return {
    scorePct,
    capturedCount,
    totalChecks,
    items,
  };
}

export function generateFollowUpSuggestions(incident: IncidentRecord): string[] {
  const suggestions: string[] = [];

  if (incident.location.verificationStatus !== 'VERIFIED') {
    suggestions.push(
      `Confirm exact street, gate number, or nearby bus stop around ${incident.location.area || 'Lagos'} so the dispatch pin can be verified.`
    );
  }
  if (!incident.location.landmark) {
    suggestions.push(
      'Ask the caller for the closest well-known landmark, filling station, or junction.'
    );
  }
  if (incident.peopleAffected === null) {
    suggestions.push(
      'Confirm how many people are affected or injured and whether anyone is unconscious or trapped.'
    );
  }
  if (incident.immediateDanger) {
    suggestions.push(
      `Verify whether bystanders are clear of immediate hazards (${incident.dangerDetails || 'reported hazard'}) and check safe unit approach.`
    );
  }
  if (!incident.callerPhone) {
    suggestions.push(
      'Request a reliable callback phone number in case the line drops.'
    );
  }
  for (const flag of incident.missingInfoFlags) {
    const clean = flag.trim();
    if (clean) {
      suggestions.push(`Resolve flagged gap: ${clean}.`);
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Core intake fields are complete. Confirm unit access instructions or gate clearance for the responding crew.'
    );
  }

  return Array.from(new Set(suggestions)).slice(0, 5);
}

export function extractKeyTopics(incident: IncidentRecord): string[] {
  const topics: string[] = [incident.category];
  if (incident.location.area) topics.push(incident.location.area);
  if (incident.location.landmark) topics.push(incident.location.landmark);
  if (incident.immediateDanger) topics.push('Immediate danger');
  if (incident.peopleAffected !== null && incident.peopleAffected > 0) {
    topics.push(`${incident.peopleAffected} affected`);
  }
  for (const msg of incident.transcript) {
    if (msg.extractedTags) {
      for (const t of msg.extractedTags) {
        if (t.trim()) topics.push(t.trim());
      }
    }
  }
  return Array.from(new Set(topics)).slice(0, 10);
}

export function buildAiCallSummary(
  incident: IncidentRecord
): AiCallSummaryStructured {
  const baseWhere =
    incident.location.correctedDescription || incident.location.description;
  const area = incident.location.area?.trim();
  const hasAreaInText =
    Boolean(area) &&
    baseWhere.toLowerCase().includes(area!.toLowerCase());
  const whereItHappened =
    area && !hasAreaInText ? `${baseWhere} (${area}, Lagos)` : baseWhere;

  const missingInfo = [...incident.missingInfoFlags];
  if (
    incident.location.verificationStatus !== 'VERIFIED' &&
    !missingInfo.some((m) => m.toLowerCase().includes('location'))
  ) {
    missingInfo.push('Human verification of exact dispatch location');
  }
  if (incident.peopleAffected === null) {
    missingInfo.push('Confirmed number of people affected');
  }
  if (!incident.callerPhone) {
    missingInfo.push('Caller callback number');
  }

  return {
    whatHappened: incident.summary || incident.description,
    whereItHappened,
    peopleAffectedLabel:
      incident.peopleAffected !== null
        ? `${incident.peopleAffected} person(s) reported`
        : 'Not yet confirmed by caller',
    dangersAndInjuries: incident.immediateDanger
      ? incident.dangerDetails || 'Immediate danger reported at scene'
      : 'No active environmental or structural danger reported',
    landmarks: incident.location.landmark || 'No landmark confirmed yet',
    missingInfo: Array.from(new Set(missingInfo)),
    followUpQuestions: generateFollowUpSuggestions(incident),
  };
}
