import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncidentRecord } from '../types/responda.ts';
import {
  SIMULATION_SCENARIOS,
  SIMULATION_STAGES,
  SIMULATION_TRACKING_DURATION_SEC,
  buildLocationIntelligenceMethods,
  buildScenarioTranscript,
  buildSimulatedCorridorRoute,
  buildSimulatedHospitalTransferCoordinates,
  buildSimulationFinalSummary,
  calculateHaversineKm,
  createSimulationFleetUnits,
  getTrackingMilestoneForElapsed,
  interpolatePointAlongRoute,
  rankUnitsForIncident,
} from './simulationEngine.ts';

function makeSimIncident(overrides: Partial<IncidentRecord> = {}): IncidentRecord {
  const scenario = SIMULATION_SCENARIOS['yaba-accident'];
  const now = '2026-11-23T10:00:00.000Z';
  return {
    id: scenario.incidentId,
    createdAt: now,
    updatedAt: now,
    category: scenario.category,
    priority: scenario.priority,
    priorityReason: scenario.priorityReason,
    status: 'AWAITING_OPERATOR',
    callerName: scenario.callerName,
    callerPhone: scenario.callerPhone,
    summary: scenario.summary,
    description: scenario.description,
    peopleAffected: scenario.peopleAffected,
    immediateDanger: scenario.immediateDanger,
    dangerDetails: scenario.dangerDetails,
    missingInfoFlags: ['Operator verification of exact junction coordinates'],
    transcript: buildScenarioTranscript(scenario, 4, now),
    location: {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: scenario.vagueLocationDescription,
      landmark: scenario.landmark,
      area: scenario.area,
      lat: scenario.resolvedCoords.lat,
      lng: scenario.resolvedCoords.lng,
      accuracyMeters: scenario.resolvedCoords.accuracyMeters,
      capturedAt: now,
      carrierNote: 'Carrier location integration not configured',
    },
    timeline: [],
    notes: [],
    aiIntakeActive: true,
    isSimulated: true,
    callChannel: 'TELEPHONY_ADAPTER',
    ...overrides,
  };
}

test('SIMULATION_STAGES covers all 10 ordered stages', () => {
  assert.equal(SIMULATION_STAGES.length, 10);
  SIMULATION_STAGES.forEach((s, idx) => {
    assert.equal(s.stage, idx + 1);
    assert.ok(s.title.length > 0);
    assert.ok(s.nextExpectedAction.length > 0);
  });
});

test('SIMULATION_SCENARIOS defines all 3 Lagos scenarios with unique deterministic IDs, shrinking flags, and demo hospitals', () => {
  const ids = Object.values(SIMULATION_SCENARIOS).map((s) => s.incidentId);
  assert.deepEqual(ids, ['INC-DEMO-2026-001', 'INC-DEMO-2026-002', 'INC-DEMO-2026-003']);

  for (const scenario of Object.values(SIMULATION_SCENARIOS)) {
    assert.equal(scenario.dialogue.length, 6);
    assert.ok(
      scenario.dialogue[0].remainingMissingFlags.length >=
        scenario.dialogue[scenario.dialogue.length - 1].remainingMissingFlags.length
    );
    assert.ok(scenario.resolvedCoords.lat > 6 && scenario.resolvedCoords.lng > 3);
    assert.equal(scenario.hospitalDestination.isSimulatedDemo, true);
    assert.ok(scenario.hospitalDestination.name.length > 0);
    assert.ok(
      scenario.hospitalDestination.lat > 6 && scenario.hospitalDestination.lng > 3
    );
  }
});

test('createSimulationFleetUnits returns the 4 deterministic simulation Lagos units', () => {
  const units = createSimulationFleetUnits('2026-11-23T10:00:00.000Z');
  assert.deepEqual(
    units.map((u) => u.id),
    ['UNIT-SIM-A01', 'UNIT-SIM-A02', 'UNIT-SIM-R01', 'UNIT-SIM-M01']
  );
  assert.equal(units[0].availability, 'AVAILABLE');
  assert.equal(units[3].availability, 'ASSIGNED');
  assert.ok(units.every((u) => u.isSimulated === true));
});

test('calculateHaversineKm computes positive realistic Lagos distances and rankUnitsForIncident picks closest suitable unit', () => {
  const units = createSimulationFleetUnits();
  const yabaIncident = makeSimIncident();

  const rankedYaba = rankUnitsForIncident(units, yabaIncident, 'UNIT-SIM-A01');
  assert.equal(rankedYaba[0].unit.id, 'UNIT-SIM-A01');
  assert.equal(rankedYaba[0].recommended, true);
  assert.ok(rankedYaba[0].distanceKm !== null && rankedYaba[0].distanceKm > 0 && rankedYaba[0].distanceKm < 3);

  const distSelf = calculateHaversineKm(6.5158, 3.3845, 6.5158, 3.3845);
  assert.equal(distSelf, 0);

  const lekkiScenario = SIMULATION_SCENARIOS['lekki-security'];
  const lekkiIncident = makeSimIncident({
    id: lekkiScenario.incidentId,
    category: lekkiScenario.category,
    location: {
      source: 'CALLER_DESCRIPTION',
      verificationStatus: 'UNVERIFIED',
      description: lekkiScenario.vagueLocationDescription,
      area: lekkiScenario.area,
      lat: lekkiScenario.resolvedCoords.lat,
      lng: lekkiScenario.resolvedCoords.lng,
      capturedAt: '2026-11-23T10:00:00.000Z',
    },
  });
  const rankedLekki = rankUnitsForIncident(units, lekkiIncident, 'UNIT-SIM-R01');
  assert.equal(rankedLekki[0].unit.id, 'UNIT-SIM-R01');
  assert.equal(rankedLekki[0].recommended, true);
});

test('interpolatePointAlongRoute accurately interpolates 0%, 50%, and 100% along route coordinates', () => {
  const coords: [number, number][] = [
    [6.5, 3.37],
    [6.51, 3.38],
    [6.52, 3.39],
  ];
  assert.deepEqual(interpolatePointAlongRoute(coords, 0), [6.5, 3.37]);
  assert.deepEqual(interpolatePointAlongRoute(coords, 50), [6.51, 3.38]);
  assert.deepEqual(interpolatePointAlongRoute(coords, 100), [6.52, 3.39]);

  const corridor = buildSimulatedCorridorRoute(6.5068, 3.3775, 6.5158, 3.3845);
  assert.equal(corridor.isSimulatedFallback, true);
  assert.equal(corridor.coordinates?.length, 5);
});

test('60-second simulation tracking milestones progress cleanly from departed to arrived and never report arrival early', () => {
  assert.equal(SIMULATION_TRACKING_DURATION_SEC, 60);

  const departed = getTrackingMilestoneForElapsed(0, 60, 'Yaba');
  assert.equal(departed.milestoneKey, 'DEPARTED');
  assert.equal(departed.availability, 'ACKNOWLEDGED');
  assert.equal(departed.statusText, 'Response unit has departed.');

  const enRoute = getTrackingMilestoneForElapsed(20, 60, 'Yaba');
  assert.equal(enRoute.milestoneKey, 'EN_ROUTE');
  assert.equal(enRoute.availability, 'EN_ROUTE');
  assert.equal(enRoute.statusText, 'Emergency vehicle is en route to the incident.');

  const approaching = getTrackingMilestoneForElapsed(50, 60, 'Yaba');
  assert.equal(approaching.milestoneKey, 'APPROACHING');
  assert.equal(approaching.availability, 'EN_ROUTE');
  assert.equal(
    approaching.statusText,
    'Response unit is approaching the incident location.'
  );

  const arrived = getTrackingMilestoneForElapsed(60, 60, 'Yaba');
  assert.equal(arrived.milestoneKey, 'ARRIVED');
  assert.equal(arrived.progressPct, 100);
  assert.equal(arrived.availability, 'ON_SCENE');
  assert.equal(
    arrived.statusText,
    'Response unit has arrived at the incident location.'
  );

  const yaba = SIMULATION_SCENARIOS['yaba-accident'];
  const hospitalPts = buildSimulatedHospitalTransferCoordinates(
    yaba.resolvedCoords.lat,
    yaba.resolvedCoords.lng,
    yaba.hospitalDestination
  );
  assert.equal(hospitalPts.length, 5);
  assert.deepEqual(hospitalPts[0], [yaba.resolvedCoords.lat, yaba.resolvedCoords.lng]);
  assert.deepEqual(hospitalPts[4], [
    yaba.hospitalDestination.lat,
    yaba.hospitalDestination.lng,
  ]);
});

test('buildLocationIntelligenceMethods returns A–D methods and keeps Method D honest when unconfigured', () => {
  const unverified = makeSimIncident();
  const methods = buildLocationIntelligenceMethods(unverified, false);
  assert.equal(methods.length, 4);
  assert.equal(methods[0].key, 'GPS');
  assert.equal(methods[1].key, 'CALLER_DESCRIPTION');
  assert.equal(methods[2].key, 'OPERATOR_VERIFIED');
  assert.equal(methods[2].available, false);
  assert.equal(methods[3].key, 'NETWORK_DERIVED');
  assert.equal(methods[3].available, false);
  assert.equal(methods[3].statusText, 'Carrier location integration not configured');

  const verified = makeSimIncident({
    location: {
      ...unverified.location,
      source: 'OPERATOR_VERIFIED',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'Tunde Adeola',
    },
  });
  const methodsVerified = buildLocationIntelligenceMethods(verified, false);
  assert.equal(methodsVerified[2].available, true);
  assert.match(methodsVerified[2].statusText, /VERIFIED/);

  const summary = buildSimulationFinalSummary(verified, createSimulationFleetUnits()[0], null);
  assert.match(summary.headline, /INC-DEMO-2026-001/);
  assert.match(summary.routingNote, /Simulated demo route corridor/);
});
