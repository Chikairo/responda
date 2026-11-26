import fs from 'fs/promises';
import path from 'path';
import type {
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  MedicalEmergencyCategory,
  NotificationLog,
  OrganisationSettings,
  ResponseUnit,
  StaffAccount,
  UnitAvailability,
} from '../src/types/responda.ts';

export interface RespondaDatabase {
  schemaVersion: 2;
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  notifications: NotificationLog[];
  staffAccounts: StaffAccount[];
  organisationSettings: OrganisationSettings;
  sequenceCounter: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'responda-db.json');

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

export function createDefaultStaffAccounts(nowIso: string = new Date().toISOString()): StaffAccount[] {
  return [
    {
      id: 'staff-ops-1',
      name: 'Seyi Ogunleye',
      email: 'seyi.ogunleye@responda.ng',
      role: 'Operations Staff',
      accountStatus: 'ACTIVE',
      badgeCode: 'OPS-101',
      dateAdded: nowIso,
      lastActive: nowIso,
    },
    {
      id: 'staff-ops-2',
      name: 'Amina Bello',
      email: 'amina.bello@responda.ng',
      role: 'Operations Staff',
      accountStatus: 'ACTIVE',
      badgeCode: 'OPS-102',
      dateAdded: nowIso,
      lastActive: nowIso,
    },
    {
      id: 'staff-ops-3',
      name: 'Chinedu Okafor',
      email: 'chinedu.okafor@responda.ng',
      role: 'Operations Staff',
      accountStatus: 'ACTIVE',
      badgeCode: 'OPS-103',
      dateAdded: nowIso,
    },
    {
      id: 'staff-admin-1',
      name: 'Dr. Folashade Adeyemi',
      email: 'folashade.adeyemi@responda.ng',
      role: 'Organisation Administrator',
      accountStatus: 'ACTIVE',
      badgeCode: 'ADM-001',
      dateAdded: nowIso,
      lastActive: nowIso,
    },
    {
      id: 'staff-ops-4',
      name: 'Kemi Lawal',
      email: 'kemi.lawal@responda.ng',
      role: 'Operations Staff',
      accountStatus: 'INVITED',
      badgeCode: 'OPS-104',
      dateAdded: nowIso,
    },
  ];
}

export function createDefaultOrganisationSettings(): OrganisationSettings {
  return {
    name: 'Responda Medical Emergency Coordination (Lagos)',
    city: 'Lagos, Nigeria',
    contactEmail: 'dispatch@responda.ng',
    contactPhone: '+234-800-RESPONDA',
    defaultOperationalArea: 'Lagos Mainland & Island Medical Corridor',
    requireLocationVerificationBeforeDispatch: true,
    clinicalTriageNotice:
      'Automated intake assists caller triage only. Human Operations Staff verify clinical priority, confirm Lagos location, and approve every ambulance dispatch.',
  };
}

export function createSeedData(): RespondaDatabase {
  const nowIso = new Date().toISOString();
  const units: ResponseUnit[] = [
    {
      id: 'UNIT-AMB-01',
      callsign: 'Ikeja Alpha-1',
      organisation: 'Lagos Metro EMS',
      unitType: 'Ambulance',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-401-EM',
      operationalBase: 'Allen Avenue Medical Station, Ikeja',
      crewDescription: '2 Trauma Paramedics, 1 EVOC Driver',
      crewMembers: [
        { id: 'c-101', name: 'Dr. Tunde Bakare', medicalRole: 'Trauma Lead', qualification: 'ALS Paramedic' },
        { id: 'c-102', name: 'Ngozi Eze', medicalRole: 'Flight/Ground EMT', qualification: 'BLS / Defibrillation' },
      ],
      medicalCapabilities: [
        'Advanced Life Support (ALS)',
        'Basic Life Support (BLS)',
        'Patient transport',
        'Oxygen support',
        'Defibrillation',
      ],
      locationName: 'Allen Avenue Roundabout',
      area: 'Ikeja',
      lat: 6.6018,
      lng: 3.3515,
      locationFreshness: 'LIVE',
      locationSourceLabel: 'Simulated GPS Telemetry',
      availability: 'Available',
      lastLocationUpdate: minutesAgo(2),
      activityLog: [
        {
          id: 'uact-1',
          timestamp: minutesAgo(30),
          actor: 'Dr. Folashade Adeyemi',
          actorRole: 'Organisation Administrator',
          action: 'Unit Shift Active',
          details: 'Ikeja Alpha-1 checked in with full ALS trauma kit.',
        },
      ],
      isSimulated: true,
    },
    {
      id: 'UNIT-AMB-02',
      callsign: 'Yaba Trauma-2',
      organisation: 'Lagos Metro EMS',
      unitType: 'Ambulance',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-402-EM',
      operationalBase: 'Sabo Medical Post, Yaba',
      crewDescription: '1 Emergency Physician, 1 Paramedic, 1 Driver',
      crewMembers: [
        { id: 'c-201', name: 'Dr. Ibrahim Musa', medicalRole: 'Emergency Physician', qualification: 'ALS / Cardiac' },
        { id: 'c-202', name: 'Funke Adewale', medicalRole: 'Paramedic', qualification: 'BLS / Oxygen' },
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
      locationSourceLabel: 'Simulated GPS Telemetry',
      availability: 'Available',
      lastLocationUpdate: minutesAgo(1),
      activityLog: [],
      isSimulated: true,
    },
    {
      id: 'UNIT-RRV-03',
      callsign: 'Surulere Rapid-3',
      organisation: 'SwiftCare Medical Response',
      unitType: 'Rapid response vehicle',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-209-RR',
      operationalBase: 'Bode Thomas Medical Post, Surulere',
      crewDescription: '2 Advanced EMTs',
      crewMembers: [
        { id: 'c-301', name: 'Yusuf Balogun', medicalRole: 'Senior EMT', qualification: 'BLS / Oxygen' },
        { id: 'c-302', name: 'Grace Ojo', medicalRole: 'EMT Responder', qualification: 'Defibrillation' },
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
      locationSourceLabel: 'Simulated GPS Telemetry',
      availability: 'Responding',
      currentAssignmentId: 'INC-2026-1047',
      lastLocationUpdate: minutesAgo(1),
      activityLog: [
        {
          id: 'uact-3',
          timestamp: minutesAgo(9),
          actor: 'Seyi Ogunleye',
          actorRole: 'Operations Staff',
          action: 'Dispatched to INC-2026-1047',
          details: 'Assigned to Adeniran Ogunsanya respiratory emergency.',
        },
      ],
      isSimulated: true,
    },
    {
      id: 'UNIT-AMB-04',
      callsign: 'VI Care-4',
      organisation: 'Eko Clinical EMS',
      unitType: 'Ambulance',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-404-EM',
      operationalBase: 'Adeola Odeku Ambulance Bay, VI',
      crewDescription: '2 Paramedics, 1 Driver',
      crewMembers: [
        { id: 'c-401', name: 'Bolanle Peters', medicalRole: 'Lead Paramedic', qualification: 'ALS Paramedic' },
      ],
      medicalCapabilities: [
        'Advanced Life Support (ALS)',
        'Basic Life Support (BLS)',
        'Patient transport',
        'Oxygen support',
        'Defibrillation',
      ],
      locationName: 'Adeola Odeku / Akin Adesola',
      area: 'Victoria Island',
      lat: 6.4281,
      lng: 3.4219,
      locationFreshness: 'LAST_KNOWN',
      locationSourceLabel: 'Last Reported Bay Telemetry',
      availability: 'Available',
      lastLocationUpdate: minutesAgo(6),
      activityLog: [],
      isSimulated: true,
    },
    {
      id: 'UNIT-AMB-07',
      callsign: 'Ikoyi Bravo-7',
      organisation: 'Lagos Metro EMS',
      unitType: 'Ambulance',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-407-EM',
      operationalBase: 'Bourdillon EMS Point, Ikoyi',
      crewDescription: '2 Paramedics, 1 Driver',
      crewMembers: [
        { id: 'c-701', name: 'Damilola Sanni', medicalRole: 'Paramedic', qualification: 'BLS / Transport' },
      ],
      medicalCapabilities: [
        'Basic Life Support (BLS)',
        'Patient transport',
        'Oxygen support',
      ],
      locationName: 'Bourdillon Road Junction',
      area: 'Ikoyi',
      lat: 6.4549,
      lng: 3.4346,
      locationFreshness: 'LIVE',
      locationSourceLabel: 'Simulated GPS Telemetry',
      availability: 'Available',
      lastLocationUpdate: minutesAgo(5),
      activityLog: [],
      isSimulated: true,
    },
    {
      id: 'UNIT-RRV-08',
      callsign: 'Lekki Med-8',
      organisation: 'SwiftCare Medical Response',
      unitType: 'Rapid response vehicle',
      registrationStatus: 'Active',
      vehicleRegistration: 'LAS-218-RR',
      operationalBase: 'Admiralty Way Medical Post, Lekki',
      crewDescription: '2 EMTs (Stand-down maintenance)',
      crewMembers: [
        { id: 'c-801', name: 'Kolawole Ade', medicalRole: 'EMT', qualification: 'BLS' },
      ],
      medicalCapabilities: ['Basic Life Support (BLS)', 'Oxygen support'],
      locationName: 'Admiralty Way Medical Post',
      area: 'Lekki',
      lat: 6.4474,
      lng: 3.4723,
      locationFreshness: 'MANUAL',
      locationSourceLabel: 'Base Check-in',
      availability: 'Unavailable',
      lastLocationUpdate: minutesAgo(18),
      adminNotes: 'Restocking oxygen cylinders.',
      activityLog: [],
      isSimulated: true,
    },
  ];

  const incidents: IncidentRecord[] = [
    {
      id: 'INC-2026-1048',
      createdAt: minutesAgo(3),
      updatedAt: minutesAgo(2),
      category: 'Road accident',
      priority: 'Critical',
      priorityReason: 'Multi-vehicle collision on Herbert Macaulay Way with 2 reported injuries and jammed door.',
      status: 'New',
      callerName: 'Tunde A. (Demo)',
      callerPhone: '+234-800-010-1048',
      summary: 'Two-vehicle collision near Sabo Yaba junction; 2 occupants injured and unable to exit vehicle safely.',
      description: 'Caller reports a saloon car and minibus collided at the Sabo junction traffic light. Two passengers injured; fuel odour noted.',
      peopleAffected: 2,
      immediateDanger: true,
      dangerDetails: 'Oncoming traffic hazard and minor fuel odour near vehicle.',
      clinicalDetails: {
        chiefComplaint: 'Suspected blunt trauma and lacerations from collision',
        consciousness: 'Conscious but distressed',
        breathing: 'Rapid breathing',
        bleedingOrInjury: 'Active bleeding from facial/arm lacerations',
        clinicalNotes: 'Needs ALS trauma & extrication assessment on arrival.',
      },
      missingInfoFlags: ['Operator verification of exact junction lane'],
      transcript: [
        {
          id: 't-1048-1',
          speaker: 'AI',
          text: 'This is Responda automated medical intake. Please tell me what happened and where you are located.',
          timestamp: minutesAgo(3),
        },
        {
          id: 't-1048-2',
          speaker: 'CALLER',
          text: 'There is a bad car crash right by Sabo junction in Yaba. A danfo bus hit a sedan.',
          timestamp: minutesAgo(2.8),
          extractedTags: ['Road accident', 'Sabo junction, Yaba'],
        },
        {
          id: 't-1048-3',
          speaker: 'AI',
          text: 'Understood. Is anyone injured, unconscious, or in immediate danger?',
          timestamp: minutesAgo(2.5),
        },
        {
          id: 't-1048-4',
          speaker: 'CALLER',
          text: 'Yes, two people in the car are injured and bleeding, one door is jammed. I smell fuel.',
          timestamp: minutesAgo(2.1),
          extractedTags: ['2 injured', 'Bleeding', 'Fuel odour'],
        },
      ],
      location: {
        source: 'GPS',
        verificationStatus: 'UNVERIFIED',
        description: 'Herbert Macaulay Way near Sabo Junction, Yaba, Lagos',
        landmark: 'Sabo Market Junction',
        area: 'Yaba',
        lat: 6.5095,
        lng: 3.3711,
        accuracyMeters: 22,
        capturedAt: minutesAgo(2.9),
        carrierNote: 'Carrier location integration not configured',
      },
      timeline: [
        {
          id: 'ev-1048-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Emergency report received',
          description: 'Inbound simulated web intake initiated.',
          actor: 'Responda Intake Gateway',
          actorRole: 'System',
          timestamp: minutesAgo(3),
          isSimulated: true,
        },
        {
          id: 'ev-1048-2',
          type: 'AI_INTAKE_STARTED',
          title: 'AI intake structured medical report',
          description: 'Extracted Road accident · Critical suggested · Flagged for human takeover.',
          actor: 'Responda AI Intake',
          actorRole: 'AI Assistant',
          timestamp: minutesAgo(2.2),
          isSimulated: true,
        },
        {
          id: 'ev-1048-3',
          type: 'OPERATOR_NOTIFIED',
          title: 'Awaiting operator takeover',
          description: 'Alert queued on Command Centre for human verification.',
          actor: 'Responda Router',
          actorRole: 'System',
          timestamp: minutesAgo(2),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: true,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1047',
      createdAt: minutesAgo(14),
      updatedAt: minutesAgo(4),
      acceptedAt: minutesAgo(12),
      dispatchedAt: minutesAgo(9),
      acknowledgedAt: minutesAgo(8),
      category: 'Medical',
      priority: 'Urgent',
      priorityReason: 'Acute respiratory distress reported for elderly resident.',
      status: 'Dispatched',
      callerName: 'Chidinma K. (Demo)',
      callerPhone: '+234-800-010-1047',
      summary: 'Adult experiencing severe shortness of breath inside residential estate off Bode Thomas, Surulere.',
      description: 'Caller reports 68-year-old family member struggling to breathe. Conscious and seated indoors.',
      peopleAffected: 1,
      immediateDanger: false,
      clinicalDetails: {
        chiefComplaint: 'Shortness of breath / respiratory distress',
        consciousness: 'Conscious and alert',
        breathing: 'Laboured breathing',
        bleedingOrInjury: 'None',
        clinicalNotes: 'Oxygen support requested on arrival.',
      },
      missingInfoFlags: [],
      assignedOperator: 'Amina Bello',
      assignedUnitId: 'UNIT-RRV-03',
      transcript: [
        {
          id: 't-1047-1',
          speaker: 'CALLER',
          text: 'My father is having severe trouble breathing at 14 Adeniran Ogunsanya close, Surulere.',
          timestamp: minutesAgo(14),
        },
        {
          id: 't-1047-2',
          speaker: 'OPERATOR',
          text: 'Operations Staff Amina speaking. I have taken over your call and dispatched Surulere Rapid-3.',
          timestamp: minutesAgo(12),
        },
      ],
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: '14 Adeniran Ogunsanya Close, off Bode Thomas, Surulere',
        correctedDescription: '14 Adeniran Ogunsanya Close (Estate Gate B), Surulere, Lagos',
        landmark: 'Leisure Mall / Bode Thomas',
        area: 'Surulere',
        lat: 6.4945,
        lng: 3.3592,
        accuracyMeters: 15,
        capturedAt: minutesAgo(14),
        verifiedBy: 'Amina Bello',
        verifiedAt: minutesAgo(11),
      },
      timeline: [
        {
          id: 'ev-1047-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Emergency report received',
          description: 'Inbound medical report logged via simulated call.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(14),
          isSimulated: true,
        },
        {
          id: 'ev-1047-2',
          type: 'OPERATOR_TAKEOVER',
          title: 'Operations Staff took over incident',
          description: 'Amina Bello assumed human control.',
          actor: 'Amina Bello',
          actorRole: 'Operations Staff',
          timestamp: minutesAgo(12),
          isSimulated: true,
        },
        {
          id: 'ev-1047-3',
          type: 'LOCATION_VERIFIED',
          title: 'Location verified by operator',
          description: 'Confirmed Gate B entry on Adeniran Ogunsanya Close.',
          actor: 'Amina Bello',
          actorRole: 'Operations Staff',
          timestamp: minutesAgo(11),
          isSimulated: true,
        },
        {
          id: 'ev-1047-4',
          type: 'UNIT_ASSIGNED',
          title: 'Approved dispatch: Surulere Rapid-3 (UNIT-RRV-03)',
          description: 'Human operator approved dispatch to 14 Adeniran Ogunsanya Close.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Operations Staff',
          timestamp: minutesAgo(9),
          isSimulated: true,
        },
        {
          id: 'ev-1047-5',
          type: 'UNIT_EN_ROUTE',
          title: 'Unit responding (Simulated)',
          description: 'Surulere Rapid-3 acknowledged and departed station.',
          actor: 'UNIT-RRV-03',
          actorRole: 'Medical Unit',
          timestamp: minutesAgo(4),
          isSimulated: true,
        },
      ],
      notes: [
        {
          id: 'n-1047-1',
          author: 'Amina Bello',
          role: 'Operations Staff',
          text: 'Estate security alerted at Gate B to keep barrier clear.',
          timestamp: minutesAgo(10),
        },
      ],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1044',
      createdAt: minutesAgo(6),
      updatedAt: minutesAgo(5),
      category: 'Other medical emergency',
      priority: 'Unassessed',
      priorityReason: 'Caller dropped before confirming consciousness or breathing status; flagged for urgent operator assessment.',
      status: 'New',
      callerName: 'Kemi O. (Demo)',
      callerPhone: '+234-800-010-1044',
      summary: 'Workplace injury reported near Allen Avenue, Ikeja — insufficient clinical details yet.',
      description: 'Caller states someone fell on office stairs near Allen Avenue; consciousness, bleeding, and exact floor remain unconfirmed.',
      peopleAffected: 1,
      immediateDanger: false,
      clinicalDetails: {
        chiefComplaint: 'Fall injury (details incomplete)',
        consciousness: 'Unknown — needs callback',
        breathing: 'Unknown',
      },
      missingInfoFlags: ['Clinical severity assessment', 'Exact building number / floor', 'Callback confirmation'],
      transcript: [
        {
          id: 't-1044-1',
          speaker: 'CALLER',
          text: 'Someone fell on the stairs at our office near Allen Avenue Ikeja, please help.',
          timestamp: minutesAgo(6),
        },
      ],
      location: {
        source: 'CALLER_DESCRIPTION',
        verificationStatus: 'UNVERIFIED',
        description: 'Office complex near Allen Avenue roundabout, Ikeja',
        landmark: 'Allen Avenue Roundabout',
        area: 'Ikeja',
        lat: 6.6018,
        lng: 3.3515,
        capturedAt: minutesAgo(6),
        carrierNote: 'Carrier location integration not configured',
      },
      timeline: [
        {
          id: 'ev-1044-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Medical emergency report received',
          description: 'Submitted via intake with incomplete clinical details.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(6),
          isSimulated: true,
        },
        {
          id: 'ev-1044-2',
          type: 'OPERATOR_NOTIFIED',
          title: 'Flagged Unassessed — awaiting operator review',
          description: 'Insufficient clinical information; human callback and priority assessment required.',
          actor: 'Responda AI Intake',
          actorRole: 'AI Assistant',
          timestamp: minutesAgo(5),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: true,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1042',
      createdAt: minutesAgo(210),
      updatedAt: minutesAgo(160),
      acceptedAt: minutesAgo(208),
      dispatchedAt: minutesAgo(205),
      acknowledgedAt: minutesAgo(204),
      arrivedAtSceneAt: minutesAgo(195),
      patientPickedUpAt: minutesAgo(188),
      transportStartedAt: minutesAgo(185),
      hospitalArrivedAt: minutesAgo(170),
      resolvedAt: minutesAgo(160),
      closedAt: minutesAgo(160),
      outcome: 'Patient stabilised and handed over to emergency reception at LUTH.',
      hospitalDestination: {
        id: 'hosp-luth',
        name: 'Lagos University Teaching Hospital (LUTH)',
        area: 'Idi-Araba, Surulere / Yaba Axis',
        lat: 6.5177,
        lng: 3.3547,
        isSimulatedDemo: true,
        selectedBy: 'Amina Bello',
        selectedAt: minutesAgo(186),
      },
      category: 'Medical',
      priority: 'Critical',
      priorityReason: 'Acute chest pain with diaphoresis at Victoria Island office complex.',
      status: 'Closed',
      callerName: 'Building Concierge (Demo)',
      callerPhone: '+234-800-010-1042',
      summary: 'Executive experiencing acute chest pain on Adeola Odeku safely transported to LUTH.',
      description: 'Ambulance crew administered oxygen and ECG monitoring on scene prior to hospital transfer.',
      peopleAffected: 1,
      immediateDanger: false,
      clinicalDetails: {
        chiefComplaint: 'Acute chest pain',
        consciousness: 'Conscious',
        breathing: 'Assisted with oxygen',
        bleedingOrInjury: 'None',
        clinicalNotes: 'Handed over stable at LUTH emergency bay.',
      },
      missingInfoFlags: [],
      assignedOperator: 'Amina Bello',
      assignedUnitId: 'UNIT-AMB-04',
      transcript: [
        {
          id: 't-1042-1',
          speaker: 'CALLER',
          text: 'Our director is having severe chest pain at 42 Adeola Odeku Street, Victoria Island.',
          timestamp: minutesAgo(210),
        },
      ],
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: '42 Adeola Odeku Street, Victoria Island, Lagos',
        landmark: 'Adeola Odeku',
        area: 'Victoria Island',
        lat: 6.4281,
        lng: 3.4219,
        capturedAt: minutesAgo(210),
        verifiedBy: 'Amina Bello',
        verifiedAt: minutesAgo(207),
      },
      timeline: [
        {
          id: 'ev-1042-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Medical emergency received',
          description: 'Logged via intake.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(210),
          isSimulated: true,
        },
        {
          id: 'ev-1042-2',
          type: 'UNIT_ASSIGNED',
          title: 'Ambulance dispatched',
          description: 'VI Care-4 dispatched to 42 Adeola Odeku.',
          actor: 'Amina Bello',
          actorRole: 'Operations Staff',
          timestamp: minutesAgo(205),
          isSimulated: true,
        },
        {
          id: 'ev-1042-3',
          type: 'HOSPITAL_ARRIVED',
          title: 'Arrived at LUTH Emergency Reception',
          description: 'Patient handed over safely.',
          actor: 'VI Care-4',
          actorRole: 'Medical Unit',
          timestamp: minutesAgo(170),
          isSimulated: true,
        },
        {
          id: 'ev-1042-4',
          type: 'UNIT_COMPLETED',
          title: 'Incident closed',
          description: 'Patient stabilised and handed over to emergency reception at LUTH.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Operations Staff',
          timestamp: minutesAgo(160),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
  ];

  const notifications: NotificationLog[] = [
    {
      id: 'notif-1',
      channel: 'SYSTEM_ALERT',
      recipient: 'Command Centre Queue',
      message: 'INC-2026-1048 (Road accident · Yaba) flagged Critical — awaiting operator takeover.',
      incidentId: 'INC-2026-1048',
      status: 'DELIVERED_DEMO',
      providerResponse: 'WebSocket broadcast queued (Demo)',
      timestamp: minutesAgo(2),
      isSimulated: true,
    },
    {
      id: 'notif-2',
      channel: 'DISPATCH_ALERT',
      recipient: 'Surulere Rapid-3 (Demo Crew)',
      message: '[SIMULATED DEMO] Dispatch approved for INC-2026-1047 at 14 Adeniran Ogunsanya Close, Surulere.',
      incidentId: 'INC-2026-1047',
      unitId: 'UNIT-RRV-03',
      status: 'DELIVERED_DEMO',
      providerResponse: 'Simulated dispatch alert log (no external carrier message sent)',
      timestamp: minutesAgo(9),
      isSimulated: true,
    },
  ];

  return {
    schemaVersion: 2,
    incidents,
    units,
    notifications,
    staffAccounts: createDefaultStaffAccounts(nowIso),
    organisationSettings: createDefaultOrganisationSettings(),
    sequenceCounter: 1049,
  };
}

const MEDICAL_CATEGORY_SET = new Set<string>([
  'Medical',
  'Road accident',
  'Other medical emergency',
]);

export function mapLegacyPriority(rawPriority?: string): {
  priority: IncidentPriority;
  changed: boolean;
} {
  const upper = String(rawPriority || '').trim().toUpperCase();
  if (upper === 'CRITICAL') return { priority: 'Critical', changed: rawPriority !== 'Critical' };
  if (upper === 'URGENT' || upper === 'HIGH') return { priority: 'Urgent', changed: rawPriority !== 'Urgent' };
  // LOW must preserve its original low-severity meaning -> Standard (NEVER Unassessed!)
  if (upper === 'STANDARD' || upper === 'MEDIUM' || upper === 'LOW') {
    return { priority: 'Standard', changed: rawPriority !== 'Standard' };
  }
  return { priority: 'Unassessed', changed: rawPriority !== 'Unassessed' };
}

export function mapLegacyStatus(rawStatus?: string): {
  status: IncidentStatus;
  changed: boolean;
} {
  const upper = String(rawStatus || '').trim().toUpperCase();
  switch (upper) {
    case 'NEW':
    case 'AI_INTAKE':
    case 'AWAITING_OPERATOR':
      return { status: 'New', changed: rawStatus !== 'New' };
    case 'UNDER_REVIEW':
    case 'VERIFIED':
      return { status: 'Under Review', changed: rawStatus !== 'Under Review' };
    case 'UNIT_ASSIGNED':
    case 'RESPONDING':
    case 'ON_SCENE':
    case 'DISPATCHED':
      return { status: 'Dispatched', changed: rawStatus !== 'Dispatched' };
    case 'PATIENT_TRANSPORT':
    case 'PATIENT TRANSPORT':
      return { status: 'Patient Transport', changed: rawStatus !== 'Patient Transport' };
    case 'RESOLVED':
    case 'CLOSED':
      return { status: 'Closed', changed: rawStatus !== 'Closed' };
    default:
      return { status: 'New', changed: rawStatus !== 'New' };
  }
}

export function mapLegacyUnitAvailability(rawAvail?: string): UnitAvailability {
  const upper = String(rawAvail || '').trim().toUpperCase();
  switch (upper) {
    case 'AVAILABLE':
      return 'Available';
    case 'ASSIGNED':
    case 'ACKNOWLEDGED':
    case 'EN_ROUTE':
    case 'RESPONDING':
      return 'Responding';
    case 'ON_SCENE':
    case 'AT SCENE':
      return 'At Scene';
    case 'TRANSPORTING':
      return 'Transporting';
    default:
      return 'Unavailable';
  }
}

export interface MigrationResult {
  db: RespondaDatabase;
  migrated: boolean;
  backupPath?: string;
}

export async function migrateDatabaseIfNeeded(
  rawDb: Record<string, unknown>,
  options: { backupDir?: string; writeBackup?: boolean } = {}
): Promise<MigrationResult> {
  const nowIso = new Date().toISOString();
  const allowedChannels = ['DISPATCH_ALERT', 'DEMO_SMS', 'SYSTEM_ALERT'];
  const allowedCallChannels = ['WEB_TEXT', 'WEB_VOICE', 'TELEPHONY_ADAPTER', 'DEMO_SCENARIO'];

  const rawSchemaVersion = Number(rawDb.schemaVersion || 1);
  const needsMigration = rawSchemaVersion < 2;

  let backupPath: string | undefined;
  if (needsMigration && options.writeBackup !== false) {
    const dir = options.backupDir || DATA_DIR;
    await fs.mkdir(dir, { recursive: true });
    const stamp = nowIso.replace(/[:.]/g, '-');
    backupPath = path.join(dir, `responda-db.backup-v1-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(rawDb, null, 2), 'utf-8');
  }

  const rawIncidents = Array.isArray(rawDb.incidents)
    ? (rawDb.incidents as Array<Record<string, unknown>>)
    : [];
  const rawUnits = Array.isArray(rawDb.units)
    ? (rawDb.units as Array<Record<string, unknown>>)
    : [];
  const rawNotifications = Array.isArray(rawDb.notifications)
    ? (rawDb.notifications as Array<Record<string, unknown>>)
    : [];

  const incidents: IncidentRecord[] = rawIncidents.map((raw) => {
    const inc = raw as unknown as IncidentRecord;
    const isMedicalCategory = MEDICAL_CATEGORY_SET.has(inc.category);
    const { priority, changed: priChanged } = mapLegacyPriority(String(inc.priority || ''));
    const { status: mappedStatus, changed: statusChanged } = mapLegacyStatus(String(inc.status || ''));

    // Non-medical legacy records are archived read-only without erasing or rewriting original timeline events
    const legacyOutOfScope = Boolean(inc.legacyOutOfScope) || !isMedicalCategory;
    const finalStatus: IncidentStatus = legacyOutOfScope ? 'Closed' : mappedStatus;

    return {
      ...inc,
      priority,
      status: finalStatus,
      legacyOutOfScope: legacyOutOfScope || undefined,
      legacyPriorityOriginal:
        inc.legacyPriorityOriginal || (priChanged ? String(inc.priority) : undefined),
      legacyStatusOriginal:
        inc.legacyStatusOriginal || (statusChanged ? String(inc.status) : undefined),
      closedAt:
        finalStatus === 'Closed'
          ? inc.closedAt || inc.resolvedAt || inc.updatedAt || nowIso
          : inc.closedAt,
      callChannel: allowedCallChannels.includes(inc.callChannel)
        ? inc.callChannel
        : 'TELEPHONY_ADAPTER',
      // Preserve historical timeline verbatim without rewriting past audit entries
      timeline: Array.isArray(inc.timeline) ? inc.timeline : [],
    };
  });

  const units: ResponseUnit[] = rawUnits.map((raw) => {
    const u = raw as unknown as ResponseUnit & { unitType?: string };
    const isMedicalType =
      u.unitType === 'Ambulance' || u.unitType === 'Rapid response vehicle';
    const legacyOutOfScope = Boolean(u.legacyOutOfScope) || !isMedicalType;

    return {
      ...u,
      unitType: isMedicalType ? u.unitType : 'Rapid response vehicle',
      legacyUnitType: u.legacyUnitType || (!isMedicalType ? String(u.unitType) : undefined),
      legacyOutOfScope: legacyOutOfScope || undefined,
      registrationStatus: legacyOutOfScope
        ? 'Inactive'
        : u.registrationStatus === 'Inactive'
        ? 'Inactive'
        : 'Active',
      availability: legacyOutOfScope
        ? 'Unavailable'
        : mapLegacyUnitAvailability(String(u.availability || 'Available')),
      currentAssignmentId: legacyOutOfScope ? undefined : u.currentAssignmentId,
      vehicleRegistration: u.vehicleRegistration || `LAS-${u.id.slice(-3)}`,
      operationalBase: u.operationalBase || `${u.area || 'Lagos'} Medical Station`,
      crewMembers: Array.isArray(u.crewMembers) ? u.crewMembers : [],
      medicalCapabilities: Array.isArray(u.medicalCapabilities)
        ? u.medicalCapabilities
        : u.unitType === 'Ambulance'
        ? ['Basic Life Support (BLS)', 'Patient transport', 'Oxygen support']
        : ['Basic Life Support (BLS)', 'Oxygen support'],
      locationFreshness: u.locationFreshness || 'LAST_KNOWN',
      activityLog: Array.isArray(u.activityLog) ? u.activityLog : [],
    };
  });

  const notifications: NotificationLog[] = rawNotifications.map((raw) => {
    const n = raw as unknown as NotificationLog;
    return {
      ...n,
      channel: allowedChannels.includes(n.channel) ? n.channel : 'DISPATCH_ALERT',
    };
  });

  const staffAccounts = Array.isArray(rawDb.staffAccounts) && rawDb.staffAccounts.length > 0
    ? (rawDb.staffAccounts as StaffAccount[])
    : createDefaultStaffAccounts(nowIso);

  const organisationSettings =
    rawDb.organisationSettings && typeof rawDb.organisationSettings === 'object'
      ? {
          ...createDefaultOrganisationSettings(),
          ...(rawDb.organisationSettings as Partial<OrganisationSettings>),
        }
      : createDefaultOrganisationSettings();

  const sequenceCounter =
    typeof rawDb.sequenceCounter === 'number' && Number.isFinite(rawDb.sequenceCounter)
      ? rawDb.sequenceCounter
      : 1049;

  return {
    db: {
      schemaVersion: 2,
      incidents,
      units,
      notifications,
      staffAccounts,
      organisationSettings,
      sequenceCounter,
    },
    migrated: needsMigration,
    backupPath,
  };
}

class StoreManager {
  private db: RespondaDatabase | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  async init(): Promise<RespondaDatabase> {
    if (this.db) return this.db;
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(parsed.incidents) && Array.isArray(parsed.units)) {
        const result = await migrateDatabaseIfNeeded(parsed, { backupDir: DATA_DIR });
        this.db = result.db;
        if (result.migrated) {
          await this.persist();
        }
        return this.db;
      }
    } catch {
      // Seed fresh database on first start
    }
    this.db = createSeedData();
    await this.persist();
    return this.db;
  }

  async getState(): Promise<RespondaDatabase> {
    return this.init();
  }

  async mutate<T>(fn: (db: RespondaDatabase) => T | Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const db = await this.init();
      const result = await fn(db);
      await this.persist();
      return result;
    };
    const next = this.writeLock.then(run, run);
    this.writeLock = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async persist(): Promise<void> {
    if (!this.db) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpPath = `${DB_PATH}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(this.db, null, 2), 'utf-8');
    await fs.rename(tmpPath, DB_PATH);
  }
}

export const store = new StoreManager();
