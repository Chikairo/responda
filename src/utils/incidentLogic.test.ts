import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canApproveDispatch,
  canTakeOver,
  computeAverageAcceptanceMinutes,
  computeDashboardMetrics,
  validateStatusTransition,
} from './incidentLogic';
import { IncidentRecord, ResponseUnit } from '../types/responda';

const sampleIncidents: IncidentRecord[] = [
  {
    id: 'INC-2026-1001',
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-17T10:04:00.000Z',
    acceptedAt: '2026-11-17T10:02:00.000Z',
    category: 'Road accident',
    priority: 'CRITICAL',
    priorityReason: 'Multi-vehicle crash with reported injuries',
    status: 'UNDER_REVIEW',
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
    resolvedAt: '2026-11-17T09:30:00.000Z',
    category: 'Medical',
    priority: 'HIGH',
    priorityReason: 'Chest pain report',
    status: 'RESOLVED',
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
];

const sampleUnits: ResponseUnit[] = [
  {
    id: 'UNIT-AMB-01',
    callsign: 'Ikeja Alpha-1',
    organisation: 'Lagos Private EMS',
    unitType: 'Ambulance',
    crewDescription: '2 Paramedics, 1 Driver',
    locationName: 'Allen Roundabout',
    area: 'Ikeja',
    lat: 6.6018,
    lng: 3.3515,
    availability: 'AVAILABLE',
    lastLocationUpdate: '2026-11-17T10:00:00.000Z',
    isSimulated: true,
  },
  {
    id: 'UNIT-RRV-02',
    callsign: 'Yaba Rapid-2',
    organisation: 'MetroMed Lagos',
    unitType: 'Rapid response vehicle',
    crewDescription: '1 EMT, 1 Driver',
    locationName: 'Sabo Yaba',
    area: 'Yaba',
    lat: 6.5095,
    lng: 3.3711,
    availability: 'EN_ROUTE',
    currentAssignmentId: 'INC-2026-1001',
    lastLocationUpdate: '2026-11-17T10:03:00.000Z',
    isSimulated: true,
  },
];

test('role permissions enforce human dispatch control', () => {
  assert.equal(canApproveDispatch('Dispatcher'), true);
  assert.equal(canApproveDispatch('Administrator'), true);
  assert.equal(canApproveDispatch('Call Operator'), false);
  assert.equal(canApproveDispatch('Responder'), false);
  assert.equal(canTakeOver('Call Operator'), true);
  assert.equal(canTakeOver('Responder'), false);
});

test('status transitions prevent autonomous dispatch without human approval', () => {
  const blocked = validateStatusTransition('VERIFIED', 'UNIT_ASSIGNED', {
    hasHumanApproval: false,
    hasAssignedUnit: false,
  });
  assert.equal(blocked.valid, false);

  const allowed = validateStatusTransition('VERIFIED', 'UNIT_ASSIGNED', {
    hasHumanApproval: true,
    hasAssignedUnit: true,
  });
  assert.equal(allowed.valid, true);
});

test('metrics and average acceptance calculations derive accurately from incident records', () => {
  const avg = computeAverageAcceptanceMinutes(sampleIncidents);
  // (2 min + 4 min) / 2 = 3.0 min
  assert.equal(avg, 3.0);

  const metrics = computeDashboardMetrics(
    sampleIncidents,
    sampleUnits,
    new Date('2026-11-17T10:10:00.000Z')
  );
  assert.equal(metrics.activeCount, 1);
  assert.equal(metrics.criticalCount, 1);
  assert.equal(metrics.availableUnitsCount, 1);
  assert.equal(metrics.respondingUnitsCount, 1);
  assert.equal(metrics.avgAcceptanceMinutes, 3.0);
});
