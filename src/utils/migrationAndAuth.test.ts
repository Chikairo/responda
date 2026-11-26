import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import {
  createAuthMiddleware,
  issueDemoSession,
  signSessionToken,
  verifySessionToken,
  type AuthenticatedRequest,
} from '../../server/auth.ts';
import {
  createDefaultStaffAccounts,
  mapLegacyPriority,
  mapLegacyStatus,
  migrateDatabaseIfNeeded,
} from '../../server/store.ts';
import type { StaffAccount } from '../types/responda.ts';

test('mapLegacyPriority preserves LOW as Standard and never maps LOW to Unassessed', () => {
  assert.deepEqual(mapLegacyPriority('LOW'), { priority: 'Standard', changed: true });
  assert.deepEqual(mapLegacyPriority('MEDIUM'), { priority: 'Standard', changed: true });
  assert.deepEqual(mapLegacyPriority('HIGH'), { priority: 'Urgent', changed: true });
  assert.deepEqual(mapLegacyPriority('CRITICAL'), { priority: 'Critical', changed: true });
  assert.deepEqual(mapLegacyPriority(''), { priority: 'Unassessed', changed: true });
  assert.deepEqual(mapLegacyPriority('Unassessed'), { priority: 'Unassessed', changed: false });
});

test('mapLegacyStatus converts legacy states cleanly', () => {
  assert.equal(mapLegacyStatus('AWAITING_OPERATOR').status, 'New');
  assert.equal(mapLegacyStatus('UNDER_REVIEW').status, 'Under Review');
  assert.equal(mapLegacyStatus('VERIFIED').status, 'Under Review');
  assert.equal(mapLegacyStatus('RESPONDING').status, 'Dispatched');
  assert.equal(mapLegacyStatus('RESOLVED').status, 'Closed');
});

test('migrateDatabaseIfNeeded writes backup, preserves audit timelines verbatim, archives non-medical records, and maps LOW -> Standard', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'responda-mig-'));
  try {
    const originalTimeline = [
      {
        id: 'ev-hist-1',
        type: 'INCIDENT_RECEIVED',
        title: 'Original legacy event',
        description: 'Recorded with original priority LOW',
        actor: 'Legacy Router',
        actorRole: 'System',
        timestamp: '2026-10-01T08:00:00.000Z',
      },
    ];

    const v1Raw: Record<string, unknown> = {
      schemaVersion: 1,
      sequenceCounter: 1055,
      incidents: [
        {
          id: 'INC-2026-0901',
          createdAt: '2026-10-01T08:00:00.000Z',
          updatedAt: '2026-10-01T08:05:00.000Z',
          category: 'Medical',
          priority: 'LOW',
          priorityReason: 'Minor sprain',
          status: 'VERIFIED',
          summary: 'Low severity sprain',
          description: 'Minor injury',
          peopleAffected: 1,
          immediateDanger: false,
          missingInfoFlags: [],
          transcript: [],
          location: {
            source: 'CALLER_DESCRIPTION',
            verificationStatus: 'VERIFIED',
            description: 'Yaba',
            capturedAt: '2026-10-01T08:00:00.000Z',
          },
          timeline: originalTimeline,
          notes: [],
          aiIntakeActive: false,
          isSimulated: true,
          callChannel: 'WEB_TEXT',
        },
        {
          id: 'INC-2026-0902',
          createdAt: '2026-10-01T09:00:00.000Z',
          updatedAt: '2026-10-01T09:10:00.000Z',
          category: 'Fire',
          priority: 'HIGH',
          priorityReason: 'Transformer fire',
          status: 'RESPONDING',
          summary: 'Legacy fire report',
          description: 'Fire report',
          peopleAffected: 0,
          immediateDanger: true,
          missingInfoFlags: [],
          transcript: [],
          location: {
            source: 'GPS',
            verificationStatus: 'UNVERIFIED',
            description: 'Lekki',
            capturedAt: '2026-10-01T09:00:00.000Z',
          },
          timeline: originalTimeline,
          notes: [],
          aiIntakeActive: false,
          isSimulated: true,
          callChannel: 'WEB_TEXT',
        },
      ],
      units: [
        {
          id: 'UNIT-FIRE-01',
          callsign: 'Lekki Fire-1',
          organisation: 'Lagos Fire',
          unitType: 'Fire truck',
          crewDescription: '4 Firefighters',
          locationName: 'Lekki',
          area: 'Lekki',
          lat: 6.44,
          lng: 3.47,
          availability: 'EN_ROUTE',
          currentAssignmentId: 'INC-2026-0902',
          lastLocationUpdate: '2026-10-01T09:05:00.000Z',
          isSimulated: true,
        },
      ],
      notifications: [],
    };

    const result = await migrateDatabaseIfNeeded(v1Raw, {
      backupDir: tmpDir,
      writeBackup: true,
    });

    assert.equal(result.migrated, true);
    assert.ok(result.backupPath);
    const backupContent = await fs.readFile(result.backupPath!, 'utf-8');
    assert.ok(backupContent.includes('Fire truck'));

    const med = result.db.incidents.find((i) => i.id === 'INC-2026-0901')!;
    assert.equal(med.priority, 'Standard');
    assert.equal(med.legacyPriorityOriginal, 'LOW');
    assert.equal(med.status, 'Under Review');
    assert.equal(med.legacyStatusOriginal, 'VERIFIED');
    assert.equal(med.legacyOutOfScope, undefined);
    assert.deepEqual(med.timeline, originalTimeline);

    const fireInc = result.db.incidents.find((i) => i.id === 'INC-2026-0902')!;
    assert.equal(fireInc.category, 'Fire');
    assert.equal(fireInc.priority, 'Urgent');
    assert.equal(fireInc.status, 'Closed');
    assert.equal(fireInc.legacyOutOfScope, true);
    assert.deepEqual(fireInc.timeline, originalTimeline);

    const fireUnit = result.db.units.find((u) => u.id === 'UNIT-FIRE-01')!;
    assert.equal(fireUnit.legacyOutOfScope, true);
    assert.equal(fireUnit.legacyUnitType, 'Fire truck');
    assert.equal(fireUnit.registrationStatus, 'Inactive');
    assert.equal(fireUnit.availability, 'Unavailable');
    assert.equal(fireUnit.currentAssignmentId, undefined);

    assert.equal(result.db.schemaVersion, 2);
    assert.ok(result.db.staffAccounts.length >= 4);
    assert.equal(typeof result.db.organisationSettings.requireLocationVerificationBeforeDispatch, 'boolean');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('server auth verifies HMAC tokens, blocks forged headers, blocks INACTIVE/INVITED accounts, and enforces roles', async () => {
  const accounts: StaffAccount[] = [
    ...createDefaultStaffAccounts('2026-11-26T00:00:00.000Z'),
    {
      id: 'staff-inactive',
      name: 'Disabled Operator',
      email: 'disabled@responda.ng',
      role: 'Operations Staff',
      accountStatus: 'INACTIVE',
      badgeCode: 'OPS-999',
      dateAdded: '2026-11-26T00:00:00.000Z',
    },
  ];

  const opsAccount = accounts.find((a) => a.id === 'staff-ops-1')!;
  const adminAccount = accounts.find((a) => a.id === 'staff-admin-1')!;
  const invitedAccount = accounts.find((a) => a.accountStatus === 'INVITED')!;
  const inactiveAccount = accounts.find((a) => a.accountStatus === 'INACTIVE')!;

  assert.throws(() => issueDemoSession(invitedAccount));
  assert.throws(() => issueDemoSession(inactiveAccount));

  const opsSession = issueDemoSession(opsAccount);
  const adminSession = issueDemoSession(adminAccount);

  assert.ok(verifySessionToken(opsSession.token));
  assert.equal(verifySessionToken(`${opsSession.token}tampered`), null);

  const expiredToken = signSessionToken({
    accountId: opsAccount.id,
    role: opsAccount.role,
    issuedAt: Date.now() - 10_000,
    exp: Date.now() - 1000,
  });
  assert.equal(verifySessionToken(expiredToken), null);

  const { requireRole } = createAuthMiddleware(async () => accounts);

  async function invokeRoleMiddleware(
    allowedRoles: Array<'Operations Staff' | 'Organisation Administrator'>,
    headers: Record<string, string>
  ): Promise<{ statusCode: number; body: unknown; nextCalled: boolean; accountId?: string }> {
    let statusCode = 200;
    let body: unknown = null;
    let nextCalled = false;
    const req = { headers } as unknown as AuthenticatedRequest;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as unknown as Response;

    await new Promise<void>((resolve) => {
      const next: NextFunction = () => {
        nextCalled = true;
        resolve();
      };
      const origJson = res.json.bind(res);
      res.json = ((payload: unknown) => {
        origJson(payload);
        resolve();
        return res;
      }) as Response['json'];
      requireRole(...allowedRoles)(req as Request, res, next);
    });

    return { statusCode, body, nextCalled, accountId: req.authAccount?.id };
  }

  // Forged headers without Bearer token must be rejected 401
  const forged = await invokeRoleMiddleware(['Operations Staff'], {
    'x-responda-role': 'Operations Staff',
    'x-responda-operator': 'Attacker',
  });
  assert.equal(forged.statusCode, 401);
  assert.equal(forged.nextCalled, false);

  // Operations Staff token rejected on Admin endpoint (403)
  const opsOnAdmin = await invokeRoleMiddleware(['Organisation Administrator'], {
    authorization: `Bearer ${opsSession.token}`,
  });
  assert.equal(opsOnAdmin.statusCode, 403);
  assert.equal(opsOnAdmin.nextCalled, false);

  // Admin token rejected on Operations dispatch endpoint (403)
  const adminOnOps = await invokeRoleMiddleware(['Operations Staff'], {
    authorization: `Bearer ${adminSession.token}`,
  });
  assert.equal(adminOnOps.statusCode, 403);
  assert.equal(adminOnOps.nextCalled, false);

  // Valid Operations Staff token passes Operations Staff route
  const validOps = await invokeRoleMiddleware(['Operations Staff'], {
    authorization: `Bearer ${opsSession.token}`,
  });
  assert.equal(validOps.statusCode, 200);
  assert.equal(validOps.nextCalled, true);
  assert.equal(validOps.accountId, opsAccount.id);

  // Token for account later marked INACTIVE is rejected (403)
  const staleInactiveToken = signSessionToken({
    accountId: inactiveAccount.id,
    role: inactiveAccount.role,
    issuedAt: Date.now(),
    exp: Date.now() + 60_000,
  });
  const blockedInactive = await invokeRoleMiddleware(['Operations Staff'], {
    authorization: `Bearer ${staleInactiveToken}`,
  });
  assert.equal(blockedInactive.statusCode, 403);
  assert.equal(blockedInactive.nextCalled, false);
});
