import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocationFromIntake,
  isValidLagosCoords,
  normalizeIntakeExtraction,
  sanitizeCategory,
  sanitizePriority,
} from './intakeParser.ts';

test('GPS and caller-described coordinates never auto-verify an incident location', () => {
  const gpsLoc = buildLocationFromIntake({
    callerDescription: 'Near Tejuosho market',
    gps: { lat: 6.5095, lng: 3.3711, accuracyMeters: 18 },
  });
  assert.equal(gpsLoc.source, 'GPS');
  assert.equal(gpsLoc.verificationStatus, 'UNVERIFIED');
  assert.equal(gpsLoc.accuracyMeters, 18);

  const callerLoc = buildLocationFromIntake({
    callerDescription: 'Close to UNILAG second gate, Yaba',
    landmark: 'UNILAG Gate',
    area: 'Yaba',
  });
  assert.equal(callerLoc.source, 'CALLER_DESCRIPTION');
  assert.equal(callerLoc.verificationStatus, 'UNVERIFIED');
  assert.equal(isValidLagosCoords(callerLoc.lat, callerLoc.lng), true);
});

test('sanitizePriority preserves LOW as Standard and reserves Unassessed for missing clinical details', () => {
  assert.equal(sanitizePriority('Critical'), 'Critical');
  assert.equal(sanitizePriority('CRITICAL'), 'Critical');
  assert.equal(sanitizePriority('HIGH'), 'Urgent');
  assert.equal(sanitizePriority('Urgent'), 'Urgent');
  assert.equal(sanitizePriority('MEDIUM'), 'Standard');
  assert.equal(sanitizePriority('LOW'), 'Standard');
  assert.equal(sanitizePriority('Standard'), 'Standard');
  assert.equal(sanitizePriority('Unassessed'), 'Unassessed');
  assert.equal(sanitizePriority(''), 'Unassessed');
  assert.equal(sanitizePriority(undefined), 'Unassessed');
});

test('sanitizeCategory restricts to medical categories and normalizeIntakeExtraction flags Unassessed for review', () => {
  assert.equal(sanitizeCategory('Road accident'), 'Road accident');
  assert.equal(sanitizeCategory('Cardiac distress'), 'Medical');
  assert.equal(sanitizeCategory('Workplace fall'), 'Other medical emergency');

  const crit = normalizeIntakeExtraction({
    category: 'Road accident',
    suggestedPriority: 'Critical',
    peopleAffected: 2,
    immediateDanger: true,
    missingInfoFlags: ['Exact street name'],
  });
  assert.equal(crit.category, 'Road accident');
  assert.equal(crit.suggestedPriority, 'Critical');
  assert.equal(crit.peopleAffected, 2);
  assert.equal(crit.immediateDanger, true);
  assert.deepEqual(crit.missingInfoFlags, ['Exact street name']);

  const unassessed = normalizeIntakeExtraction({
    category: 'Other medical emergency',
    suggestedPriority: 'Unassessed',
  });
  assert.equal(unassessed.suggestedPriority, 'Unassessed');
  assert.equal(unassessed.needsImmediateHumanAttention, true);
});
