import fs from 'fs/promises';
import path from 'path';
import type {
  IncidentRecord,
  NotificationLog,
  ResponseUnit,
} from '../src/types/responda.ts';

export interface RespondaDatabase {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  notifications: NotificationLog[];
  sequenceCounter: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'responda-db.json');

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

export function createSeedData(): RespondaDatabase {
  const units: ResponseUnit[] = [
    {
      id: 'UNIT-AMB-01',
      callsign: 'Ikeja Alpha-1',
      organisation: 'Lagos Metro EMS (Demo)',
      unitType: 'Ambulance',
      crewDescription: '2 Trauma Paramedics, 1 EVOC Driver',
      locationName: 'Allen Avenue Roundabout',
      area: 'Ikeja',
      lat: 6.6018,
      lng: 3.3515,
      availability: 'AVAILABLE',
      lastLocationUpdate: minutesAgo(2),
      isSimulated: true,
    },
    {
      id: 'UNIT-AMB-02',
      callsign: 'Yaba Trauma-2',
      organisation: 'Lagos Metro EMS (Demo)',
      unitType: 'Ambulance',
      crewDescription: '1 Emergency Physician, 1 Paramedic, 1 Driver',
      locationName: 'Sabo / Commercial Avenue',
      area: 'Yaba',
      lat: 6.5068,
      lng: 3.3775,
      availability: 'AVAILABLE',
      lastLocationUpdate: minutesAgo(1),
      isSimulated: true,
    },
    {
      id: 'UNIT-RRV-03',
      callsign: 'Surulere Rapid-3',
      organisation: 'SwiftCare Response (Demo)',
      unitType: 'Rapid response vehicle',
      crewDescription: '2 Advanced EMTs',
      locationName: 'Bode Thomas / Adeniran Ogunsanya',
      area: 'Surulere',
      lat: 6.4972,
      lng: 3.3568,
      availability: 'EN_ROUTE',
      currentAssignmentId: 'INC-2026-1047',
      lastLocationUpdate: minutesAgo(1),
      isSimulated: true,
    },
    {
      id: 'UNIT-SEC-04',
      callsign: 'VI Sentinel-4',
      organisation: 'Eko Shield Security (Demo)',
      unitType: 'Security patrol',
      crewDescription: '3 Armed Response Officers',
      locationName: 'Adeola Odeku / Akin Adesola',
      area: 'Victoria Island',
      lat: 6.4281,
      lng: 3.4219,
      availability: 'AVAILABLE',
      lastLocationUpdate: minutesAgo(3),
      isSimulated: true,
    },
    {
      id: 'UNIT-RES-05',
      callsign: 'Lekki Rescue-5',
      organisation: 'Atlantic Rescue Partners (Demo)',
      unitType: 'Rescue team',
      crewDescription: '4 Extrication & Hazmat Specialists',
      locationName: 'Admiralty Way Toll Corridor',
      area: 'Lekki',
      lat: 6.4474,
      lng: 3.4723,
      availability: 'AVAILABLE',
      lastLocationUpdate: minutesAgo(4),
      isSimulated: true,
    },
    {
      id: 'UNIT-FIR-06',
      callsign: 'Eko Fire Partner-6',
      organisation: 'Industrial Fire & Safety (Demo)',
      unitType: 'Fire-response partner',
      crewDescription: '4 Fire Suppression Crew',
      locationName: 'Iganmu / Costain Axis',
      area: 'Surulere',
      lat: 6.4795,
      lng: 3.3665,
      availability: 'ON_SCENE',
      currentAssignmentId: 'INC-2026-1045',
      lastLocationUpdate: minutesAgo(2),
      isSimulated: true,
    },
    {
      id: 'UNIT-AMB-07',
      callsign: 'Ikoyi Bravo-7',
      organisation: 'Lagos Metro EMS (Demo)',
      unitType: 'Ambulance',
      crewDescription: '2 Paramedics, 1 Driver',
      locationName: 'Bourdillon Road Junction',
      area: 'Ikoyi',
      lat: 6.4549,
      lng: 3.4346,
      availability: 'AVAILABLE',
      lastLocationUpdate: minutesAgo(5),
      isSimulated: true,
    },
    {
      id: 'UNIT-SEC-08',
      callsign: 'Ikeja Patrol-8',
      organisation: 'Eko Shield Security (Demo)',
      unitType: 'Security patrol',
      crewDescription: '2 Patrol Officers',
      locationName: 'Alausa Secretariat Way',
      area: 'Ikeja',
      lat: 6.6152,
      lng: 3.3589,
      availability: 'UNAVAILABLE',
      lastLocationUpdate: minutesAgo(18),
      isSimulated: true,
    },
  ];

  const incidents: IncidentRecord[] = [
    {
      id: 'INC-2026-1048',
      createdAt: minutesAgo(3),
      updatedAt: minutesAgo(2),
      category: 'Road accident',
      priority: 'CRITICAL',
      priorityReason: 'Multi-vehicle collision on Herbert Macaulay Way with 2 reported injuries and fuel leak risk.',
      status: 'AWAITING_OPERATOR',
      callerName: 'Tunde A. (Demo)',
      callerPhone: '+234-800-010-1048',
      summary: 'Two-vehicle collision near Sabo Yaba junction; 2 occupants injured and unable to exit vehicle safely.',
      description: 'Caller reports a saloon car and minibus collided at the Sabo junction traffic light. Two passengers injured; traffic backing up.',
      peopleAffected: 2,
      immediateDanger: true,
      dangerDetails: 'Oncoming traffic hazard and minor fuel odour near vehicle.',
      missingInfoFlags: ['Operator verification of exact junction lane'],
      transcript: [
        {
          id: 't-1048-1',
          speaker: 'AI',
          text: 'This is Responda automated intake. Please tell me what happened and where you are located.',
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
          text: 'Understood. Is anyone injured, trapped, or in immediate danger?',
          timestamp: minutesAgo(2.5),
        },
        {
          id: 't-1048-4',
          speaker: 'CALLER',
          text: 'Yes, two people in the car are injured and bleeding, one door is jammed. I smell fuel.',
          timestamp: minutesAgo(2.1),
          extractedTags: ['2 injured', 'Door jammed', 'Fuel odour'],
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
          title: 'AI intake structured report',
          description: 'Extracted Road accident · CRITICAL priority suggestion · Flagged for human takeover.',
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
      priority: 'HIGH',
      priorityReason: 'Acute respiratory distress reported for elderly resident.',
      status: 'RESPONDING',
      callerName: 'Chidinma K. (Demo)',
      callerPhone: '+234-800-010-1047',
      summary: 'Adult experiencing severe shortness of breath inside residential estate off Bode Thomas, Surulere.',
      description: 'Caller reports 68-year-old family member struggling to breathe. Conscious and seated indoors.',
      peopleAffected: 1,
      immediateDanger: false,
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
          text: 'Operator Amina speaking. I have taken over your call and verified your gate code with our Surulere Rapid unit.',
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
          description: 'Inbound report logged via simulated call.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(14),
          isSimulated: true,
        },
        {
          id: 'ev-1047-2',
          type: 'OPERATOR_TAKEOVER',
          title: 'Operator took over incident',
          description: 'Amina Bello assumed human control.',
          actor: 'Amina Bello',
          actorRole: 'Call Operator',
          timestamp: minutesAgo(12),
          isSimulated: true,
        },
        {
          id: 'ev-1047-3',
          type: 'LOCATION_VERIFIED',
          title: 'Location verified by operator',
          description: 'Confirmed Gate B entry on Adeniran Ogunsanya Close.',
          actor: 'Amina Bello',
          actorRole: 'Call Operator',
          timestamp: minutesAgo(11),
          isSimulated: true,
        },
        {
          id: 'ev-1047-4',
          type: 'UNIT_ASSIGNED',
          title: 'Dispatcher assigned UNIT-RRV-03',
          description: 'Surulere Rapid-3 approved for dispatch by human dispatcher.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(9),
          isSimulated: true,
        },
        {
          id: 'ev-1047-5',
          type: 'UNIT_EN_ROUTE',
          title: 'Unit en route (Simulated)',
          description: 'Surulere Rapid-3 acknowledged and departed station.',
          actor: 'UNIT-RRV-03',
          actorRole: 'Responder',
          timestamp: minutesAgo(4),
          isSimulated: true,
        },
      ],
      notes: [
        {
          id: 'n-1047-1',
          author: 'Amina Bello',
          role: 'Call Operator',
          text: 'Estate security alerted at Gate B to keep barrier clear.',
          timestamp: minutesAgo(10),
        },
      ],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1046',
      createdAt: minutesAgo(22),
      updatedAt: minutesAgo(18),
      acceptedAt: minutesAgo(19),
      category: 'Security',
      priority: 'MEDIUM',
      priorityReason: 'Perimeter intrusion alarm at commercial warehouse with no confirmed weapon sighting.',
      status: 'VERIFIED',
      callerName: 'Facility Guard Desk (Demo)',
      callerPhone: '+234-800-010-1046',
      summary: 'Unauthorised perimeter breach alarm at commercial facility off Admiralty Way, Lekki Phase 1.',
      description: 'Motion sensors triggered at rear loading bay. Night guard requested patrol inspection.',
      peopleAffected: 1,
      immediateDanger: false,
      missingInfoFlags: [],
      assignedOperator: 'Seyi Ogunleye',
      transcript: [
        {
          id: 't-1046-1',
          speaker: 'CALLER',
          text: 'Rear gate motion alarm triggered at our Admiralty Way depot in Lekki Phase 1.',
          timestamp: minutesAgo(22),
        },
      ],
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: 'Plot 24 Admiralty Way, Lekki Phase 1, Lagos',
        landmark: 'Admiralty Circle',
        area: 'Lekki',
        lat: 6.4479,
        lng: 3.4678,
        capturedAt: minutesAgo(22),
        verifiedBy: 'Seyi Ogunleye',
        verifiedAt: minutesAgo(18),
      },
      timeline: [
        {
          id: 'ev-1046-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Security alert received',
          description: 'Commercial client security desk initiated report.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(22),
          isSimulated: true,
        },
        {
          id: 'ev-1046-2',
          type: 'OPERATOR_TAKEOVER',
          title: 'Operator took over incident',
          description: 'Seyi Ogunleye verified client callback credentials.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(19),
          isSimulated: true,
        },
        {
          id: 'ev-1046-3',
          type: 'INCIDENT_VERIFIED',
          title: 'Incident & location verified',
          description: 'Ready for patrol unit assignment decision.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(18),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1045',
      createdAt: minutesAgo(36),
      updatedAt: minutesAgo(8),
      acceptedAt: minutesAgo(34),
      dispatchedAt: minutesAgo(30),
      acknowledgedAt: minutesAgo(28),
      category: 'Fire',
      priority: 'CRITICAL',
      priorityReason: 'Electrical transformer fire adjacent to commercial building in Iganmu.',
      status: 'ON_SCENE',
      callerName: 'Ibrahim M. (Demo)',
      callerPhone: '+234-800-010-1045',
      summary: 'Transformer sparks and smoke near warehouse perimeter on Eric Moore / Iganmu axis.',
      description: 'Visible smoke from step-down transformer outside commercial yard; staff evacuated to muster point.',
      peopleAffected: 4,
      immediateDanger: true,
      dangerDetails: 'Live electrical hazard; perimeter cordoned.',
      missingInfoFlags: [],
      assignedOperator: 'Seyi Ogunleye',
      assignedUnitId: 'UNIT-FIR-06',
      transcript: [
        {
          id: 't-1045-1',
          speaker: 'CALLER',
          text: 'Our transformer by Eric Moore / Iganmu road just caught fire with thick black smoke.',
          timestamp: minutesAgo(36),
        },
      ],
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: 'Eric Moore Road industrial corridor, Iganmu, Lagos',
        landmark: 'National Theatre / Iganmu Bridge',
        area: 'Surulere',
        lat: 6.4795,
        lng: 3.3665,
        capturedAt: minutesAgo(36),
        verifiedBy: 'Seyi Ogunleye',
        verifiedAt: minutesAgo(33),
      },
      timeline: [
        {
          id: 'ev-1045-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Fire incident received',
          description: 'Report captured via AI intake.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(36),
          isSimulated: true,
        },
        {
          id: 'ev-1045-2',
          type: 'OPERATOR_TAKEOVER',
          title: 'Operator takeover',
          description: 'Seyi Ogunleye verified evacuation status.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(34),
          isSimulated: true,
        },
        {
          id: 'ev-1045-3',
          type: 'UNIT_ASSIGNED',
          title: 'Fire partner unit assigned',
          description: 'Eko Fire Partner-6 dispatched.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(30),
          isSimulated: true,
        },
        {
          id: 'ev-1045-4',
          type: 'UNIT_ON_SCENE',
          title: 'Unit on scene (Simulated)',
          description: 'Fire crew isolating perimeter and suppressing blaze.',
          actor: 'UNIT-FIR-06',
          actorRole: 'Responder',
          timestamp: minutesAgo(8),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1044',
      createdAt: minutesAgo(6),
      updatedAt: minutesAgo(5),
      category: 'Medical',
      priority: 'HIGH',
      priorityReason: 'Workplace fall injury reported near Allen Avenue; exact building floor missing.',
      status: 'AWAITING_OPERATOR',
      callerName: 'Kemi O. (Demo)',
      callerPhone: '+234-800-010-1044',
      summary: 'Colleague fell down stairwell at office block on Allen Avenue, Ikeja; suspected leg fracture.',
      description: 'Caller states injured person is conscious and in pain; exact suite number not yet confirmed.',
      peopleAffected: 1,
      immediateDanger: false,
      missingInfoFlags: ['Exact building number / floor', 'Callback confirmation'],
      transcript: [
        {
          id: 't-1044-1',
          speaker: 'CALLER',
          text: 'Someone fell on the stairs at our office near Allen Avenue Ikeja. His ankle looks broken.',
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
      },
      timeline: [
        {
          id: 'ev-1044-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Emergency report received',
          description: 'Submitted via text intake.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(6),
          isSimulated: true,
        },
        {
          id: 'ev-1044-2',
          type: 'OPERATOR_NOTIFIED',
          title: 'Awaiting operator review',
          description: 'Missing exact suite number flagged for human follow-up.',
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
      id: 'INC-2026-1043',
      createdAt: minutesAgo(140),
      updatedAt: minutesAgo(85),
      acceptedAt: minutesAgo(137),
      dispatchedAt: minutesAgo(134),
      acknowledgedAt: minutesAgo(132),
      resolvedAt: minutesAgo(85),
      category: 'Environmental hazard',
      priority: 'MEDIUM',
      priorityReason: 'Fallen tree obstructing residential access road in Ikoyi.',
      status: 'RESOLVED',
      callerName: 'Femi D. (Demo)',
      callerPhone: '+234-800-010-1043',
      summary: 'Storm-felled tree cleared from Bourdillon Road lane by rescue crew.',
      description: 'Roadway obstruction cleared and hazard cones removed.',
      peopleAffected: 0,
      immediateDanger: false,
      missingInfoFlags: [],
      assignedOperator: 'Amina Bello',
      assignedUnitId: 'UNIT-RES-05',
      transcript: [
        {
          id: 't-1043-1',
          speaker: 'CALLER',
          text: 'A large branch fell across one lane on Bourdillon Road Ikoyi.',
          timestamp: minutesAgo(140),
        },
      ],
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: 'Bourdillon Road near Alexander Junction, Ikoyi',
        landmark: 'Bourdillon Road',
        area: 'Ikoyi',
        lat: 6.4549,
        lng: 3.4346,
        capturedAt: minutesAgo(140),
        verifiedBy: 'Amina Bello',
        verifiedAt: minutesAgo(136),
      },
      timeline: [
        {
          id: 'ev-1043-1',
          type: 'INCIDENT_RECEIVED',
          title: 'Hazard report received',
          description: 'Logged via intake.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(140),
          isSimulated: true,
        },
        {
          id: 'ev-1043-2',
          type: 'OPERATOR_TAKEOVER',
          title: 'Operator takeover',
          description: 'Amina Bello verified location.',
          actor: 'Amina Bello',
          actorRole: 'Call Operator',
          timestamp: minutesAgo(137),
          isSimulated: true,
        },
        {
          id: 'ev-1043-3',
          type: 'UNIT_ASSIGNED',
          title: 'Rescue team assigned',
          description: 'Lekki Rescue-5 dispatched.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(134),
          isSimulated: true,
        },
        {
          id: 'ev-1043-4',
          type: 'UNIT_COMPLETED',
          title: 'Incident resolved',
          description: 'Roadway cleared and reopened.',
          actor: 'UNIT-RES-05',
          actorRole: 'Responder',
          timestamp: minutesAgo(85),
          isSimulated: true,
        },
      ],
      notes: [],
      aiIntakeActive: false,
      isSimulated: true,
      callChannel: 'WEB_TEXT',
    },
    {
      id: 'INC-2026-1042',
      createdAt: minutesAgo(210),
      updatedAt: minutesAgo(165),
      acceptedAt: minutesAgo(208),
      dispatchedAt: minutesAgo(205),
      acknowledgedAt: minutesAgo(204),
      resolvedAt: minutesAgo(165),
      category: 'Rescue',
      priority: 'HIGH',
      priorityReason: 'Stalled elevator with two occupants inside Victoria Island office building.',
      status: 'CLOSED',
      callerName: 'Building Concierge (Demo)',
      callerPhone: '+234-800-010-1042',
      summary: 'Two occupants safely extracted from stalled passenger lift on Adeola Odeku, Victoria Island.',
      description: 'Facility technicians and rescue crew completed manual release.',
      peopleAffected: 2,
      immediateDanger: false,
      missingInfoFlags: [],
      assignedOperator: 'Amina Bello',
      assignedUnitId: 'UNIT-RES-05',
      transcript: [
        {
          id: 't-1042-1',
          speaker: 'CALLER',
          text: 'Two visitors are stuck in lift 2 at our Adeola Odeku tower.',
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
          title: 'Rescue request received',
          description: 'Logged via intake.',
          actor: 'Responda Intake',
          actorRole: 'System',
          timestamp: minutesAgo(210),
          isSimulated: true,
        },
        {
          id: 'ev-1042-2',
          type: 'UNIT_COMPLETED',
          title: 'Incident closed',
          description: 'Occupants safely assisted; no injuries reported.',
          actor: 'Seyi Ogunleye',
          actorRole: 'Dispatcher',
          timestamp: minutesAgo(165),
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
      message: 'INC-2026-1048 (Road accident · Yaba) flagged CRITICAL — awaiting human operator takeover.',
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
      providerResponse: 'Simulated dispatch alert log (no live external SMS sent)',
      timestamp: minutesAgo(9),
      isSimulated: true,
    },
  ];

  return {
    incidents,
    units,
    notifications,
    sequenceCounter: 1049,
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
      const parsed = JSON.parse(raw) as RespondaDatabase;
      if (Array.isArray(parsed.incidents) && Array.isArray(parsed.units)) {
        // Normalize any legacy channel identifiers from older persisted demo databases
        const allowedChannels = ['DISPATCH_ALERT', 'DEMO_SMS', 'SYSTEM_ALERT'];
        const allowedCallChannels = ['WEB_TEXT', 'WEB_VOICE', 'TELEPHONY_ADAPTER', 'DEMO_SCENARIO'];
        parsed.notifications = (parsed.notifications || []).map((n) => ({
          ...n,
          channel: allowedChannels.includes(n.channel) ? n.channel : 'DISPATCH_ALERT',
        }));
        parsed.incidents = parsed.incidents.map((inc) => ({
          ...inc,
          callChannel: allowedCallChannels.includes(inc.callChannel)
            ? inc.callChannel
            : 'TELEPHONY_ADAPTER',
        }));
        this.db = parsed;
        await this.persist();
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
