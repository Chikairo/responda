import {
  EmergencyCategory,
  IncidentPriority,
  IncidentRecord,
  LocationSource,
  ResponseUnit,
  RouteResult,
  SimulationScenarioId,
  SimulationStageNumber,
  TranscriptMessage,
} from '../types/responda';

export interface SimulationStageDefinition {
  stage: SimulationStageNumber;
  title: string;
  shortLabel: string;
  nextExpectedAction: string;
  targetSection:
    | 'command-centre'
    | 'conversation-centre'
    | 'incident-workspace'
    | 'response-units';
  targetWorkspaceTab?: 'overview' | 'location' | 'units' | 'transcript' | 'timeline';
}

export const SIMULATION_STAGES: SimulationStageDefinition[] = [
  {
    stage: 1,
    title: 'Incoming Emergency Call',
    shortLabel: '1. Incoming Call',
    nextExpectedAction: 'Answer the incoming simulated call in Conversation Centre.',
    targetSection: 'conversation-centre',
  },
  {
    stage: 2,
    title: 'AI Voice Intake',
    shortLabel: '2. AI Intake',
    nextExpectedAction: 'AI asks adaptive triage questions while extracting structured details.',
    targetSection: 'conversation-centre',
  },
  {
    stage: 3,
    title: 'Audio & Voice Experience',
    shortLabel: '3. Voice Playback',
    nextExpectedAction: 'Review live spoken transcript turns, speaker labels, and extracted topics.',
    targetSection: 'conversation-centre',
  },
  {
    stage: 4,
    title: 'Location Intelligence',
    shortLabel: '4. Location Intel',
    nextExpectedAction: 'Inspect caller-described landmark, Lagos map marker, and location methods.',
    targetSection: 'incident-workspace',
    targetWorkspaceTab: 'location',
  },
  {
    stage: 5,
    title: 'Incident Creation',
    shortLabel: '5. Create Record',
    nextExpectedAction: 'Structured incident record is created across all live operational views.',
    targetSection: 'command-centre',
  },
  {
    stage: 6,
    title: 'Human Operator Takeover',
    shortLabel: '6. Human Takeover',
    nextExpectedAction: 'Click TAKE OVER INCIDENT and verify the Lagos location coordinates.',
    targetSection: 'incident-workspace',
    targetWorkspaceTab: 'location',
  },
  {
    stage: 7,
    title: 'Response Unit Selection',
    shortLabel: '7. Select Unit',
    nextExpectedAction: 'Compare available Lagos units by distance and select recommended unit.',
    targetSection: 'response-units',
  },
  {
    stage: 8,
    title: 'Human-Approved Dispatch',
    shortLabel: '8. Approve Dispatch',
    nextExpectedAction: 'Review route on map and click APPROVE & DISPATCH UNIT.',
    targetSection: 'incident-workspace',
    targetWorkspaceTab: 'units',
  },
  {
    stage: 9,
    title: 'Live Response Tracking',
    shortLabel: '9. Live Tracking',
    nextExpectedAction: 'Track selected ambulance moving along Lagos route: En Route → On Scene.',
    targetSection: 'incident-workspace',
    targetWorkspaceTab: 'units',
  },
  {
    stage: 10,
    title: 'Arrival & Incident Closure',
    shortLabel: '10. Arrival & Close',
    nextExpectedAction: 'Unit arrived On Scene. Review final summary and click Close Incident.',
    targetSection: 'incident-workspace',
    targetWorkspaceTab: 'overview',
  },
];

export interface SimulationDialogueTurn {
  id: string;
  speaker: 'CALLER' | 'AI';
  text: string;
  extractedTags?: string[];
  /** Missing info flags remaining after this turn */
  remainingMissingFlags: string[];
  /** Approximate spoken duration in seconds for pacing */
  durationSec: number;
  /** Adaptive AI reasoning hint displayed subtly */
  adaptiveNote?: string;
}

export interface SimulationScenarioConfig {
  id: SimulationScenarioId;
  label: string;
  subtitle: string;
  incidentId: string;
  category: EmergencyCategory;
  priority: IncidentPriority;
  priorityReason: string;
  callerName: string;
  callerPhone: string;
  area: string;
  vagueLocationDescription: string;
  verifiedLocationDescription: string;
  landmark: string;
  resolvedCoords: { lat: number; lng: number; accuracyMeters: number };
  peopleAffected: number;
  immediateDanger: boolean;
  dangerDetails: string;
  summary: string;
  description: string;
  recommendedUnitId: string;
  preferredUnitTypes: ResponseUnit['unitType'][];
  incomingCallNotification: string;
  dialogue: SimulationDialogueTurn[];
}

export const SIMULATION_SCENARIOS: Record<
  SimulationScenarioId,
  SimulationScenarioConfig
> = {
  'yaba-accident': {
    id: 'yaba-accident',
    label: 'Yaba Road Accident (Default)',
    subtitle: '2 potentially injured · UNILAG Main Gate / Sabo axis · Uncertain street address',
    incidentId: 'INC-DEMO-2026-001',
    category: 'Road accident',
    priority: 'CRITICAL',
    priorityReason:
      'Multi-vehicle collision in Yaba with two reported injuries, jammed car door, and fuel odour near traffic.',
    callerName: 'Folake Adeyemi (Demo Caller)',
    callerPhone: '+234-800-010-2026',
    area: 'Yaba',
    vagueLocationDescription:
      'Somewhere along the road in Yaba near UNILAG main gate / Sabo junction (caller unsure of exact street number)',
    verifiedLocationDescription:
      'University Road / Abule Oja Junction by UNILAG Main Gate, Yaba, Lagos',
    landmark: 'UNILAG Main Gate',
    resolvedCoords: { lat: 6.5158, lng: 3.3845, accuracyMeters: 28 },
    peopleAffected: 2,
    immediateDanger: true,
    dangerDetails: 'Two injured occupants; jammed door and noticeable petrol odour near moving traffic.',
    summary:
      'Two-vehicle collision near UNILAG Main Gate / Sabo junction, Yaba; two occupants potentially injured with jammed door.',
    description:
      'Distressed caller reports a commercial bus collided with a saloon car near UNILAG Main Gate in Yaba. Two occupants injured; caller uncertain of exact street number.',
    recommendedUnitId: 'UNIT-SIM-A01',
    preferredUnitTypes: ['Ambulance', 'Rapid response vehicle', 'Rescue team'],
    incomingCallNotification: 'Incoming emergency call — Yaba, Lagos.',
    dialogue: [
      {
        id: 'sim-yaba-1',
        speaker: 'CALLER',
        text: 'Hello, please help! There is a bad road accident right here in Yaba—a commercial bus just slammed into a car!',
        extractedTags: ['Road accident', 'Yaba'],
        remainingMissingFlags: [
          'Exact street or landmark',
          'Injuries & people affected',
          'Immediate danger check',
          'Caller name & callback',
        ],
        durationSec: 5,
      },
      {
        id: 'sim-yaba-2',
        speaker: 'AI',
        text: 'This is Responda automated intake. Stay calm—I have logged a road accident in Yaba. Is anyone injured, trapped, or in immediate danger right now?',
        adaptiveNote: 'Skipped Q1 (What happened) — caller already reported a road accident.',
        remainingMissingFlags: [
          'Exact street or landmark',
          'Injuries & people affected',
          'Immediate danger check',
          'Caller name & callback',
        ],
        durationSec: 6,
      },
      {
        id: 'sim-yaba-3',
        speaker: 'CALLER',
        text: 'Yes, two people inside the car look injured and one door is jammed! I can smell fuel and traffic is rushing past us.',
        extractedTags: ['2 people injured', 'Door jammed', 'Fuel odour'],
        remainingMissingFlags: [
          'Exact street or landmark',
          'Caller name confirmation',
        ],
        durationSec: 6,
      },
      {
        id: 'sim-yaba-4',
        speaker: 'AI',
        text: 'Understood: two people potentially injured with a fuel hazard. What is your exact street address, or the nearest major landmark in Yaba?',
        adaptiveNote: 'Skipped Q3–Q5 (already captured 2 injured + immediate danger).',
        remainingMissingFlags: ['Exact street or landmark', 'Caller name confirmation'],
        durationSec: 6,
      },
      {
        id: 'sim-yaba-5',
        speaker: 'CALLER',
        text: "I'm shaking and I don't know the exact street number, but we are right opposite the UNILAG main gate junction heading toward Sabo. My name is Folake.",
        extractedTags: ['UNILAG Main Gate', 'Sabo axis', 'Caller: Folake'],
        remainingMissingFlags: ['Operator verification of exact junction coordinates'],
        durationSec: 7,
      },
      {
        id: 'sim-yaba-6',
        speaker: 'AI',
        text: 'Thank you, Folake. I have flagged this as urgent near UNILAG Main Gate and handed your details to a human operator to verify your location and decide response.',
        adaptiveNote: 'All core intake fields captured; never promises automatic dispatch.',
        remainingMissingFlags: ['Operator verification of exact junction coordinates'],
        durationSec: 6,
      },
    ],
  },
  'ikeja-medical': {
    id: 'ikeja-medical',
    label: 'Ikeja Medical Emergency',
    subtitle: '1 person collapsed · Allen Avenue Roundabout · Respiratory distress',
    incidentId: 'INC-DEMO-2026-002',
    category: 'Medical',
    priority: 'CRITICAL',
    priorityReason:
      'Sudden collapse with severe shortness of breath reported outside Allen Avenue office plaza.',
    callerName: 'Chukwudi Okafor (Demo Caller)',
    callerPhone: '+234-800-010-2027',
    area: 'Ikeja',
    vagueLocationDescription:
      'Outside a bank plaza somewhere along Allen Avenue near the roundabout in Ikeja',
    verifiedLocationDescription:
      '45 Allen Avenue (By Alade Market Junction), Ikeja, Lagos',
    landmark: 'Allen Avenue Roundabout',
    resolvedCoords: { lat: 6.6018, lng: 3.3515, accuracyMeters: 24 },
    peopleAffected: 1,
    immediateDanger: true,
    dangerDetails: 'Acute chest tightness and breathing difficulty; crowd gathering around patient.',
    summary:
      'Adult collapsed with severe breathing difficulty along Allen Avenue, Ikeja; crowd cleared by caller.',
    description:
      'Caller reports a colleague collapsed outside an office plaza near Allen Avenue Roundabout, Ikeja, experiencing acute breathing distress.',
    recommendedUnitId: 'UNIT-SIM-A02',
    preferredUnitTypes: ['Ambulance', 'Rapid response vehicle'],
    incomingCallNotification: 'Incoming emergency call — Ikeja, Lagos.',
    dialogue: [
      {
        id: 'sim-ikeja-1',
        speaker: 'CALLER',
        text: 'Please hurry! My colleague just collapsed outside our office in Ikeja and he is struggling to breathe!',
        extractedTags: ['Medical', 'Collapsed', 'Ikeja'],
        remainingMissingFlags: ['Exact street or landmark', 'Consciousness & danger check', 'Caller name'],
        durationSec: 5,
      },
      {
        id: 'sim-ikeja-2',
        speaker: 'AI',
        text: 'This is Responda automated intake. I have noted a medical emergency in Ikeja. Is he conscious, and is the area around him safe?',
        adaptiveNote: 'Skipped Q1 (already identified medical collapse).',
        remainingMissingFlags: ['Exact street or landmark', 'Caller name'],
        durationSec: 6,
      },
      {
        id: 'sim-ikeja-3',
        speaker: 'CALLER',
        text: 'He is conscious but very weak and holding his chest. Only one person is affected. I am Chukwudi.',
        extractedTags: ['1 person affected', 'Chest distress', 'Caller: Chukwudi'],
        remainingMissingFlags: ['Exact street or landmark'],
        durationSec: 5,
      },
      {
        id: 'sim-ikeja-4',
        speaker: 'AI',
        text: 'Thank you, Chukwudi. What street number or major landmark in Ikeja are you closest to?',
        adaptiveNote: 'Focused directly on missing location landmark.',
        remainingMissingFlags: ['Exact street or landmark'],
        durationSec: 5,
      },
      {
        id: 'sim-ikeja-5',
        speaker: 'CALLER',
        text: "We are right near Allen Avenue roundabout, beside the plaza near Alade Market junction.",
        extractedTags: ['Allen Avenue Roundabout', 'Alade Market Junction'],
        remainingMissingFlags: ['Operator verification of plaza entrance'],
        durationSec: 5,
      },
      {
        id: 'sim-ikeja-6',
        speaker: 'AI',
        text: 'Got it. Your report and Allen Avenue landmark are now queued for immediate human operator review and unit assignment decision.',
        adaptiveNote: 'Intake complete; awaiting human operator verification.',
        remainingMissingFlags: ['Operator verification of plaza entrance'],
        durationSec: 5,
      },
    ],
  },
  'lekki-security': {
    id: 'lekki-security',
    label: 'Lekki Security Incident',
    subtitle: '3 staff sheltered · Admiralty Way, Lekki Phase 1 · Active perimeter breach',
    incidentId: 'INC-DEMO-2026-003',
    category: 'Security',
    priority: 'HIGH',
    priorityReason:
      'Active unauthorised perimeter breach reported at commercial compound off Admiralty Way, Lekki Phase 1.',
    callerName: 'Bamidele Jacobs (Demo Caller)',
    callerPhone: '+234-800-010-2028',
    area: 'Lekki',
    vagueLocationDescription:
      'Commercial depot off Admiralty Way near Admiralty Circle in Lekki Phase 1',
    verifiedLocationDescription:
      'Plot 18 Admiralty Way (Gate 2 Security Post), Lekki Phase 1, Lagos',
    landmark: 'Admiralty Circle',
    resolvedCoords: { lat: 6.4479, lng: 3.4678, accuracyMeters: 30 },
    peopleAffected: 3,
    immediateDanger: true,
    dangerDetails: 'Two intruders sighted inside rear compound yard; three staff locked in guardroom.',
    summary:
      'Unauthorised perimeter breach at commercial yard on Admiralty Way, Lekki Phase 1; three staff sheltered inside.',
    description:
      'Caller reports two intruders scaled the rear perimeter wall at a commercial depot off Admiralty Way, Lekki Phase 1. Three night staff are locked safely inside Gate 2 guardroom.',
    recommendedUnitId: 'UNIT-SIM-R01',
    preferredUnitTypes: ['Security patrol', 'Rescue team', 'Rapid response vehicle'],
    incomingCallNotification: 'Incoming emergency call — Lekki Phase 1, Lagos.',
    dialogue: [
      {
        id: 'sim-lekki-1',
        speaker: 'CALLER',
        text: 'Hello Responda, our perimeter alarm just went off in Lekki Phase 1—two people climbed the back wall into our yard!',
        extractedTags: ['Security', 'Perimeter breach', 'Lekki Phase 1'],
        remainingMissingFlags: ['Immediate danger & people affected', 'Exact street or landmark', 'Caller name'],
        durationSec: 6,
      },
      {
        id: 'sim-lekki-2',
        speaker: 'AI',
        text: 'This is Responda automated intake. Are you and anyone else in a safe place, and how many people are on site?',
        adaptiveNote: 'Prioritised immediate safety & headcount.',
        remainingMissingFlags: ['Exact street or landmark', 'Caller name'],
        durationSec: 5,
      },
      {
        id: 'sim-lekki-3',
        speaker: 'CALLER',
        text: 'Three of us are locked safely inside the front guardroom. I am Bamidele, the site supervisor.',
        extractedTags: ['3 staff sheltered', 'No injuries', 'Caller: Bamidele'],
        remainingMissingFlags: ['Exact street or landmark'],
        durationSec: 5,
      },
      {
        id: 'sim-lekki-4',
        speaker: 'AI',
        text: 'Thank you, Bamidele. Please confirm the exact plot or closest landmark off Admiralty Way.',
        remainingMissingFlags: ['Exact street or landmark'],
        durationSec: 5,
      },
      {
        id: 'sim-lekki-5',
        speaker: 'CALLER',
        text: 'Plot 18 off Admiralty Way, right near the Admiralty Circle roundabout at Gate 2.',
        extractedTags: ['Plot 18 Admiralty Way', 'Admiralty Circle'],
        remainingMissingFlags: ['Operator verification of Gate 2 access'],
        durationSec: 5,
      },
      {
        id: 'sim-lekki-6',
        speaker: 'AI',
        text: 'Understood. A human operator is reviewing your security alert and Admiralty Way coordinates now.',
        remainingMissingFlags: ['Operator verification of Gate 2 access'],
        durationSec: 5,
      },
    ],
  },
};

export function createSimulationFleetUnits(nowIso: string = new Date().toISOString()): ResponseUnit[] {
  return [
    {
      id: 'UNIT-SIM-A01',
      callsign: 'Ambulance Unit A01',
      organisation: 'Lagos Metro EMS (Simulation)',
      unitType: 'Ambulance',
      crewDescription: '2 Trauma Paramedics, 1 EVOC Driver',
      locationName: 'Sabo / Commercial Avenue',
      area: 'Yaba',
      lat: 6.5068,
      lng: 3.3775,
      availability: 'AVAILABLE',
      lastLocationUpdate: nowIso,
      isSimulated: true,
    },
    {
      id: 'UNIT-SIM-A02',
      callsign: 'Ambulance Unit A02',
      organisation: 'Lagos Metro EMS (Simulation)',
      unitType: 'Ambulance',
      crewDescription: '1 Emergency Physician, 1 Paramedic, 1 Driver',
      locationName: 'Opebi / Allen Junction',
      area: 'Ikeja',
      lat: 6.5942,
      lng: 3.3578,
      availability: 'AVAILABLE',
      lastLocationUpdate: nowIso,
      isSimulated: true,
    },
    {
      id: 'UNIT-SIM-R01',
      callsign: 'Rescue Unit R01',
      organisation: 'Atlantic Rescue Partners (Simulation)',
      unitType: 'Rescue team',
      crewDescription: '4 Rapid Extrication & Security Specialists',
      locationName: 'Ikoyi Link / Admiralty Corridor',
      area: 'Lekki',
      lat: 6.4538,
      lng: 3.4502,
      availability: 'AVAILABLE',
      lastLocationUpdate: nowIso,
      isSimulated: true,
    },
    {
      id: 'UNIT-SIM-M01',
      callsign: 'Medical Support M01',
      organisation: 'SwiftCare Response (Simulation)',
      unitType: 'Rapid response vehicle',
      crewDescription: '2 Advanced EMTs',
      locationName: 'Bode Thomas / Adeniran Ogunsanya',
      area: 'Surulere',
      lat: 6.4972,
      lng: 3.3568,
      availability: 'ASSIGNED',
      currentAssignmentId: 'INC-2026-1047',
      lastLocationUpdate: nowIso,
      isSimulated: true,
    },
  ];
}

export function calculateHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export interface RankedUnitRecommendation {
  unit: ResponseUnit;
  distanceKm: number | null;
  recommended: boolean;
  reason: string;
}

export function rankUnitsForIncident(
  units: ResponseUnit[],
  incident: Pick<IncidentRecord, 'category' | 'location'>,
  preferredUnitId?: string
): RankedUnitRecommendation[] {
  const incLat = incident.location.lat;
  const incLng = incident.location.lng;

  const scored = units.map((unit) => {
    const distanceKm =
      typeof incLat === 'number' && typeof incLng === 'number'
        ? calculateHaversineKm(unit.lat, unit.lng, incLat, incLng)
        : null;

    let typeScore = 0;
    if (
      (incident.category === 'Road accident' || incident.category === 'Medical') &&
      unit.unitType === 'Ambulance'
    ) {
      typeScore = 100;
    } else if (
      incident.category === 'Security' &&
      (unit.unitType === 'Security patrol' || unit.unitType === 'Rescue team')
    ) {
      typeScore = 100;
    } else if (unit.unitType === 'Rescue team' || unit.unitType === 'Rapid response vehicle') {
      typeScore = 60;
    }

    const availScore = unit.availability === 'AVAILABLE' ? 1000 : 0;
    const prefBonus = preferredUnitId && unit.id === preferredUnitId ? 50 : 0;
    const distPenalty = distanceKm !== null ? distanceKm * 5 : 25;
    const totalScore = availScore + typeScore + prefBonus - distPenalty;

    return { unit, distanceKm, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const topAvailable = scored.find((s) => s.unit.availability === 'AVAILABLE')?.unit.id;

  return scored.map((item) => {
    const recommended = item.unit.id === topAvailable;
    const reason = recommended
      ? `Closest available ${item.unit.unitType.toLowerCase()} (${
          item.distanceKm !== null ? `${item.distanceKm} km straight-line` : 'Lagos sector'
        })`
      : item.unit.availability !== 'AVAILABLE'
      ? `Currently ${item.unit.availability.replace('_', ' ')}`
      : item.distanceKm !== null
      ? `${item.distanceKm} km straight-line from scene`
      : 'Available in Lagos fleet';
    return {
      unit: item.unit,
      distanceKm: item.distanceKm,
      recommended,
      reason,
    };
  });
}

export function buildSimulatedCorridorRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): RouteResult {
  const p1: [number, number] = [fromLat, fromLng];
  const p2: [number, number] = [
    Number((fromLat + (toLat - fromLat) * 0.28 + 0.0018).toFixed(5)),
    Number((fromLng + (toLng - fromLng) * 0.28 - 0.0014).toFixed(5)),
  ];
  const p3: [number, number] = [
    Number((fromLat + (toLat - fromLat) * 0.58 + 0.0022).toFixed(5)),
    Number((fromLng + (toLng - fromLng) * 0.58 - 0.0008).toFixed(5)),
  ];
  const p4: [number, number] = [
    Number((fromLat + (toLat - fromLat) * 0.84 + 0.0009).toFixed(5)),
    Number((fromLng + (toLng - fromLng) * 0.84 - 0.0004).toFixed(5)),
  ];
  const p5: [number, number] = [toLat, toLng];

  return {
    available: true,
    isSimulatedFallback: true,
    provider: 'Simulated Demo Route (OpenRouteService Not Configured)',
    coordinates: [p1, p2, p3, p4, p5],
    message:
      'Simulated demo corridor shown along Lagos road axis (OPENROUTESERVICE_API_KEY not set; real driving ETA is not fabricated).',
  };
}

export function interpolatePointAlongRoute(
  coordinates: [number, number][],
  progressPct: number
): [number, number] {
  if (coordinates.length === 0) return [6.5158, 3.3845];
  if (coordinates.length === 1) return coordinates[0];

  const clamped = Math.max(0, Math.min(100, progressPct)) / 100;
  if (clamped <= 0) return coordinates[0];
  if (clamped >= 1) return coordinates[coordinates.length - 1];

  const segments: Array<{ from: [number, number]; to: [number, number]; len: number }> = [];
  let totalLen = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segments.push({ from: a, to: b, len });
    totalLen += len;
  }

  if (totalLen === 0) return coordinates[coordinates.length - 1];

  let targetDist = clamped * totalLen;
  for (const seg of segments) {
    if (targetDist <= seg.len || seg.len === 0) {
      const t = seg.len === 0 ? 0 : targetDist / seg.len;
      return [
        Number((seg.from[0] + (seg.to[0] - seg.from[0]) * t).toFixed(5)),
        Number((seg.from[1] + (seg.to[1] - seg.from[1]) * t).toFixed(5)),
      ];
    }
    targetDist -= seg.len;
  }

  return coordinates[coordinates.length - 1];
}

export interface LocationIntelligenceMethodStatus {
  key: 'GPS' | 'CALLER_DESCRIPTION' | 'OPERATOR_VERIFIED' | 'NETWORK_DERIVED';
  label: string;
  sourceCode: LocationSource;
  statusText: string;
  available: boolean;
  detail: string;
}

export function buildLocationIntelligenceMethods(
  incident: IncidentRecord,
  carrierConfigured: boolean = false
): LocationIntelligenceMethodStatus[] {
  const isVerified = incident.location.verificationStatus === 'VERIFIED';
  const hasCoords =
    typeof incident.location.lat === 'number' &&
    typeof incident.location.lng === 'number';

  return [
    {
      key: 'GPS',
      label: 'A. Device GPS Location',
      sourceCode: 'GPS',
      statusText:
        incident.location.source === 'GPS' && hasCoords
          ? `GPS captured (±${incident.location.accuracyMeters ?? 25}m)`
          : hasCoords && incident.location.accuracyMeters
          ? `Simulated coordinate estimate (±${incident.location.accuracyMeters}m)`
          : 'Mobile data uncertain — GPS not locked',
      available: Boolean(hasCoords && incident.location.accuracyMeters),
      detail:
        'Uses browser/device Geolocation API when available; never auto-verifies an incident without human confirmation.',
    },
    {
      key: 'CALLER_DESCRIPTION',
      label: 'B. Caller-Described Location',
      sourceCode: 'CALLER_DESCRIPTION',
      statusText: isVerified ? 'Preserved as original report' : 'UNVERIFIED caller text',
      available: true,
      detail: `${incident.location.description}${
        incident.location.landmark ? ` · Landmark: ${incident.location.landmark}` : ''
      }`,
    },
    {
      key: 'OPERATOR_VERIFIED',
      label: 'C. Operator-Verified Location',
      sourceCode: 'OPERATOR_VERIFIED',
      statusText: isVerified
        ? `VERIFIED by ${incident.location.verifiedBy || 'Human Operator'}`
        : 'Pending human operator confirmation',
      available: isVerified,
      detail: isVerified
        ? incident.location.correctedDescription || incident.location.description
        : 'Operator must confirm landmark/street and approve exact Lagos map pin.',
    },
    {
      key: 'NETWORK_DERIVED',
      label: 'D. Carrier-Derived Location',
      sourceCode: 'NETWORK_DERIVED',
      statusText: carrierConfigured
        ? 'Authorised endpoint ready'
        : 'Carrier location integration not configured',
      available: carrierConfigured,
      detail: carrierConfigured
        ? 'Authorised MNO emergency location adapter enabled.'
        : 'Carrier location integration not configured. Coordinates are never fabricated from phone numbers.',
    },
  ];
}

export function buildScenarioTranscript(
  scenario: SimulationScenarioConfig,
  turnCount: number,
  baseIso: string = new Date().toISOString()
): TranscriptMessage[] {
  const baseMs = Date.parse(baseIso) || Date.now();
  return scenario.dialogue.slice(0, turnCount).map((turn, idx) => ({
    id: turn.id,
    speaker: turn.speaker,
    text: turn.text,
    timestamp: new Date(baseMs + idx * 6000).toISOString(),
    extractedTags: turn.extractedTags,
  }));
}

export function buildSimulationFinalSummary(
  incident: IncidentRecord,
  unit: ResponseUnit | null,
  route: RouteResult | null
): {
  headline: string;
  locationLine: string;
  unitLine: string;
  routingNote: string;
  timelineCount: number;
} {
  return {
    headline: `${incident.id} — ${incident.category} (${incident.priority})`,
    locationLine: `${
      incident.location.correctedDescription || incident.location.description
    } [${incident.location.verificationStatus}]`,
    unitLine: unit
      ? `${unit.callsign} (${unit.unitType}) — ${unit.availability.replace('_', ' ')}`
      : 'No unit assigned',
    routingNote:
      route && !route.isSimulatedFallback && route.distanceMeters
        ? `OpenRouteService distance: ${(route.distanceMeters / 1000).toFixed(1)} km`
        : 'Simulated demo route corridor used (no real emergency dispatch or external routing call fabricated)',
    timelineCount: incident.timeline.length,
  };
}
