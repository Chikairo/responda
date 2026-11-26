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
    priority: 'Critical',
    priorityReason: 'Two injuries reported.',
    status: 'New',
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
    registrationStatus: 'Active',
    vehicleRegistration: 'LAS-401-EM',
    operationalBase: 'Yaba Medical Post',
    crewDescription: '2 paramedics',
    crewMembers: [],
    medicalCapabilities: ['Advanced Life Support (ALS)', 'Patient transport'],
    locationName: 'Yaba Axis',
    area: 'Yaba',
    lat: 6.51,
    lng: 3.38,
    locationFreshness: 'LIVE',
    availability: 'Available',
    lastLocationUpdate: '2026-11-14T10:00:00.000Z',
    isSimulated: true,
    ...overrides,
  };
}

test('5-milestone workflow guides operator to Take Over when incident is New', () => {
  const inc = makeIncident({ status: 'New', aiIntakeActive: true, assignedOperator: undefined });
  const guidance = computeIncidentWorkflow(inc, null);
  assert.equal(guidance.milestones.length, 5);
  assert.equal(guidance.currentMilestoneIndex, 0);
  assert.equal(guidance.nextActionType, 'TAKE_OVER');
  assert.equal(guidance.milestones[0].status, 'current');
});

test('workflow flags Unassessed priority before dispatch and guides to medical-details or location', () => {
  const inc = makeIncident({
    status: 'Under Review',
    priority: 'Unassessed',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'UNILAG Gate, Yaba',
      capturedAt: '2026-11-14T10:00:00.000Z',
    },
  });
  const priorityGuidance = computeIncidentWorkflow(inc, null);
  assert.equal(priorityGuidance.currentMilestoneIndex, 1);
  assert.equal(priorityGuidance.nextActionType, 'ASSESS_PRIORITY');
  assert.equal(priorityGuidance.nextTabTarget, 'medical-details');

  const unverifiedLocInc = makeIncident({
    status: 'Under Review',
    priority: 'Critical',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
  });
  const locGuidance = computeIncidentWorkflow(unverifiedLocInc, null);
  assert.equal(locGuidance.currentMilestoneIndex, 1);
  assert.equal(locGuidance.nextActionType, 'VERIFY_LOCATION');
  assert.equal(locGuidance.nextTabTarget, 'location');
});

test('workflow separates Select Unit and Approve Dispatch in Milestone 3', () => {
  const inc = makeIncident({
    status: 'Under Review',
    priority: 'Critical',
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
  assert.equal(stepSelect.currentMilestoneIndex, 2);
  assert.equal(stepSelect.nextActionType, 'SELECT_UNIT');
  assert.equal(stepSelect.nextTabTarget, 'response');

  const stepApprove = computeIncidentWorkflow(inc, null, true);
  assert.equal(stepApprove.currentMilestoneIndex, 2);
  assert.equal(stepApprove.nextActionType, 'APPROVE_DISPATCH');
  assert.equal(stepApprove.nextTabTarget, 'response');
});

test('workflow guides Milestone 4 response/transport and Milestone 5 closure after hospital arrival', () => {
  const unitResponding = makeUnit({ availability: 'Responding', currentAssignmentId: 'INC-2026-9999' });
  const incDispatched = makeIncident({
    status: 'Dispatched',
    aiIntakeActive: false,
    assignedOperator: 'Seyi Ogunleye',
    assignedUnitId: unitResponding.id,
    dispatchedAt: '2026-11-14T10:05:00.000Z',
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'UNILAG Gate',
      capturedAt: '2026-11-14T10:00:00.000Z',
    },
  });

  const tracking = computeIncidentWorkflow(incDispatched, unitResponding);
  assert.equal(tracking.currentMilestoneIndex, 3);
  assert.equal(tracking.nextActionType, 'TRACK_RESPONSE');
  assert.equal(tracking.nextTabTarget, 'response');

  const incHospitalArrived = {
    ...incDispatched,
    status: 'Patient Transport' as const,
    transportStartedAt: '2026-11-14T10:12:00.000Z',
    hospitalArrivedAt: '2026-11-14T10:25:00.000Z',
    hospitalDestination: {
      id: 'hosp-luth',
      name: 'Lagos University Teaching Hospital (LUTH)',
      area: 'Idi-Araba',
      lat: 6.5177,
      lng: 3.3547,
    },
  };
  const closing = computeIncidentWorkflow(incHospitalArrived, unitResponding);
  assert.equal(closing.currentMilestoneIndex, 4);
  assert.equal(closing.nextActionType, 'CLOSE_INCIDENT');

  const closedInc = { ...incHospitalArrived, status: 'Closed' as const, closedAt: '2026-11-14T10:30:00.000Z' };
  const archived = computeIncidentWorkflow(closedInc, null);
  assert.equal(archived.nextActionType, 'COMPLETED');
  assert.ok(archived.milestones.every((m) => m.status === 'done'));
});

test('command briefing prioritizes New incident awaiting takeover over Standard ready incident', () => {
  const stdVerified = makeIncident({
    id: 'INC-STD',
    priority: 'Standard',
    status: 'Under Review',
    assignedOperator: 'Seyi Ogunleye',
    aiIntakeActive: false,
    location: {
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      description: 'Ikeja',
      capturedAt: '2026-11-14T09:50:00.000Z',
    },
  });
  const criticalNew = makeIncident({
    id: 'INC-CRIT',
    priority: 'Critical',
    status: 'New',
  });
  const briefing = computeCommandBriefing([stdVerified, criticalNew], [makeUnit()]);
  assert.equal(briefing.focusIncident?.id, 'INC-CRIT');
  assert.equal(briefing.focusAction, 'TAKE_OVER');
});
