import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { IntakeExtraction, TranscriptMessage } from '../../src/types/responda.ts';
import { normalizeIntakeExtraction } from '../../src/utils/intakeParser.ts';

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return getGeminiClient() !== null;
}

const INTAKE_SYSTEM_INSTRUCTION = `You are Responda's automated medical emergency intake assistant for private emergency-medical coordination in Lagos, Nigeria.

CRITICAL SAFETY & OPERATIONAL RULES:
1. Introduce yourself calmly, briefly, and clearly as Responda's automated medical intake assistant on the first turn.
2. Ask ONLY 1 concise, relevant next follow-up question based on what is still missing. Never overwhelm a distressed caller with a multi-question list.
3. Progressively collect:
   - What happened?
   - Where is the incident (street, estate, building, landmark, Lagos area)?
   - Medical emergency category (strictly one of: Medical, Road accident, Other medical emergency)
   - Is anyone injured, unconscious, having trouble breathing, bleeding, or in immediate danger?
   - How many people are affected?
   - Caller's name and callback number (optional, if willing/able)
4. Priority assessment rules:
   - Use 'Critical' for life-threatening collapse, severe bleeding, unconsciousness, respiratory arrest, or major road trauma.
   - Use 'Urgent' for serious acute symptoms or painful injuries without immediate life threat.
   - Use 'Standard' only when clinical facts confirm low-acuity stable condition.
   - Use 'Unassessed' whenever caller details are too incomplete or unclear to judge clinical severity. NEVER guess Standard when assessment facts are missing.
5. NEVER diagnose medical conditions or give medical prescriptions.
6. NEVER promise an ambulance, guarantee a response time, or claim emergency units have been dispatched. Say that human Operations Staff will review the report immediately.
7. Flag uncertainty explicitly in uncertainties/missingInfoFlags instead of inventing facts or coordinates.
8. If immediate danger, severe symptoms, or insufficient info ('Unassessed') is detected, set needsImmediateHumanAttention=true.`;

export async function runGeminiIntakeTurn(params: {
  history: TranscriptMessage[];
  latestMessage: string;
  hasGps?: boolean;
}): Promise<{
  ok: boolean;
  configured: boolean;
  extraction?: IntakeExtraction;
  error?: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      ok: false,
      configured: false,
      error:
        'GEMINI_API_KEY is not configured in the server environment. Set GEMINI_API_KEY in Secrets to enable live Gemini AI intake, or use the Simulated Demo Intake mode.',
    };
  }

  const conversationText = [
    ...params.history.map((m) => `${m.speaker}: ${m.text}`),
    `CALLER: ${params.latestMessage}`,
  ].join('\n');

  const prompt = `Conversation so far:
${conversationText}

Caller GPS attached: ${params.hasGps ? 'Yes (unverified browser GPS coordinates attached)' : 'No'}

Analyse the caller's latest report, extract structured medical incident fields, identify missing critical info, and write a calm, brief response asking the single most useful next question (or confirming the report is queued for Operations Staff review).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: INTAKE_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            category: {
              type: Type.STRING,
              description: 'One of: Medical, Road accident, Other medical emergency',
            },
            suggestedPriority: {
              type: Type.STRING,
              description: 'One of: Critical, Urgent, Standard, Unassessed',
            },
            priorityReason: { type: Type.STRING },
            summary: { type: Type.STRING },
            description: { type: Type.STRING },
            peopleAffected: { type: Type.INTEGER, nullable: true },
            immediateDanger: { type: Type.BOOLEAN },
            dangerDetails: { type: Type.STRING, nullable: true },
            locationDescription: { type: Type.STRING, nullable: true },
            landmark: { type: Type.STRING, nullable: true },
            area: { type: Type.STRING, nullable: true },
            callerName: { type: Type.STRING, nullable: true },
            callerPhone: { type: Type.STRING, nullable: true },
            missingInfoFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            readyForIncidentCreation: { type: Type.BOOLEAN },
            needsImmediateHumanAttention: { type: Type.BOOLEAN },
            uncertainties: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'reply',
            'category',
            'suggestedPriority',
            'priorityReason',
            'summary',
            'description',
            'immediateDanger',
            'missingInfoFlags',
            'readyForIncidentCreation',
            'needsImmediateHumanAttention',
            'uncertainties',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as Partial<IntakeExtraction>;
    return {
      ok: true,
      configured: true,
      extraction: normalizeIntakeExtraction(parsed),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini API request failed';
    return {
      ok: false,
      configured: true,
      error: `Gemini intake error: ${msg}`,
    };
  }
}

/**
 * Explicit offline/demo simulation intake engine used ONLY when user activates
 * "Simulated Intake Mode" or when GEMINI_API_KEY is absent and user chooses demo mode.
 */
export function runSimulatedDemoIntakeTurn(params: {
  history: TranscriptMessage[];
  latestMessage: string;
}): IntakeExtraction {
  const fullText = [...params.history.map((h) => h.text), params.latestMessage].join(' ');
  const lower = fullText.toLowerCase();

  let category: IntakeExtraction['category'] = 'Other medical emergency';
  if (
    lower.includes('accident') ||
    lower.includes('crash') ||
    lower.includes('collision') ||
    lower.includes('car') ||
    lower.includes('bus')
  ) {
    category = 'Road accident';
  } else if (
    lower.includes('bleed') ||
    lower.includes('breath') ||
    lower.includes('pain') ||
    lower.includes('unconscious') ||
    lower.includes('medical') ||
    lower.includes('collapse') ||
    lower.includes('chest') ||
    lower.includes('injur') ||
    lower.includes('seizure')
  ) {
    category = 'Medical';
  }

  const criticalSignals =
    lower.includes('unconscious') ||
    lower.includes('not breathing') ||
    lower.includes('bleed') ||
    lower.includes('chest') ||
    lower.includes('collapse') ||
    lower.includes('crash') ||
    lower.includes('trapped');

  const urgentSignals =
    lower.includes('injur') ||
    lower.includes('pain') ||
    lower.includes('breath') ||
    lower.includes('fracture') ||
    lower.includes('fell');

  const immediateDanger = criticalSignals || lower.includes('fuel') || lower.includes('danger');

  let peopleAffected: number | null = null;
  if (lower.includes('two') || /\b2\b/.test(lower)) peopleAffected = 2;
  else if (lower.includes('three') || /\b3\b/.test(lower)) peopleAffected = 3;
  else if (lower.includes('one') || /\b1\b/.test(lower)) peopleAffected = 1;

  const areas = [
    'Yaba',
    'Ikeja',
    'Surulere',
    'Lekki',
    'Victoria Island',
    'Ikoyi',
    'Ajah',
    'Maryland',
    'Apapa',
  ];
  const detectedArea = areas.find((a) => lower.includes(a.toLowerCase()));
  const hasLandmark =
    lower.includes('unilag') ||
    lower.includes('sabo') ||
    lower.includes('herbert macaulay') ||
    lower.includes('allen') ||
    lower.includes('admiralty') ||
    lower.includes('bode thomas') ||
    lower.includes('junction') ||
    lower.includes('gate') ||
    lower.includes('street') ||
    lower.includes('road');

  const missingInfoFlags: string[] = [];
  if (!detectedArea && !hasLandmark) {
    missingInfoFlags.push('Location / nearest landmark in Lagos');
  } else if (!hasLandmark) {
    missingInfoFlags.push('Exact street or nearest landmark');
  }
  if (!criticalSignals && !urgentSignals && !lower.includes('stable') && !lower.includes('minor')) {
    missingInfoFlags.push('Clinical symptoms & consciousness check');
  }
  if (peopleAffected === null) {
    missingInfoFlags.push('Number of people affected');
  }

  let suggestedPriority: IntakeExtraction['suggestedPriority'] = 'Unassessed';
  let priorityReason =
    'Insufficient clinical information captured so far; flagged Unassessed for operator triage.';

  if (criticalSignals) {
    suggestedPriority = 'Critical';
    priorityReason =
      'Critical clinical indicators (unconsciousness, bleeding, chest distress, or major collision) detected.';
  } else if (urgentSignals) {
    suggestedPriority = 'Urgent';
    priorityReason =
      'Acute pain or injury reported; pending human operator verification.';
  } else if (lower.includes('minor') || lower.includes('stable')) {
    suggestedPriority = 'Standard';
    priorityReason = 'Stable or minor non-critical complaint reported by caller.';
  }

  const callerTurns = params.history.filter((m) => m.speaker === 'CALLER').length + 1;
  let reply = '';
  if (!detectedArea && !hasLandmark) {
    reply =
      'This is Responda automated medical intake (Simulated Mode). Please share your location or the nearest landmark in Lagos, and tell me if the patient is conscious and breathing.';
  } else if (!criticalSignals && !urgentSignals && !lower.includes('minor')) {
    reply =
      'Thank you. Is the patient conscious and breathing normally, and how many people need medical help?';
  } else if (peopleAffected === null) {
    reply =
      'Understood. How many people are affected or injured so Operations Staff can assess this immediately?';
  } else {
    reply =
      'Thank you. I have recorded these medical details and queued the report for immediate human operator review—no unit is dispatched until an operator confirms.';
  }

  return normalizeIntakeExtraction({
    reply,
    category,
    suggestedPriority,
    priorityReason,
    summary: `${category} reported${detectedArea ? ` in ${detectedArea}` : ''}${
      peopleAffected !== null ? ` (${peopleAffected} affected)` : ''
    }. [Simulated Demo Intake]`,
    description: fullText.trim(),
    peopleAffected,
    immediateDanger,
    dangerDetails: immediateDanger ? 'Active clinical danger or hazard reported by caller.' : undefined,
    locationDescription: hasLandmark || detectedArea ? params.latestMessage : undefined,
    landmark: lower.includes('unilag')
      ? 'UNILAG Gate'
      : lower.includes('sabo')
      ? 'Sabo Junction'
      : undefined,
    area: detectedArea,
    missingInfoFlags,
    readyForIncidentCreation: Boolean(detectedArea || hasLandmark || callerTurns >= 2),
    needsImmediateHumanAttention: immediateDanger || suggestedPriority === 'Unassessed',
    uncertainties: !hasLandmark ? ['Exact street address not yet confirmed by caller'] : [],
  });
}
