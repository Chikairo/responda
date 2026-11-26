export type UserRole = 'Operations Staff' | 'Organisation Administrator';

export type StaffAccountStatus = 'ACTIVE' | 'INVITED' | 'INACTIVE';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus: StaffAccountStatus;
  badgeCode: string;
  dateAdded: string;
  lastActive?: string;
}

export interface OrganisationSettings {
  name: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  defaultOperationalArea: string;
  requireLocationVerificationBeforeDispatch: boolean;
  clinicalTriageNotice: string;
}

export type MedicalEmergencyCategory =
  | 'Medical'
  | 'Road accident'
  | 'Other medical emergency';

export type LegacyNonMedicalCategory =
  | 'Fire'
  | 'Security'
  | 'Rescue'
  | 'Disaster'
  | 'Environmental hazard'
  | 'Other urgent incident';

export type EmergencyCategory = MedicalEmergencyCategory | LegacyNonMedicalCategory;

export type IncidentPriority = 'Critical' | 'Urgent' | 'Standard' | 'Unassessed';

export type IncidentStatus =
  | 'New'
  | 'Under Review'
  | 'Dispatched'
  | 'Patient Transport'
  | 'Closed';

export type LocationSource =
  | 'GPS'
  | 'CALLER_DESCRIPTION'
  | 'OPERATOR_VERIFIED'
  | 'NETWORK_DERIVED'
  | 'MANUAL'
  | 'SIMULATED'
  | 'UNKNOWN';

export type VerificationStatus = 'UNVERIFIED' | 'PARTIAL' | 'VERIFIED';

export type UnitType = 'Ambulance' | 'Rapid response vehicle';

export type UnitRegistrationStatus = 'Active' | 'Inactive';

export type UnitAvailability =
  | 'Available'
  | 'Responding'
  | 'At Scene'
  | 'Transporting'
  | 'Unavailable';

export type UnitLocationFreshness =
  | 'LIVE'
  | 'LAST_KNOWN'
  | 'MANUAL'
  | 'UNAVAILABLE';

export const PREDEFINED_MEDICAL_CAPABILITIES = [
  'Basic Life Support (BLS)',
  'Advanced Life Support (ALS)',
  'Patient transport',
  'Oxygen support',
  'Defibrillation',
] as const;

export type MedicalCapability = (typeof PREDEFINED_MEDICAL_CAPABILITIES)[number] | string;

export interface CrewMemberRecord {
  id: string;
  name: string;
  medicalRole: string;
  qualification: string;
}

export interface UnitActivityEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  details: string;
}

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
    | 'PATIENT_PICKED_UP'
    | 'HOSPITAL_CONFIRMED'
    | 'TRANSPORT_STARTED'
    | 'HOSPITAL_ARRIVED'
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
  role: string;
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

export interface HospitalDestination {
  id?: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  isSimulatedDemo?: boolean;
  isCustom?: boolean;
  selectedBy?: string;
  selectedAt?: string;
}

export interface ClinicalDetails {
  chiefComplaint?: string;
  consciousness?: string;
  breathing?: string;
  bleedingOrInjury?: string;
  clinicalNotes?: string;
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
  clinicalDetails?: ClinicalDetails;
  missingInfoFlags: string[];
  transcript: TranscriptMessage[];
  location: IncidentLocation;
  assignedOperator?: string;
  acceptedAt?: string;
  assignedUnitId?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  arrivedAtSceneAt?: string;
  patientPickedUpAt?: string;
  hospitalDestination?: HospitalDestination;
  transportStartedAt?: string;
  hospitalArrivedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  outcome?: string;
  timeline: TimelineEvent[];
  notes: IncidentNote[];
  aiIntakeActive: boolean;
  isSimulated: boolean;
  callChannel: CallChannel;
  legacyOutOfScope?: boolean;
  legacyPriorityOriginal?: string;
  legacyStatusOriginal?: string;
}

export interface ResponseUnit {
  id: string;
  callsign: string;
  organisation: string;
  unitType: UnitType;
  registrationStatus: UnitRegistrationStatus;
  vehicleRegistration: string;
  operationalBase: string;
  crewDescription: string;
  crewMembers: CrewMemberRecord[];
  medicalCapabilities: MedicalCapability[];
  customEquipment?: string[];
  locationName: string;
  area: string;
  lat: number;
  lng: number;
  locationFreshness: UnitLocationFreshness;
  locationSourceLabel?: string;
  availability: UnitAvailability;
  currentAssignmentId?: string;
  lastLocationUpdate: string;
  adminNotes?: string;
  activityLog?: UnitActivityEvent[];
  legacyOutOfScope?: boolean;
  legacyUnitType?: string;
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

export type IntegrationConnectionState =
  | 'CONNECTED'
  | 'CONFIGURED_UNVERIFIED'
  | 'NOT_CONFIGURED'
  | 'SIMULATED';

export interface IntegrationStatus {
  id:
    | 'gemini'
    | 'persistence'
    | 'routing'
    | 'voice_telephony'
    | 'carrier_location';
  name: string;
  category: string;
  configured: boolean;
  state: IntegrationConnectionState;
  statusLabel: string;
  details: string;
  setupSteps: string[];
  envVars: string[];
  lastTestedAt?: string;
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
  category: MedicalEmergencyCategory;
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

export type OperationsSection =
  | 'command-centre'
  | 'incident-management'
  | 'response-units'
  | 'incident-history';

export type AdminSection =
  | 'admin-overview'
  | 'staff-management'
  | 'unit-management'
  | 'organisation-settings'
  | 'integrations';

export type AppSection = OperationsSection | AdminSection;

export type SimulationScenarioId = 'yaba-accident' | 'ikeja-medical';

export type SimulationStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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
  trackingRemainingSec: number;
  trackingElapsedSec: number;
  trackingStatusText: string;
  simulatedArrivalAt?: string;
  arrivedOnScene: boolean;
  patientPickedUp: boolean;
  confirmedHospital: HospitalDestination | null;
  transportStarted: boolean;
  hospitalArrived: boolean;
  completed: boolean;
  activeRoute: RouteResult | null;
  hospitalRoute: RouteResult | null;
  statusMessage: string;
}

export interface AuthSessionInfo {
  token: string;
  account: StaffAccount;
  isDemoSession: true;
}
