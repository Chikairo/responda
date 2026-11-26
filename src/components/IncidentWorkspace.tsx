import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  History,
  LocateFixed,
  Lock,
  MapPin,
  MessageSquare,
  Navigation,
  PanelLeft,
  PanelRight,
  Send,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  ClinicalDetails,
  HospitalDestination,
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  MedicalEmergencyCategory,
  ResponseUnit,
  RouteResult,
  SimulationRuntimeState,
  UserRole,
} from '../types/responda';
import {
  canAddNote,
  canApproveDispatch,
  canTakeOver,
  canUpdateIncidentStatus,
  canVerifyIncident,
  formatDistanceKm,
  formatDurationMinutes,
  formatRelativeTime,
  INCIDENT_STATUS_ORDER,
  isActiveIncidentStatus,
  MEDICAL_CATEGORIES,
} from '../utils/incidentLogic';
import {
  computeIncidentWorkflow,
  type IncidentWorkspaceTabId,
} from '../utils/guidedWorkflow';
import {
  buildLocationIntelligenceMethods,
  LAGOS_HOSPITAL_DESTINATIONS,
  rankUnitsForIncident,
} from '../utils/simulationEngine';
import { ConfirmActionModal } from './ConfirmActionModal';
import { DispatchConfirmModal } from './DispatchConfirmModal';
import { LagosMap } from './LagosMap';
import {
  IncidentStatusBadge,
  LegacyBadge,
  LocationFreshnessBadge,
  LocationSourceBadge,
  PriorityBadge,
  UnitAvailabilityBadge,
  VerificationBadge,
} from './StatusBadges';

export interface IncidentWorkspaceDraft {
  summary?: string;
  category?: MedicalEmergencyCategory;
  priority?: IncidentPriority;
  priorityReason?: string;
  peopleAffected?: string;
  immediateDanger?: boolean;
  dangerDetails?: string;
  clinicalDetails?: ClinicalDetails;
  correctedDesc?: string;
  landmark?: string;
  area?: string;
  pinLat?: number;
  pinLng?: number;
  noteText?: string;
  operatorReply?: string;
}

interface IncidentWorkspaceProps {
  incident: IncidentRecord;
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  operatorName: string;
  authFetch: typeof fetch;
  readOnly?: boolean;
  initialTab?: IncidentWorkspaceTabId;
  simState?: SimulationRuntimeState;
  carrierConfigured?: boolean;
  preselectedUnitId?: string | null;
  requireLocationVerificationBeforeDispatch?: boolean;
  draft?: IncidentWorkspaceDraft;
  onUpdateDraft?: (incidentId: string, patch: Partial<IncidentWorkspaceDraft>) => void;
  onBack: () => void;
  onSelectIncident: (id: string) => void;
  onTakeOver: (id: string) => Promise<void>;
  onUpdateMedicalDetails: (
    id: string,
    payload: {
      category?: MedicalEmergencyCategory;
      priority?: IncidentPriority;
      priorityReason?: string;
      peopleAffected?: number | null;
      immediateDanger?: boolean;
      dangerDetails?: string;
      clinicalDetails?: ClinicalDetails;
      summary?: string;
    }
  ) => Promise<void>;
  onVerifyLocation: (
    id: string,
    payload: {
      correctedDescription?: string;
      landmark?: string;
      area?: string;
      lat?: number;
      lng?: number;
      markVerified: boolean;
    }
  ) => Promise<void>;
  onUpdateStatus: (id: string, status: IncidentStatus, reason: string) => Promise<void>;
  onDispatchUnit: (
    incidentId: string,
    unitId: string,
    notes: string,
    notifySms: boolean
  ) => Promise<void>;
  onTransportEvent: (
    id: string,
    payload: {
      event:
        | 'ARRIVED_ON_SCENE'
        | 'PATIENT_PICKED_UP'
        | 'CONFIRM_HOSPITAL'
        | 'TRANSPORT_STARTED'
        | 'HOSPITAL_ARRIVED'
        | 'CLOSE_INCIDENT';
      hospitalDestination?: HospitalDestination;
      outcomeText?: string;
    }
  ) => Promise<void>;
  onAddNote: (id: string, text: string) => Promise<void>;
  onSendOperatorMessage: (id: string, text: string) => Promise<void>;
  onRouteCalculated?: (route: RouteResult | null) => void;
}

export function IncidentWorkspace({
  incident,
  incidents,
  units,
  userRole,
  operatorName,
  authFetch,
  readOnly = false,
  initialTab = 'workflow',
  simState,
  carrierConfigured = false,
  preselectedUnitId = null,
  requireLocationVerificationBeforeDispatch = true,
  draft,
  onUpdateDraft,
  onBack,
  onSelectIncident,
  onTakeOver,
  onUpdateMedicalDetails,
  onVerifyLocation,
  onUpdateStatus,
  onDispatchUnit,
  onTransportEvent,
  onAddNote,
  onSendOperatorMessage,
  onRouteCalculated,
}: IncidentWorkspaceProps) {
  const isLocked = readOnly || incident.status === 'Closed' || Boolean(incident.legacyOutOfScope);
  const [activeTab, setActiveTab] = useState<IncidentWorkspaceTabId>(initialTab);
  const [busy, setBusy] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, incident.id]);

  // Controlled values backed by per-incident draft cache when available
  const editSummary = draft?.summary ?? incident.summary;
  const editCategory = (draft?.category ?? incident.category) as MedicalEmergencyCategory;
  const editPriority = draft?.priority ?? incident.priority;
  const editPriorityReason = draft?.priorityReason ?? incident.priorityReason;
  const editPeopleAffected =
    draft?.peopleAffected ??
    (incident.peopleAffected !== null ? String(incident.peopleAffected) : '');
  const editImmediateDanger = draft?.immediateDanger ?? incident.immediateDanger;
  const editDangerDetails = draft?.dangerDetails ?? (incident.dangerDetails || '');
  const editClinical: ClinicalDetails = draft?.clinicalDetails ?? (incident.clinicalDetails || {});

  const correctedDesc =
    draft?.correctedDesc ??
    (incident.location.correctedDescription || incident.location.description);
  const landmark = draft?.landmark ?? (incident.location.landmark || '');
  const area = draft?.area ?? (incident.location.area || '');
  const pinLat = draft?.pinLat ?? incident.location.lat;
  const pinLng = draft?.pinLng ?? incident.location.lng;

  const noteText = draft?.noteText ?? '';
  const operatorReply = draft?.operatorReply ?? '';

  const setDraft = (patch: Partial<IncidentWorkspaceDraft>) => {
    onUpdateDraft?.(incident.id, patch);
  };

  // Status update controls
  const [statusTarget, setStatusTarget] = useState<IncidentStatus>(incident.status);
  const [statusReason, setStatusReason] = useState('');
  useEffect(() => {
    setStatusTarget(incident.status);
    setStatusReason('');
  }, [incident.id, incident.status]);

  // Dispatch & Route state
  const [candidateUnitId, setCandidateUnitId] = useState<string | null>(
    incident.assignedUnitId || preselectedUnitId || null
  );
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [confirmUnit, setConfirmUnit] = useState<ResponseUnit | null>(null);
  const [confirmClosure, setConfirmClosure] = useState<{ defaultReason: string } | null>(null);

  // Hospital selector state for Milestone 4
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(
    incident.hospitalDestination?.id || LAGOS_HOSPITAL_DESTINATIONS[0]?.id || 'hosp-luth'
  );
  const [customHospitalMode, setCustomHospitalMode] = useState(
    Boolean(incident.hospitalDestination?.isCustom)
  );
  const [customHospName, setCustomHospName] = useState(
    incident.hospitalDestination?.isCustom ? incident.hospitalDestination.name : ''
  );
  const [customHospArea, setCustomHospArea] = useState(
    incident.hospitalDestination?.isCustom ? incident.hospitalDestination.area : 'Lagos'
  );
  const [customHospLat, setCustomHospLat] = useState<string>(
    incident.hospitalDestination?.isCustom ? String(incident.hospitalDestination.lat) : '6.5244'
  );
  const [customHospLng, setCustomHospLng] = useState<string>(
    incident.hospitalDestination?.isCustom ? String(incident.hospitalDestination.lng) : '3.3792'
  );

  useEffect(() => {
    if (incident.assignedUnitId) {
      setCandidateUnitId(incident.assignedUnitId);
    } else if (preselectedUnitId) {
      setCandidateUnitId(preselectedUnitId);
    } else {
      setCandidateUnitId(null);
    }
  }, [incident.id, incident.assignedUnitId, preselectedUnitId]);

  const assignedUnit = incident.assignedUnitId
    ? units.find((u) => u.id === incident.assignedUnitId) || null
    : null;

  const selectedRouteUnit = candidateUnitId
    ? units.find((u) => u.id === candidateUnitId) || null
    : assignedUnit;

  const isSimIncident = Boolean(simState?.active && simState.incidentId === incident.id);

  // Fetch route when candidateUnitId changes
  useEffect(() => {
    if (
      isLocked ||
      !selectedRouteUnit ||
      typeof incident.location.lat !== 'number' ||
      typeof incident.location.lng !== 'number' ||
      userRole !== 'Operations Staff'
    ) {
      setRoute(null);
      onRouteCalculated?.(null);
      return;
    }

    let cancelled = false;
    authFetch('/api/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLat: selectedRouteUnit.lat,
        fromLng: selectedRouteUnit.lng,
        toLat: incident.location.lat,
        toLng: incident.location.lng,
        allowSimulatedOverlay: Boolean(incident.isSimulated),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: RouteResult | null) => {
        if (!cancelled && data) {
          setRoute(data);
          onRouteCalculated?.(data);
        }
      })
      .catch(() => {
        if (!cancelled) setRoute(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    authFetch,
    incident.isSimulated,
    incident.location.lat,
    incident.location.lng,
    isLocked,
    onRouteCalculated,
    selectedRouteUnit?.id,
    selectedRouteUnit?.lat,
    selectedRouteUnit?.lng,
    userRole,
  ]);

  const rankedUnits = useMemo(
    () =>
      rankUnitsForIncident(
        units,
        incident,
        preselectedUnitId || simState?.selectedUnitId || undefined
      ),
    [units, incident, preselectedUnitId, simState?.selectedUnitId]
  );

  const locationMethods = useMemo(
    () => buildLocationIntelligenceMethods(incident, carrierConfigured),
    [incident, carrierConfigured]
  );

  const workflow = computeIncidentWorkflow(
    incident,
    assignedUnit,
    Boolean(candidateUnitId && !incident.assignedUnitId)
  );

  const isTakenOver = Boolean(incident.assignedOperator) || !incident.aiIntakeActive;
  const needsTakeover = !isLocked && incident.status === 'New' && !incident.assignedOperator;
  const dispatchBlockedByPolicy =
    requireLocationVerificationBeforeDispatch && incident.location.verificationStatus !== 'VERIFIED';

  const queueList = useMemo(() => {
    return readOnly
      ? incidents.filter((i) => i.status === 'Closed' || i.legacyOutOfScope)
      : incidents.filter((i) => !i.legacyOutOfScope && isActiveIncidentStatus(i.status));
  }, [incidents, readOnly]);

  const tabs: Array<{ id: IncidentWorkspaceTabId; label: string; count?: number }> = [
    { id: 'workflow', label: 'Workflow & Notes', count: incident.transcript.length },
    { id: 'medical-details', label: 'Medical Details' },
    { id: 'location', label: 'Location' },
    { id: 'response', label: 'Response & Transport' },
  ];

  const handleGuidedAction = async () => {
    if (isLocked) return;
    if (workflow.nextActionType === 'TAKE_OVER' && canTakeOver(userRole)) {
      setBusy(true);
      await onTakeOver(incident.id);
      setBusy(false);
      return;
    }
    if (workflow.nextActionType === 'APPROVE_DISPATCH') {
      const target = candidateUnitId ? units.find((u) => u.id === candidateUnitId) || null : null;
      if (target && target.availability === 'Available' && canApproveDispatch(userRole)) {
        setActiveTab('response');
        setConfirmUnit(target);
        return;
      }
    }
    if (workflow.nextActionType === 'CLOSE_INCIDENT' && canUpdateIncidentStatus(userRole)) {
      setConfirmClosure({
        defaultReason: incident.hospitalDestination
          ? `Patient handed over safely at ${incident.hospitalDestination.name}.`
          : 'Medical response completed and verified by operator.',
      });
      return;
    }
    setActiveTab(workflow.nextTabTarget);
  };

  const handleConfirmHospitalSubmit = async () => {
    if (isLocked) return;
    let payload: HospitalDestination;
    if (customHospitalMode) {
      const latNum = Number(customHospLat);
      const lngNum = Number(customHospLng);
      if (!customHospName.trim() || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return;
      }
      payload = {
        id: `hosp-custom-${Date.now()}`,
        name: customHospName.trim(),
        area: customHospArea.trim() || 'Lagos',
        lat: latNum,
        lng: lngNum,
        isCustom: true,
        isSimulatedDemo: incident.isSimulated,
      };
    } else {
      const preset =
        LAGOS_HOSPITAL_DESTINATIONS.find((h) => h.id === selectedHospitalId) ||
        LAGOS_HOSPITAL_DESTINATIONS[0];
      payload = preset;
    }
    setBusy(true);
    await onTransportEvent(incident.id, {
      event: 'CONFIRM_HOSPITAL',
      hospitalDestination: payload,
    });
    setBusy(false);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Collapsible Left Incident Queue Drawer */}
      {queueOpen && (
        <aside className="w-full lg:w-64 shrink-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 space-y-2 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#26364B]">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {readOnly ? 'Archived Cases' : 'Active Medical Queue'} ({queueList.length})
            </span>
            <button
              type="button"
              onClick={() => setQueueOpen(false)}
              className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400"
              aria-label="Close incident queue drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {queueList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectIncident(item.id)}
                className={`w-full text-left rounded-lg border p-2.5 text-xs transition-colors ${
                  item.id === incident.id
                    ? 'bg-blue-50 border-blue-400 dark:bg-blue-500/15 dark:border-blue-500/60'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B]'
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">
                  <span>{item.id}</span>
                  <span className="text-[10px] font-normal text-slate-500">{item.priority}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate mt-0.5">
                  {item.category} · {item.location.area || 'Lagos'}
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Main Workspace Column */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        {/* Persistent Header */}
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueOpen((q) => !q)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <PanelLeft className="w-3.5 h-3.5" />
                  <span>{queueOpen ? 'Hide Queue' : 'Queue'}</span>
                </button>

                <span className="font-mono text-base font-bold text-slate-900 dark:text-slate-50">
                  {incident.id}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {incident.category}
                </span>
                <PriorityBadge priority={incident.priority} />
                <IncidentStatusBadge status={incident.status} />
                <VerificationBadge status={incident.location.verificationStatus} />
                {incident.legacyOutOfScope && <LegacyBadge />}
                {isLocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600 text-[11px] font-semibold">
                    <Lock className="w-3 h-3" />
                    <span>Read-Only Archive</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <span>Received {formatRelativeTime(incident.createdAt)}</span>
                <span>·</span>
                <span>
                  Caller:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {incident.callerName || 'Anonymous'}
                    {incident.callerPhone ? ` (${incident.callerPhone})` : ''}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Operator:{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {incident.assignedOperator || 'Unassigned'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {needsTakeover && canTakeOver(userRole) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onTakeOver(incident.id);
                    setBusy(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Take Over Incident</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAuditOpen((a) => !a)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <PanelRight className="w-3.5 h-3.5" />
                <span>Audit Log ({incident.timeline.length})</span>
              </button>
            </div>
          </div>

          {/* 4 Navigation Tabs */}
          <div
            role="tablist"
            aria-label="Incident workspace tabs"
            className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-200 dark:border-[#26364B]"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-[#0B1220] dark:text-slate-300 dark:hover:bg-[#172438] dark:border-[#26364B]'
                }`}
              >
                {tab.label}
                {tab.count !== undefined ? ` (${tab.count})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* 5-Milestone Guided Workflow Bar */}
        <section
          aria-label="5-milestone emergency workflow"
          className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none"
        >
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {workflow.milestones.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold flex items-center gap-2 min-w-0 ${
                  m.status === 'done'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300'
                    : m.status === 'current'
                    ? 'bg-blue-50 border-blue-400 text-blue-900 dark:bg-blue-600/25 dark:border-blue-400 dark:text-blue-100'
                    : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full text-[10px] font-mono flex items-center justify-center shrink-0 ${
                    m.status === 'done'
                      ? 'bg-emerald-600 text-white font-bold'
                      : m.status === 'current'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-200 text-slate-600 dark:bg-[#172438] dark:text-slate-400'
                  }`}
                >
                  {m.number}
                </span>
                <span className="truncate">{m.shortLabel}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-xs">
              <div>
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  Current Stage
                </div>
                <p className="text-slate-700 dark:text-slate-200 mt-0.5">{workflow.whatIsHappening}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  Needs Attention
                </div>
                <p className="text-slate-700 dark:text-slate-200 mt-0.5">{workflow.needsAttention}</p>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Recommended Next Step
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {workflow.nextActionDescription}
                </p>
              </div>
            </div>

            {!isLocked && (
              <button
                type="button"
                disabled={busy}
                onClick={handleGuidedAction}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap shrink-0"
              >
                <span>{workflow.nextActionLabel}</span>
              </button>
            )}
          </div>
        </section>

        {/* TAB 1: WORKFLOW, TRANSCRIPT & NOTES */}
        {activeTab === 'workflow' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#26364B]">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Live Call Transcript &amp; Operator Reply</span>
                </h2>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {isTakenOver ? 'HUMAN CONTROL' : 'AI INTAKE ACTIVE'}
                </span>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {incident.transcript.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                    No transcript messages recorded.
                  </p>
                ) : (
                  incident.transcript.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-2.5 text-xs space-y-1 ${
                        m.speaker === 'CALLER'
                          ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30'
                          : m.speaker === 'OPERATOR'
                          ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                          : 'bg-slate-50 border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>{m.speaker}</span>
                        <span className="font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-100">{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              {!isLocked && canTakeOver(userRole) && (
                <div className="pt-2 border-t border-slate-200 dark:border-[#26364B] space-y-2">
                  {!isTakenOver ? (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                      <span>Take over this incident before sending direct operator messages.</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          await onTakeOver(incident.id);
                          setBusy(false);
                        }}
                        className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] whitespace-nowrap"
                      >
                        Take Over
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={operatorReply}
                        onChange={(e) => setDraft({ operatorReply: e.target.value })}
                        placeholder="Record operator message into call transcript..."
                        className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        disabled={busy || !operatorReply.trim()}
                        onClick={async () => {
                          setBusy(true);
                          await onSendOperatorMessage(incident.id, operatorReply.trim());
                          setDraft({ operatorReply: '' });
                          setBusy(false);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              {/* Operator Notes */}
              <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Operational Notes ({incident.notes.length})</span>
                </h3>

                {!isLocked && canAddNote(userRole) && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setDraft({ noteText: e.target.value })}
                      placeholder="Add clinical or dispatch note..."
                      className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      disabled={busy || !noteText.trim()}
                      onClick={async () => {
                        setBusy(true);
                        await onAddNote(incident.id, noteText.trim());
                        setDraft({ noteText: '' });
                        setBusy(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
                    >
                      Save Note
                    </button>
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {incident.notes.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No operational notes recorded yet.
                    </p>
                  ) : (
                    incident.notes.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {n.author} ({n.role})
                          </span>
                          <span className="font-mono">{formatRelativeTime(n.timestamp)}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200">{n.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Manual Incident Status Update (Hidden / Locked when Closed) */}
              {!isLocked && canUpdateIncidentStatus(userRole) && (
                <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2.5 shadow-2xs dark:shadow-none">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Update Incident Status
                  </h3>
                  <select
                    aria-label="Target incident status"
                    value={statusTarget}
                    onChange={(e) => setStatusTarget(e.target.value as IncidentStatus)}
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {INCIDENT_STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Mandatory reason for status update"
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={busy || (!statusReason.trim() && statusTarget !== 'Closed')}
                    onClick={async () => {
                      if (statusTarget === 'Closed') {
                        setConfirmClosure({
                          defaultReason:
                            statusReason.trim() ||
                            'Medical response completed and verified by human operator.',
                        });
                        return;
                      }
                      setBusy(true);
                      await onUpdateStatus(incident.id, statusTarget, statusReason.trim());
                      setStatusReason('');
                      setBusy(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
                  >
                    Record Status Change
                  </button>
                </div>
              )}

              {incident.outcome && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/35 p-4 text-xs space-y-1">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300">
                    Recorded Closure Outcome
                  </div>
                  <p className="text-emerald-900 dark:text-emerald-100">{incident.outcome}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MEDICAL DETAILS */}
        {activeTab === 'medical-details' && (
          <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-5 space-y-4 shadow-2xs dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#26364B]">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Clinical Assessment &amp; Medical Details</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unsaved edits stay preserved if you switch between open incidents.
                </p>
              </div>
              {editPriority === 'Unassessed' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/40 dark:text-amber-200 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Priority is Unassessed — assign Clinical Priority</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Medical Category
                </label>
                <select
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editCategory}
                  onChange={(e) =>
                    setDraft({ category: e.target.value as MedicalEmergencyCategory })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  {MEDICAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Clinical Priority
                </label>
                <select
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editPriority}
                  onChange={(e) => setDraft({ priority: e.target.value as IncidentPriority })}
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                >
                  <option value="Critical">Critical</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Standard">Standard</option>
                  <option value="Unassessed">Unassessed (Insufficient info)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Patients Affected
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editPeopleAffected}
                  onChange={(e) => setDraft({ peopleAffected: e.target.value })}
                  placeholder="Unknown"
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Verified Summary
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editSummary}
                  onChange={(e) => setDraft({ summary: e.target.value })}
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Priority Justification
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editPriorityReason}
                  onChange={(e) => setDraft({ priorityReason: e.target.value })}
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editClinical.chiefComplaint || ''}
                  onChange={(e) =>
                    setDraft({
                      clinicalDetails: { ...editClinical, chiefComplaint: e.target.value },
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Consciousness
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editClinical.consciousness || ''}
                  onChange={(e) =>
                    setDraft({
                      clinicalDetails: { ...editClinical, consciousness: e.target.value },
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Breathing
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editClinical.breathing || ''}
                  onChange={(e) =>
                    setDraft({
                      clinicalDetails: { ...editClinical, breathing: e.target.value },
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Bleeding / Injury Details
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editClinical.bleedingOrInjury || ''}
                  onChange={(e) =>
                    setDraft({
                      clinicalDetails: { ...editClinical, bleedingOrInjury: e.target.value },
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Clinical Triage Notes
                </label>
                <input
                  type="text"
                  disabled={isLocked || !canVerifyIncident(userRole)}
                  value={editClinical.clinicalNotes || ''}
                  onChange={(e) =>
                    setDraft({
                      clinicalDetails: { ...editClinical, clinicalNotes: e.target.value },
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    disabled={isLocked || !canVerifyIncident(userRole)}
                    checked={editImmediateDanger}
                    onChange={(e) => setDraft({ immediateDanger: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Immediate life / scene hazard present</span>
                </label>
                {editImmediateDanger && (
                  <input
                    type="text"
                    disabled={isLocked || !canVerifyIncident(userRole)}
                    value={editDangerDetails}
                    onChange={(e) => setDraft({ dangerDetails: e.target.value })}
                    placeholder="Specify immediate hazard details..."
                    className="flex-1 min-w-[220px] rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                )}
              </div>
            </div>

            {!isLocked && canVerifyIncident(userRole) && (
              <div className="pt-3 border-t border-slate-200 dark:border-[#26364B] flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const parsedPeople =
                      editPeopleAffected.trim() !== '' &&
                      Number.isFinite(Number(editPeopleAffected))
                        ? Math.max(0, Math.round(Number(editPeopleAffected)))
                        : null;
                    await onUpdateMedicalDetails(incident.id, {
                      category: editCategory,
                      priority: editPriority,
                      priorityReason: editPriorityReason,
                      peopleAffected: parsedPeople,
                      immediateDanger: editImmediateDanger,
                      dangerDetails: editDangerDetails,
                      clinicalDetails: editClinical,
                      summary: editSummary,
                    });
                    setBusy(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Medical Assessment</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LOCATION VERIFICATION */}
        {activeTab === 'location' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#26364B]">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Location Verification</span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <LocationSourceBadge source={incident.location.source} />
                  <VerificationBadge status={incident.location.verificationStatus} />
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Verified / Corrected Street Description
                  </label>
                  <input
                    type="text"
                    disabled={isLocked || !canVerifyIncident(userRole)}
                    value={correctedDesc}
                    onChange={(e) => setDraft({ correctedDesc: e.target.value })}
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nearest Landmark
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || !canVerifyIncident(userRole)}
                      value={landmark}
                      onChange={(e) => setDraft({ landmark: e.target.value })}
                      className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Lagos Area
                    </label>
                    <input
                      type="text"
                      disabled={isLocked || !canVerifyIncident(userRole)}
                      value={area}
                      onChange={(e) => setDraft({ area: e.target.value })}
                      className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Latitude (Lagos)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={isLocked || !canVerifyIncident(userRole)}
                      value={pinLat ?? ''}
                      onChange={(e) =>
                        setDraft({ pinLat: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Longitude (Lagos)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={isLocked || !canVerifyIncident(userRole)}
                      value={pinLng ?? ''}
                      onChange={(e) =>
                        setDraft({ pinLng: e.target.value ? Number(e.target.value) : undefined })
                      }
                      className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100 disabled:opacity-60"
                    />
                  </div>
                </div>

                {!isLocked && canVerifyIncident(userRole) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) return;
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setDraft({
                            pinLat: Number(pos.coords.latitude.toFixed(5)),
                            pinLng: Number(pos.coords.longitude.toFixed(5)),
                          });
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>Use Browser GPS</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await onVerifyLocation(incident.id, {
                          correctedDescription: correctedDesc,
                          landmark,
                          area,
                          lat: pinLat,
                          lng: pinLng,
                          markVerified: false,
                        });
                        setBusy(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Save Draft
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await onVerifyLocation(incident.id, {
                          correctedDescription: correctedDesc,
                          landmark,
                          area,
                          lat: pinLat,
                          lng: pinLng,
                          markVerified: true,
                        });
                        setBusy(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Verify Location</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4 Honest Location Intelligence Methods */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-[#26364B]">
                {locationMethods.map((m) => (
                  <div
                    key={m.key}
                    className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 text-[11px] space-y-0.5"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{m.label}</div>
                    <div
                      className={`font-medium ${
                        m.available
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {m.statusText}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-snug">{m.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Lagos Scene Map Pin Preview
              </div>
              <LagosMap
                incidents={[
                  {
                    ...incident,
                    location: {
                      ...incident.location,
                      lat: pinLat,
                      lng: pinLng,
                    },
                  },
                ]}
                units={assignedUnit ? [assignedUnit] : []}
                selectedIncidentId={incident.id}
                route={route}
                heightClass="h-[400px]"
                showInfoCard={false}
              />
            </div>
          </div>
        )}

        {/* TAB 4: RESPONSE & PATIENT TRANSPORT */}
        {activeTab === 'response' && (
          <div className="space-y-4">
            {/* Milestone 4 Scene & Transport Sequential Lifecycle Card */}
            {(assignedUnit || incident.dispatchedAt || incident.status === 'Patient Transport') && (
              <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-cyan-300 dark:border-cyan-500/40 p-4 space-y-4 shadow-2xs dark:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>
                        {assignedUnit ? `${assignedUnit.callsign} — ` : ''}Response &amp; Patient Transport
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sequential medical response milestones (each action records once to audit history).
                    </p>
                  </div>
                  {assignedUnit && <UnitAvailabilityBadge availability={assignedUnit.availability} />}
                </div>

                {isSimIncident && simState?.stage === 8 && !simState.arrivedOnScene && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/35 px-3 py-2 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                    <span>{simState.trackingStatusText || 'Unit en route to incident scene...'}</span>
                    <span className="font-mono font-bold">
                      {simState.trackingProgressPct}% · {simState.trackingRemainingSec}s
                    </span>
                  </div>
                )}

                {/* 5 Explicit Milestone Steps */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
                  {/* 1. Arrived at Scene */}
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      1. Scene Arrival
                    </div>
                    {incident.arrivedAtSceneAt ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Confirmed {formatRelativeTime(incident.arrivedAtSceneAt)}
                      </div>
                    ) : !isLocked ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          await onTransportEvent(incident.id, { event: 'ARRIVED_ON_SCENE' });
                          setBusy(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold"
                      >
                        Mark Arrived at Scene
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Not recorded</span>
                    )}
                  </div>

                  {/* 2. Patient Picked Up */}
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      2. Patient Pickup
                    </div>
                    {incident.patientPickedUpAt ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Picked up {formatRelativeTime(incident.patientPickedUpAt)}
                      </div>
                    ) : !isLocked ? (
                      <button
                        type="button"
                        disabled={busy || !incident.arrivedAtSceneAt}
                        onClick={async () => {
                          setBusy(true);
                          await onTransportEvent(incident.id, { event: 'PATIENT_PICKED_UP' });
                          setBusy(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-semibold"
                      >
                        Mark Patient Picked Up
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Not recorded</span>
                    )}
                  </div>

                  {/* 3. Hospital Confirmed */}
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      3. Receiving Hospital
                    </div>
                    {incident.hospitalDestination ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        {incident.hospitalDestination.name}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">
                        Select hospital below
                      </div>
                    )}
                  </div>

                  {/* 4. Start Transport */}
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      4. Transport Started
                    </div>
                    {incident.transportStartedAt ? (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        En route {formatRelativeTime(incident.transportStartedAt)}
                      </div>
                    ) : !isLocked ? (
                      <button
                        type="button"
                        disabled={busy || !incident.hospitalDestination}
                        onClick={async () => {
                          setBusy(true);
                          await onTransportEvent(incident.id, { event: 'TRANSPORT_STARTED' });
                          setBusy(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[11px] font-semibold"
                      >
                        Start Patient Transport
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Not recorded</span>
                    )}
                  </div>

                  {/* 5. Hospital Arrival & Close */}
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      5. Hospital Arrival
                    </div>
                    {incident.hospitalArrivedAt ? (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          Arrived {formatRelativeTime(incident.hospitalArrivedAt)}
                        </div>
                        {!isLocked && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setConfirmClosure({
                                defaultReason: `Patient delivered safely to ${
                                  incident.hospitalDestination?.name || 'receiving hospital'
                                }.`,
                              })
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold"
                          >
                            Close Incident
                          </button>
                        )}
                      </div>
                    ) : !isLocked ? (
                      <button
                        type="button"
                        disabled={busy || !incident.transportStartedAt}
                        onClick={async () => {
                          setBusy(true);
                          await onTransportEvent(incident.id, { event: 'HOSPITAL_ARRIVED' });
                          setBusy(false);
                        }}
                        className="w-full px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-semibold"
                      >
                        Confirm Hospital Arrival
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Not recorded</span>
                    )}
                  </div>
                </div>

                {/* Operator Hospital Destination Selector (Never hardcoded by scenario) */}
                {!isLocked && !incident.transportStartedAt && (
                  <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Operator Hospital Destination Selection</span>
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={customHospitalMode}
                          onChange={(e) => setCustomHospitalMode(e.target.checked)}
                        />
                        <span>Enter custom receiving facility</span>
                      </label>
                    </div>

                    {!customHospitalMode ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          aria-label="Select Lagos receiving hospital"
                          value={selectedHospitalId}
                          onChange={(e) => setSelectedHospitalId(e.target.value)}
                          className="flex-1 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
                        >
                          {LAGOS_HOSPITAL_DESTINATIONS.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} — {h.area}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleConfirmHospitalSubmit}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
                        >
                          Confirm Hospital Destination
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={customHospName}
                          onChange={(e) => setCustomHospName(e.target.value)}
                          placeholder="Hospital name"
                          className="sm:col-span-2 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-1.5"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={customHospLat}
                          onChange={(e) => setCustomHospLat(e.target.value)}
                          placeholder="Lat"
                          className="rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 font-mono"
                        />
                        <input
                          type="number"
                          step="0.0001"
                          value={customHospLng}
                          onChange={(e) => setCustomHospLng(e.target.value)}
                          placeholder="Lng"
                          className="rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 font-mono"
                        />
                        <input
                          type="text"
                          value={customHospArea}
                          onChange={(e) => setCustomHospArea(e.target.value)}
                          placeholder="Area"
                          className="sm:col-span-2 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-1.5"
                        />
                        <button
                          type="button"
                          disabled={busy || !customHospName.trim()}
                          onClick={handleConfirmHospitalSubmit}
                          className="sm:col-span-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
                        >
                          Confirm Custom Hospital
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Unit Selection & Human-Approved Dispatch Section */}
            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#26364B]">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Active Medical Response Units Comparison</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Only Active registered medical vehicles appear here. Human operator confirmation is mandatory for dispatch.
                  </p>
                </div>
                {route && route.available && !route.isSimulatedFallback && (
                  <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                    ORS Route: {formatDistanceKm(route.distanceMeters)} ·{' '}
                    {formatDurationMinutes(route.durationSeconds)}
                  </span>
                )}
              </div>

              {dispatchBlockedByPolicy && !incident.assignedUnitId && !isLocked && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                  <span>
                    Organisation policy requires verifying the Lagos location before dispatching any medical unit.
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('location')}
                    className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] whitespace-nowrap"
                  >
                    Verify Location
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                {rankedUnits.map(({ unit, distanceKm, recommended, reason }) => {
                  const isAssigned = incident.assignedUnitId === unit.id;
                  const canSelectDispatch =
                    !isLocked &&
                    !incident.assignedUnitId &&
                    unit.availability === 'Available' &&
                    canApproveDispatch(userRole);

                  return (
                    <div
                      key={unit.id}
                      onClick={() => setCandidateUnitId(unit.id)}
                      className={`rounded-xl border p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isAssigned
                          ? 'bg-emerald-50/60 border-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/40'
                          : candidateUnitId === unit.id
                          ? 'bg-blue-50/70 border-blue-400 dark:bg-blue-500/10 dark:border-blue-500/50'
                          : 'bg-slate-50/70 border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {unit.callsign}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {unit.unitType} · {unit.vehicleRegistration}
                          </span>
                          <UnitAvailabilityBadge availability={unit.availability} />
                          <LocationFreshnessBadge freshness={unit.locationFreshness} />
                          {recommended && (
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                              RECOMMENDED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          {unit.operationalBase} ({unit.area}) · Crew: {unit.crewDescription}
                        </div>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {unit.medicalCapabilities.map((cap) => (
                            <span
                              key={cap}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] text-[10px] text-slate-700 dark:text-slate-300"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right text-[11px]">
                          <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                            {distanceKm !== null ? `${distanceKm} km` : 'Distance N/A'}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">{reason}</div>
                        </div>

                        {canSelectDispatch && (
                          <button
                            type="button"
                            disabled={dispatchBlockedByPolicy}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCandidateUnitId(unit.id);
                              setConfirmUnit(unit);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Approve Dispatch</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Right Audit Timeline Drawer */}
      {auditOpen && (
        <aside className="w-full lg:w-80 shrink-0 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#26364B]">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Audit Timeline ({incident.timeline.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setAuditOpen(false)}
              className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400"
              aria-label="Close audit timeline drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {[...incident.timeline].reverse().map((ev) => (
              <div
                key={ev.id}
                className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {ev.title}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-snug">{ev.description}</p>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {ev.actor} · {ev.actorRole}
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {confirmUnit && !isLocked && (
        <DispatchConfirmModal
          incident={incident}
          unit={confirmUnit}
          route={route}
          operatorName={operatorName}
          submitting={busy}
          onCancel={() => setConfirmUnit(null)}
          onConfirm={async (notes, notifySms) => {
            setBusy(true);
            await onDispatchUnit(incident.id, confirmUnit.id, notes, notifySms);
            setConfirmUnit(null);
            setBusy(false);
          }}
        />
      )}

      {confirmClosure && !isLocked && (
        <ConfirmActionModal
          title={`Close Incident ${incident.id}`}
          description="Closing an incident archives it as a permanent read-only record in Incident History and returns any assigned medical unit to Available."
          confirmLabel="Close Incident"
          reasonLabel="Final Patient / Incident Outcome Summary"
          defaultReason={confirmClosure.defaultReason}
          tone="primary"
          submitting={busy}
          onCancel={() => setConfirmClosure(null)}
          onConfirm={async (reason) => {
            setBusy(true);
            if (incident.assignedUnitId) {
              await onTransportEvent(incident.id, {
                event: 'CLOSE_INCIDENT',
                outcomeText: reason,
              });
            } else {
              await onUpdateStatus(incident.id, 'Closed', reason);
            }
            setConfirmClosure(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}
