import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INCIDENT_STATUS_ORDER,
  canApproveDispatch,
  canManageIntegrations,
  canManageOrganisation,
  canManageStaff,
  canManageUnits,
  canTakeOver,
  canUpdateIncidentStatus,
  canUpdateUnitStatus,
  canVerifyIncident,
  computeAverageAcceptanceMinutes,
  computeDashboardMetrics,
  isActiveIncidentStatus,
  mapUnitAvailabilityToIncidentStatus,
  validateStatusTransition,
} from './incidentLogic.ts';
import type { IncidentRecord, ResponseUnit } from '../types/responda.ts';

const sampleIncidents: IncidentRecord[] = [
  {
    id: 'INC-2026-1001',
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-17T10:04:00.000Z',
    acceptedAt: '2026-11-17T10:02:00.000Z',
    category: 'Road accident',
    priority: 'Critical',
    priorityReason: 'Multi-vehicle crash with reported injuries',
    status: 'Under Review',
    summary: 'Two-car collision near Yaba',
    description: 'Two vehicles collided; two injured',
    peopleAffected: 2,
    immediateDanger: true,
    missingInfoFlags: [],
    transcript: [],
    location: {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: 'Near UNILAG gate, Yaba',
      capturedAt: '2026-11-17T10:00:00.000Z',
    },
    timeline: [],
    notes: [],
    aiIntakeActive: false,
    isSimulated: true,
    callChannel: 'WEB_TEXT',
  },
  {
    id: 'INC-2026-1002',
    createdAt: '2026-11-17T09:00:00.000Z',
    updatedAt: '2026-11-17T09:30:00.000Z',
    acceptedAt: '2026-11-17T09:04:00.000Z',
    closedAt: '2026-11-17T09:30:00.000Z',
    category: 'Medical',
    priority: 'Urgent',
    priorityReason: 'Chest pain report',
    status: 'Closed',
    summary: 'Medical assistance in Ikeja',
    description: 'Adult experiencing chest pain',
    peopleAffected: 1,
    immediateDanger: false,
    missingInfoFlags: [],
    transcript: [],
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'Allen Avenue, Ikeja',
      capturedAt: '2026-11-17T09:00:00.000Z',
    },
    timeline: [],
    notes: [],
    aiIntakeActive: false,
    isSimulated: true,
    callChannel: 'WEB_TEXT',
  },
  {
    id: 'INC-2026-1003',
    createdAt: '2026-11-17T10:05:00.000Z',
    updatedAt: '2026-11-17T10:05:00.000Z',
    category: 'Other medical emergency',
    priority: 'Unassessed',
    priorityReason: 'Caller disconnected early.',
    status: 'New',
    summary: 'Unassessed fall injury report',
    description: 'Fall on stairs; details incomplete',
    peopleAffected: 1,
    immediateDanger: false,
    missingInfoFlags: ['Clinical assessment'],
    transcript: [],
    location: {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: 'Allen Avenue, Ikeja',
      capturedAt: '2026-11-17T10:05:00.000Z',
    },
    timeline: [],
    notes: [],
    aiIntakeActive: true,
    isSimulated: true,
    callChannel: 'WEB_TEXT',
  },
  {
    id: 'INC-2026-LEGACY',
    createdAt: '2026-11-17T08:00:00.000Z',
    updatedAt: '2026-11-17T08:15:00.000Z',
    closedAt: '2026-11-17T08:15:00.000Z',
    category: 'Fire',
    priority: 'Urgent',
    priorityReason: 'Archived legacy non-medical record',
    status: 'Closed',
    legacyOutOfScope: true,
    summary: 'Legacy non-medical record',
    description: 'Legacy incident archived out of scope',
    peopleAffected: 0,
    immediateDanger: false,
    missingInfoFlags: [],
    transcript: [],
    location: {
      source: 'MANUAL',
      verificationStatus: 'VERIFIED',
      description: 'Ikeja',
      capturedAt: '2026-11-17T08:00:00.000Z',
    },
    timeline: [],
    notes: [],
    aiIntakeActive: false,
    isSimulated: true,
    callChannel: 'TELEPHONY_ADAPTER',
  },
];

const sampleUnits: ResponseUnit[] = [
  {
    id: 'UNIT-AMB-01',
    callsign: 'Ikeja Alpha-1',
    organisation: 'Lagos Metro EMS',
    unitType: 'Ambulance',
    registrationStatus: 'Active',
    vehicleRegistration: 'LAS-401-EM',
    operationalBase: 'Allen Avenue, Ikeja',
    crewDescription: '2 Paramedics, 1 Driver',
    crewMembers: [],
    medicalCapabilities: ['Advanced Life Support (ALS)', 'Patient transport'],
    locationName: 'Allen Roundabout',
    area: 'Ikeja',
    lat: 6.6018,
    lng: 3.3515,
    locationFreshness: 'LIVE',
    availability: 'Available',
    lastLocationUpdate: '2026-11-17T10:00:00.000Z',
    isSimulated: true,
  },
  {
    id: 'UNIT-RRV-02',
    callsign: 'Yaba Rapid-2',
    organisation: 'SwiftCare Medical Response',
    unitType: 'Rapid response vehicle',
    registrationStatus: 'Active',
    vehicleRegistration: 'LAS-202-RR',
    operationalBase: 'Sabo Post, Yaba',
    crewDescription: '1 EMT, 1 Driver',
    crewMembers: [],
    medicalCapabilities: ['Basic Life Support (BLS)', 'Oxygen support'],
    locationName: 'Sabo Yaba',
    area: 'Yaba',
    lat: 6.5095,
    lng: 3.3711,
    locationFreshness: 'LIVE',
    availability: 'Responding',
    currentAssignmentId: 'INC-2026-1001',
    lastLocationUpdate: '2026-11-17T10:03:00.000Z',
    isSimulated: true,
  },
  {
    id: 'UNIT-LEGACY-99',
    callsign: 'Legacy Non-Med 99',
    organisation: 'Legacy Dept',
    unitType: 'Rapid response vehicle',
    registrationStatus: 'Inactive',
    legacyOutOfScope: true,
    vehicleRegistration: 'LAS-OLD-99',
    operationalBase: 'Archived Base',
    crewDescription: 'Inactive',
    crewMembers: [],
    medicalCapabilities: [],
    locationName: 'Yaba',
    area: 'Yaba',
    lat: 6.5,
    lng: 3.37,
    locationFreshness: 'UNAVAILABLE',
    availability: 'Unavailable',
    lastLocationUpdate: '2026-11-17T08:00:00.000Z',
    isSimulated: true,
  },
];

test('strict two-role permissions isolate Operations Staff from Organisation Administrator', () => {
  assert.equal(canTakeOver('Operations Staff'), true);
  assert.equal(canVerifyIncident('Operations Staff'), true);
  assert.equal(canApproveDispatch('Operations Staff'), true);
  assert.equal(canUpdateIncidentStatus('Operations Staff'), true);
  assert.equal(canUpdateUnitStatus('Operations Staff'), true);
  assert.equal(canManageStaff('Operations Staff'), false);
  assert.equal(canManageUnits('Operations Staff'), false);
  assert.equal(canManageOrganisation('Operations Staff'), false);
  assert.equal(canManageIntegrations('Operations Staff'), false);

  assert.equal(canTakeOver('Organisation Administrator'), false);
  assert.equal(canApproveDispatch('Organisation Administrator'), false);
  assert.equal(canManageStaff('Organisation Administrator'), true);
  assert.equal(canManageUnits('Organisation Administrator'), true);
  assert.equal(canManageOrganisation('Organisation Administrator'), true);
  assert.equal(canManageIntegrations('Organisation Administrator'), true);
});

test('5-status workflow validates dispatch requirements and locks Closed incidents', () => {
  assert.deepEqual(INCIDENT_STATUS_ORDER, [
    'New',
    'Under Review',
    'Dispatched',
    'Patient Transport',
    'Closed',
  ]);
  assert.equal(isActiveIncidentStatus('New'), true);
  assert.equal(isActiveIncidentStatus('Patient Transport'), true);
  assert.equal(isActiveIncidentStatus('Closed'), false);

  const blocked = validateStatusTransition('Under Review', 'Dispatched', {
    hasHumanApproval: false,
    hasAssignedUnit: false,
  });
  assert.equal(blocked.valid, false);

  const allowed = validateStatusTransition('Under Review', 'Dispatched', {
    hasHumanApproval: true,
    hasAssignedUnit: true,
  });
  assert.equal(allowed.valid, true);

  const lockedClosed = validateStatusTransition('Closed', 'Under Review', {
    hasHumanApproval: true,
    hasAssignedUnit: true,
  });
  assert.equal(lockedClosed.valid, false);

  assert.equal(mapUnitAvailabilityToIncidentStatus('Responding'), 'Dispatched');
  assert.equal(mapUnitAvailabilityToIncidentStatus('At Scene'), 'Dispatched');
  assert.equal(mapUnitAvailabilityToIncidentStatus('Transporting'), 'Patient Transport');
  assert.equal(mapUnitAvailabilityToIncidentStatus('Available'), null);
});

test('metrics exclude legacyOutOfScope and Inactive units while counting Unassessed', () => {
  const avg = computeAverageAcceptanceMinutes(sampleIncidents);
  assert.equal(avg, 3.0);

  const metrics = computeDashboardMetrics(
    sampleIncidents,
    sampleUnits,
    new Date('2026-11-17T10:10:00.000Z')
  );
  assert.equal(metrics.activeCount, 2); // INC-2026-1001 + INC-2026-1003 (excludes Closed & legacyOutOfScope)
  assert.equal(metrics.criticalCount, 1);
  assert.equal(metrics.unassessedCount, 1);
  assert.equal(metrics.availableUnitsCount, 1);
  assert.equal(metrics.respondingUnitsCount, 1);
  assert.equal(metrics.avgAcceptanceMinutes, 3.0);
});
