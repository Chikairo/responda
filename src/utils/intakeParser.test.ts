import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocationFromIntake,
  isValidLagosCoords,
  normalizeIntakeExtraction,
  sanitizePriority,
} from './intakeParser';

test('GPS coordinates never auto-verify an incident location', () => {
  const loc = buildLocationFromIntake({
    callerDescription: 'Near Tejuosho market',
    gps: { lat: 6.5095, lng: 3.3711, accuracyMeters: 18 },
  });
  assert.equal(loc.source, 'GPS');
  assert.equal(loc.verificationStatus, 'UNVERIFIED');
  assert.equal(loc.accuracyMeters, 18);
});

test('caller-described location records source CALLER_DESCRIPTION and stays unverified', () => {
  const loc = buildLocationFromIntake({
    callerDescription: 'Close to UNILAG second gate, Yaba',
    landmark: 'UNILAG Gate',
    area: 'Yaba',
  });
  assert.equal(loc.source, 'CALLER_DESCRIPTION');
  assert.equal(loc.verificationStatus, 'UNVERIFIED');
  assert.equal(isValidLagosCoords(loc.lat, loc.lng), true);
});

test('normalizeIntakeExtraction defaults safely without inventing verified state', () => {
  assert.equal(sanitizePriority('critical'), 'CRITICAL');
  const parsed = normalizeIntakeExtraction({
    category: 'Road accident',
    suggestedPriority: 'CRITICAL',
    peopleAffected: 2,
    immediateDanger: true,
    missingInfoFlags: ['Exact street name'],
  });
  assert.equal(parsed.category, 'Road accident');
  assert.equal(parsed.suggestedPriority, 'CRITICAL');
  assert.equal(parsed.peopleAffected, 2);
  assert.equal(parsed.immediateDanger, true);
  assert.deepEqual(parsed.missingInfoFlags, ['Exact street name']);
});
