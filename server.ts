import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  CallChannel,
  IncidentLocation,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  LocationSource,
  TranscriptMessage,
  UnitAvailability,
  UserRole,
} from './src/types/responda';
import {
  canApproveDispatch,
  canTakeOver,
  canUpdateIncidentStatus,
  canUpdateUnitStatus,
  canVerifyIncident,
  mapUnitAvailabilityToIncidentStatus,
  validateStatusTransition,
} from './src/utils/incidentLogic';
import {
  buildLocationFromIntake,
  isValidLagosCoords,
  sanitizeCategory,
  sanitizePriority,
} from './src/utils/intakeParser';
import { attachWebSocketServers, broadcastEvent } from './server/liveBridge';
import {
  isGeminiConfigured,
  runGeminiIntakeTurn,
  runSimulatedDemoIntakeTurn,
} from './server/services/geminiService';
import {
  calculateDrivingRoute,
  getIntegrationStatuses,
  queryCarrierLocationAdapter,
  sendDispatchNotification,
} from './server/services/integrations';
import { voiceProvider } from './server/services/voiceProvider';
import { createSeedData, store } from './server/store';
import {
  buildScenarioTranscript,
  createSimulationFleetUnits,
  SIMULATION_SCENARIOS,
} from './src/utils/simulationEngine';
import type { SimulationScenarioId } from './src/types/responda';

const PORT = 3000;

function getRoleFromReq(req: express.Request): { role: UserRole; operatorName: string } {
  const rawRole = String(req.headers['x-responda-role'] || req.body?.actorRole || 'Dispatcher');
  const validRoles: UserRole[] = [
    'Administrator',
    'Call Operator',
    'Dispatcher',
    'Responder',
  ];
  const role: UserRole = validRoles.includes(rawRole as UserRole)
    ? (rawRole as UserRole)
    : 'Dispatcher';
  const operatorName = String(
    req.headers['x-responda-operator'] || req.body?.actorName || 'Seyi Ogunleye'
  ).slice(0, 80);
  return { role, operatorName };
}

async function startServer(): Promise<void> {
  await store.init();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health & Bootstrap
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'RESPONDA',
      geminiConfigured: isGeminiConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/bootstrap', async (_req, res) => {
    const db = await store.getState();
    res.json({
      incidents: db.incidents,
      units: db.units,
      notifications: db.notifications,
      integrations: getIntegrationStatuses(),
    });
  });

  // AI Intake Turn (Text Simulation or Live Gemini)
  app.post('/api/intake/message', async (req, res) => {
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

    // In 'auto' mode when Gemini key is absent, return explicit status so UI informs operator cleanly
    res.status(503).json({
      configured: geminiRes.configured,
      error:
        geminiRes.error ||
        'GEMINI_API_KEY is not configured. Switch to Simulated Demo Intake mode or configure GEMINI_API_KEY.',
    });
  });

  // Create structured incident from AI intake or manual report
  app.post('/api/incidents', async (req, res) => {
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
    const location = buildLocationFromIntake({
      callerDescription: locationDescription,
      landmark,
      area,
      gps,
    });

    const incident = await store.mutate((db) => {
      const id = `INC-2026-${db.sequenceCounter++}`;
      const record: IncidentRecord = {
        id,
        createdAt: now,
        updatedAt: now,
        category: sanitizeCategory(category),
        priority: sanitizePriority(priority),
        priorityReason:
          priorityReason?.trim() ||
          'Priority suggested by automated intake; awaiting human operator verification.',
        status: 'AWAITING_OPERATOR',
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
        missingInfoFlags: Array.isArray(missingInfoFlags) ? missingInfoFlags : [],
        transcript: Array.isArray(transcript) ? transcript : [],
        location,
        timeline: [
          {
            id: `ev-${Date.now()}-1`,
            type: 'INCIDENT_RECEIVED',
            title: 'Emergency report received',
            description: `Intake initiated via ${callChannel}.`,
            actor: 'Responda Intake Gateway',
            actorRole: 'System',
            timestamp: now,
            isSimulated: Boolean(isSimulated),
          },
          {
            id: `ev-${Date.now()}-2`,
            type: 'INCIDENT_CREATED',
            title: 'Structured incident record created',
            description: `${sanitizeCategory(category)} · ${sanitizePriority(priority)} suggested · Location source: ${location.source} (UNVERIFIED).`,
            actor: 'Responda AI Intake',
            actorRole: 'AI Assistant',
            timestamp: now,
            isSimulated: Boolean(isSimulated),
          },
          {
            id: `ev-${Date.now()}-3`,
            type: 'OPERATOR_NOTIFIED',
            title: 'Command Centre alerted for human takeover',
            description: 'No unit dispatched; awaiting operator verification.',
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
        message: `${id} (${record.category} · ${record.location.area || 'Lagos'}) created — awaiting human operator takeover.`,
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
  app.post('/api/incidents/:id/takeover', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canTakeOver(role)) {
      res.status(403).json({
        error: `Role '${role}' is not authorised to take over incidents. Switch to Call Operator, Dispatcher, or Administrator.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const updated = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return null;

      inc.status = 'UNDER_REVIEW';
      inc.assignedOperator = operatorName;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.updatedAt = now;
      inc.aiIntakeActive = false;
      inc.transcript.push({
        id: `t-${Date.now()}`,
        speaker: 'OPERATOR',
        text: `Human operator ${operatorName} (${role}) took over this session. Automated AI intake stopped.`,
        timestamp: now,
      });
      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'OPERATOR_TAKEOVER',
        title: 'Human operator took over incident',
        description: `${operatorName} (${role}) assumed control and halted AI intake.`,
        actor: operatorName,
        actorRole: role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });
      return inc;
    });

    if (!updated) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    broadcastEvent('incident:updated', updated);
    res.json({ incident: updated });
  });

  // Operator Edit / Verify Location & Incident Details
  app.post('/api/incidents/:id/verify-location', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canVerifyIncident(role)) {
      res.status(403).json({
        error: `Role '${role}' is not authorised to verify incident locations.`,
      });
      return;
    }

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
    const updated = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return null;

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
        updatedLoc.verifiedBy = operatorName;
        updatedLoc.verifiedAt = now;
        if (inc.status === 'UNDER_REVIEW' || inc.status === 'AWAITING_OPERATOR') {
          inc.status = 'VERIFIED';
        }
      }

      if (summary?.trim()) inc.summary = summary.trim();
      if (priority) inc.priority = sanitizePriority(priority);
      if (peopleAffected !== undefined) inc.peopleAffected = peopleAffected;

      inc.location = updatedLoc;
      inc.assignedOperator = inc.assignedOperator || operatorName;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.aiIntakeActive = false;
      inc.updatedAt = now;

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: markVerified ? 'LOCATION_VERIFIED' : 'LOCATION_UPDATED',
        title: markVerified
          ? 'Location verified by human operator'
          : 'Location details updated',
        description: `${updatedLoc.correctedDescription || updatedLoc.description}${updatedLoc.lat && updatedLoc.lng ? ` (${updatedLoc.lat.toFixed(4)}, ${updatedLoc.lng.toFixed(4)})` : ''}`,
        actor: operatorName,
        actorRole: role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });

      return inc;
    });

    if (!updated) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    broadcastEvent('incident:updated', updated);
    res.json({ incident: updated });
  });

  // Update Incident Status (with recorded reason & strict anti-auto-dispatch validation)
  app.post('/api/incidents/:id/status', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canUpdateIncidentStatus(role)) {
      res.status(403).json({ error: `Role '${role}' cannot update incident status.` });
      return;
    }

    const { status, reason } = req.body as {
      status?: IncidentStatus;
      reason?: string;
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
      if (status === 'RESOLVED' || status === 'CLOSED') {
        inc.resolvedAt = inc.resolvedAt || now;
        if (inc.assignedUnitId) {
          const unit = db.units.find((u) => u.id === inc.assignedUnitId);
          if (unit) {
            unit.availability = 'AVAILABLE';
            unit.currentAssignmentId = undefined;
            unit.lastLocationUpdate = now;
          }
        }
      }

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'STATUS_CHANGED',
        title: `Status updated: ${prev} → ${status}`,
        description: `Reason: ${reason.trim()}`,
        actor: operatorName,
        actorRole: role,
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
  app.post('/api/incidents/:id/dispatch', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canApproveDispatch(role)) {
      res.status(403).json({
        error: `Role '${role}' is not authorised to approve dispatch. Only Dispatcher or Administrator roles may confirm unit assignments.`,
      });
      return;
    }

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

      const unit = db.units.find((u) => u.id === unitId);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };
      if (unit.availability !== 'AVAILABLE') {
        return {
          error: `Unit ${unit.callsign} is currently ${unit.availability} and cannot be newly assigned.`,
          code: 400 as const,
        };
      }

      inc.assignedUnitId = unit.id;
      inc.assignedOperator = inc.assignedOperator || operatorName;
      inc.acceptedAt = inc.acceptedAt || now;
      inc.dispatchedAt = now;
      inc.status = 'UNIT_ASSIGNED';
      inc.aiIntakeActive = false;
      inc.updatedAt = now;

      unit.availability = 'ASSIGNED';
      unit.currentAssignmentId = inc.id;
      unit.lastLocationUpdate = now;

      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'UNIT_ASSIGNED',
        title: `Human-approved dispatch: ${unit.callsign} (${unit.id})`,
        description: `Destination: ${inc.location.correctedDescription || inc.location.description}.${notes?.trim() ? ` Note: ${notes.trim()}` : ''}`,
        actor: operatorName,
        actorRole: role,
        timestamp: now,
        isSimulated: inc.isSimulated || unit.isSimulated,
      });

      let notification = null;
      if (notifyUnitSms) {
        notification = await sendDispatchNotification({
          recipient: unitContactNumber?.trim() || `${unit.callsign} (Demo Crew)`,
          message: `RESPONDA DISPATCH: ${inc.id} (${inc.category}, ${inc.priority}) at ${inc.location.correctedDescription || inc.location.description}. Approved by ${operatorName}.`,
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

  // Add Operator Note
  app.post('/api/incidents/:id/notes', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    const { text } = req.body as { text?: string };
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Note text is required.' });
      return;
    }

    const now = new Date().toISOString();
    const updated = await store.mutate((db) => {
      const inc = db.incidents.find((i) => i.id === req.params.id);
      if (!inc) return null;

      inc.notes.unshift({
        id: `note-${Date.now()}`,
        author: operatorName,
        role,
        text: text.trim(),
        timestamp: now,
      });
      inc.updatedAt = now;
      inc.timeline.push({
        id: `ev-${Date.now()}`,
        type: 'NOTE_ADDED',
        title: 'Operator note recorded',
        description: text.trim(),
        actor: operatorName,
        actorRole: role,
        timestamp: now,
        isSimulated: inc.isSimulated,
      });
      return inc;
    });

    if (!updated) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    broadcastEvent('incident:updated', updated);
    res.json({ incident: updated });
  });

  // Append Live Operator Transcript Message (Preserves AI Transcript History)
  app.post('/api/incidents/:id/transcript', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canTakeOver(role)) {
      res.status(403).json({
        error: `Role '${role}' is not authorised to send operator responses on active calls.`,
      });
      return;
    }

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

  // Update Response Unit Availability Status (Assigned -> Acknowledged -> En route -> On scene -> Completed / Cancelled)
  app.post('/api/units/:id/status', async (req, res) => {
    const { role, operatorName } = getRoleFromReq(req);
    if (!canUpdateUnitStatus(role)) {
      res.status(403).json({
        error: `Role '${role}' is not authorised to update response unit status.`,
      });
      return;
    }

    const { availability, note } = req.body as {
      availability?: UnitAvailability | 'COMPLETED' | 'CANCELLED';
      note?: string;
    };

    if (!availability) {
      res.status(400).json({ error: 'Target unit status is required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await store.mutate((db) => {
      const unit = db.units.find((u) => u.id === req.params.id);
      if (!unit) return { error: 'Response unit not found.', code: 404 as const };

      const assignedIncident = unit.currentAssignmentId
        ? db.incidents.find((i) => i.id === unit.currentAssignmentId)
        : undefined;

      if (availability === 'COMPLETED') {
        unit.availability = 'AVAILABLE';
        unit.currentAssignmentId = undefined;
        unit.lastLocationUpdate = now;
        if (assignedIncident) {
          assignedIncident.status = 'RESOLVED';
          assignedIncident.resolvedAt = now;
          assignedIncident.updatedAt = now;
          assignedIncident.timeline.push({
            id: `ev-${Date.now()}`,
            type: 'UNIT_COMPLETED',
            title: `${unit.callsign} completed response (Simulated)`,
            description: note?.trim() || 'Incident marked RESOLVED upon unit completion.',
            actor: operatorName,
            actorRole: role,
            timestamp: now,
            isSimulated: unit.isSimulated,
          });
        }
        return { unit, incident: assignedIncident };
      }

      if (availability === 'CANCELLED') {
        unit.availability = 'AVAILABLE';
        unit.currentAssignmentId = undefined;
        unit.lastLocationUpdate = now;
        if (assignedIncident) {
          assignedIncident.assignedUnitId = undefined;
          assignedIncident.status = 'VERIFIED';
          assignedIncident.updatedAt = now;
          assignedIncident.timeline.push({
            id: `ev-${Date.now()}`,
            type: 'UNIT_CANCELLED',
            title: `Assignment cancelled for ${unit.callsign}`,
            description: note?.trim() || 'Unit returned to AVAILABLE; incident returned to VERIFIED.',
            actor: operatorName,
            actorRole: role,
            timestamp: now,
            isSimulated: unit.isSimulated,
          });
        }
        return { unit, incident: assignedIncident };
      }

      unit.availability = availability;
      unit.lastLocationUpdate = now;

      if (assignedIncident) {
        const mappedStatus = mapUnitAvailabilityToIncidentStatus(availability);
        if (mappedStatus) {
          assignedIncident.status = mappedStatus;
        }
        if (availability === 'ACKNOWLEDGED') {
          assignedIncident.acknowledgedAt = assignedIncident.acknowledgedAt || now;
          // Move simulated unit slightly toward incident when acknowledging / going en route
          if (assignedIncident.location.lat && assignedIncident.location.lng) {
            unit.lat = Number((unit.lat + (assignedIncident.location.lat - unit.lat) * 0.25).toFixed(5));
            unit.lng = Number((unit.lng + (assignedIncident.location.lng - unit.lng) * 0.25).toFixed(5));
          }
        } else if (availability === 'EN_ROUTE') {
          if (assignedIncident.location.lat && assignedIncident.location.lng) {
            unit.lat = Number((unit.lat + (assignedIncident.location.lat - unit.lat) * 0.45).toFixed(5));
            unit.lng = Number((unit.lng + (assignedIncident.location.lng - unit.lng) * 0.45).toFixed(5));
          }
        } else if (availability === 'ON_SCENE') {
          if (assignedIncident.location.lat && assignedIncident.location.lng) {
            unit.lat = assignedIncident.location.lat;
            unit.lng = assignedIncident.location.lng;
          }
        }
        assignedIncident.updatedAt = now;

        const eventTypeMap: Record<string, IncidentRecord['timeline'][number]['type']> = {
          ACKNOWLEDGED: 'UNIT_ACKNOWLEDGED',
          EN_ROUTE: 'UNIT_EN_ROUTE',
          ON_SCENE: 'UNIT_ON_SCENE',
          ASSIGNED: 'UNIT_ASSIGNED',
        };

        assignedIncident.timeline.push({
          id: `ev-${Date.now()}`,
          type: eventTypeMap[availability] || 'STATUS_CHANGED',
          title: `${unit.callsign} status: ${availability.replace('_', ' ')}${unit.isSimulated ? ' (Simulated)' : ''}`,
          description: note?.trim() || `Unit updated status to ${availability}.`,
          actor: operatorName,
          actorRole: role,
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
  app.post('/api/routing', async (req, res) => {
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

  // Integration Status & Connection Test
  app.get('/api/integrations/status', async (_req, res) => {
    const carrier = await queryCarrierLocationAdapter();
    res.json({
      integrations: getIntegrationStatuses(),
      carrierAdapter: carrier,
    });
  });

  app.post('/api/integrations/test/:id', async (req, res) => {
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
        message: ok
          ? 'GEMINI_API_KEY detected and client initialized.'
          : 'GEMINI_API_KEY missing. Configure it in Settings > Secrets.',
      });
      return;
    }

    if (id === 'carrier_location') {
      const carrier = await queryCarrierLocationAdapter();
      res.json({
        id,
        ok: carrier.configured,
        message: carrier.statusText,
      });
      return;
    }

    res.json({
      id,
      ok: target.configured,
      message: target.configured
        ? `${target.name} environment variables detected.`
        : `${target.name} is operating in safe demonstration fallback mode (${target.envVars.join(', ')} not configured).`,
    });
  });

  // Provider-Independent Telephony Adapter Routes (Local Simulation Active)
  app.get('/api/telephony/status', (_req, res) => {
    res.json(voiceProvider.getStatusSummary());
  });

  app.post('/api/telephony/simulate-call', async (req, res) => {
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
        category: 'Other urgent incident',
        priority: 'HIGH',
        priorityReason:
          'Simulated voice-adapter emergency call session awaiting human operator review.',
        status: 'AWAITING_OPERATOR',
        callerName: callerName?.trim() || 'Simulated Voice Caller',
        callerPhone: maskedPhone,
        summary: `Simulated voice call session (${sid}) — awaiting human operator intake.`,
        description: `Local Simulation Voice Adapter received simulated inbound call (${areaHint || 'Lagos'}). Real telephone integration not configured.`,
        peopleAffected: null,
        immediateDanger: false,
        missingInfoFlags: ['Emergency description', 'Location verification'],
        transcript: [
          {
            id: `t-${Date.now()}`,
            speaker: 'AI',
            text: 'Connected via Local Simulation Voice Adapter (real telephone integration not configured). Please describe the emergency and nearest Lagos landmark.',
            timestamp: now,
          },
        ],
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
  app.post('/api/simulation/prepare', async (req, res) => {
    const { scenarioId = 'yaba-accident' } = req.body as {
      scenarioId?: SimulationScenarioId;
    };
    const scenario =
      SIMULATION_SCENARIOS[scenarioId] || SIMULATION_SCENARIOS['yaba-accident'];
    const now = new Date().toISOString();

    const state = await store.mutate((db) => {
      // Remove any previous copy of the deterministic simulation incident IDs so Restart is clean
      const simIncidentIds = new Set(
        Object.values(SIMULATION_SCENARIOS).map((s) => s.incidentId)
      );
      db.incidents = db.incidents.filter((i) => !simIncidentIds.has(i.id));
      db.notifications = db.notifications.filter(
        (n) => !n.incidentId || !simIncidentIds.has(n.incidentId)
      );

      // Upsert the 4 dedicated simulation units cleanly without duplicates
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

  app.post('/api/simulation/incident', async (req, res) => {
    const {
      scenarioId = 'yaba-accident',
      turnCount = 6,
      includeCoords = true,
      markLocationResolved = true,
    } = req.body as {
      scenarioId?: SimulationScenarioId;
      turnCount?: number;
      includeCoords?: boolean;
      markLocationResolved?: boolean;
    };
    const scenario =
      SIMULATION_SCENARIOS[scenarioId] || SIMULATION_SCENARIOS['yaba-accident'];
    const now = new Date().toISOString();

    await voiceProvider.answerCall(`SIM-${scenario.incidentId}`);

    const outcome = await store.mutate((db) => {
      const existingIdx = db.incidents.findIndex(
        (i) => i.id === scenario.incidentId
      );
      const transcript = buildScenarioTranscript(scenario, turnCount, now);
      const lastTurn = scenario.dialogue[Math.max(0, Math.min(turnCount, scenario.dialogue.length) - 1)];

      const record: IncidentRecord =
        existingIdx >= 0
          ? {
              ...db.incidents[existingIdx],
              transcript,
              missingInfoFlags: lastTurn
                ? lastTurn.remainingMissingFlags
                : scenario.dialogue[scenario.dialogue.length - 1].remainingMissingFlags,
              updatedAt: now,
              location: {
                ...db.incidents[existingIdx].location,
                lat: includeCoords ? scenario.resolvedCoords.lat : undefined,
                lng: includeCoords ? scenario.resolvedCoords.lng : undefined,
                accuracyMeters: includeCoords
                  ? scenario.resolvedCoords.accuracyMeters
                  : undefined,
              },
            }
          : {
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
              missingInfoFlags: lastTurn
                ? lastTurn.remainingMissingFlags
                : ['Operator verification of exact location'],
              transcript,
              location: {
                source: 'CALLER_DESCRIPTION',
                verificationStatus: 'UNVERIFIED',
                description: scenario.vagueLocationDescription,
                landmark: scenario.landmark,
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
                  title: 'Simulated emergency call received',
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
                  description: `${scenario.category} · ${scenario.priority} suggested · Location: CALLER_DESCRIPTION (UNVERIFIED).`,
                  actor: 'Responda AI Intake',
                  actorRole: 'AI Assistant',
                  timestamp: now,
                  isSimulated: true,
                },
              ],
              notes: [],
              aiIntakeActive: true,
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

  app.post('/api/simulation/unit-position', async (req, res) => {
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
          if (incidentStatus) incident.status = incidentStatus;
          if (availability === 'ACKNOWLEDGED') {
            incident.acknowledgedAt = incident.acknowledgedAt || now;
          }
          incident.updatedAt = now;
          if (timelineTitle) {
            incident.timeline.push({
              id: `ev-sim-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              type:
                availability === 'ON_SCENE'
                  ? 'UNIT_ON_SCENE'
                  : availability === 'EN_ROUTE'
                  ? 'UNIT_EN_ROUTE'
                  : availability === 'ACKNOWLEDGED'
                  ? 'UNIT_ACKNOWLEDGED'
                  : 'STATUS_CHANGED',
              title: timelineTitle,
              description: timelineDescription || 'Simulation unit tracking update.',
              actor: unit.callsign,
              actorRole: 'Responder (Simulation)',
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
                actorRole: 'Responder (Simulation)',
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

  // Repeatable Competition Demo Scenario Reset / Launch
  app.post('/api/demo/reset', async (_req, res) => {
    const fresh = await store.mutate((db) => {
      const seed = createSeedData();
      db.incidents = seed.incidents;
      db.units = seed.units;
      db.notifications = seed.notifications;
      db.sequenceCounter = seed.sequenceCounter;
      return db;
    });
    broadcastEvent('state:reset', fresh);
    res.json(fresh);
  });

  // Vite middleware in dev, static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
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
