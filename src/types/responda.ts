export type UserRole = 'Administrator' | 'Call Operator' | 'Dispatcher' | 'Responder';

export interface OperatorProfile {
  id: string;
  name: string;
  role: UserRole;
  organisation: string;
  badgeCode: string;
}

export type EmergencyCategory =
  | 'Medical'
  | 'Road accident'
  | 'Fire'
  | 'Security'
  | 'Rescue'
  | 'Disaster'
  | 'Environmental hazard'
  | 'Other urgent incident';

export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus =
  | 'NEW'
  | 'AI_INTAKE'
  | 'AWAITING_OPERATOR'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'UNIT_ASSIGNED'
  | 'RESPONDING'
  | 'ON_SCENE'
  | 'RESOLVED'
  | 'CLOSED';

export type LocationSource =
  | 'GPS'
  | 'CALLER_DESCRIPTION'
  | 'OPERATOR_VERIFIED'
  | 'NETWORK_DERIVED'
  | 'UNKNOWN';

export type VerificationStatus = 'UNVERIFIED' | 'PARTIAL' | 'VERIFIED';

export type UnitType =
  | 'Ambulance'
  | 'Rapid response vehicle'
  | 'Security patrol'
  | 'Rescue team'
  | 'Fire-response partner';

export type UnitAvailability =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'UNAVAILABLE';

export type CallChannel =
  | 'WEB_TEXT'
  | 'WEB_VOICE'
  | 'TELEPHONY_ADAPTER'
  | 'DEMO_SCENARIO';

export interface TranscriptMessage {
  id: string;
  speaker: 'CALLER' | 'AI' | 'OPERATOR';
  text: string;
  timestamp: string;
  extractedTags?: string[];
}

export interface TimelineEvent {
  id: string;
  type:
    | 'INCIDENT_RECEIVED'
    | 'AI_INTAKE_STARTED'
    | 'INCIDENT_CREATED'
    | 'OPERATOR_NOTIFIED'
    | 'OPERATOR_TAKEOVER'
    | 'LOCATION_UPDATED'
    | 'LOCATION_VERIFIED'
    | 'INCIDENT_VERIFIED'
    | 'UNIT_ASSIGNED'
    | 'UNIT_ACKNOWLEDGED'
    | 'UNIT_EN_ROUTE'
    | 'UNIT_ON_SCENE'
    | 'UNIT_COMPLETED'
    | 'UNIT_CANCELLED'
    | 'STATUS_CHANGED'
    | 'NOTE_ADDED'
    | 'NOTIFICATION_SENT';
  title: string;
  description: string;
  actor: string;
  actorRole: string;
  timestamp: string;
  isSimulated?: boolean;
}

export interface IncidentNote {
  id: string;
  author: string;
  role: UserRole;
  text: string;
  timestamp: string;
}

export interface IncidentLocation {
  source: LocationSource;
  verificationStatus: VerificationStatus;
  description: string;
  correctedDescription?: string;
  landmark?: string;
  area?: string;
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  capturedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  carrierNote?: string;
}

export interface IncidentRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  category: EmergencyCategory;
  priority: IncidentPriority;
  priorityReason: string;
  status: IncidentStatus;
  callerName?: string;
  callerPhone?: string;
  summary: string;
  description: string;
  peopleAffected: number | null;
  immediateDanger: boolean;
  dangerDetails?: string;
  missingInfoFlags: string[];
  transcript: TranscriptMessage[];
  location: IncidentLocation;
  assignedOperator?: string;
  acceptedAt?: string;
  assignedUnitId?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  timeline: TimelineEvent[];
  notes: IncidentNote[];
  aiIntakeActive: boolean;
  isSimulated: boolean;
  callChannel: CallChannel;
}

export interface ResponseUnit {
  id: string;
  callsign: string;
  organisation: string;
  unitType: UnitType;
  crewDescription: string;
  locationName: string;
  area: string;
  lat: number;
  lng: number;
  availability: UnitAvailability;
  currentAssignmentId?: string;
  lastLocationUpdate: string;
  isSimulated: boolean;
}

export interface NotificationLog {
  id: string;
  channel: 'DISPATCH_ALERT' | 'DEMO_SMS' | 'SYSTEM_ALERT';
  recipient: string;
  message: string;
  incidentId?: string;
  unitId?: string;
  status: 'DELIVERED_DEMO' | 'SENT_LIVE' | 'FAILED' | 'QUEUED';
  providerResponse: string;
  timestamp: string;
  isSimulated: boolean;
}

export interface IntegrationStatus {
  id:
    | 'gemini'
    | 'firebase'
    | 'routing'
    | 'voice_telephony'
    | 'carrier_location';
  name: string;
  category: string;
  configured: boolean;
  mode: 'LIVE' | 'DEMO_FALLBACK' | 'NOT_CONFIGURED';
  statusLabel: string;
  details: string;
  setupSteps: string[];
  envVars: string[];
}

export interface RouteResult {
  available: boolean;
  isSimulatedFallback: boolean;
  provider: string;
  distanceMeters?: number;
  durationSeconds?: number;
  coordinates?: [number, number][];
  message: string;
}

export interface IntakeExtraction {
  reply: string;
  category: EmergencyCategory;
  suggestedPriority: IncidentPriority;
  priorityReason: string;
  summary: string;
  description: string;
  peopleAffected: number | null;
  immediateDanger: boolean;
  dangerDetails?: string;
  locationDescription?: string;
  landmark?: string;
  area?: string;
  callerName?: string;
  callerPhone?: string;
  missingInfoFlags: string[];
  readyForIncidentCreation: boolean;
  needsImmediateHumanAttention: boolean;
  uncertainties: string[];
}

export type AppSection =
  | 'command-centre'
  | 'live-incidents'
  | 'ai-intake'
  | 'conversation-centre'
  | 'response-units'
  | 'incident-history'
  | 'analytics'
  | 'responsive-showcase'
  | 'settings';

export type SimulationScenarioId =
  | 'yaba-accident'
  | 'ikeja-medical'
  | 'lekki-security';

export type SimulationStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type SimulationCallStatus =
  | 'IDLE'
  | 'INCOMING'
  | 'CONNECTED_AI'
  | 'OPERATOR_CONNECTED'
  | 'ENDED';

export interface SimulationRuntimeState {
  active: boolean;
  paused: boolean;
  scenarioId: SimulationScenarioId;
  stage: SimulationStageNumber;
  incidentId: string | null;
  selectedUnitId: string | null;
  callStatus: SimulationCallStatus;
  callElapsedSec: number;
  audioEnabled: boolean;
  audioPlaying: boolean;
  speakingSpeaker: 'CALLER' | 'AI' | 'OPERATOR' | null;
  speechSupported: boolean;
  revealedTurnCount: number;
  locationResolvedInSim: boolean;
  operatorTakenOver: boolean;
  dispatchApproved: boolean;
  trackingProgressPct: number;
  arrivedOnScene: boolean;
  completed: boolean;
  activeRoute: RouteResult | null;
  statusMessage: string;
}
