import type {
  EmergencyCategory,
  IncidentLocation,
  IncidentPriority,
  IntakeExtraction,
  LocationSource,
} from '../types/responda.ts';

export interface LagosLandmarkRef {
  area: string;
  landmark: string;
  lat: number;
  lng: number;
}

// Reference coordinates for well-known Lagos areas/landmarks (used strictly as unverified map hints when caller describes an area)
export const LAGOS_LANDMARK_REFS: LagosLandmarkRef[] = [
  { area: 'Yaba', landmark: 'UNILAG Gate / Sabo Yaba', lat: 6.5158, lng: 3.3845 },
  { area: 'Yaba', landmark: 'Yaba Bus Terminal / Tejuosho', lat: 6.5095, lng: 3.3711 },
  { area: 'Ikeja', landmark: 'Allen Avenue / Obafemi Awolowo Way', lat: 6.6018, lng: 3.3515 },
  { area: 'Surulere', landmark: 'Bode Thomas / National Stadium', lat: 6.4972, lng: 3.3568 },
  { area: 'Victoria Island', landmark: 'Adeola Odeku / Akin Adesola', lat: 6.4281, lng: 3.4219 },
  { area: 'Lekki', landmark: 'Admiralty Way / Lekki Phase 1', lat: 6.4474, lng: 3.4723 },
  { area: 'Ikoyi', landmark: 'Bourdillon Road / Awolowo Road', lat: 6.4549, lng: 3.4346 },
  { area: 'Ajah', landmark: 'Ajah Roundabout / Lekki-Epe Expressway', lat: 6.4698, lng: 3.5852 },
  { area: 'Maryland', landmark: 'Maryland Mall / Ikorodu Road', lat: 6.5764, lng: 3.3646 },
  { area: 'Apapa', landmark: 'Apapa Wharf / Creek Road', lat: 6.4488, lng: 3.359 },
];

export function isValidLagosCoords(lat?: number, lng?: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 6.32 && lat <= 6.75 && lng >= 3.05 && lng <= 3.75;
}

export function inferApproximateLagosReference(text: string): LagosLandmarkRef | null {
  const lower = text.toLowerCase();
  for (const ref of LAGOS_LANDMARK_REFS) {
    if (lower.includes(ref.area.toLowerCase())) {
      return ref;
    }
  }
  if (lower.includes('unilag') || lower.includes('herbert macaulay') || lower.includes('sabo')) {
    return LAGOS_LANDMARK_REFS[0];
  }
  if (lower.includes('allen') || lower.includes('alausa')) {
    return LAGOS_LANDMARK_REFS[2];
  }
  if (lower.includes('stadium') || lower.includes('bode thomas')) {
    return LAGOS_LANDMARK_REFS[3];
  }
  if (lower.includes('admiralty') || lower.includes('lekki')) {
    return LAGOS_LANDMARK_REFS[5];
  }
  return null;
}

export function buildLocationFromIntake(params: {
  callerDescription?: string;
  landmark?: string;
  area?: string;
  gps?: { lat: number; lng: number; accuracyMeters?: number; timestamp?: string } | null;
}): IncidentLocation {
  const now = new Date().toISOString();

  // Coordinates alone NEVER auto-verify a location. Verification requires human operator confirmation.
  if (params.gps && isValidLagosCoords(params.gps.lat, params.gps.lng)) {
    return {
      source: 'GPS',
      verificationStatus: 'UNVERIFIED',
      description:
        params.callerDescription?.trim() ||
        `Device GPS coordinates (${params.gps.lat.toFixed(5)}, ${params.gps.lng.toFixed(5)})`,
      landmark: params.landmark,
      area: params.area,
      lat: params.gps.lat,
      lng: params.gps.lng,
      accuracyMeters: params.gps.accuracyMeters,
      capturedAt: params.gps.timestamp || now,
    };
  }

  const combinedText = [params.callerDescription, params.landmark, params.area]
    .filter(Boolean)
    .join(' ');

  if (combinedText.trim().length > 0) {
    const approx = inferApproximateLagosReference(combinedText);
    return {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: params.callerDescription?.trim() || combinedText.trim(),
      landmark: params.landmark,
      area: params.area || approx?.area,
      // Note: approximate landmark coordinates are NOT GPS and remain strictly UNVERIFIED
      lat: approx?.lat,
      lng: approx?.lng,
      capturedAt: now,
    };
  }

  return {
    source: 'UNKNOWN',
    verificationStatus: 'UNVERIFIED',
    description: 'Location not yet provided by caller.',
    capturedAt: now,
  };
}

export function getLocationSourceBadgeMeta(source: LocationSource): {
  label: string;
  shortLabel: string;
  toneClass: string;
} {
  switch (source) {
    case 'OPERATOR_VERIFIED':
      return {
        label: 'OPERATOR VERIFIED',
        shortLabel: 'Operator Verified',
        toneClass:
          'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30',
      };
    case 'GPS':
      return {
        label: 'GPS LOCATION',
        shortLabel: 'Device GPS',
        toneClass:
          'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/30',
      };
    case 'CALLER_DESCRIPTION':
      return {
        label: 'CALLER DESCRIPTION',
        shortLabel: 'Caller Described',
        toneClass:
          'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30',
      };
    case 'NETWORK_DERIVED':
      return {
        label: 'NETWORK-DERIVED',
        shortLabel: 'Carrier Derived',
        toneClass:
          'text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/30',
      };
    case 'UNKNOWN':
    default:
      return {
        label: 'UNKNOWN LOCATION',
        shortLabel: 'Unknown',
        toneClass:
          'text-slate-700 bg-slate-100 border-slate-300 dark:text-slate-400 dark:bg-slate-500/10 dark:border-slate-500/30',
      };
  }
}

export function sanitizeCategory(input?: string): EmergencyCategory {
  const valid: EmergencyCategory[] = [
    'Medical',
    'Road accident',
    'Fire',
    'Security',
    'Rescue',
    'Disaster',
    'Environmental hazard',
    'Other urgent incident',
  ];
  const match = valid.find((c) => c.toLowerCase() === (input || '').toLowerCase());
  return match || 'Other urgent incident';
}

export function sanitizePriority(input?: string): IncidentPriority {
  const upper = (input || '').toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
    return upper;
  }
  return 'HIGH';
}

export function normalizeIntakeExtraction(
  raw: Partial<IntakeExtraction>
): IntakeExtraction {
  return {
    reply:
      raw.reply?.trim() ||
      'This is Responda automated intake. Please tell me what happened and your nearest landmark in Lagos so an operator can review this immediately.',
    category: sanitizeCategory(raw.category),
    suggestedPriority: sanitizePriority(raw.suggestedPriority),
    priorityReason:
      raw.priorityReason?.trim() || 'Priority suggested from caller description; pending human operator review.',
    summary: raw.summary?.trim() || 'Emergency report under automated intake.',
    description: raw.description?.trim() || 'Caller report captured during intake.',
    peopleAffected:
      typeof raw.peopleAffected === 'number' && Number.isFinite(raw.peopleAffected)
        ? Math.max(0, Math.round(raw.peopleAffected))
        : null,
    immediateDanger: Boolean(raw.immediateDanger),
    dangerDetails: raw.dangerDetails?.trim() || undefined,
    locationDescription: raw.locationDescription?.trim() || undefined,
    landmark: raw.landmark?.trim() || undefined,
    area: raw.area?.trim() || undefined,
    callerName: raw.callerName?.trim() || undefined,
    callerPhone: raw.callerPhone?.trim() || undefined,
    missingInfoFlags: Array.isArray(raw.missingInfoFlags)
      ? raw.missingInfoFlags.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [],
    readyForIncidentCreation: Boolean(raw.readyForIncidentCreation),
    needsImmediateHumanAttention: Boolean(raw.needsImmediateHumanAttention),
    uncertainties: Array.isArray(raw.uncertainties)
      ? raw.uncertainties.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [],
  };
}
