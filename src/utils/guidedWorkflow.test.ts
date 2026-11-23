import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncidentRecord, ResponseUnit } from '../types/responda.ts';
import { computeCommandBriefing, computeIncidentWorkflow } from './guidedWorkflow.ts';

function makeIncident(overrides: Partial<IncidentRecord> = {}): IncidentRecord {
  const now = '2026-11-14T10:00:00.000Z';
  return {
    id: 'INC-2026-9999',
    createdAt: now,
    updatedAt: now,
    category: 'Road accident',
    priority: 'CRITICAL',
    priorityReason: 'Two injuries reported.',
    status: 'AWAITING_OPERATOR',
    summary: 'Road accident near UNILAG Gate, Yaba.',
    description: 'Collision near gate.',
    peopleAffected: 2,
    immediateDanger: true,
    missingInfoFlags: [],
    transcript: [
      { id: 't1', speaker: 'AI', text: 'What happened?', timestamp: now },
      { id: 't2', speaker: 'CALLER', text: 'Crash in Yaba!', timestamp: now },
    ],
    location: {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: 'UNILAG Gate, Yaba',
      area: 'Yaba',
      capturedAt: now,
    },
    timeline: [],
    notes: [],
    aiIntakeActive: true,
    isSimulated: true,
    callChannel: 'WEB_TEXT',
    ...overrides,
  };
}

function makeUnit(overrides: Partial<ResponseUnit> = {}): ResponseUnit {
  return {
    id: 'UNIT-AMB-01',
    callsign: 'Ambulance Alpha-1',
    organisation: 'Lagos Metro EMS',
    unitType: 'Ambulance',
    crewDescription: '2 paramedics',
    locationName: 'Yaba Axis',
    area: 'Yaba',
    lat: 6.51,
    lng: 3.38,
    availability: 'AVAILABLE',
    lastLocationUpdate: '2026-11-14T10:00:00.000Z',
    isSimulated: true,
    ...overrides,
  };
}

test('workflow guides operator to Take Over when incident is awaiting operator', () => {
  const inc = makeIncident({ status: 'AWAITING_OPERATOR', aiIntakeActive: true, assignedOperator: undefined });
  const guidance = computeIncidentWorkflow(inc, null);
  assert.equal(guidance.nextActionType, 'TAKE_OVER');
  assert.equal(guidance.steps.length, 8);
  assert.equal(guidance.currentStepIndex, 3);
  assert.equal(guidance.steps[2].status, 'upcoming');
  assert.equal(guidance.steps[3].status, 'current');
});

test('workflow guides operator to Verify Location after takeover when unverified', () => {
  const inc = makeIncident({
    status: 'UNDER_REVIEW',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
    location: {
      source: 'GPS',
      verificationStatus: 'UNVERIFIED',
      description: 'Yaba GPS',
      capturedAt: '2026-11-14T10:00:00.000Z',
    },
  });
  const guidance = computeIncidentWorkflow(inc, null);
  assert.equal(guidance.nextActionType, 'VERIFY_LOCATION');
  assert.equal(guidance.currentStepIndex, 2);
  assert.equal(guidance.nextTabTarget, 'location');
});

test('workflow separates Select Unit and Approve Dispatch when location is verified', () => {
  const inc = makeIncident({
    status: 'VERIFIED',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'UNILAG Gate, Yaba',
      capturedAt: '2026-11-14T10:00:00.000Z',
    },
  });

  const stepSelect = computeIncidentWorkflow(inc, null, false);
  assert.equal(stepSelect.nextActionType, 'SELECT_UNIT');
  assert.equal(stepSelect.currentStepIndex, 4);

  const stepApprove = computeIncidentWorkflow(inc, null, true);
  assert.equal(stepApprove.nextActionType, 'APPROVE_DISPATCH');
  assert.equal(stepApprove.currentStepIndex, 5);
});

test('workflow guides Track Response while en route and Close Incident when on scene or resolved', () => {
  const unitEnRoute = makeUnit({ availability: 'EN_ROUTE', currentAssignmentId: 'INC-2026-9999' });
  const incResponding = makeIncident({
    status: 'RESPONDING',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
    assignedUnitId: unitEnRoute.id,
    dispatchedAt: '2026-11-14T10:05:00.000Z',
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'UNILAG Gate',
      capturedAt: '2026-11-14T10:00:00.000Z',
    },
  });

  const tracking = computeIncidentWorkflow(incResponding, unitEnRoute);
  assert.equal(tracking.nextActionType, 'TRACK_RESPONSE');
  assert.equal(tracking.currentStepIndex, 6);

  const incResolved = { ...incResponding, status: 'RESOLVED' as const };
  const closing = computeIncidentWorkflow(incResolved, null);
  assert.equal(closing.nextActionType, 'CLOSE_INCIDENT');
  assert.equal(closing.currentStepIndex, 7);
});

test('command briefing prioritizes critical unaccepted incident first', () => {
  const lowVerified = makeIncident({
    id: 'INC-LOW',
    priority: 'LOW',
    status: 'VERIFIED',
    assignedOperator: 'Seyi',
    aiIntakeActive: false,
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'Ikeja',
      capturedAt: '2026-11-14T09:50:00.000Z',
    },
  });
  const criticalAwaiting = makeIncident({
    id: 'INC-CRIT',
    priority: 'CRITICAL',
    status: 'AWAITING_OPERATOR',
  });
  const briefing = computeCommandBriefing([lowVerified, criticalAwaiting], [makeUnit()]);
  assert.equal(briefing.focusIncident?.id, 'INC-CRIT');
  assert.equal(briefing.focusAction, 'TAKE_OVER');
});
