import assert from 'node:assert/strict';
import test from 'node:test';
import { IncidentRecord, ResponseUnit } from '../types/responda';
import {
  computeAreaHotspots,
  computeDailyTrend,
  computeHourlyTrend,
  computeIncidentPerformanceRows,
  computeResolutionStats,
  filterAnalyticsIncidents,
} from './analyticsEngine';
import {
  buildAiCallSummary,
  computeIntakeCompleteness,
  computeTalkRatio,
  formatSecondsClock,
} from './conversationIntelligence';

function makeIncident(overrides: Partial<IncidentRecord>): IncidentRecord {
  const baseTime = '2026-11-17T10:00:00.000Z';
  return {
    id: 'INC-TEST-1',
    createdAt: baseTime,
    updatedAt: baseTime,
    category: 'Road accident',
    priority: 'CRITICAL',
    priorityReason: 'Test reason',
    status: 'AWAITING_OPERATOR',
    summary: 'Road accident at Sabo Junction',
    description: 'Two vehicles collided',
    peopleAffected: 2,
    immediateDanger: true,
    dangerDetails: 'Fuel odour',
    missingInfoFlags: ['Exact junction lane'],
    transcript: [
      {
        id: 't1',
        speaker: 'AI',
        text: 'Hello, what happened and where are you?',
        timestamp: baseTime,
      },
      {
        id: 't2',
        speaker: 'CALLER',
        text: 'Two cars crashed near Sabo junction in Yaba with two people injured.',
        timestamp: baseTime,
        extractedTags: ['Yaba', '2 injured'],
      },
    ],
    location: {
      source: 'GPS',
      verificationStatus: 'UNVERIFIED',
      description: 'Herbert Macaulay Way, Sabo, Yaba',
      landmark: 'Sabo Junction',
      area: 'Yaba',
      lat: 6.5095,
      lng: 3.3711,
      capturedAt: baseTime,
    },
    timeline: [],
    notes: [],
    aiIntakeActive: true,
    isSimulated: true,
    callChannel: 'WEB_TEXT',
    ...overrides,
  };
}

const SAMPLE_UNITS: ResponseUnit[] = [
  {
    id: 'UNIT-1',
    callsign: 'Yaba Trauma-2',
    organisation: 'Lagos Metro EMS',
    unitType: 'Ambulance',
    crewDescription: '2 Paramedics',
    locationName: 'Sabo',
    area: 'Yaba',
    lat: 6.5068,
    lng: 3.3775,
    availability: 'AVAILABLE',
    lastLocationUpdate: '2026-11-17T10:00:00.000Z',
    isSimulated: true,
  },
  {
    id: 'UNIT-2',
    callsign: 'Ikoyi Bravo-7',
    organisation: 'Lagos Metro EMS',
    unitType: 'Ambulance',
    crewDescription: '2 Paramedics',
    locationName: 'Bourdillon',
    area: 'Ikoyi',
    lat: 6.4549,
    lng: 3.4346,
    availability: 'EN_ROUTE',
    currentAssignmentId: 'INC-TEST-2',
    lastLocationUpdate: '2026-11-17T10:00:00.000Z',
    isSimulated: true,
  },
];

test('filterAnalyticsIncidents filters cleanly by dateRange, category, and area', () => {
  const nowMs = Date.parse('2026-11-17T12:00:00.000Z');
  const records = [
    makeIncident({
      id: 'INC-1',
      createdAt: '2026-11-17T10:00:00.000Z',
      category: 'Road accident',
      location: {
        source: 'GPS',
        verificationStatus: 'VERIFIED',
        description: 'Yaba',
        area: 'Yaba',
        capturedAt: '2026-11-17T10:00:00.000Z',
      },
    }),
    makeIncident({
      id: 'INC-2',
      createdAt: '2026-11-15T10:00:00.000Z',
      category: 'Medical',
      location: {
        source: 'GPS',
        verificationStatus: 'VERIFIED',
        description: 'Ikoyi',
        area: 'Ikoyi',
        capturedAt: '2026-11-15T10:00:00.000Z',
      },
    }),
    makeIncident({
      id: 'INC-3',
      createdAt: '2026-11-01T10:00:00.000Z',
      category: 'Fire',
      location: {
        source: 'GPS',
        verificationStatus: 'VERIFIED',
        description: 'Surulere',
        area: 'Surulere',
        capturedAt: '2026-11-01T10:00:00.000Z',
      },
    }),
  ];

  const todayYaba = filterAnalyticsIncidents(
    records,
    { dateRange: 'TODAY', category: 'Road accident', area: 'Yaba' },
    nowMs
  );
  assert.equal(todayYaba.length, 1);
  assert.equal(todayYaba[0].id, 'INC-1');

  const last7Days = filterAnalyticsIncidents(
    records,
    { dateRange: '7D', category: 'ALL', area: 'ALL' },
    nowMs
  );
  assert.equal(last7Days.length, 2);
});

test('computeDailyTrend, computeHourlyTrend, computeAreaHotspots, and resolution stats match source data', () => {
  const refNow = new Date('2026-11-17T12:00:00.000Z');
  const records = [
    makeIncident({
      id: 'INC-1',
      createdAt: '2026-11-17T09:15:00.000Z',
      acceptedAt: '2026-11-17T09:17:00.000Z',
      priority: 'CRITICAL',
      status: 'AWAITING_OPERATOR',
    }),
    makeIncident({
      id: 'INC-2',
      createdAt: '2026-11-17T09:45:00.000Z',
      acceptedAt: '2026-11-17T09:48:00.000Z',
      resolvedAt: '2026-11-17T10:25:00.000Z',
      priority: 'HIGH',
      status: 'RESOLVED',
      assignedUnitId: 'UNIT-2',
      location: {
        source: 'OPERATOR_VERIFIED',
        verificationStatus: 'VERIFIED',
        description: 'Bourdillon Road',
        area: 'Ikoyi',
        lat: 6.4549,
        lng: 3.4346,
        capturedAt: '2026-11-17T09:45:00.000Z',
      },
    }),
  ];

  const daily = computeDailyTrend(records, 7, refNow);
  assert.equal(daily.length, 7);
  assert.equal(daily[6].dateKey, '2026-11-17');
  assert.equal(daily[6].total, 2);
  assert.equal(daily[6].critical, 1);
  assert.equal(daily[6].resolved, 1);

  const hourly = computeHourlyTrend(records);
  assert.equal(hourly.length, 24);
  const totalHourly = hourly.reduce((acc, h) => acc + h.total, 0);
  assert.equal(totalHourly, 2);

  const hotspots = computeAreaHotspots(records, SAMPLE_UNITS);
  assert.equal(hotspots.length, 2);
  assert.equal(hotspots.find((h) => h.area === 'Ikoyi')?.resolved, 1);

  const resStats = computeResolutionStats(records);
  assert.equal(resStats.resolutionRatePct, 50);
  assert.equal(resStats.verifiedLocationPct, 50);

  const perfRows = computeIncidentPerformanceRows(records, SAMPLE_UNITS);
  assert.equal(perfRows[0].id, 'INC-2');
  assert.equal(perfRows[0].unitCallsign, 'Ikoyi Bravo-7');
  assert.equal(perfRows[0].resolveMin, 40);
});

test('computeTalkRatio calculates accurate percentages and playback windows', () => {
  const ratio = computeTalkRatio([
    {
      id: '1',
      speaker: 'AI',
      text: 'Hello please state your emergency location',
      timestamp: '2026-11-17T10:00:00.000Z',
    },
    {
      id: '2',
      speaker: 'CALLER',
      text: 'We have an accident at Sabo Yaba near the market junction',
      timestamp: '2026-11-17T10:01:00.000Z',
    },
    {
      id: '3',
      speaker: 'OPERATOR',
      text: 'Operator Amina connected now',
      timestamp: '2026-11-17T10:02:00.000Z',
    },
  ]);

  assert.equal(ratio.totalTurns, 3);
  assert.equal(ratio.callerPct + ratio.aiPct + ratio.operatorPct, 100);
  assert.ok(ratio.estimatedDurationSec > 0);
  assert.equal(ratio.turnWindows.length, 3);
  assert.equal(ratio.turnWindows[0].startSec, 0);
  assert.equal(formatSecondsClock(65), '01:05');
});

test('computeIntakeCompleteness and buildAiCallSummary flag unverified location and missing callback', () => {
  const inc = makeIncident({
    callerPhone: undefined,
    peopleAffected: null,
    assignedOperator: undefined,
    aiIntakeActive: true,
  });

  const completeness = computeIntakeCompleteness(inc);
  assert.equal(completeness.totalChecks, 7);
  assert.ok(completeness.scorePct < 100);

  const summary = buildAiCallSummary(inc);
  assert.ok(summary.missingInfo.length >= 2);
  assert.ok(summary.followUpQuestions.length >= 2);
  assert.equal(summary.peopleAffectedLabel, 'Not yet confirmed by caller');
});
