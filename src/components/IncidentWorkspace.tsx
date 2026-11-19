import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  LocateFixed,
  MapPin,
  MessageSquare,
  Navigation,
  Radio,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  ResponseUnit,
  RouteResult,
  UserRole,
} from '../types/responda';
import {
  canApproveDispatch,
  canTakeOver,
  canUpdateIncidentStatus,
  canUpdateUnitStatus,
  canVerifyIncident,
  formatDistanceKm,
  formatDurationMinutes,
  formatRelativeTime,
  INCIDENT_STATUS_ORDER,
} from '../utils/incidentLogic';
import { computeIncidentWorkflow } from '../utils/guidedWorkflow';
import { ConfirmActionModal } from './ConfirmActionModal';
import { DispatchConfirmModal } from './DispatchConfirmModal';
import { LagosMap } from './LagosMap';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  UnitAvailabilityBadge,
  VerificationBadge,
} from './StatusBadges';

export type WorkspaceTab =
  | 'overview'
  | 'transcript'
  | 'location'
  | 'units'
  | 'timeline'
  | 'notes';

interface IncidentWorkspaceProps {
  incident: IncidentRecord;
  units: ResponseUnit[];
  userRole: UserRole;
  operatorName: string;
  initialTab?: WorkspaceTab;
  onBack: () => void;
  onOpenConversation?: (id: string) => void;
  onTakeOver: (id: string) => Promise<void>;
  onVerifyLocation: (
    id: string,
    payload: {
      correctedDescription?: string;
      landmark?: string;
      area?: string;
      lat?: number;
      lng?: number;
      markVerified: boolean;
      summary?: string;
      priority?: IncidentPriority;
      peopleAffected?: number | null;
    }
  ) => Promise<void>;
  onUpdateStatus: (id: string, status: IncidentStatus, reason: string) => Promise<void>;
  onDispatchUnit: (
    incidentId: string,
    unitId: string,
    notes: string,
    notifySms: boolean
  ) => Promise<void>;
  onUpdateUnitStatus: (
    unitId: string,
    availability: ResponseUnit['availability'] | 'COMPLETED' | 'CANCELLED'
  ) => Promise<void>;
  onAddNote: (id: string, text: string) => Promise<void>;
  onRouteCalculated?: (route: RouteResult | null) => void;
}

export function IncidentWorkspace({
  incident,
  units,
  userRole,
  operatorName,
  initialTab = 'overview',
  onBack,
  onOpenConversation,
  onTakeOver,
  onVerifyLocation,
  onUpdateStatus,
  onDispatchUnit,
  onUpdateUnitStatus,
  onAddNote,
  onRouteCalculated,
}: IncidentWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, incident.id]);

  // Location editing state
  const [correctedDesc, setCorrectedDesc] = useState(
    incident.location.correctedDescription || incident.location.description
  );
  const [landmark, setLandmark] = useState(incident.location.landmark || '');
  const [area, setArea] = useState(incident.location.area || '');
  const [pinLat, setPinLat] = useState<number | undefined>(incident.location.lat);
  const [pinLng, setPinLng] = useState<number | undefined>(incident.location.lng);

  // Overview editing state
  const [editSummary, setEditSummary] = useState(incident.summary);
  const [editPriority, setEditPriority] = useState<IncidentPriority>(incident.priority);
  const [statusTarget, setStatusTarget] = useState<IncidentStatus>(incident.status);
  const [statusReason, setStatusReason] = useState('');

  // Dispatch & Route state
  const [candidateUnitId, setCandidateUnitId] = useState<string | null>(
    incident.assignedUnitId || null
  );
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [allowSimRoute, setAllowSimRoute] = useState(false);
  const [confirmUnit, setConfirmUnit] = useState<ResponseUnit | null>(null);

  // Notes state
  const [noteText, setNoteText] = useState('');

  // Confirmation modal for closing/resolving incident
  const [confirmClosure, setConfirmClosure] = useState<{
    targetStatus: 'RESOLVED' | 'CLOSED';
    defaultReason: string;
  } | null>(null);

  // Sync local fields when incident updates via WebSocket
  useEffect(() => {
    setCorrectedDesc(
      incident.location.correctedDescription || incident.location.description
    );
    setLandmark(incident.location.landmark || '');
    setArea(incident.location.area || '');
    setPinLat(incident.location.lat);
    setPinLng(incident.location.lng);
    setEditSummary(incident.summary);
    setEditPriority(incident.priority);
    setStatusTarget(incident.status);
    if (incident.assignedUnitId) {
      setCandidateUnitId(incident.assignedUnitId);
    }
  }, [incident]);

  const assignedUnit = incident.assignedUnitId
    ? units.find((u) => u.id === incident.assignedUnitId) || null
    : null;

  const selectedRouteUnit = candidateUnitId
    ? units.find((u) => u.id === candidateUnitId) || null
    : assignedUnit;

  // Fetch route when candidateUnitId or allowSimRoute changes
  useEffect(() => {
    if (
      !selectedRouteUnit ||
      typeof incident.location.lat !== 'number' ||
      typeof incident.location.lng !== 'number'
    ) {
      setRoute(null);
      onRouteCalculated?.(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    fetch('/api/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLat: selectedRouteUnit.lat,
        fromLng: selectedRouteUnit.lng,
        toLat: incident.location.lat,
        toLng: incident.location.lng,
        allowSimulatedOverlay: allowSimRoute,
      }),
    })
      .then((r) => r.json())
      .then((data: RouteResult) => {
        if (!cancelled) {
          setRoute(data);
          onRouteCalculated?.(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoute(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedRouteUnit?.id,
    selectedRouteUnit?.lat,
    selectedRouteUnit?.lng,
    incident.location.lat,
    incident.location.lng,
    allowSimRoute,
  ]);

  const isTakenOver = Boolean(incident.assignedOperator) || !incident.aiIntakeActive;
  const needsTakeover =
    incident.status === 'NEW' ||
    incident.status === 'AI_INTAKE' ||
    incident.status === 'AWAITING_OPERATOR';

  const handleGpsCapture = () => {
    if (!navigator.geolocation) {
      alert('Browser geolocation is unavailable.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPinLat(Number(pos.coords.latitude.toFixed(5)));
        setPinLng(Number(pos.coords.longitude.toFixed(5)));
      },
      () => {
        // Handled cleanly via UI text if denied
      }
    );
  };

  const tabs: Array<{ id: WorkspaceTab; label: string; tip: string; count?: number }> = [
    { id: 'overview', label: 'Overview', tip: 'Incident summary, people affected, danger indicators, and status' },
    { id: 'transcript', label: 'AI Transcript', tip: 'Verbatim caller and AI intake messages', count: incident.transcript.length },
    { id: 'location', label: 'Location', tip: 'Verify Lagos street address, landmark, and map pin' },
    { id: 'units', label: 'Response Units', tip: 'Choose a response unit, check route, and approve dispatch' },
    { id: 'timeline', label: 'Activity Timeline', tip: 'Full timestamped audit log of every action', count: incident.timeline.length },
    { id: 'notes', label: 'Notes', tip: 'Record operator notes and access instructions', count: incident.notes.length },
  ];

  const workflow = computeIncidentWorkflow(
    incident,
    assignedUnit,
    Boolean(candidateUnitId && !incident.assignedUnitId)
  );

  const handleGuidedNextAction = async () => {
    if (workflow.nextActionType === 'TAKE_OVER' && canTakeOver(userRole)) {
      setBusy(true);
      await onTakeOver(incident.id);
      setBusy(false);
      return;
    }
    if (workflow.nextActionType === 'APPROVE_DISPATCH') {
      const targetUnit = candidateUnitId ? units.find((u) => u.id === candidateUnitId) || null : null;
      if (targetUnit && targetUnit.availability === 'AVAILABLE' && canApproveDispatch(userRole)) {
        setActiveTab('units');
        setConfirmUnit(targetUnit);
        return;
      }
    }
    if (workflow.nextActionType === 'CLOSE_INCIDENT' && canUpdateIncidentStatus(userRole)) {
      setConfirmClosure({
        targetStatus: 'CLOSED',
        defaultReason: 'Field response completed and confirmed safe by human operator.',
      });
      return;
    }
    setActiveTab(workflow.nextTabTarget);
  };

  return (
    <div className="space-y-4">
      {/* Workspace Header */}
      <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-medium text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <span className="font-mono text-base font-bold text-slate-50">
                {incident.id}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-sm font-semibold text-slate-200">
                {incident.category}
              </span>
              <PriorityBadge priority={incident.priority} />
              <IncidentStatusBadge status={incident.status} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Received {formatRelativeTime(incident.createdAt)}</span>
              <span>·</span>
              <span>
                Operator:{' '}
                <strong className="text-slate-200">
                  {incident.assignedOperator || 'Unassigned'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Control State:{' '}
                <strong className={isTakenOver ? 'text-emerald-400' : 'text-amber-300'}>
                  {isTakenOver ? 'HUMAN OPERATOR CONTROL' : 'AI INTAKE ACTIVE'}
                </strong>
              </span>
              {incident.isSimulated && (
                <>
                  <span>·</span>
                  <span className="font-mono text-amber-300">SIMULATED RECORD</span>
                </>
              )}
            </div>
          </div>

          {/* Role-Gated Primary Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenConversation && (
              <button
                type="button"
                onClick={() => onOpenConversation(incident.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-blue-300 transition-colors whitespace-nowrap"
              >
                <Headphones className="w-4 h-4" />
                <span>Conversation Centre</span>
              </button>
            )}
            {needsTakeover && canTakeOver(userRole) && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onTakeOver(incident.id);
                  setBusy(false);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" />
                <span>Take Over</span>
              </button>
            )}

            {incident.location.verificationStatus !== 'VERIFIED' &&
              canVerifyIncident(userRole) && (
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Incident</span>
                </button>
              )}

            {!incident.assignedUnitId && canApproveDispatch(userRole) && (
              <button
                type="button"
                onClick={() => setActiveTab('units')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Truck className="w-4 h-4" />
                <span>Assign Unit</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Incident workspace sections"
          className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-[#26364B]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              title={tab.tip}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0B1220] text-slate-300 hover:bg-[#172438] border border-[#26364B]'
              }`}
            >
              {tab.label}
              {tab.count !== undefined ? ` (${tab.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* 8-Step Guided Operational Workflow Bar */}
      <section
        aria-label="Guided operational workflow"
        className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8 gap-2">
          {workflow.steps.map((step) => (
            <div
              key={step.id}
              title={`Step ${step.number}: ${step.label}`}
              className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold flex items-center gap-2 transition-colors min-w-0 ${
                step.status === 'done'
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                  : step.status === 'current'
                  ? 'bg-blue-600/25 border-blue-400 text-blue-100'
                  : 'bg-[#0B1220] border-[#26364B] text-slate-400'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full text-[10px] font-mono flex items-center justify-center shrink-0 ${
                  step.status === 'done'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : step.status === 'current'
                    ? 'bg-blue-500 text-white font-bold'
                    : 'bg-[#172438] text-slate-400'
                }`}
              >
                {step.number}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-[#0B1220] border border-[#26364B] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-xs">
            <div>
              <div className="text-[11px] font-semibold text-blue-300">
                What is happening
              </div>
              <p className="text-slate-200 mt-0.5 leading-snug">
                {workflow.whatIsHappening}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-amber-300">
                What needs attention
              </div>
              <p className="text-slate-200 mt-0.5 leading-snug">
                {workflow.needsAttention}
              </p>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-emerald-300">
                Recommended next step
              </div>
              <p className="text-slate-300 mt-0.5 leading-snug">
                {workflow.nextActionDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={handleGuidedNextAction}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <span>{workflow.nextActionLabel}</span>
            </button>
            {incident.status !== 'CLOSED' &&
              incident.status !== 'RESOLVED' &&
              canUpdateIncidentStatus(userRole) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setConfirmClosure({
                      targetStatus: 'CLOSED',
                      defaultReason: 'Case reviewed and closed by human operator.',
                    })
                  }
                  title="Close this incident after confirming all actions are complete"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
                >
                  <span>Close Incident</span>
                </button>
              )}
          </div>
        </div>
      </section>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-slate-100">
                  AI &amp; Operator Incident Summary
                </h2>
                <span className="text-[11px] text-slate-400">
                  Channel: {incident.callChannel.replace('_', ' ')}
                </span>
              </div>

              <p className="text-sm text-slate-100 leading-relaxed">{incident.summary}</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Original Report: {incident.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#26364B]">
                <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3">
                  <div className="text-[11px] text-slate-400">People Affected</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-100 tabular-nums">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>
                      {incident.peopleAffected !== null
                        ? incident.peopleAffected
                        : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3">
                  <div className="text-[11px] text-slate-400">Immediate Danger</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                    {incident.immediateDanger ? (
                      <span className="text-red-400 inline-flex items-center gap-1">
                        <AlertOctagon className="w-4 h-4" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-300">Not reported</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3">
                  <div className="text-[11px] text-slate-400">Caller Contact</div>
                  <div className="mt-1 text-xs font-mono text-slate-200 truncate">
                    {incident.callerName || 'Anonymous'}
                    {incident.callerPhone ? ` · ${incident.callerPhone}` : ''}
                  </div>
                </div>
              </div>

              {incident.dangerDetails && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/35 p-3 text-xs text-red-200 flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>Danger Indicator: {incident.dangerDetails}</span>
                </div>
              )}

              {incident.missingInfoFlags.length > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/35 p-3 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Missing Information Flags</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-100/90 space-y-0.5">
                    {incident.missingInfoFlags.map((flag, idx) => (
                      <li key={idx}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-slate-400 pt-1">
                Priority Explanation: <span className="text-slate-200">{incident.priorityReason}</span>
              </div>
            </div>

            {/* Operator Edit Incident Details */}
            {canVerifyIncident(userRole) && (
              <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Operator Corrections &amp; Triage Override
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="op-summary"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Verified Summary
                    </label>
                    <input
                      id="op-summary"
                      type="text"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="op-priority"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Priority Level
                    </label>
                    <select
                      id="op-priority"
                      value={editPriority}
                      onChange={(e) =>
                        setEditPriority(e.target.value as IncidentPriority)
                      }
                      className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await onVerifyLocation(incident.id, {
                      summary: editSummary,
                      priority: editPriority,
                      markVerified: incident.location.verificationStatus === 'VERIFIED',
                    });
                    setBusy(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-blue-300"
                >
                  Save Operator Corrections
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-4">
            {/* Location Snapshot */}
            <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Location Intelligence
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('location')}
                  className="text-xs font-medium text-blue-400 hover:underline"
                >
                  Manage Location →
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <LocationSourceBadge source={incident.location.source} />
                <VerificationBadge status={incident.location.verificationStatus} />
              </div>
              <p className="text-xs text-slate-200">
                {incident.location.correctedDescription || incident.location.description}
              </p>
              {incident.location.lat && incident.location.lng && (
                <div className="font-mono text-[11px] text-slate-400">
                  {incident.location.lat.toFixed(5)}, {incident.location.lng.toFixed(5)}
                  {incident.location.accuracyMeters
                    ? ` (±${incident.location.accuracyMeters}m)`
                    : ''}
                </div>
              )}
              <LagosMap
                incidents={[incident]}
                units={assignedUnit ? [assignedUnit] : []}
                selectedIncidentId={incident.id}
                route={route}
                heightClass="h-[210px]"
                showLegend={false}
                showInfoCard={false}
              />
            </div>

            {/* Authorised Status Transition */}
            {canUpdateIncidentStatus(userRole) && (
              <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-100">
                  Update Incident Status
                </h3>
                <p className="text-[11px] text-slate-400">
                  Authorised operators record a mandatory reason for every status change. Dispatch statuses require unit approval.
                </p>
                <div className="space-y-2">
                  <select
                    aria-label="Target incident status"
                    value={statusTarget}
                    onChange={(e) => setStatusTarget(e.target.value as IncidentStatus)}
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100"
                  >
                    {INCIDENT_STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Reason for status change (required)"
                    aria-label="Reason for status change"
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={busy || (!statusReason.trim() && statusTarget !== 'RESOLVED' && statusTarget !== 'CLOSED')}
                    onClick={async () => {
                      if (statusTarget === 'RESOLVED' || statusTarget === 'CLOSED') {
                        setConfirmClosure({
                          targetStatus: statusTarget,
                          defaultReason:
                            statusReason.trim() ||
                            (statusTarget === 'CLOSED'
                              ? 'Incident confirmed complete and closed by operator.'
                              : 'Field response completed and incident resolved.'),
                        });
                        return;
                      }
                      setBusy(true);
                      await onUpdateStatus(incident.id, statusTarget, statusReason);
                      setStatusReason('');
                      setBusy(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                  >
                    Record Status Change
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI TRANSCRIPT */}
      {activeTab === 'transcript' && (
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#26364B]">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-100">
                Intake Conversation Transcript
              </h2>
              <p className="text-xs text-slate-400">
                Preserved verbatim alongside extracted tags and human takeover records.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenConversation && (
                <button
                  type="button"
                  onClick={() => onOpenConversation(incident.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Open in Conversation Centre</span>
                </button>
              )}
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  isTakenOver
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/35'
                }`}
              >
                {isTakenOver
                  ? `Human Operator Connected (${incident.assignedOperator || operatorName}) — AI Halted`
                  : 'Responda Automated AI Intake Active'}
              </div>
            </div>
          </div>

          {incident.transcript.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No transcript messages recorded for this incident.
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {incident.transcript.map((msg) => {
                const isCaller = msg.speaker === 'CALLER';
                const isOp = msg.speaker === 'OPERATOR';
                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3.5 border ${
                      isCaller
                        ? 'bg-[#0B1220] border-[#26364B] mr-8'
                        : isOp
                        ? 'bg-emerald-500/10 border-emerald-500/35 ml-8'
                        : 'bg-blue-500/10 border-blue-500/30 ml-8'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                      <span
                        className={`font-semibold ${
                          isCaller
                            ? 'text-slate-200'
                            : isOp
                            ? 'text-emerald-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {isCaller
                          ? 'Caller'
                          : isOp
                          ? 'Human Operator'
                          : 'Responda AI Assistant'}
                      </span>
                      <span className="font-mono text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-100 leading-relaxed">{msg.text}</p>
                    {msg.extractedTags && msg.extractedTags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-blue-300 font-mono">
                        {msg.extractedTags.map((tag, idx) => (
                          <span key={idx}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOCATION INTELLIGENCE */}
      {activeTab === 'location' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-4">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-100">
                Multi-Source Location Verification
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Coordinates alone never auto-verify an incident. Operators verify and preserve original caller text.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LocationSourceBadge source={incident.location.source} />
              <VerificationBadge status={incident.location.verificationStatus} />
            </div>

            <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3 space-y-1 text-xs">
              <div className="text-slate-400 font-medium">Original Caller Description</div>
              <div className="text-slate-100">{incident.location.description}</div>
              {incident.location.accuracyMeters && (
                <div className="font-mono text-[11px] text-blue-300">
                  Reported GPS accuracy: ±{incident.location.accuracyMeters} m
                </div>
              )}
            </div>

            <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3 space-y-1 text-xs">
              <div className="text-slate-400 font-medium">
                Source 3 — Carrier / Network Location Adapter
              </div>
              <div className="text-amber-300 font-medium">
                {incident.location.carrierNote || 'Carrier location integration not configured'}
              </div>
              <p className="text-[11px] text-slate-400">
                Responda never infers GPS coordinates from a caller phone number.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#26364B]">
              <div>
                <label htmlFor="loc-desc" className="block text-xs text-slate-300 mb-1">
                  Operator-Verified Address / Description
                </label>
                <input
                  id="loc-desc"
                  type="text"
                  value={correctedDesc}
                  onChange={(e) => setCorrectedDesc(e.target.value)}
                  className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="loc-landmark" className="block text-xs text-slate-300 mb-1">
                    Landmark
                  </label>
                  <input
                    id="loc-landmark"
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="loc-area" className="block text-xs text-slate-300 mb-1">
                    Lagos Area
                  </label>
                  <input
                    id="loc-area"
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="loc-lat" className="block text-xs text-slate-300 mb-1">
                    Latitude
                  </label>
                  <input
                    id="loc-lat"
                    type="number"
                    step="0.0001"
                    value={pinLat ?? ''}
                    onChange={(e) => setPinLat(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor="loc-lng" className="block text-xs text-slate-300 mb-1">
                    Longitude
                  </label>
                  <input
                    id="loc-lng"
                    type="number"
                    step="0.0001"
                    value={pinLng ?? ''}
                    onChange={(e) => setPinLng(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleGpsCapture}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs text-slate-200"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-blue-400" />
                  <span>Use Browser GPS</span>
                </button>
                {canVerifyIncident(userRole) && (
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
                    <span>Save &amp; Verify Location</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Click anywhere on the Lagos map to adjust the operator pin</span>
              </div>
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
              units={units}
              selectedIncidentId={incident.id}
              editablePin={canVerifyIncident(userRole)}
              onPinMove={(lat, lng) => {
                setPinLat(lat);
                setPinLng(lng);
              }}
              heightClass="h-[440px]"
            />
          </div>
        </div>
      )}

      {/* TAB 4: RESPONSE UNITS & HUMAN-APPROVED DISPATCH */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          {/* Workflow Stepper */}
          <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4">
            <div className="text-xs font-semibold text-slate-300 mb-2.5">
              Human-Controlled Dispatch Sequence
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
              {[
                {
                  label: '1. Incident Verified',
                  done:
                    incident.location.verificationStatus === 'VERIFIED' ||
                    Boolean(incident.assignedUnitId),
                },
                { label: '2. Unit Selected', done: Boolean(candidateUnitId || assignedUnit) },
                { label: '3. Human Approval', done: Boolean(incident.dispatchedAt) },
                { label: '4. Unit Assigned', done: Boolean(incident.assignedUnitId) },
                {
                  label: '5. Acknowledged',
                  done:
                    Boolean(incident.acknowledgedAt) ||
                    assignedUnit?.availability === 'ACKNOWLEDGED' ||
                    assignedUnit?.availability === 'EN_ROUTE' ||
                    assignedUnit?.availability === 'ON_SCENE',
                },
                {
                  label: '6. En Route',
                  done:
                    assignedUnit?.availability === 'EN_ROUTE' ||
                    assignedUnit?.availability === 'ON_SCENE',
                },
                {
                  label: '7. On Scene',
                  done: assignedUnit?.availability === 'ON_SCENE',
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className={`px-2.5 py-2 rounded-lg border font-medium ${
                    step.done
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                      : 'bg-[#0B1220] border-[#26364B] text-slate-400'
                  }`}
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6 space-y-3">
              {/* Assigned Unit Status Controls */}
              {assignedUnit && (
                <div className="rounded-xl bg-[#111C2E] border border-cyan-500/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-cyan-300 font-semibold">
                        Assigned Response Unit {assignedUnit.isSimulated ? '(Simulated Demo Mode)' : ''}
                      </div>
                      <div className="text-sm font-bold text-slate-50">
                        {assignedUnit.callsign} · {assignedUnit.unitType}
                      </div>
                      <div className="text-xs text-slate-400">
                        {assignedUnit.crewDescription}
                      </div>
                    </div>
                    <UnitAvailabilityBadge availability={assignedUnit.availability} />
                  </div>

                  {canUpdateUnitStatus(userRole) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#26364B]">
                      {(
                        [
                          { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
                          { key: 'EN_ROUTE', label: 'En route' },
                          { key: 'ON_SCENE', label: 'On scene' },
                          { key: 'COMPLETED', label: 'Completed' },
                          { key: 'CANCELLED', label: 'Cancelled' },
                        ] as const
                      ).map((act) => (
                        <button
                          key={act.key}
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            await onUpdateUnitStatus(assignedUnit.id, act.key);
                            setBusy(false);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-200 transition-colors"
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Unit Selection List */}
              <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-100">
                    Lagos Response Units
                  </h3>
                  {!canApproveDispatch(userRole) && (
                    <span className="text-[11px] text-amber-300">
                      Role &apos;{userRole}&apos; is read-only for dispatch approval
                    </span>
                  )}
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {units.map((unit) => {
                    const isSelected = candidateUnitId === unit.id;
                    const isAvailable = unit.availability === 'AVAILABLE';
                    return (
                      <div
                        key={unit.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          isSelected
                            ? 'bg-[#172438] border-blue-500/60'
                            : 'bg-[#0B1220] border-[#26364B]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setCandidateUnitId(unit.id)}
                            className="text-left flex-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-400">
                                {unit.id}
                              </span>
                              <span className="text-sm font-semibold text-slate-100">
                                {unit.callsign}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {unit.unitType} · {unit.locationName}, {unit.area}
                            </div>
                          </button>
                          <UnitAvailabilityBadge availability={unit.availability} />
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#26364B]/70 text-[11px] text-slate-400">
                          <span>{unit.crewDescription}</span>
                          {isAvailable &&
                            !incident.assignedUnitId &&
                            canApproveDispatch(userRole) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCandidateUnitId(unit.id);
                                  setConfirmUnit(unit);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Select &amp; Approve Dispatch</span>
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Route & Map Comparison */}
            <div className="lg:col-span-6 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-100">
                    Dispatch Route Preview
                  </h3>
                  <p className="text-xs text-slate-400">
                    {routeLoading
                      ? 'Calculating OpenRouteService route...'
                      : route?.available
                      ? route.isSimulatedFallback
                        ? 'Simulated demo corridor overlay active (no ORS key)'
                        : `${formatDistanceKm(route.distanceMeters)} · Estimated ${formatDurationMinutes(route.durationSeconds)} via OpenRouteService`
                      : route?.message || 'Select a unit to inspect location and routing status.'}
                  </p>
                </div>

                <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSimRoute}
                    onChange={(e) => setAllowSimRoute(e.target.checked)}
                    className="rounded border-[#26364B] bg-[#0B1220] text-blue-600"
                  />
                  <span>Show Simulated Demo Route Overlay</span>
                </label>
              </div>

              <LagosMap
                incidents={[incident]}
                units={units}
                selectedIncidentId={incident.id}
                selectedUnitId={candidateUnitId}
                route={route}
                onSelectUnit={(id) => setCandidateUnitId(id)}
                heightClass="h-[400px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-5">
          <h2 className="font-display text-sm font-bold text-slate-100 mb-4">
            Immutable Audit &amp; Activity Timeline
          </h2>
          <div className="space-y-4">
            {incident.timeline.map((ev, idx) => (
              <div key={ev.id} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-[#172438] border border-[#26364B] flex items-center justify-center text-blue-400 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  {idx < incident.timeline.length - 1 && (
                    <div className="w-px flex-1 bg-[#26364B] my-1" />
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-100">{ev.title}</div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {new Date(ev.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{ev.description}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span>
                      Actor: {ev.actor} ({ev.actorRole})
                    </span>
                    {ev.isSimulated && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300 font-mono">SIMULATED</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: OPERATOR NOTES */}
      {activeTab === 'notes' && (
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-5 space-y-4">
          <h2 className="font-display text-sm font-bold text-slate-100">
            Operator Notes &amp; Decisions
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              setBusy(true);
              await onAddNote(incident.id, noteText.trim());
              setNoteText('');
              setBusy(false);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Record verification note, gate access instruction, or clinical/security context..."
              aria-label="Operator note"
              className="flex-1 rounded-lg bg-[#0B1220] border border-[#26364B] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !noteText.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Add Note</span>
            </button>
          </form>

          {incident.notes.length === 0 ? (
            <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-6 text-center text-xs text-slate-400">
              No operator notes added yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {incident.notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {n.author} ({n.role})
                    </span>
                    <span className="font-mono">
                      {new Date(n.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-200">{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmUnit && (
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

      {confirmClosure && (
        <ConfirmActionModal
          title={
            confirmClosure.targetStatus === 'CLOSED'
              ? `Confirm Closing ${incident.id}`
              : `Confirm Marking ${incident.id} Resolved`
          }
          description={
            confirmClosure.targetStatus === 'CLOSED'
              ? `Closing ${incident.id} moves it from the Live Incidents queue into Incident History. Please confirm that the situation is safe and record a short closure reason.`
              : `Marking ${incident.id} as Resolved indicates field assistance has finished. Please record a short resolution reason for the audit trail.`
          }
          confirmLabel={
            confirmClosure.targetStatus === 'CLOSED'
              ? 'Confirm & Close Incident'
              : 'Confirm & Mark Resolved'
          }
          defaultReason={confirmClosure.defaultReason}
          tone={confirmClosure.targetStatus === 'CLOSED' ? 'danger' : 'warning'}
          submitting={busy}
          onCancel={() => setConfirmClosure(null)}
          onConfirm={async (reason) => {
            setBusy(true);
            await onUpdateStatus(incident.id, confirmClosure.targetStatus, reason);
            setStatusReason('');
            setConfirmClosure(null);
            setBusy(false);
          }}
        />
      )}
    </div>
  );
}
