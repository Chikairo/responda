import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import type {
  CallChannel,
  ClinicalDetails,
  CrewMemberRecord,
  HospitalDestination,
  IncidentLocation,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  MedicalCapability,
  OrganisationSettings,
  ResponseUnit,
  SimulationScenarioId,
  StaffAccount,
  StaffAccountStatus,
  TranscriptMessage,
  UnitAvailability,
  UnitRegistrationStatus,
  UnitType,
  UserRole,
} from './src/types/responda.ts';
import {
  mapUnitAvailabilityToIncidentStatus,
  validateStatusTransition,
} from './src/utils/incidentLogic.ts';
import {
  buildLocationFromIntake,
  isValidLagosCoords,
  sanitizeCategory,
  sanitizePriority,
} from './src/utils/intakeParser.ts';
import {
  createAuthMiddleware,
  issueDemoSession,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { attachWebSocketServers, broadcastEvent } from './server/liveBridge.ts';
import {
  isGeminiConfigured,
  runGeminiIntakeTurn,
  runSimulatedDemoIntakeTurn,
} from './server/services/geminiService.ts';
import {
  calculateDrivingRoute,
  getIntegrationStatuses,
  queryCarrierLocationAdapter,
  sendDispatchNotification,
} from './server/services/integrations.ts';
import { voiceProvider } from './server/services/voiceProvider.ts';
import { createSeedData, store } from './server/store.ts';
import {
  buildScenarioTranscript,
  createSimulationFleetUnits,
  getProgressiveSimulationSnapshot,
  SIMULATION_SCENARIOS,
} from './src/utils/simulationEngine.ts';

const PORT = Number(process.env.PORT) || 3000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

async function startServer(): Promise<void> {
  await store.init();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  const { requireAuth, requireRole } = createAuthMiddleware(async () => {
    const db = await store.getState();
    return db.staffAccounts;
  });

  // Public Health & Demo Auth Directory
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'RESPONDA',
      geminiConfigured: isGeminiConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/auth/accounts', async (_req, res) => {
    const db = await store.getState();
    res.json({
      accounts: db.staffAccounts,
      isDemoSessionSupported: true,
    });
  });

  app.post('/api/auth/demo-session', async (req, res) => {
    const { accountId } = req.body as { accountId?: string };
    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({ error: 'accountId is required.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const account = db.staffAccounts.find((a) => a.id === accountId);
      if (!account) {
        return { error: 'Staff account not found.', code: 404 as const };
      }
      if (account.accountStatus !== 'ACTIVE') {
        return {
          error: `Account '${account.name}' has status '${account.accountStatus}' and cannot start an active session.`,
          code: 403 as const,
        };
      }
      account.lastActive = now;
      return { session: issueDemoSession(account) };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    res.json(outcome.session);
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      account: req.authAccount,
      isDemoSession: true,
    });
  });

  app.get('/api/bootstrap', requireAuth, async (_req, res) => {
    const db = await store.getState();
    res.json({
      incidents: db.incidents,
      units: db.units,
      notifications: db.notifications,
      staffAccounts: db.staffAccounts,
      organisationSettings: db.organisationSettings,
      integrations: getIntegrationStatuses(),
    });
  });

  // ============================================================================
  // OPERATIONS STAFF ROUTES (Strict server-side role & active account checks)
  // ============================================================================

  // AI Intake Turn (Text Simulation or Live Gemini)
  app.post('/api/intake/message', requireRole('Operations Staff'), async (req, res) => {
    const {
      message,
      history = [],
      mode = 'auto',
      hasGps = false,
    } = req.body as {
      message?: string;
      history?: TranscriptMessage[];
      mode?: 'auto' | 'gemini' | 'simulated';
      hasGps?: boolean;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const cleanHistory = Array.isArray(history) ? history.slice(-20) : [];

    if (mode === 'simulated') {
      const extraction = runSimulatedDemoIntakeTurn({
        history: cleanHistory,
        latestMessage: message.trim(),
      });
      res.json({
        modeUsed: 'SIMULATED_DEMO',
        configured: isGeminiConfigured(),
        extraction,
      });
      return;
    }

    const geminiRes = await runGeminiIntakeTurn({
      history: cleanHistory,
      latestMessage: message.trim(),
      hasGps: Boolean(hasGps),
    });

    if (geminiRes.ok && geminiRes.extraction) {
      res.json({
        modeUsed: 'GEMINI_LIVE',
        configured: true,
        extraction: geminiRes.extraction,
      });
      return;
    }

    if (mode === 'gemini') {
      res.status(geminiRes.configured ? 502 : 503).json({
        error: geminiRes.error || 'Gemini API unavailable.',
        configured: geminiRes.configured,
      });
      return;
    }

    res.status(503).json({
      configured: geminiRes.configured,
      error:
        geminiRes.error ||
        'GEMINI_API_KEY is not configured. Switch to Simulated Demo Intake mode or configure GEMINI_API_KEY.',
    });
  });

  // Create structured medical incident from AI intake or manual report
  app.post('/api/incidents', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      category,
      priority,
      priorityReason,
      summary,
      description,
      callerName,
      callerPhone,
      peopleAffected,
      immediateDanger,
      dangerDetails,
      clinicalDetails,
      missingInfoFlags,
      transcript,
      locationDescription,
      landmark,
      area,
      gps,
      callChannel = 'WEB_TEXT',
      isSimulated = true,
    } = req.body as {
      category?: string;
      priority?: string;
      priorityReason?: string;
      summary?: string;
      description?: string;
      callerName?: string;
      callerPhone?: string;
      peopleAffected?: number | null;
      immediateDanger?: boolean;
      dangerDetails?: string;
      clinicalDetails?: ClinicalDetails;
      missingInfoFlags?: string[];
      transcript?: TranscriptMessage[];
      locationDescription?: string;
      landmark?: string;
      area?: string;
      gps?: { lat: number; lng: number; accuracyMeters?: number; timestamp?: string } | null;
      callChannel?: CallChannel;
      isSimulated?: boolean;
    };

    if (!description && !summary) {
      res.status(400).json({ error: 'Incident summary or description is required.' });
      return;
    }

    const now = new Date().toISOString();
    // Voice telephony calls never fabricate handset GPS unless real GPS coordinates were explicitly passed
    const effectiveGps =
      callChannel === 'TELEPHONY_ADAPTER' || callChannel === 'WEB_VOICE'
        ? gps && isValidLagosCoords(gps.lat, gps.lng)
          ? gps
          : null
        : gps;

    const location = buildLocationFromIntake({
      callerDescription: locationDescription,
      landmark,
      area,
      gps: effectiveGps,
      isSimulated: Boolean(isSimulated),
    });

    const sanitizedCat = sanitizeCategory(category);
    const sanitizedPri = sanitizePriority(priority);

    const incident = await store.mutate((db) => {
      const id = `INC-2026-${db.sequenceCounter++}`;
      const record: IncidentRecord = {
        id,
        createdAt: now,
        updatedAt: now,
        category: sanitizedCat,
        priority: sanitizedPri,
        priorityReason:
          priorityReason?.trim() ||
          (sanitizedPri === 'Unassessed'
            ? 'Insufficient clinical information; flagged Unassessed for operator triage.'
            : 'Priority suggested during intake; awaiting human operator verification.'),
        status: 'New',
        callerName: callerName?.trim() || undefined,
        callerPhone: callerPhone?.trim() || undefined,
        summary: (summary || description || '').trim(),
        description: (description || summary || '').trim(),
        peopleAffected:
          typeof peopleAffected === 'number' && Number.isFinite(peopleAffected)
            ? Math.max(0, Math.round(peopleAffected))
            : null,
        immediateDanger: Boolean(immediateDanger),
        dangerDetails: dangerDetails?.trim() || undefined,
        clinicalDetails: clinicalDetails
          ? {
              chiefComplaint: clinicalDetails.chiefComplaint?.trim() || undefined,
              consciousness: clinicalDetails.consciousness?.trim() || undefined,
              breathing: clinicalDetails.breathing?.trim() || undefined,
              bleedingOrInjury: clinicalDetails.bleedingOrInjury?.trim() || undefined,
              clinicalNotes: clinicalDetails.clinicalNotes?.trim() || undefined,
            }
          : undefined,
        missingInfoFlags: Array.isArray(missingInfoFlags) ? missingInfoFlags : [],
        transcript: Array.isArray(transcript) ? transcript : [],
        location: {
          ...location,
          carrierNote: location.carrierNote || 'Carrier location integration not configured',
        },
        timeline: [
          {
            id: `ev-${Date.now()}-1`,
            type: 'INCIDENT_RECEIVED',
            title: 'Medical emergency report received',
            description: `Intake initiated via ${callChannel} (logged by ${actor.name}).`,
            actor: 'Responda Intake Gateway',
            actorRole: 'System',
            timestamp: now,
            isSimulated: Boolean(isSimulated),
          },
          {
            id: `ev-${Date.now()}-2`,
            type: 'INCIDENT_CREATED',
            title: 'Structured incident record created',
            description: `${sanitizedCat} · Priority: ${sanitizedPri} · Location source: ${location.source} (UNVERIFIED).`,
            actor: 'Responda AI Intake',
            actorRole: 'AI Assistant',
            timestamp: now,
            isSimulated: Boolean(isSimulated),
          },
          {
            id: `ev-${Date.now()}-3`,
            type: 'OPERATOR_NOTIFIED',
            title: 'Command Centre alerted for human takeover',
            description: 'No unit dispatched; awaiting Operations Staff review.',
            actor: 'Responda Router',
            actorRole: 'System',
            timestamp: now,
            isSimulated: Boolean(isSimulated),
          },
        ],
        notes: [],
        aiIntakeActive: true,
        isSimulated: Boolean(isSimulated),
        callChannel,
      };

      db.incidents.unshift(record);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        channel: 'SYSTEM_ALERT',
        recipient: 'Command Centre Queue',
        message: `${id} (${record.category} · ${record.location.area || 'Lagos'}) created — awaiting operator takeover.`,
        incidentId: id,
        status: 'DELIVERED_DEMO',
        providerResponse: 'Real-time WebSocket command alert broadcast',
        timestamp: now,
        isSimulated: Boolean(isSimulated),
      });
      return record;
    });

    broadcastEvent('incident:created', incident);
    res.status(201).json({ incident });
  });

  // Human Operator Takeover
  app.post('/api/incidents/:id/takeover', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const now = new Date().toISOString();

    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Closed or archived incidents are read-only.', code: 400 as const };
      }

      if (inc.status === 'New') {
        inc.status = 'Under Review';
      }
      inc.assignedOperator = actor.name;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.updatedAt = now;
      inc.aiIntakeActive = false;
      inc.transcript.push({
        id: `t-${Date.now()}`,
        speaker: 'OPERATOR',
        text: `${actor.name} (${actor.role}) took over this session. Automated AI intake stopped.`,
        timestamp: now,
      });
      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'OPERATOR_TAKEOVER',
        title: 'Human operator took over incident',
        description: `${actor.name} (${actor.role}) assumed control and halted AI intake.`,
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });
      return { incident: inc };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    res.json({ incident: outcome.incident });
  });

  // Update Medical & Clinical Assessment Details
  app.patch('/api/incidents/:id/medical-details', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      category,
      priority,
      priorityReason,
      peopleAffected,
      immediateDanger,
      dangerDetails,
      clinicalDetails,
      summary,
      description,
    } = req.body as {
      category?: string;
      priority?: IncidentPriority;
      priorityReason?: string;
      peopleAffected?: number | null;
      immediateDanger?: boolean;
      dangerDetails?: string;
      clinicalDetails?: ClinicalDetails;
      summary?: string;
      description?: string;
    };

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Closed incidents are permanently read-only.', code: 400 as const };
      }

      if (category) inc.category = sanitizeCategory(category);
      if (priority) inc.priority = sanitizePriority(priority);
      if (priorityReason !== undefined) inc.priorityReason = priorityReason.trim();
      if (peopleAffected !== undefined) {
        inc.peopleAffected =
          typeof peopleAffected === 'number' && Number.isFinite(peopleAffected)
            ? Math.max(0, Math.round(peopleAffected))
            : null;
      }
      if (immediateDanger !== undefined) inc.immediateDanger = Boolean(immediateDanger);
      if (dangerDetails !== undefined) inc.dangerDetails = dangerDetails.trim() || undefined;
      if (summary?.trim()) inc.summary = summary.trim();
      if (description?.trim()) inc.description = description.trim();
      if (clinicalDetails) {
        inc.clinicalDetails = {
          ...(inc.clinicalDetails || {}),
          chiefComplaint: clinicalDetails.chiefComplaint?.trim() ?? inc.clinicalDetails?.chiefComplaint,
          consciousness: clinicalDetails.consciousness?.trim() ?? inc.clinicalDetails?.consciousness,
          breathing: clinicalDetails.breathing?.trim() ?? inc.clinicalDetails?.breathing,
          bleedingOrInjury: clinicalDetails.bleedingOrInjury?.trim() ?? inc.clinicalDetails?.bleedingOrInjury,
          clinicalNotes: clinicalDetails.clinicalNotes?.trim() ?? inc.clinicalDetails?.clinicalNotes,
        };
      }

      if (inc.status === 'New') {
        inc.status = 'Under Review';
      }
      inc.assignedOperator = inc.assignedOperator || actor.name;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.aiIntakeActive = false;
      inc.updatedAt = now;

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'INCIDENT_VERIFIED',
        title: `Medical assessment updated (${inc.priority} · ${inc.category})`,
        description: `Clinical triage details reviewed by ${actor.name}.`,
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });

      return { incident: inc };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    res.json({ incident: outcome.incident });
  });

  // Operator Edit / Verify Location & Incident Details
  app.post('/api/incidents/:id/verify-location', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      correctedDescription,
      landmark,
      area,
      lat,
      lng,
      markVerified = true,
      summary,
      priority,
      peopleAffected,
    } = req.body as {
      correctedDescription?: string;
      landmark?: string;
      area?: string;
      lat?: number;
      lng?: number;
      markVerified?: boolean;
      summary?: string;
      priority?: IncidentPriority;
      peopleAffected?: number | null;
    };

    if (lat !== undefined && lng !== undefined && !isValidLagosCoords(lat, lng)) {
      res.status(400).json({
        error: 'Coordinates must fall within the Lagos metropolitan operational bounds.',
      });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Closed incidents cannot be modified.', code: 400 as const };
      }

      const updatedLoc: IncidentLocation = {
        ...inc.location,
        correctedDescription:
          correctedDescription?.trim() || inc.location.correctedDescription,
        landmark: landmark?.trim() || inc.location.landmark,
        area: area?.trim() || inc.location.area,
        lat: typeof lat === 'number' ? lat : inc.location.lat,
        lng: typeof lng === 'number' ? lng : inc.location.lng,
      };

      if (markVerified) {
        updatedLoc.source = 'OPERATOR_VERIFIED';
        updatedLoc.verificationStatus = 'VERIFIED';
        updatedLoc.verifiedBy = actor.name;
        updatedLoc.verifiedAt = now;
        if (inc.status === 'New') {
          inc.status = 'Under Review';
        }
      }

      if (summary?.trim()) inc.summary = summary.trim();
      if (priority) inc.priority = sanitizePriority(priority);
      if (peopleAffected !== undefined) inc.peopleAffected = peopleAffected;

      inc.location = updatedLoc;
      inc.assignedOperator = inc.assignedOperator || actor.name;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.aiIntakeActive = false;
      inc.updatedAt = now;

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: markVerified ? 'LOCATION_VERIFIED' : 'LOCATION_UPDATED',
        title: markVerified
          ? 'Location verified by human operator'
          : 'Location details updated',
        description: `${updatedLoc.correctedDescription || updatedLoc.description}${
          updatedLoc.lat && updatedLoc.lng
            ? ` (${updatedLoc.lat.toFixed(4)}, ${updatedLoc.lng.toFixed(4)})`
            : ''
        }`,
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });

      return { incident: inc };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    res.json({ incident: outcome.incident });
  });

  // Update Incident Status (with recorded reason & strict validation)
  app.post('/api/incidents/:id/status', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { status, reason, outcome: closureOutcome } = req.body as {
      status?: IncidentStatus;
      reason?: string;
      outcome?: string;
    };

    if (!status || !reason || !reason.trim()) {
      res.status(400).json({
        error: 'Both target status and a recorded reason are required.',
      });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };

      const check = validateStatusTransition(inc.status, status, {
        hasHumanApproval: Boolean(inc.dispatchedAt),
        hasAssignedUnit: Boolean(inc.assignedUnitId),
      });
      if (!check.valid) {
        return { error: check.reason || 'Invalid transition.', code: 400 as const };
      }

      const prev = inc.status;
      inc.status = status;
      inc.updatedAt = now;
      if (status === 'Closed') {
        inc.closedAt = inc.closedAt || now;
        inc.resolvedAt = inc.resolvedAt || now;
        inc.outcome = closureOutcome?.trim() || reason.trim();
        if (inc.assignedUnitId) {
          const unit = db.units.find((u) => u.id === inc.assignedUnitId);
          if (unit) {
            unit.availability = 'Available';
            unit.currentAssignmentId = undefined;
            unit.lastLocationUpdate = now;
            unit.activityLog = [
              {
                id: `uact-${Date.now()}`,
                timestamp: now,
                actor: actor.name,
                actorRole: actor.role,
                action: `Cleared from ${inc.id}`,
                details: `Returned to Available upon incident closure: ${reason.trim()}`,
              },
              ...(unit.activityLog || []),
            ];
          }
        }
      }

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: status === 'Closed' ? 'UNIT_COMPLETED' : 'STATUS_CHANGED',
        title: `Status updated: ${prev} → ${status}`,
        description: `Reason: ${reason.trim()}`,
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });

      return { incident: inc, units: db.units };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    broadcastEvent('units:sync', outcome.units);
    res.json({ incident: outcome.incident, units: outcome.units });
  });

  // Human-Approved Dispatch
  app.post('/api/incidents/:id/dispatch', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      unitId,
      humanConfirmed,
      notes,
      notifyUnitSms = true,
      unitContactNumber,
    } = req.body as {
      unitId?: string;
      humanConfirmed?: boolean;
      notes?: string;
      notifyUnitSms?: boolean;
      unitContactNumber?: string;
    };

    if (!humanConfirmed) {
      res.status(400).json({
        error: 'Explicit human operator confirmation is required before dispatching any response unit.',
      });
      return;
    }

    if (!unitId) {
      res.status(400).json({ error: 'A valid response unit ID is required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await store.mutate(async (db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Cannot dispatch units to a closed or out-of-scope incident.', code: 400 as const };
      }

      if (
        db.organisationSettings.requireLocationVerificationBeforeDispatch &&
        inc.location.verificationStatus !== 'VERIFIED'
      ) {
        return {
          error:
            'Organisation policy requires location verification before unit dispatch. Verify the location first.',
          code: 400 as const,
        };
      }

      const unit = db.units.find((u) => u.id === unitId);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };
      if (unit.registrationStatus !== 'Active' || unit.legacyOutOfScope) {
        return {
          error: `Unit ${unit.callsign} is ${unit.registrationStatus} / out-of-scope and cannot be dispatched.`,
          code: 400 as const,
        };
      }
      if (unit.availability !== 'Available') {
        return {
          error: `Unit ${unit.callsign} is currently ${unit.availability} and cannot be newly assigned.`,
          code: 400 as const,
        };
      }

      inc.assignedUnitId = unit.id;
      inc.assignedOperator = inc.assignedOperator || actor.name;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.dispatchedAt = now;
      inc.acknowledgedAt = inc.acknowledgedAt || now;
      inc.status = 'Dispatched';
      inc.aiIntakeActive = false;
      inc.updatedAt = now;

      unit.availability = 'Responding';
      unit.currentAssignmentId = inc.id;
      unit.lastLocationUpdate = now;
      unit.activityLog = [
        {
          id: `uact-${Date.now()}`,
          timestamp: now,
          actor: actor.name,
          actorRole: actor.role,
          action: `Dispatched to ${inc.id}`,
          details: `Approved dispatch to ${inc.location.correctedDescription || inc.location.description}.${
            notes?.trim() ? ` Note: ${notes.trim()}` : ''
          }`,
        },
        ...(unit.activityLog || []),
      ];

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'UNIT_ASSIGNED',
        title: `Human-approved dispatch: ${unit.callsign} (${unit.id})`,
        description: `Destination: ${inc.location.correctedDescription || inc.location.description}.${
          notes?.trim() ? ` Note: ${notes.trim()}` : ''
        }`,
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated || unit.isSimulated,
      });

      let notification = null;
      if (notifyUnitSms) {
        notification = await sendDispatchNotification({
          recipient: unitContactNumber?.trim() || `${unit.callsign} (Demo Crew)`,
          message: `RESPONDA DISPATCH: ${inc.id} (${inc.category}, ${inc.priority}) at ${
            inc.location.correctedDescription || inc.location.description
          }. Approved by ${actor.name}.`,
          incidentId: inc.id,
          unitId: unit.id,
        });
        db.notifications.unshift(notification);
        inc.timeline.push({
          id: `ev-${Date.now() + 1}`,
          type: 'NOTIFICATION_SENT',
          title: 'Simulated unit dispatch alert logged',
          description: notification.providerResponse,
          actor: 'Notification Service',
          actorRole: 'System',
          timestamp: now,
          isSimulated: notification.isSimulated,
        });
      }

      return { incident: inc, unit, notification };
    });

    if ('error' in result) {
      res.status(result.code ?? 400).json({ error: result.error });
      return;
    }

    broadcastEvent('incident:updated', result.incident);
    broadcastEvent('unit:updated', result.unit);
    if (result.notification) {
      broadcastEvent('notification:created', result.notification);
    }
    res.json(result);
  });

  // Explicit Idempotent Scene & Patient Transport Events (Once-Only, Never Bundled)
  app.post('/api/incidents/:id/transport-event', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { event, hospitalDestination, outcomeText } = req.body as {
      event?:
        | 'ARRIVED_ON_SCENE'
        | 'PATIENT_PICKED_UP'
        | 'CONFIRM_HOSPITAL'
        | 'TRANSPORT_STARTED'
        | 'HOSPITAL_ARRIVED'
        | 'CLOSE_INCIDENT';
      hospitalDestination?: HospitalDestination;
      outcomeText?: string;
    };

    if (!event) {
      res.status(400).json({ error: 'Transport event type is required.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Closed incidents are archived read-only.', code: 400 as const };
      }

      const unit = inc.assignedUnitId
        ? db.units.find((u) => u.id === inc.assignedUnitId)
        : undefined;

      if (event === 'ARRIVED_ON_SCENE') {
        if (!unit) return { error: 'No unit assigned to mark arrival at scene.', code: 400 as const };
        if (inc.arrivedAtSceneAt) {
          return { incident: inc, unit, alreadyApplied: true };
        }
        inc.arrivedAtSceneAt = now;
        inc.updatedAt = now;
        unit.availability = 'At Scene';
        if (typeof inc.location.lat === 'number' && typeof inc.location.lng === 'number') {
          unit.lat = inc.location.lat;
          unit.lng = inc.location.lng;
        }
        unit.lastLocationUpdate = now;
        inc.timeline.push({
          id: `ev-${Date.now()}`,
          type: 'UNIT_ON_SCENE',
          title: `${unit.callsign} arrived at scene`,
          description: `Medical team arrived at ${inc.location.correctedDescription || inc.location.description}.`,
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: inc.isSimulated,
        });
        return { incident: inc, unit };
      }

      if (event === 'PATIENT_PICKED_UP') {
        if (!unit) return { error: 'No assigned unit on scene.', code: 400 as const };
        if (inc.patientPickedUpAt) {
          return { incident: inc, unit, alreadyApplied: true };
        }
        if (!inc.arrivedAtSceneAt) {
          inc.arrivedAtSceneAt = now;
        }
        inc.patientPickedUpAt = now;
        inc.updatedAt = now;
        inc.timeline.push({
          id: `ev-${Date.now()}`,
          type: 'PATIENT_PICKED_UP',
          title: 'Patient picked up and loaded for care',
          description: `${unit.callsign} secured patient for medical transfer.`,
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: inc.isSimulated,
        });
        return { incident: inc, unit };
      }

      if (event === 'CONFIRM_HOSPITAL') {
        if (
          !hospitalDestination ||
          !hospitalDestination.name?.trim() ||
          typeof hospitalDestination.lat !== 'number' ||
          typeof hospitalDestination.lng !== 'number'
        ) {
          return { error: 'Valid receiving hospital name and coordinates are required.', code: 400 as const };
        }
        const cleanHospital: HospitalDestination = {
          id: hospitalDestination.id,
          name: hospitalDestination.name.trim(),
          area: hospitalDestination.area?.trim() || 'Lagos',
          lat: hospitalDestination.lat,
          lng: hospitalDestination.lng,
          isSimulatedDemo: Boolean(hospitalDestination.isSimulatedDemo),
          isCustom: Boolean(hospitalDestination.isCustom),
          selectedBy: actor.name,
          selectedAt: now,
        };
        const isSame =
          inc.hospitalDestination && inc.hospitalDestination.name === cleanHospital.name;
        inc.hospitalDestination = cleanHospital;
        inc.updatedAt = now;
        if (!isSame) {
          inc.timeline.push({
            id: `ev-${Date.now()}`,
            type: 'HOSPITAL_CONFIRMED',
            title: `Hospital destination confirmed: ${cleanHospital.name}`,
            description: `Operator confirmed receiving hospital (${cleanHospital.area}).`,
            actor: actor.name,
            actorRole: actor.role,
            timestamp: now,
            isSimulated: inc.isSimulated,
          });
        }
        return { incident: inc, unit };
      }

      if (event === 'TRANSPORT_STARTED') {
        if (!unit) return { error: 'No assigned unit for transport.', code: 400 as const };
        if (!inc.hospitalDestination) {
          return {
            error: 'Select and confirm a hospital destination before starting patient transport.',
            code: 400 as const,
          };
        }
        if (inc.transportStartedAt) {
          return { incident: inc, unit, alreadyApplied: true };
        }
        if (!inc.patientPickedUpAt) {
          inc.patientPickedUpAt = now;
        }
        inc.transportStartedAt = now;
        inc.status = 'Patient Transport';
        inc.updatedAt = now;
        unit.availability = 'Transporting';
        unit.lastLocationUpdate = now;
        inc.timeline.push({
          id: `ev-${Date.now()}`,
          type: 'TRANSPORT_STARTED',
          title: `Patient transport started → ${inc.hospitalDestination.name}`,
          description: `${unit.callsign} departed scene toward ${inc.hospitalDestination.name}.`,
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: inc.isSimulated,
        });
        return { incident: inc, unit };
      }

      if (event === 'HOSPITAL_ARRIVED') {
        if (!unit) return { error: 'No assigned unit found.', code: 400 as const };
        if (!inc.transportStartedAt || !inc.hospitalDestination) {
          return { error: 'Patient transport must be started before confirming hospital arrival.', code: 400 as const };
        }
        if (inc.hospitalArrivedAt) {
          return { incident: inc, unit, alreadyApplied: true };
        }
        inc.hospitalArrivedAt = now;
        inc.updatedAt = now;
        unit.lat = inc.hospitalDestination.lat;
        unit.lng = inc.hospitalDestination.lng;
        unit.lastLocationUpdate = now;
        inc.timeline.push({
          id: `ev-${Date.now()}`,
          type: 'HOSPITAL_ARRIVED',
          title: `Arrived at ${inc.hospitalDestination.name}`,
          description: `Patient delivered to emergency reception by ${unit.callsign}.`,
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: inc.isSimulated,
        });
        return { incident: inc, unit };
      }

      if (event === 'CLOSE_INCIDENT') {
        const finalOutcome = outcomeText?.trim();
        if (!finalOutcome) {
          return { error: 'Closure outcome summary is required.', code: 400 as const };
        }
        inc.status = 'Closed';
        inc.closedAt = now;
        inc.resolvedAt = inc.resolvedAt || now;
        inc.outcome = finalOutcome;
        inc.updatedAt = now;

        if (unit) {
          unit.availability = 'Available';
          unit.currentAssignmentId = undefined;
          unit.lastLocationUpdate = now;
          unit.activityLog = [
            {
              id: `uact-${Date.now()}`,
              timestamp: now,
              actor: actor.name,
              actorRole: actor.role,
              action: `Returned Available (${inc.id} closed)`,
              details: finalOutcome,
            },
            ...(unit.activityLog || []),
          ];
        }

        inc.timeline.push({
          id: `ev-${Date.now()}`,
          type: 'UNIT_COMPLETED',
          title: 'Incident closed and archived',
          description: finalOutcome,
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: inc.isSimulated,
        });
        return { incident: inc, unit };
      }

      return { error: 'Unsupported transport event.', code: 400 as const };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    if (outcome.unit) {
      broadcastEvent('unit:updated', outcome.unit);
    }
    res.json(outcome);
  });

  // Add Operator Note
  app.post('/api/incidents/:id/notes', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Note text is required.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Cannot add notes to closed or archived incidents.', code: 400 as const };
      }

      inc.notes.unshift({
        id: `note-${Date.now()}`,
        author: actor.name,
        role: actor.role,
        text: text.trim(),
        timestamp: now,
      });
      inc.updatedAt = now;
      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'NOTE_ADDED',
        title: 'Operator note recorded',
        description: text.trim(),
        actor: actor.name,
        actorRole: actor.role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });
      return { incident: inc };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('incident:updated', outcome.incident);
    res.json({ incident: outcome.incident });
  });

  // Append Live Operator Transcript Message
  app.post('/api/incidents/:id/transcript', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { text, extractedTags } = req.body as {
      text?: string;
      extractedTags?: string[];
    };
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return { error: 'Incident not found.', code: 404 as const };
      if (inc.status === 'Closed' || inc.legacyOutOfScope) {
        return { error: 'Closed incidents are permanently read-only.', code: 400 as const };
      }

      if (inc.aiIntakeActive && !inc.assignedOperator) {
        return {
          error: 'Human operator must take over the call before sending operator replies.',
          code: 400 as const,
        };
      }

      const cleanTags = Array.isArray(extractedTags)
        ? extractedTags.map((t) => String(t).trim()).filter(Boolean)
        : undefined;

      inc.transcript.push({
        id: `t-op-${Date.now()}`,
        speaker: 'OPERATOR',
        text: text.trim(),
        timestamp: now,
        extractedTags: cleanTags && cleanTags.length > 0 ? cleanTags : undefined,
      });
      inc.updatedAt = now;
      return { incident: inc };
    });

    if ('error' in result) {
      res.status(result.code ?? 400).json({ error: result.error });
      return;
    }

    broadcastEvent('incident:updated', result.incident);
    res.json({ incident: result.incident });
  });

  // Operations Staff: Temporary Operational Unit Status Override / Update (requires reason for manual override)
  app.post('/api/units/:id/status', requireRole('Operations Staff'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { availability, note } = req.body as {
      availability?: UnitAvailability | 'CANCELLED';
      note?: string;
    };

    if (!availability) {
      res.status(400).json({ error: 'Target unit status is required.' });
      return;
    }

    if (!note || !note.trim()) {
      res.status(400).json({
        error: 'A recorded operational reason is required when updating unit availability.',
      });
      return;
    }

    const now = new Date().toISOString();
    const result = await store.mutate((db) => {
      const unit = db.units.find((u) => u.id === req.params.id);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };
      if (unit.registrationStatus !== 'Active' || unit.legacyOutOfScope) {
        return {
          error: `Unit ${unit.callsign} is ${unit.registrationStatus} and cannot change operational availability.`,
          code: 400 as const,
        };
      }

      const assignedIncident = unit.currentAssignmentId
        ? db.incidents.find((i) => i.id === unit.currentAssignmentId)
        : undefined;

      if (availability === 'CANCELLED') {
        unit.availability = 'Available';
        unit.currentAssignmentId = undefined;
        unit.lastLocationUpdate = now;
        unit.activityLog = [
          {
            id: `uact-${Date.now()}`,
            timestamp: now,
            actor: actor.name,
            actorRole: actor.role,
            action: 'Assignment cancelled',
            details: note.trim(),
          },
          ...(unit.activityLog || []),
        ];
        if (assignedIncident) {
          assignedIncident.assignedUnitId = undefined;
          assignedIncident.status = 'Under Review';
          assignedIncident.updatedAt = now;
          assignedIncident.timeline.push({
            id: `ev-${Date.now()}`,
            type: 'UNIT_CANCELLED',
            title: `Assignment cancelled for ${unit.callsign}`,
            description: note.trim(),
            actor: actor.name,
            actorRole: actor.role,
            timestamp: now,
            isSimulated: unit.isSimulated,
          });
        }
        return { unit, incident: assignedIncident };
      }

      const prevAvail = unit.availability;
      unit.availability = availability;
      unit.lastLocationUpdate = now;
      unit.activityLog = [
        {
          id: `uact-${Date.now()}`,
          timestamp: now,
          actor: actor.name,
          actorRole: actor.role,
          action: `Availability: ${prevAvail} → ${availability}`,
          details: note.trim(),
        },
        ...(unit.activityLog || []),
      ];

      if (assignedIncident) {
        const mappedStatus = mapUnitAvailabilityToIncidentStatus(availability);
        if (mappedStatus && assignedIncident.status !== 'Closed') {
          assignedIncident.status = mappedStatus;
        }
        if (availability === 'At Scene') {
          assignedIncident.arrivedAtSceneAt = assignedIncident.arrivedAtSceneAt || now;
          if (assignedIncident.location.lat && assignedIncident.location.lng) {
            unit.lat = assignedIncident.location.lat;
            unit.lng = assignedIncident.location.lng;
          }
        }
        assignedIncident.updatedAt = now;
        assignedIncident.timeline.push({
          id: `ev-${Date.now()}`,
          type:
            availability === 'At Scene'
              ? 'UNIT_ON_SCENE'
              : availability === 'Transporting'
              ? 'TRANSPORT_STARTED'
              : availability === 'Responding'
              ? 'UNIT_EN_ROUTE'
              : 'STATUS_CHANGED',
          title: `${unit.callsign} status: ${availability}`,
          description: note.trim(),
          actor: actor.name,
          actorRole: actor.role,
          timestamp: now,
          isSimulated: unit.isSimulated,
        });
      }

      return { unit, incident: assignedIncident };
    });

    if ('error' in result) {
      res.status(result.code ?? 400).json({ error: result.error });
      return;
    }

    broadcastEvent('unit:updated', result.unit);
    if (result.incident) {
      broadcastEvent('incident:updated', result.incident);
    }
    res.json(result);
  });

  // Routing endpoint (OpenRouteService with honest fallback)
  app.post('/api/routing', requireRole('Operations Staff'), async (req, res) => {
    const { fromLat, fromLng, toLat, toLng, allowSimulatedOverlay = false } =
      req.body as {
        fromLat?: number;
        fromLng?: number;
        toLat?: number;
        toLng?: number;
        allowSimulatedOverlay?: boolean;
      };

    if (
      typeof fromLat !== 'number' ||
      typeof fromLng !== 'number' ||
      typeof toLat !== 'number' ||
      typeof toLng !== 'number'
    ) {
      res.status(400).json({ error: 'Valid origin and destination coordinates are required.' });
      return;
    }

    const route = await calculateDrivingRoute({
      fromLat,
      fromLng,
      toLat,
      toLng,
      allowSimulatedOverlay: Boolean(allowSimulatedOverlay),
    });
    res.json(route);
  });

  // Simulated Voice Adapter Inbound Call
  app.post('/api/telephony/simulate-call', requireRole('Operations Staff'), async (req, res) => {
    const { sessionId, callerNumber, callerName, areaHint } = req.body as {
      sessionId?: string;
      callerNumber?: string;
      callerName?: string;
      areaHint?: string;
    };

    const now = new Date().toISOString();
    const sid = sessionId?.trim() || `SIM-VOICE-${Date.now()}`;
    const maskedPhone = callerNumber?.trim() || '+234-800-010-9999';

    await voiceProvider.onIncomingCall({
      sessionId: sid,
      callerNumber: maskedPhone,
      callerName: callerName?.trim(),
      areaHint: areaHint?.trim() || 'Lagos',
      receivedAt: now,
      isSimulated: true,
    });
    await voiceProvider.answerCall(sid);

    const created = await store.mutate((db) => {
      const id = `INC-2026-${db.sequenceCounter++}`;
      const record: IncidentRecord = {
        id,
        createdAt: now,
        updatedAt: now,
        category: 'Other medical emergency',
        priority: 'Unassessed',
        priorityReason:
          'Simulated voice-adapter emergency call session; clinical details incomplete and flagged Unassessed for operator triage.',
        status: 'New',
        callerName: callerName?.trim() || 'Simulated Voice Caller',
        callerPhone: maskedPhone,
        summary: `Simulated voice call session (${sid}) — awaiting operator assessment.`,
        description: `Local Simulation Voice Adapter received simulated inbound call (${areaHint || 'Lagos'}). Real telephone integration not configured.`,
        peopleAffected: null,
        immediateDanger: false,
        missingInfoFlags: ['Clinical severity assessment', 'Exact location verification'],
        transcript: [
          {
            id: `t-${Date.now()}`,
            speaker: 'AI',
            text: 'Connected via Local Simulation Voice Adapter (real telephone integration not configured). Please describe the medical emergency and nearest Lagos landmark.',
            timestamp: now,
          },
        ],
        // Voice calls must NEVER fabricate device GPS coordinates
        location: {
          source: 'UNKNOWN',
          verificationStatus: 'UNVERIFIED',
          description: `Caller location unverified (${areaHint || 'Lagos'}) — carrier location integration not configured.`,
          carrierNote: 'Carrier location integration not configured',
          capturedAt: now,
        },
        timeline: [
          {
            id: `ev-${Date.now()}`,
            type: 'INCIDENT_RECEIVED',
            title: 'Simulated voice-adapter call received',
            description: `Session ${sid} logged via Local Simulation Voice Adapter. Real telephone integration not configured.`,
            actor: voiceProvider.name,
            actorRole: 'Telephony Adapter',
            timestamp: now,
            isSimulated: true,
          },
        ],
        notes: [],
        aiIntakeActive: true,
        isSimulated: true,
        callChannel: 'TELEPHONY_ADAPTER',
      };
      db.incidents.unshift(record);
      return record;
    });

    broadcastEvent('incident:created', created);
    res.status(201).json({
      incident: created,
      telephonyStatus: voiceProvider.getStatusSummary(),
    });
  });

  // Live Simulation Engine Sync Endpoints (Idempotent — zero duplicates on restart)
  app.post('/api/simulation/prepare', requireRole('Operations Staff'), async (req, res) => {
    const { scenarioId = 'yaba-accident' } = req.body as {
      scenarioId?: SimulationScenarioId;
    };
    const scenario =
      SIMULATION_SCENARIOS[scenarioId] || SIMULATION_SCENARIOS['yaba-accident'];
    const now = new Date().toISOString();

    const state = await store.mutate((db) => {
      const simIncidentIds = new Set(
        Object.values(SIMULATION_SCENARIOS).map((s) => s.incidentId)
      );
      db.incidents = db.incidents.filter((i) => !simIncidentIds.has(i.id));
      db.notifications = db.notifications.filter(
        (n) => !n.incidentId || !simIncidentIds.has(n.incidentId)
      );

      const simUnits = createSimulationFleetUnits(now);
      const simUnitIds = new Set(simUnits.map((u) => u.id));
      const nonSimUnits = db.units.filter((u) => !simUnitIds.has(u.id));
      db.units = [...simUnits, ...nonSimUnits];

      return {
        incidents: db.incidents,
        units: db.units,
        notifications: db.notifications,
        scenarioId: scenario.id,
      };
    });

    await voiceProvider.onIncomingCall({
      sessionId: `SIM-${scenario.incidentId}`,
      callerNumber: scenario.callerPhone,
      callerName: scenario.callerName,
      areaHint: scenario.area,
      receivedAt: now,
      isSimulated: true,
    });

    broadcastEvent('state:reset', {
      incidents: state.incidents,
      units: state.units,
      notifications: state.notifications,
    });
    res.json(state);
  });

  app.post('/api/simulation/incident', requireRole('Operations Staff'), async (req, res) => {
    const {
      scenarioId = 'yaba-accident',
      turnCount = 6,
      includeCoords = true,
      markLocationResolved = true,
      completeIntake = false,
    } = req.body as {
      scenarioId?: SimulationScenarioId;
      turnCount?: number;
      includeCoords?: boolean;
      markLocationResolved?: boolean;
      completeIntake?: boolean;
    };
    const scenario =
      SIMULATION_SCENARIOS[scenarioId] || SIMULATION_SCENARIOS['yaba-accident'];
    const now = new Date().toISOString();

    await voiceProvider.answerCall(`SIM-${scenario.incidentId}`);

    const outcome = await store.mutate((db) => {
      const existingIdx = db.incidents.findIndex((i) => i.id === scenario.incidentId);
      const transcript = buildScenarioTranscript(scenario, turnCount, now);
      const snapshot = getProgressiveSimulationSnapshot(scenario, turnCount);
      const lastTurn =
        scenario.dialogue[Math.max(0, Math.min(turnCount, scenario.dialogue.length) - 1)];
      const existing = existingIdx >= 0 ? db.incidents[existingIdx] : null;
      const shouldAdvanceToAssessment =
        Boolean(completeIntake) && (!existing || existing.status === 'New');
      const nextStatus: IncidentStatus = existing
        ? shouldAdvanceToAssessment
          ? 'Under Review'
          : existing.status
        : shouldAdvanceToAssessment
        ? 'Under Review'
        : 'New';
      const nextAiIntakeActive = existing
        ? completeIntake
          ? false
          : existing.aiIntakeActive
        : !completeIntake;

      const completionTimeline =
        completeIntake &&
        (!existing || !existing.timeline.some((e) => e.id === `ev-sim-intake-done-${scenario.incidentId}`))
          ? [
              {
                id: `ev-sim-intake-done-${scenario.incidentId}`,
                type: 'AI_INTAKE_STARTED' as const,
                title: 'AI intake Q&A completed — queued for Assessment & Verification',
                description:
                  'Structured caller triage, clinical symptoms, hazards, and Lagos landmark extracted. Incident automatically moved to Milestone 2: Assessment & Verification.',
                actor: 'Responda AI Intake',
                actorRole: 'AI Assistant',
                timestamp: now,
                isSimulated: true,
              },
            ]
          : [];

      const record: IncidentRecord = existing
        ? {
            ...existing,
            category: snapshot.category,
            priority: existing.assignedOperator ? existing.priority : snapshot.priority,
            priorityReason: existing.assignedOperator
              ? existing.priorityReason
              : snapshot.priorityReason,
            status: nextStatus,
            callerName: snapshot.callerName ?? existing.callerName,
            summary: snapshot.summary,
            description: snapshot.description,
            peopleAffected: snapshot.peopleAffected ?? existing.peopleAffected,
            immediateDanger: snapshot.immediateDanger,
            dangerDetails: snapshot.dangerDetails ?? existing.dangerDetails,
            clinicalDetails: snapshot.clinicalDetails,
            transcript,
            missingInfoFlags: lastTurn
              ? lastTurn.remainingMissingFlags
              : scenario.dialogue[scenario.dialogue.length - 1].remainingMissingFlags,
            updatedAt: now,
            aiIntakeActive: nextAiIntakeActive,
            location: {
              ...existing.location,
              description:
                existing.location.verificationStatus === 'VERIFIED'
                  ? existing.location.description
                  : snapshot.locationDescription,
              landmark: snapshot.landmark ?? existing.location.landmark,
              source:
                existing.location.verificationStatus === 'VERIFIED'
                  ? existing.location.source
                  : includeCoords
                  ? 'SIMULATED'
                  : 'CALLER_DESCRIPTION',
              lat:
                existing.location.verificationStatus === 'VERIFIED'
                  ? existing.location.lat
                  : includeCoords
                  ? scenario.resolvedCoords.lat
                  : undefined,
              lng:
                existing.location.verificationStatus === 'VERIFIED'
                  ? existing.location.lng
                  : includeCoords
                  ? scenario.resolvedCoords.lng
                  : undefined,
              accuracyMeters:
                existing.location.verificationStatus === 'VERIFIED'
                  ? existing.location.accuracyMeters
                  : includeCoords && markLocationResolved
                  ? scenario.resolvedCoords.accuracyMeters
                  : undefined,
            },
            timeline: [...existing.timeline, ...completionTimeline],
          }
        : {
            id: scenario.incidentId,
            createdAt: now,
            updatedAt: now,
            category: snapshot.category,
            priority: snapshot.priority,
            priorityReason: snapshot.priorityReason,
            status: nextStatus,
            callerName: snapshot.callerName,
            callerPhone: scenario.callerPhone,
            summary: snapshot.summary,
            description: snapshot.description,
            peopleAffected: snapshot.peopleAffected ?? null,
            immediateDanger: snapshot.immediateDanger,
            dangerDetails: snapshot.dangerDetails,
            clinicalDetails: snapshot.clinicalDetails,
            missingInfoFlags: lastTurn
              ? lastTurn.remainingMissingFlags
              : ['Operator verification of exact location'],
            transcript,
            location: {
              source: includeCoords ? 'SIMULATED' : 'CALLER_DESCRIPTION',
              verificationStatus: 'UNVERIFIED',
              description: snapshot.locationDescription,
              landmark: snapshot.landmark,
              area: scenario.area,
              lat: includeCoords ? scenario.resolvedCoords.lat : undefined,
              lng: includeCoords ? scenario.resolvedCoords.lng : undefined,
              accuracyMeters:
                includeCoords && markLocationResolved
                  ? scenario.resolvedCoords.accuracyMeters
                  : undefined,
              carrierNote: 'Carrier location integration not configured',
              capturedAt: now,
            },
            timeline: [
              {
                id: `ev-${Date.now()}-1`,
                type: 'INCIDENT_RECEIVED',
                title: 'Simulated medical emergency call received',
                description: `${scenario.incomingCallNotification} Real telephone integration not configured.`,
                actor: voiceProvider.name,
                actorRole: 'Telephony Adapter',
                timestamp: now,
                isSimulated: true,
              },
              {
                id: `ev-${Date.now()}-2`,
                type: 'INCIDENT_CREATED',
                title: 'Structured incident record created (Simulation)',
                description: `${scenario.category} · Location: ${includeCoords ? 'SIMULATED' : 'CALLER_DESCRIPTION'} (UNVERIFIED).`,
                actor: 'Responda AI Intake',
                actorRole: 'AI Assistant',
                timestamp: now,
                isSimulated: true,
              },
              ...completionTimeline,
            ],
            notes: [],
            aiIntakeActive: nextAiIntakeActive,
            isSimulated: true,
            callChannel: 'DEMO_SCENARIO',
          };

      if (existingIdx >= 0) {
        db.incidents[existingIdx] = record;
      } else {
        db.incidents.unshift(record);
        db.notifications.unshift({
          id: `notif-sim-${Date.now()}`,
          channel: 'SYSTEM_ALERT',
          recipient: 'Command Centre Queue',
          message: `[DEMO SIMULATION] ${record.id} (${record.category} · ${scenario.area}) created — awaiting operator takeover.`,
          incidentId: record.id,
          status: 'DELIVERED_DEMO',
          providerResponse: 'Simulated command alert broadcast',
          timestamp: now,
          isSimulated: true,
        });
      }

      return { incident: record, created: existingIdx < 0 };
    });

    broadcastEvent(
      outcome.created ? 'incident:created' : 'incident:updated',
      outcome.incident
    );
    res.status(outcome.created ? 201 : 200).json(outcome);
  });

  app.post('/api/simulation/unit-position', requireRole('Operations Staff'), async (req, res) => {
    const {
      unitId,
      lat,
      lng,
      availability,
      incidentId,
      incidentStatus,
      timelineTitle,
      timelineDescription,
      extraTimelineEvents,
    } = req.body as {
      unitId?: string;
      lat?: number;
      lng?: number;
      availability?: UnitAvailability;
      incidentId?: string;
      incidentStatus?: IncidentStatus;
      timelineTitle?: string;
      timelineDescription?: string;
      extraTimelineEvents?: Array<{
        type?: IncidentRecord['timeline'][number]['type'];
        title: string;
        description: string;
      }>;
    };

    if (!unitId || typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'unitId, lat, and lng are required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await store.mutate((db) => {
      const unit = db.units.find((u) => u.id === unitId);
      if (!unit) return null;
      unit.lat = Number(lat.toFixed(5));
      unit.lng = Number(lng.toFixed(5));
      if (availability) unit.availability = availability;
      unit.lastLocationUpdate = now;

      let incident: IncidentRecord | undefined;
      if (incidentId) {
        incident = db.incidents.find((i) => i.id === incidentId);
        if (incident) {
          if (incidentStatus && incident.status !== 'Closed') {
            incident.status = incidentStatus;
          }
          if (availability === 'At Scene') {
            incident.arrivedAtSceneAt = incident.arrivedAtSceneAt || now;
          }
          incident.updatedAt = now;
          if (timelineTitle) {
            incident.timeline.push({
              id: `ev-sim-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              type:
                availability === 'At Scene'
                  ? 'UNIT_ON_SCENE'
                  : availability === 'Transporting'
                  ? 'TRANSPORT_STARTED'
                  : availability === 'Responding'
                  ? 'UNIT_EN_ROUTE'
                  : 'STATUS_CHANGED',
              title: timelineTitle,
              description: timelineDescription || 'Simulation unit tracking update.',
              actor: unit.callsign,
              actorRole: 'Medical Unit (Simulation)',
              timestamp: now,
              isSimulated: true,
            });
          }
          if (Array.isArray(extraTimelineEvents)) {
            for (const extra of extraTimelineEvents) {
              if (!extra?.title) continue;
              incident.timeline.push({
                id: `ev-sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: extra.type || 'STATUS_CHANGED',
                title: extra.title,
                description: extra.description || '',
                actor: unit.callsign,
                actorRole: 'Medical Unit (Simulation)',
                timestamp: now,
                isSimulated: true,
              });
            }
          }
        }
      }
      return { unit, incident };
    });

    if (!result) {
      res.status(404).json({ error: 'Unit not found.' });
      return;
    }

    broadcastEvent('unit:updated', result.unit);
    if (result.incident) {
      broadcastEvent('incident:updated', result.incident);
    }
    res.json(result);
  });

  // ============================================================================
  // ORGANISATION ADMINISTRATOR ROUTES (Strictly segregated from dispatch)
  // ============================================================================

  // Invite New Staff Member (Creates INVITED record; honestly notes no external email is sent)
  app.post('/api/staff/invite', requireRole('Organisation Administrator'), async (req, res) => {
    const { name, email, role, badgeCode } = req.body as {
      name?: string;
      email?: string;
      role?: UserRole;
      badgeCode?: string;
    };

    if (!name?.trim() || !email?.trim() || !isValidEmail(email)) {
      res.status(400).json({ error: 'Valid staff name and email address are required.' });
      return;
    }
    if (role !== 'Operations Staff' && role !== 'Organisation Administrator') {
      res.status(400).json({ error: 'Role must be Operations Staff or Organisation Administrator.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (db.staffAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { error: 'A staff account with this email already exists.', code: 409 as const };
      }

      const account: StaffAccount = {
        id: `staff-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        role,
        accountStatus: 'INVITED',
        badgeCode:
          badgeCode?.trim() ||
          `${role === 'Organisation Administrator' ? 'ADM' : 'OPS'}-${Math.floor(200 + Math.random() * 799)}`,
        dateAdded: now,
      };
      db.staffAccounts.push(account);
      return { account };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('staff:updated', outcome.account);
    res.status(201).json({
      account: outcome.account,
      notice:
        'No external email is sent in this prototype — share the invite status with the team member.',
    });
  });

  // Update Staff Account (Role, Active/Inactive Status — enforces Last Active Admin Guard)
  app.patch('/api/staff/:id', requireRole('Organisation Administrator'), async (req, res) => {
    const { role, accountStatus, name, badgeCode } = req.body as {
      role?: UserRole;
      accountStatus?: StaffAccountStatus;
      name?: string;
      badgeCode?: string;
    };

    if (
      role !== undefined &&
      role !== 'Operations Staff' &&
      role !== 'Organisation Administrator'
    ) {
      res.status(400).json({ error: 'Invalid role specified.' });
      return;
    }

    if (
      accountStatus !== undefined &&
      accountStatus !== 'ACTIVE' &&
      accountStatus !== 'INVITED' &&
      accountStatus !== 'INACTIVE'
    ) {
      res.status(400).json({ error: 'Invalid accountStatus specified.' });
      return;
    }

    const outcome = await store.mutate((db) => {
      const target = db.staffAccounts.find((a) => a.id === req.params.id);
      if (!target) return { error: 'Staff account not found.', code: 404 as const };

      const nextRole = role ?? target.role;
      const nextStatus = accountStatus ?? target.accountStatus;

      // Last active Organisation Administrator safeguard
      const activeAdminsAfterChange = db.staffAccounts.filter((a) => {
        const effRole = a.id === target.id ? nextRole : a.role;
        const effStatus = a.id === target.id ? nextStatus : a.accountStatus;
        return effRole === 'Organisation Administrator' && effStatus === 'ACTIVE';
      });

      if (activeAdminsAfterChange.length === 0) {
        return {
          error:
            'Cannot deactivate or demote the last active Organisation Administrator. At least one active administrator is required.',
          code: 400 as const,
        };
      }

      target.role = nextRole;
      target.accountStatus = nextStatus;
      if (name?.trim()) target.name = name.trim();
      if (badgeCode?.trim()) target.badgeCode = badgeCode.trim();

      return { account: target };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('staff:updated', outcome.account);
    res.json({ account: outcome.account });
  });

  // Register New Medical Response Unit (Admin only)
  app.post('/api/admin/units', requireRole('Organisation Administrator'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      callsign,
      organisation,
      unitType,
      vehicleRegistration,
      operationalBase,
      area,
      locationName,
      lat,
      lng,
      medicalCapabilities,
      customEquipment,
      crewMembers,
      registrationStatus = 'Active',
      availability = 'Available',
      adminNotes,
    } = req.body as {
      callsign?: string;
      organisation?: string;
      unitType?: UnitType;
      vehicleRegistration?: string;
      operationalBase?: string;
      area?: string;
      locationName?: string;
      lat?: number;
      lng?: number;
      medicalCapabilities?: MedicalCapability[];
      customEquipment?: string[];
      crewMembers?: CrewMemberRecord[];
      registrationStatus?: UnitRegistrationStatus;
      availability?: UnitAvailability;
      adminNotes?: string;
    };

    if (!callsign?.trim() || !vehicleRegistration?.trim() || !operationalBase?.trim()) {
      res.status(400).json({
        error: 'Callsign, vehicle registration, and operational base are required.',
      });
      return;
    }

    if (unitType !== 'Ambulance' && unitType !== 'Rapid response vehicle') {
      res.status(400).json({
        error: 'Unit type must be Ambulance or Rapid response vehicle.',
      });
      return;
    }

    const safeLat = typeof lat === 'number' && isValidLagosCoords(lat, lng) ? lat : 6.5244;
    const safeLng = typeof lng === 'number' && isValidLagosCoords(lat, lng) ? lng : 3.3792;
    const cleanCrew = Array.isArray(crewMembers)
      ? crewMembers.filter((m) => m && m.name?.trim())
      : [];

    const now = new Date().toISOString();
    const unit = await store.mutate((db) => {
      const id = `UNIT-MED-${Math.floor(100 + Math.random() * 899)}`;
      const record: ResponseUnit = {
        id,
        callsign: callsign.trim(),
        organisation: organisation?.trim() || db.organisationSettings.name,
        unitType,
        registrationStatus: registrationStatus === 'Inactive' ? 'Inactive' : 'Active',
        vehicleRegistration: vehicleRegistration.trim(),
        operationalBase: operationalBase.trim(),
        crewDescription:
          cleanCrew.length > 0
            ? cleanCrew.map((m) => `${m.name} (${m.medicalRole || 'EMT'})`).join(', ')
            : 'Crew pending assignment',
        crewMembers: cleanCrew.map((m, idx) => ({
          id: m.id || `cr-${Date.now()}-${idx}`,
          name: m.name.trim(),
          medicalRole: m.medicalRole?.trim() || 'Paramedic',
          qualification: m.qualification?.trim() || 'BLS',
        })),
        medicalCapabilities:
          Array.isArray(medicalCapabilities) && medicalCapabilities.length > 0
            ? medicalCapabilities
            : ['Basic Life Support (BLS)'],
        customEquipment: Array.isArray(customEquipment)
          ? customEquipment.map((x) => String(x).trim()).filter(Boolean)
          : undefined,
        locationName: locationName?.trim() || operationalBase.trim(),
        area: area?.trim() || 'Lagos',
        lat: safeLat,
        lng: safeLng,
        locationFreshness: 'MANUAL',
        locationSourceLabel: 'Station Registration Coordinates',
        availability: registrationStatus === 'Inactive' ? 'Unavailable' : availability,
        lastLocationUpdate: now,
        adminNotes: adminNotes?.trim() || undefined,
        activityLog: [
          {
            id: `uact-${Date.now()}`,
            timestamp: now,
            actor: actor.name,
            actorRole: actor.role,
            action: 'Unit Registered',
            details: `Registered ${unitType} (${vehicleRegistration.trim()}) at ${operationalBase.trim()}.`,
          },
        ],
        isSimulated: false,
      };
      db.units.push(record);
      return record;
    });

    broadcastEvent('unit:updated', unit);
    res.status(201).json({ unit });
  });

  // Update Medical Unit Record (Admin only)
  app.patch('/api/admin/units/:id', requireRole('Organisation Administrator'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const {
      callsign,
      organisation,
      unitType,
      vehicleRegistration,
      operationalBase,
      area,
      locationName,
      lat,
      lng,
      medicalCapabilities,
      customEquipment,
      crewMembers,
      availability,
      adminNotes,
    } = req.body as Partial<ResponseUnit>;

    if (lat !== undefined && lng !== undefined && !isValidLagosCoords(lat, lng)) {
      res.status(400).json({ error: 'Coordinates must fall inside Lagos bounds.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const unit = db.units.find((u) => u.id === req.params.id);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };
      if (unit.legacyOutOfScope) {
        return {
          error: 'Legacy out-of-scope units are permanently inactive.',
          code: 400 as const,
        };
      }

      if (callsign?.trim()) unit.callsign = callsign.trim();
      if (organisation?.trim()) unit.organisation = organisation.trim();
      if (unitType === 'Ambulance' || unitType === 'Rapid response vehicle') {
        unit.unitType = unitType;
      }
      if (vehicleRegistration?.trim()) unit.vehicleRegistration = vehicleRegistration.trim();
      if (operationalBase?.trim()) unit.operationalBase = operationalBase.trim();
      if (area?.trim()) unit.area = area.trim();
      if (locationName?.trim()) unit.locationName = locationName.trim();
      if (typeof lat === 'number' && typeof lng === 'number') {
        unit.lat = lat;
        unit.lng = lng;
        unit.locationFreshness = 'MANUAL';
      }
      if (Array.isArray(medicalCapabilities)) unit.medicalCapabilities = medicalCapabilities;
      if (Array.isArray(customEquipment)) unit.customEquipment = customEquipment;
      if (Array.isArray(crewMembers)) {
        unit.crewMembers = crewMembers
          .filter((m) => m && m.name?.trim())
          .map((m, idx) => ({
            id: m.id || `cr-${Date.now()}-${idx}`,
            name: m.name.trim(),
            medicalRole: m.medicalRole?.trim() || 'Paramedic',
            qualification: m.qualification?.trim() || 'BLS',
          }));
        unit.crewDescription =
          unit.crewMembers.length > 0
            ? unit.crewMembers.map((m) => `${m.name} (${m.medicalRole})`).join(', ')
            : 'Crew pending assignment';
      }
      if (availability && !unit.currentAssignmentId && unit.registrationStatus === 'Active') {
        unit.availability = availability;
      }
      if (adminNotes !== undefined) unit.adminNotes = adminNotes.trim() || undefined;
      unit.lastLocationUpdate = now;
      unit.activityLog = [
        {
          id: `uact-${Date.now()}`,
          timestamp: now,
          actor: actor.name,
          actorRole: actor.role,
          action: 'Unit Profile Updated',
          details: 'Updated medical unit details, capabilities, or assigned crew.',
        },
        ...(unit.activityLog || []),
      ];

      return { unit };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('unit:updated', outcome.unit);
    res.json({ unit: outcome.unit });
  });

  // Deactivate or Reactivate Medical Unit (No hard delete; blocks if actively assigned)
  app.post('/api/admin/units/:id/registration', requireRole('Organisation Administrator'), async (req: AuthenticatedRequest, res) => {
    const actor = req.authAccount!;
    const { registrationStatus, reason } = req.body as {
      registrationStatus?: UnitRegistrationStatus;
      reason?: string;
    };

    if (registrationStatus !== 'Active' && registrationStatus !== 'Inactive') {
      res.status(400).json({ error: 'registrationStatus must be Active or Inactive.' });
      return;
    }

    const now = new Date().toISOString();
    const outcome = await store.mutate((db) => {
      const unit = db.units.find((u) => u.id === req.params.id);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };
      if (unit.legacyOutOfScope && registrationStatus === 'Active') {
        return {
          error: 'Legacy non-medical units cannot be reactivated in medical-only scope.',
          code: 400 as const,
        };
      }

      if (
        registrationStatus === 'Inactive' &&
        (unit.currentAssignmentId ||
          unit.availability === 'Responding' ||
          unit.availability === 'At Scene' ||
          unit.availability === 'Transporting')
      ) {
        return {
          error: `Cannot deactivate ${unit.callsign} while it is actively assigned (${unit.currentAssignmentId || unit.availability}).`,
          code: 400 as const,
        };
      }

      unit.registrationStatus = registrationStatus;
      unit.availability = registrationStatus === 'Inactive' ? 'Unavailable' : 'Available';
      unit.lastLocationUpdate = now;
      unit.activityLog = [
        {
          id: `uact-${Date.now()}`,
          timestamp: now,
          actor: actor.name,
          actorRole: actor.role,
          action: registrationStatus === 'Inactive' ? 'Unit Deactivated' : 'Unit Reactivated',
          details: reason?.trim() || `Registration changed to ${registrationStatus}.`,
        },
        ...(unit.activityLog || []),
      ];

      return { unit };
    });

    if ('error' in outcome) {
      res.status(outcome.code ?? 400).json({ error: outcome.error });
      return;
    }

    broadcastEvent('unit:updated', outcome.unit);
    res.json({ unit: outcome.unit });
  });

  // Update Organisation Settings (Admin only)
  app.patch('/api/organisation', requireRole('Organisation Administrator'), async (req, res) => {
    const body = req.body as Partial<OrganisationSettings>;
    const updated = await store.mutate((db) => {
      db.organisationSettings = {
        ...db.organisationSettings,
        name: body.name?.trim() || db.organisationSettings.name,
        city: body.city?.trim() || db.organisationSettings.city,
        contactEmail: body.contactEmail?.trim() || db.organisationSettings.contactEmail,
        contactPhone: body.contactPhone?.trim() || db.organisationSettings.contactPhone,
        defaultOperationalArea:
          body.defaultOperationalArea?.trim() || db.organisationSettings.defaultOperationalArea,
        requireLocationVerificationBeforeDispatch:
          typeof body.requireLocationVerificationBeforeDispatch === 'boolean'
            ? body.requireLocationVerificationBeforeDispatch
            : db.organisationSettings.requireLocationVerificationBeforeDispatch,
        clinicalTriageNotice:
          body.clinicalTriageNotice?.trim() || db.organisationSettings.clinicalTriageNotice,
      };
      return db.organisationSettings;
    });

    broadcastEvent('organisation:updated', updated);
    res.json({ organisationSettings: updated });
  });

  // Integration Status & Connection Test
  app.get('/api/integrations/status', requireAuth, async (_req, res) => {
    const carrier = await queryCarrierLocationAdapter();
    res.json({
      integrations: getIntegrationStatuses(),
      carrierAdapter: carrier,
    });
  });

  app.post('/api/integrations/test/:id', requireRole('Organisation Administrator'), async (req, res) => {
    const id = req.params.id;
    const statuses = getIntegrationStatuses();
    const target = statuses.find((s) => s.id === id);
    if (!target) {
      res.status(404).json({ error: 'Integration adapter not found.' });
      return;
    }

    if (id === 'gemini') {
      const ok = isGeminiConfigured();
      res.json({
        id,
        ok,
        state: ok ? 'CONNECTED' : 'SIMULATED',
        message: ok
          ? 'GEMINI_API_KEY detected and @google/genai client verified.'
          : 'GEMINI_API_KEY missing. Operating in Simulated Demo Intake mode.',
      });
      return;
    }

    if (id === 'persistence') {
      res.json({
        id,
        ok: true,
        state: 'CONNECTED',
        message: 'Atomic JSON persistence and session validation are active.',
      });
      return;
    }

    if (id === 'carrier_location') {
      const carrier = await queryCarrierLocationAdapter();
      res.json({
        id,
        ok: carrier.configured,
        state: carrier.configured ? 'CONNECTED' : 'NOT_CONFIGURED',
        message: carrier.statusText,
      });
      return;
    }

    res.json({
      id,
      ok: target.configured,
      state: target.state,
      message: target.configured
        ? `${target.name} environment variables detected and ready.`
        : `${target.name}: ${target.statusLabel}.`,
    });
  });

  app.get('/api/telephony/status', requireAuth, (_req, res) => {
    res.json(voiceProvider.getStatusSummary());
  });

  // Repeatable Competition Demo Scenario Reset
  app.post(
    '/api/demo/reset',
    requireRole('Operations Staff', 'Organisation Administrator'),
    async (_req, res) => {
      const fresh = await store.mutate((db) => {
        const seed = createSeedData();
        db.incidents = seed.incidents;
        db.units = seed.units;
        db.notifications = seed.notifications;
        db.staffAccounts = seed.staffAccounts;
        db.organisationSettings = seed.organisationSettings;
        db.sequenceCounter = seed.sequenceCounter;
        return db;
      });
      broadcastEvent('state:reset', fresh);
      res.json(fresh);
    }
  );

  // Vite middleware in dev, static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  attachWebSocketServers(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`RESPONDA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RESPONDA server:', err);
  process.exit(1);
});
