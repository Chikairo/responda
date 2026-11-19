import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { IntakeExtraction, TranscriptMessage } from '../../src/types/responda';
import { normalizeIntakeExtraction } from '../../src/utils/intakeParser';

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

const INTAKE_SYSTEM_INSTRUCTION = `You are Responda's automated emergency intake assistant for private emergency-response coordination in Lagos, Nigeria.

CRITICAL SAFETY & OPERATIONAL RULES:
1. Introduce yourself calmly, briefly, and clearly as Responda's automated intake assistant on the first turn.
2. Ask ONLY 1 concise, relevant next follow-up question based on what is still missing. Never overwhelm a distressed caller with a multi-question list.
3. Progressively collect:
   - What happened?
   - Where is the incident (street, estate, building, landmark, Lagos area)?
   - Emergency category (Medical, Road accident, Fire, Security, Rescue, Disaster, Environmental hazard, Other urgent incident)
   - Is anyone injured, trapped, or in immediate danger?
   - How many people are affected?
   - Caller's name and callback number (optional, if willing/able)
4. NEVER diagnose medical conditions or give medical prescriptions.
5. NEVER promise an ambulance, guarantee a response time, or claim emergency units have been dispatched. Say that a human operator will review the report immediately.
6. Flag uncertainty explicitly in uncertainties/missingInfoFlags instead of inventing facts or coordinates.
7. If immediate danger or injuries are indicated, prioritise essential location/danger details and set needsImmediateHumanAttention=true.`;

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

Analyse the caller's latest report, extract structured incident fields, identify missing critical info, and write a calm, brief response asking the single most useful next question (or confirming the report is queued for human operator takeover if essential details are present).`;

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
              description:
                'One of: Medical, Road accident, Fire, Security, Rescue, Disaster, Environmental hazard, Other urgent incident',
            },
            suggestedPriority: {
              type: Type.STRING,
              description: 'One of: CRITICAL, HIGH, MEDIUM, LOW',
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

  let category: IntakeExtraction['category'] = 'Other urgent incident';
  if (lower.includes('accident') || lower.includes('crash') || lower.includes('collision') || lower.includes('car') || lower.includes('bus')) {
    category = 'Road accident';
  } else if (lower.includes('fire') || lower.includes('smoke') || lower.includes('burn')) {
    category = 'Fire';
  } else if (lower.includes('bleed') || lower.includes('breath') || lower.includes('pain') || lower.includes('unconscious') || lower.includes('medical') || lower.includes('injur')) {
    category = 'Medical';
  } else if (lower.includes('robbery') || lower.includes('intrusion') || lower.includes('break') || lower.includes('security') || lower.includes('attack')) {
    category = 'Security';
  } else if (lower.includes('trap') || lower.includes('lift') || lower.includes('collapse') || lower.includes('flood')) {
    category = 'Rescue';
  }

  const immediateDanger =
    lower.includes('injur') ||
    lower.includes('bleed') ||
    lower.includes('trap') ||
    lower.includes('fire') ||
    lower.includes('danger') ||
    lower.includes('crash');

  let peopleAffected: number | null = null;
  if (lower.includes('two') || /\b2\b/.test(lower)) peopleAffected = 2;
  else if (lower.includes('three') || /\b3\b/.test(lower)) peopleAffected = 3;
  else if (lower.includes('one') || /\b1\b/.test(lower)) peopleAffected = 1;

  const areas = ['Yaba', 'Ikeja', 'Surulere', 'Lekki', 'Victoria Island', 'Ikoyi', 'Ajah', 'Maryland', 'Apapa'];
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
  if (!immediateDanger && !lower.includes('no one hurt') && !lower.includes('safe')) {
    missingInfoFlags.push('Injury or immediate danger confirmation');
  }
  if (peopleAffected === null) {
    missingInfoFlags.push('Number of people affected');
  }

  const callerTurns = params.history.filter((m) => m.speaker === 'CALLER').length + 1;
  let reply = '';
  if (!detectedArea && !hasLandmark) {
    reply =
      'This is Responda automated intake (Simulated Mode). Please share your location or the nearest landmark in Lagos, and let me know if anyone is injured or in immediate danger.';
  } else if (peopleAffected === null) {
    reply =
      'Thank you. How many people are affected or injured, and is anyone trapped or in immediate danger? A human operator is being alerted to review this report.';
  } else if (callerTurns < 2 || (!hasLandmark && missingInfoFlags.length > 0)) {
    reply =
      'I have noted the area. Can you describe the closest landmark, junction, or street name, and share your name or callback number if safe to do so?';
  } else {
    reply =
      'Thank you. I have recorded these details and flagged the report for immediate human operator review. Please stay on the line while an operator takes over—no unit is dispatched until an operator confirms.';
  }

  return normalizeIntakeExtraction({
    reply,
    category,
    suggestedPriority: immediateDanger ? 'CRITICAL' : 'HIGH',
    priorityReason: immediateDanger
      ? 'Immediate danger or injuries indicated in caller report; flagged for urgent operator review.'
      : 'Urgent incident details reported; awaiting human verification.',
    summary: `${category} reported${detectedArea ? ` in ${detectedArea}` : ''}${peopleAffected !== null ? ` (${peopleAffected} affected)` : ''}. [Simulated Demo Intake]`,
    description: fullText.trim(),
    peopleAffected,
    immediateDanger,
    dangerDetails: immediateDanger ? 'Injuries or active hazard reported by caller.' : undefined,
    locationDescription: hasLandmark || detectedArea ? params.latestMessage : undefined,
    landmark: lower.includes('unilag')
      ? 'UNILAG Gate'
      : lower.includes('sabo')
      ? 'Sabo Junction'
      : undefined,
    area: detectedArea,
    missingInfoFlags,
    readyForIncidentCreation: Boolean(detectedArea || hasLandmark || callerTurns >= 2),
    needsImmediateHumanAttention: immediateDanger,
    uncertainties: !hasLandmark ? ['Exact street address not yet confirmed by caller'] : [],
  });
}
