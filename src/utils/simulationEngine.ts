import type {
  ClinicalDetails,
  HospitalDestination,
  IncidentPriority,
  IncidentRecord,
  LocationSource,
  MedicalEmergencyCategory,
  OperationsSection,
  ResponseUnit,
  RouteResult,
  SimulationScenarioId,
  SimulationStageNumber,
  TranscriptMessage,
  UnitAvailability,
} from '../types/responda.ts';
import type { IncidentWorkspaceTabId } from './guidedWorkflow.ts';

export const SIMULATION_TRACKING_DURATION_SEC = 60;

export const LAGOS_HOSPITAL_DESTINATIONS: HospitalDestination[] = [
  {
    id: 'hosp-luth',
    name: 'Lagos University Teaching Hospital (LUTH)',
    area: 'Idi-Araba, Surulere / Yaba Axis',
    lat: 6.5177,
    lng: 3.3547,
    isSimulatedDemo: true,
  },
  {
    id: 'hosp-lasuth',
    name: 'Lagos State University Teaching Hospital (LASUTH)',
    area: 'Ikeja GRA Axis',
    lat: 6.5892,
    lng: 3.3426,
    isSimulatedDemo: true,
  },
  {
    id: 'hosp-gbagada',
    name: 'Gbagada General Hospital Trauma Centre',
    area: 'Gbagada Expressway Axis',
    lat: 6.5515,
    lng: 3.3881,
    isSimulatedDemo: true,
  },
  {
    id: 'hosp-lagos-island',
    name: 'Lagos Island General Hospital',
    area: 'Marina / Lagos Island Axis',
    lat: 6.4534,
    lng: 3.3923,
    isSimulatedDemo: true,
  },
  {
    id: 'hosp-reddington',
    name: 'Reddington Multi-Specialist Hospital',
    area: 'Victoria Island / Lekki Axis',
    lat: 6.4328,
    lng: 3.4287,
    isSimulatedDemo: true,
  },
];

export interface SimulationStageDefinition {
  stage: SimulationStageNumber;
  title: string;
  shortLabel: string;
  nextExpectedAction: string;
  targetSection: OperationsSection;
  targetWorkspaceTab?: IncidentWorkspaceTabId;
}

export const SIMULATION_STAGES: SimulationStageDefinition[] = [
  {
    stage: 1,
    title: 'Incoming Medical Emergency Call',
    shortLabel: '1. Incoming Call',
    nextExpectedAction: 'Answer incoming simulated call inside Incident Management.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'workflow',
  },
  {
    stage: 2,
    title: 'AI Medical Intake & Transcription',
    shortLabel: '2. AI Intake',
    nextExpectedAction: 'AI gathers clinical symptoms, danger flags, and location into live transcript.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'medical-details',
  },
  {
    stage: 3,
    title: 'Location & Clinical Detail Extraction',
    shortLabel: '3. Location Intel',
    nextExpectedAction: 'Review unverified caller-described landmark and Lagos map coordinates.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'location',
  },
  {
    stage: 4,
    title: 'Incident Creation (New / Unverified)',
    shortLabel: '4. Incident Created',
    nextExpectedAction: 'Incident appears live on Command Centre and Incident Management queue.',
    targetSection: 'command-centre',
  },
  {
    stage: 5,
    title: 'Human Operator Takeover & Priority Assessment',
    shortLabel: '5. Takeover & Priority',
    nextExpectedAction: 'Operator takes over, confirms clinical priority, and verifies Lagos location.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'location',
  },
  {
    stage: 6,
    title: 'Medical Unit Selection',
    shortLabel: '6. Select Unit',
    nextExpectedAction: 'Compare active ambulances by medical capabilities and distance.',
    targetSection: 'response-units',
  },
  {
    stage: 7,
    title: 'Human-Approved Unit Dispatch',
    shortLabel: '7. Approve Dispatch',
    nextExpectedAction: 'Approve dispatch of selected active medical unit.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'response',
  },
  {
    stage: 8,
    title: 'Response, Scene Arrival & Patient Transport',
    shortLabel: '8. Response & Transport',
    nextExpectedAction:
      'Track 60s route to scene, confirm pickup, select & confirm hospital destination, start transport, and confirm hospital arrival.',
    targetSection: 'incident-management',
    targetWorkspaceTab: 'response',
  },
  {
    stage: 9,
    title: 'Incident Closure & Read-Only History',
    shortLabel: '9. Closure & History',
    nextExpectedAction:
      'Close incident with outcome summary; unit returns to Available and case archives read-only.',
    targetSection: 'incident-history',
  },
];

export interface SimulationDialogueTurn {
  id: string;
  speaker: 'CALLER' | 'AI';
  text: string;
  extractedTags?: string[];
  remainingMissingFlags: string[];
  durationSec: number;
  adaptiveNote?: string;
}

export interface SimulationScenarioConfig {
  id: SimulationScenarioId;
  label: string;
  subtitle: string;
  incidentId: string;
  category: MedicalEmergencyCategory;
  priority: IncidentPriority;
  priorityReason: string;
  callerName: string;
  callerPhone: string;
  area: string;
  vagueLocationDescription: string;
  verifiedLocationDescription: string;
  landmark: string;
  resolvedCoords: { lat: number; lng: number; accuracyMeters: number };
  clinicalDetails: ClinicalDetails;
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
    label: 'Yaba Road Accident (Medical Trauma)',
    subtitle: '2 potentially injured · Herbert Macaulay / UNILAG Gate axis · Uncertain address',
    incidentId: 'INC-DEMO-2026-001',
    category: 'Road accident',
    priority: 'Critical',
    priorityReason:
      'Multi-vehicle collision in Yaba with two injured occupants, jammed door, and noticeable fuel odour near moving traffic.',
    callerName: 'Folake Adeyemi (Demo Caller)',
    callerPhone: '+234-800-010-2026',
    area: 'Yaba',
    vagueLocationDescription:
      'Along the road in Yaba near UNILAG main gate / Sabo junction (caller unsure of exact street number)',
    verifiedLocationDescription:
      'University Road / Abule Oja Junction by UNILAG Main Gate, Yaba, Lagos',
    landmark: 'UNILAG Main Gate',
    resolvedCoords: { lat: 6.5158, lng: 3.3845, accuracyMeters: 28 },
    clinicalDetails: {
      chiefComplaint: 'Blunt trauma and suspected limb fractures from bus-car collision',
      consciousness: '1 conscious in pain; 1 drowsy / shock symptoms',
      breathing: 'Rapid shallow breathing reported',
      bleedingOrInjury: 'Facial lacerations and leg entrapment near jammed front door',
      clinicalNotes: 'ALS trauma support & oxygen recommended on arrival.',
    },
    peopleAffected: 2,
    immediateDanger: true,
    dangerDetails: 'Two injured occupants; jammed door and petrol odour near traffic.',
    summary:
      'Two-vehicle collision near UNILAG Main Gate / Sabo junction, Yaba; two occupants injured.',
    description:
      'Distressed caller reports a commercial bus collided with a saloon car near UNILAG Main Gate in Yaba. Two occupants injured; caller uncertain of exact street number.',
    recommendedUnitId: 'UNIT-SIM-A01',
    preferredUnitTypes: ['Ambulance', 'Rapid response vehicle'],
    incomingCallNotification: 'Incoming medical emergency call — Yaba, Lagos.',
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
        text: 'This is Responda automated intake. Stay calm—I have logged a road accident in Yaba. Is anyone injured, unconscious, or in immediate danger right now?',
        adaptiveNote: 'Skipped category question — caller already reported a road accident.',
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
        text: 'Yes, two people inside the car are hurt and bleeding, and one door is jammed! One person looks very drowsy and I can smell fuel.',
        extractedTags: ['2 people injured', 'Bleeding', 'Fuel odour'],
        remainingMissingFlags: ['Exact street or landmark', 'Caller name confirmation'],
        durationSec: 6,
      },
      {
        id: 'sim-yaba-4',
        speaker: 'AI',
        text: 'Understood: two people injured with bleeding and a fuel hazard. What is your exact street address, or the nearest major landmark in Yaba?',
        adaptiveNote: 'Captured clinical severity; querying landmark.',
        remainingMissingFlags: ['Exact street or landmark', 'Caller name confirmation'],
        durationSec: 6,
      },
      {
        id: 'sim-yaba-5',
        speaker: 'CALLER',
        text: "I'm shaking and don't know the exact street number, but we are right opposite the UNILAG main gate junction heading toward Sabo. My name is Folake.",
        extractedTags: ['UNILAG Main Gate', 'Sabo axis', 'Caller: Folake'],
        remainingMissingFlags: ['Operator verification of exact junction coordinates'],
        durationSec: 7,
      },
      {
        id: 'sim-yaba-6',
        speaker: 'AI',
        text: 'Thank you, Folake. I have queued your medical report near UNILAG Main Gate for immediate human operator assessment and dispatch decision.',
        adaptiveNote: 'Never promises automatic dispatch without human approval.',
        remainingMissingFlags: ['Operator verification of exact junction coordinates'],
        durationSec: 6,
      },
    ],
  },
  'ikeja-medical': {
    id: 'ikeja-medical',
    label: 'Ikeja Medical Collapse',
    subtitle: '1 person collapsed · Allen Avenue Roundabout · Respiratory distress',
    incidentId: 'INC-DEMO-2026-002',
    category: 'Medical',
    priority: 'Critical',
    priorityReason:
      'Sudden collapse with severe shortness of breath and chest tightness outside Allen Avenue office plaza.',
    callerName: 'Chukwudi Okafor (Demo Caller)',
    callerPhone: '+234-800-010-2027',
    area: 'Ikeja',
    vagueLocationDescription:
      'Outside a bank plaza along Allen Avenue near the roundabout in Ikeja',
    verifiedLocationDescription:
      '45 Allen Avenue (By Alade Market Junction), Ikeja, Lagos',
    landmark: 'Allen Avenue Roundabout',
    resolvedCoords: { lat: 6.6018, lng: 3.3515, accuracyMeters: 24 },
    clinicalDetails: {
      chiefComplaint: 'Acute collapse with chest tightness and respiratory distress',
      consciousness: 'Conscious but weak and diaphoretic',
      breathing: 'Laboured breathing',
      bleedingOrInjury: 'No external bleeding reported',
      clinicalNotes: 'Oxygen support and cardiac monitoring recommended.',
    },
    peopleAffected: 1,
    immediateDanger: true,
    dangerDetails: 'Acute chest tightness and breathing difficulty; crowd gathering around patient.',
    summary:
      'Adult collapsed with severe breathing difficulty along Allen Avenue, Ikeja.',
    description:
      'Caller reports a colleague collapsed outside an office plaza near Allen Avenue Roundabout, Ikeja, experiencing acute breathing distress.',
    recommendedUnitId: 'UNIT-SIM-A02',
    preferredUnitTypes: ['Ambulance', 'Rapid response vehicle'],
    incomingCallNotification: 'Incoming medical emergency call — Ikeja, Lagos.',
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
        adaptiveNote: 'Skipped category question — medical collapse identified.',
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
        text: 'We are right near Allen Avenue roundabout, beside the plaza near Alade Market junction.',
        extractedTags: ['Allen Avenue Roundabout', 'Alade Market Junction'],
        remainingMissingFlags: ['Operator verification of plaza entrance'],
        durationSec: 5,
      },
      {
        id: 'sim-ikeja-6',
        speaker: 'AI',
        text: 'Got it. Your medical report and Allen Avenue landmark are queued for immediate human operator review.',
        adaptiveNote: 'Intake complete; awaiting human operator verification.',
        remainingMissingFlags: ['Operator verification of plaza entrance'],
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
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-SIM-401A',
      operationalBase: 'Sabo / Yaba Medical Post',
      crewDescription: '2 Trauma Paramedics, 1 EVOC Driver',
      crewMembers: [
        { id: 'cr-sim-1', name: 'Dr. Tunde Bakare', medicalRole: 'Trauma Lead', qualification: 'ALS Paramedic' },
        { id: 'cr-sim-2', name: 'Ngozi Eze', medicalRole: 'EMT-Paramedic', qualification: 'BLS / Oxygen' },
      ],
      medicalCapabilities: [
        'Advanced Life Support (ALS)',
        'Basic Life Support (BLS)',
        'Patient transport',
        'Oxygen support',
        'Defibrillation',
      ],
      locationName: 'Sabo / Commercial Avenue',
      area: 'Yaba',
      lat: 6.5068,
      lng: 3.3775,
      locationFreshness: 'LIVE',
      locationSourceLabel: 'Simulated Demo Telemetry',
      availability: 'Available',
      lastLocationUpdate: nowIso,
      activityLog: [],
      isSimulated: true,
    },
    {
      id: 'UNIT-SIM-A02',
      callsign: 'Ambulance Unit A02',
      organisation: 'Lagos Metro EMS (Simulation)',
      unitType: 'Ambulance',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-SIM-402A',
      operationalBase: 'Opebi / Allen Ambulance Bay',
      crewDescription: '1 Emergency Physician, 1 Paramedic, 1 Driver',
      crewMembers: [
        { id: 'cr-sim-3', name: 'Dr. Ibrahim Musa', medicalRole: 'Emergency Physician', qualification: 'ALS / Cardiac' },
        { id: 'cr-sim-4', name: 'Funke Adewale', medicalRole: 'Paramedic', qualification: 'BLS / Defibrillation' },
      ],
      medicalCapabilities: [
        'Advanced Life Support (ALS)',
        'Basic Life Support (BLS)',
        'Patient transport',
        'Oxygen support',
        'Defibrillation',
      ],
      locationName: 'Opebi / Allen Junction',
      area: 'Ikeja',
      lat: 6.5942,
      lng: 3.3578,
      locationFreshness: 'LIVE',
      locationSourceLabel: 'Simulated Demo Telemetry',
      availability: 'Available',
      lastLocationUpdate: nowIso,
      activityLog: [],
      isSimulated: true,
    },
    {
      id: 'UNIT-SIM-M01',
      callsign: 'Rapid Medical M01',
      organisation: 'SwiftCare Medical Response (Simulation)',
      unitType: 'Rapid response vehicle',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-SIM-209R',
      operationalBase: 'Bode Thomas Medical Station',
      crewDescription: '2 Advanced EMTs',
      crewMembers: [
        { id: 'cr-sim-5', name: 'Seyi Ogunleye', medicalRole: 'Senior EMT', qualification: 'BLS / Oxygen' },
      ],
      medicalCapabilities: [
        'Basic Life Support (BLS)',
        'Oxygen support',
        'Defibrillation',
      ],
      locationName: 'Bode Thomas / Adeniran Ogunsanya',
      area: 'Surulere',
      lat: 6.4972,
      lng: 3.3568,
      locationFreshness: 'LIVE',
      locationSourceLabel: 'Simulated Demo Telemetry',
      availability: 'Available',
      lastLocationUpdate: nowIso,
      activityLog: [],
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
  incident: Pick<IncidentRecord, 'category' | 'priority' | 'location'>,
  preferredUnitId?: string
): RankedUnitRecommendation[] {
  const incLat = incident.location.lat;
  const incLng = incident.location.lng;

  const activeFleet = units.filter(
    (u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope
  );

  const scored = activeFleet.map((unit) => {
    const distanceKm =
      typeof incLat === 'number' && typeof incLng === 'number'
        ? calculateHaversineKm(unit.lat, unit.lng, incLat, incLng)
        : null;

    let typeScore = unit.unitType === 'Ambulance' ? 100 : 65;
    const hasALS = unit.medicalCapabilities.includes('Advanced Life Support (ALS)');
    const hasTransport = unit.medicalCapabilities.includes('Patient transport');
    if (incident.priority === 'Critical' && hasALS) typeScore += 35;
    if (hasTransport) typeScore += 20;

    const availScore = unit.availability === 'Available' ? 1000 : 0;
    const prefBonus = preferredUnitId && unit.id === preferredUnitId ? 50 : 0;
    const distPenalty = distanceKm !== null ? distanceKm * 5 : 25;
    const totalScore = availScore + typeScore + prefBonus - distPenalty;

    return { unit, distanceKm, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const topAvailable = scored.find((s) => s.unit.availability === 'Available')?.unit.id;

  return scored.map((item) => {
    const recommended = item.unit.id === topAvailable;
    const reason = recommended
      ? `Closest available ${item.unit.unitType.toLowerCase()} (${
          item.distanceKm !== null ? `${item.distanceKm} km straight-line` : 'Lagos sector'
        })`
      : item.unit.availability !== 'Available'
      ? `Currently ${item.unit.availability}`
      : item.distanceKm !== null
      ? `${item.distanceKm} km straight-line from scene`
      : 'Available in active medical fleet';
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

export interface TrackingMilestoneInfo {
  milestoneKey: 'DEPARTED' | 'EN_ROUTE' | 'APPROACHING' | 'ARRIVED';
  progressPct: number;
  statusText: string;
  availability: UnitAvailability;
  timelineTitle: string;
  timelineDescription: string;
}

export function getTrackingMilestoneForElapsed(
  elapsedSec: number,
  totalSec: number = SIMULATION_TRACKING_DURATION_SEC,
  areaLabel: string = 'Lagos'
): TrackingMilestoneInfo {
  const clampedElapsed = Math.max(0, Math.min(totalSec, elapsedSec));
  const progressPct = Math.min(100, Math.round((clampedElapsed / totalSec) * 100));

  if (clampedElapsed >= totalSec) {
    return {
      milestoneKey: 'ARRIVED',
      progressPct: 100,
      statusText: 'Response unit has arrived at the incident location.',
      availability: 'At Scene',
      timelineTitle: 'Response unit arrived at scene (Simulation)',
      timelineDescription: `Response unit has arrived at the incident location in ${areaLabel}.`,
    };
  }

  if (clampedElapsed >= Math.round(totalSec * 0.67)) {
    return {
      milestoneKey: 'APPROACHING',
      progressPct,
      statusText: 'Response unit is approaching the incident location.',
      availability: 'Responding',
      timelineTitle: 'Response unit approaching scene (Simulation)',
      timelineDescription: `Emergency medical vehicle is approaching the ${areaLabel} incident location.`,
    };
  }

  if (clampedElapsed >= Math.round(totalSec * 0.2)) {
    return {
      milestoneKey: 'EN_ROUTE',
      progressPct,
      statusText: 'Emergency vehicle is en route to the incident.',
      availability: 'Responding',
      timelineTitle: 'Unit en route to incident (Simulation)',
      timelineDescription: `Emergency medical vehicle is en route along the ${areaLabel} corridor.`,
    };
  }

  return {
    milestoneKey: 'DEPARTED',
    progressPct,
    statusText: 'Response unit has departed.',
    availability: 'Responding',
    timelineTitle: 'Response unit departed (Simulation)',
    timelineDescription: `Assigned medical unit acknowledged dispatch and departed toward ${areaLabel}.`,
  };
}

export function buildSimulatedHospitalTransferCoordinates(
  incidentLat: number,
  incidentLng: number,
  hospital: HospitalDestination
): [number, number][] {
  return buildSimulatedCorridorRoute(
    incidentLat,
    incidentLng,
    hospital.lat,
    hospital.lng
  ).coordinates!;
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
      sourceCode: incident.location.source === 'SIMULATED' ? 'SIMULATED' : 'GPS',
      statusText:
        incident.location.source === 'GPS' && hasCoords
          ? `GPS captured (±${incident.location.accuracyMeters ?? 25}m)`
          : incident.location.source === 'SIMULATED' && hasCoords
          ? `Simulated coordinate estimate (±${incident.location.accuracyMeters ?? 25}m)`
          : 'Mobile data uncertain — GPS not locked',
      available: Boolean(
        hasCoords &&
          (incident.location.source === 'GPS' || incident.location.source === 'SIMULATED')
      ),
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

export interface ProgressiveSimulationSnapshot {
  category: MedicalEmergencyCategory;
  priority: IncidentPriority;
  priorityReason: string;
  peopleAffected?: number;
  immediateDanger: boolean;
  dangerDetails?: string;
  clinicalDetails: ClinicalDetails;
  callerName?: string;
  landmark?: string;
  locationDescription: string;
  summary: string;
  description: string;
}

export function getProgressiveSimulationSnapshot(
  scenario: SimulationScenarioConfig,
  turnCount: number
): ProgressiveSimulationSnapshot {
  const clampedTurn = Math.max(0, Math.min(turnCount, scenario.dialogue.length));

  if (scenario.id === 'yaba-accident') {
    const hasTurn1 = clampedTurn >= 1;
    const hasTurn3 = clampedTurn >= 3;
    const hasTurn5 = clampedTurn >= 5;

    return {
      category: scenario.category,
      priority: hasTurn3 ? scenario.priority : 'Unassessed',
      priorityReason: hasTurn3
        ? scenario.priorityReason
        : 'AI intake active — awaiting injury, consciousness, and hazard confirmation.',
      peopleAffected: hasTurn3 ? scenario.peopleAffected : undefined,
      immediateDanger: hasTurn3 ? scenario.immediateDanger : false,
      dangerDetails: hasTurn3 ? scenario.dangerDetails : undefined,
      clinicalDetails: {
        chiefComplaint: hasTurn1
          ? 'Commercial bus vs. saloon car road collision in Yaba'
          : undefined,
        consciousness: hasTurn3
          ? scenario.clinicalDetails.consciousness
          : undefined,
        breathing: hasTurn3
          ? scenario.clinicalDetails.breathing
          : undefined,
        bleedingOrInjury: hasTurn3
          ? scenario.clinicalDetails.bleedingOrInjury
          : undefined,
        clinicalNotes: hasTurn3
          ? scenario.clinicalDetails.clinicalNotes
          : 'Gathering clinical triage details from caller...',
      },
      callerName: hasTurn5 ? scenario.callerName : undefined,
      landmark: hasTurn5 ? scenario.landmark : undefined,
      locationDescription: hasTurn5
        ? scenario.vagueLocationDescription
        : 'Yaba area (caller reporting road accident; landmark pending)',
      summary: hasTurn5
        ? scenario.summary
        : hasTurn3
        ? 'Two-vehicle collision in Yaba; two injured occupants with bleeding and fuel odour.'
        : 'Incoming report of commercial bus and car collision in Yaba.',
      description: hasTurn5
        ? scenario.description
        : hasTurn3
        ? 'Caller reports two people injured and bleeding inside a car with a jammed door and petrol odour in Yaba. Landmark confirmation in progress.'
        : 'Caller reports a commercial bus collided with a car in Yaba. AI intake gathering clinical severity and landmark details.',
    };
  }

  // ikeja-medical
  const hasTurn1 = clampedTurn >= 1;
  const hasTurn3 = clampedTurn >= 3;
  const hasTurn5 = clampedTurn >= 5;

  return {
    category: scenario.category,
    priority: hasTurn3 ? scenario.priority : 'Unassessed',
    priorityReason: hasTurn3
      ? scenario.priorityReason
      : 'AI intake active — awaiting consciousness, patient count, and chest distress details.',
    peopleAffected: hasTurn3 ? scenario.peopleAffected : undefined,
    immediateDanger: hasTurn3 ? scenario.immediateDanger : false,
    dangerDetails: hasTurn3 ? scenario.dangerDetails : undefined,
    clinicalDetails: {
      chiefComplaint: hasTurn1
        ? hasTurn3
          ? scenario.clinicalDetails.chiefComplaint
          : 'Sudden collapse with breathing difficulty in Ikeja'
        : undefined,
      consciousness: hasTurn3
        ? scenario.clinicalDetails.consciousness
        : undefined,
      breathing: hasTurn1 ? scenario.clinicalDetails.breathing : undefined,
      bleedingOrInjury: hasTurn3
        ? scenario.clinicalDetails.bleedingOrInjury
        : undefined,
      clinicalNotes: hasTurn3
        ? scenario.clinicalDetails.clinicalNotes
        : 'Gathering clinical triage details from caller...',
    },
    callerName: hasTurn3 ? scenario.callerName : undefined,
    landmark: hasTurn5 ? scenario.landmark : undefined,
    locationDescription: hasTurn5
      ? scenario.vagueLocationDescription
      : 'Ikeja area (exact street or landmark pending)',
    summary: hasTurn5
      ? scenario.summary
      : hasTurn3
      ? 'Adult collapsed in Ikeja with chest tightness and laboured breathing.'
      : 'Incoming report of person collapsed with breathing difficulty in Ikeja.',
    description: hasTurn5
      ? scenario.description
      : hasTurn3
      ? 'Caller Chukwudi reports one conscious but weak adult holding chest and struggling to breathe in Ikeja. Landmark confirmation in progress.'
      : 'Caller reports a colleague collapsed outside an office in Ikeja with breathing distress.',
  };
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
      ? `${unit.callsign} (${unit.unitType}) — ${unit.availability}`
      : 'No unit assigned',
    routingNote:
      route && !route.isSimulatedFallback && route.distanceMeters
        ? `OpenRouteService distance: ${(route.distanceMeters / 1000).toFixed(1)} km`
        : 'Simulated demo route corridor used (no real emergency dispatch or external routing call fabricated)',
    timelineCount: incident.timeline.length,
  };
}
