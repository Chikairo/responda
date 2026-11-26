import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Search,
  UserCheck,
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
  canTakeOver,
  formatRelativeTime,
  isActiveIncidentStatus,
  MEDICAL_CATEGORIES,
  sortIncidents,
} from '../utils/incidentLogic';
import type { IncidentWorkspaceTabId } from '../utils/guidedWorkflow';
import { AiIntakeWorkspace } from './AiIntakeWorkspace';
import { IncidentWorkspace, type IncidentWorkspaceDraft } from './IncidentWorkspace';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  VerificationBadge,
} from './StatusBadges';

interface IncidentManagementViewProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  operatorName: string;
  authFetch: typeof fetch;
  geminiConfigured: boolean;
  carrierConfigured: boolean;
  requireLocationVerificationBeforeDispatch: boolean;
  selectedIncidentId: string | null;
  workspaceOpen: boolean;
  initialTab: IncidentWorkspaceTabId;
  intakeMode: boolean;
  simState: SimulationRuntimeState;
  preselectedUnitId: string | null;
  draftsByIncidentId: Record<string, IncidentWorkspaceDraft>;
  onUpdateDraft: (incidentId: string, patch: Partial<IncidentWorkspaceDraft>) => void;
  onSetIntakeMode: (open: boolean) => void;
  onSelectIncident: (id: string) => void;
  onOpenWorkspace: (id: string, tab?: IncidentWorkspaceTabId) => void;
  onCloseWorkspace: () => void;
  onIncidentCreated: (incident: IncidentRecord) => void;
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

export function IncidentManagementView({
  incidents,
  units,
  userRole,
  operatorName,
  authFetch,
  geminiConfigured,
  carrierConfigured,
  requireLocationVerificationBeforeDispatch,
  selectedIncidentId,
  workspaceOpen,
  initialTab,
  intakeMode,
  simState,
  preselectedUnitId,
  draftsByIncidentId,
  onUpdateDraft,
  onSetIntakeMode,
  onSelectIncident,
  onOpenWorkspace,
  onCloseWorkspace,
  onIncidentCreated,
  onTakeOver,
  onUpdateMedicalDetails,
  onVerifyLocation,
  onUpdateStatus,
  onDispatchUnit,
  onTransportEvent,
  onAddNote,
  onSendOperatorMessage,
  onRouteCalculated,
}: IncidentManagementViewProps) {
  const [statusTab, setStatusTab] = useState<'ALL_OPEN' | IncidentStatus>('ALL_OPEN');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IncidentPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | MedicalEmergencyCategory>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const openIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (inc.legacyOutOfScope || !isActiveIncidentStatus(inc.status)) return false;
      if (statusTab !== 'ALL_OPEN' && inc.status !== statusTab) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (q) {
        const hay = `${inc.id} ${inc.category} ${inc.summary} ${
          inc.callerName || ''
        } ${inc.location.area || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortIncidents(list, 'priority');
  }, [incidents, statusTab, priorityFilter, categoryFilter, search]);

  const workspaceIncident = selectedIncidentId
    ? incidents.find((i) => i.id === selectedIncidentId) || null
    : null;

  if (intakeMode) {
    return (
      <AiIntakeWorkspace
        embedded
        geminiConfigured={geminiConfigured}
        authFetch={authFetch}
        activeIncident={workspaceIncident}
        onCloseEmbedded={() => onSetIntakeMode(false)}
        onIncidentCreated={(inc) => {
          onIncidentCreated(inc);
          onSetIntakeMode(false);
          onOpenWorkspace(inc.id, 'workflow');
        }}
        onOpenIncident={(id) => {
          onSetIntakeMode(false);
          onOpenWorkspace(id, 'workflow');
        }}
      />
    );
  }

  if (workspaceOpen && workspaceIncident) {
    return (
      <IncidentWorkspace
        incident={workspaceIncident}
        incidents={incidents}
        units={units}
        userRole={userRole}
        operatorName={operatorName}
        authFetch={authFetch}
        initialTab={initialTab}
        simState={simState}
        carrierConfigured={carrierConfigured}
        preselectedUnitId={preselectedUnitId}
        requireLocationVerificationBeforeDispatch={requireLocationVerificationBeforeDispatch}
        draft={draftsByIncidentId[workspaceIncident.id]}
        onUpdateDraft={onUpdateDraft}
        onBack={onCloseWorkspace}
        onSelectIncident={(id) => onOpenWorkspace(id, initialTab)}
        onTakeOver={onTakeOver}
        onUpdateMedicalDetails={onUpdateMedicalDetails}
        onVerifyLocation={onVerifyLocation}
        onUpdateStatus={onUpdateStatus}
        onDispatchUnit={onDispatchUnit}
        onTransportEvent={onTransportEvent}
        onAddNote={onAddNote}
        onSendOperatorMessage={onSendOperatorMessage}
        onRouteCalculated={onRouteCalculated}
      />
    );
  }

  const openCount = (st?: IncidentStatus) =>
    incidents.filter(
      (i) =>
        !i.legacyOutOfScope &&
        isActiveIncidentStatus(i.status) &&
        (!st || i.status === st)
    ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Incident Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create new medical intakes, review unassessed reports, verify Lagos locations, and manage dispatch through closure.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSetIntakeMode(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Emergency Intake</span>
        </button>
      </div>

      {/* Status Filter Tabs & Dropdowns */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL_OPEN', label: `All Open (${openCount()})` },
              { id: 'New', label: `New (${openCount('New')})` },
              { id: 'Under Review', label: `Under Review (${openCount('Under Review')})` },
              { id: 'Dispatched', label: `Dispatched (${openCount('Dispatched')})` },
              {
                id: 'Patient Transport',
                label: `Patient Transport (${openCount('Patient Transport')})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 dark:bg-[#0B1220] dark:text-slate-300 dark:border-[#26364B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, caller, area, or symptom..."
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | IncidentPriority)}
            className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="Urgent">Urgent</option>
            <option value="Unassessed">Unassessed</option>
            <option value="Standard">Standard</option>
          </select>

          <select
            aria-label="Filter by medical category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as 'ALL' | MedicalEmergencyCategory)
            }
            className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Medical Categories</option>
            {MEDICAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-2.5">
        {openIncidents.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No open medical incidents match the selected filters.
          </div>
        ) : (
          openIncidents.map((inc) => {
            const assignedUnit = inc.assignedUnitId
              ? units.find((u) => u.id === inc.assignedUnitId) || null
              : null;
            const needsTakeover = inc.status === 'New' && !inc.assignedOperator;
            return (
              <div
                key={inc.id}
                onClick={() => {
                  onSelectIncident(inc.id);
                  onOpenWorkspace(inc.id, 'workflow');
                }}
                className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] hover:border-blue-400 dark:hover:border-blue-500/50 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer shadow-2xs dark:shadow-none transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {inc.id}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {inc.category}
                    </span>
                    <PriorityBadge priority={inc.priority} />
                    <IncidentStatusBadge status={inc.status} />
                    <LocationSourceBadge source={inc.location.source} />
                    <VerificationBadge status={inc.location.verificationStatus} />
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{inc.summary}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Received {formatRelativeTime(inc.createdAt)}</span>
                    <span>·</span>
                    <span>
                      Location:{' '}
                      {inc.location.correctedDescription || inc.location.description}
                    </span>
                    {assignedUnit && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          Unit: {assignedUnit.callsign} ({assignedUnit.availability})
                        </span>
                      </>
                    )}
                  </div>
                  {inc.priority === 'Unassessed' && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Unassessed clinical priority — operator assessment needed</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {needsTakeover && canTakeOver(userRole) && (
                    <button
                      type="button"
                      disabled={busyId === inc.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setBusyId(inc.id);
                        await onTakeOver(inc.id);
                        setBusyId(null);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Take Over</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWorkspace(inc.id, 'workflow');
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    <span>Open Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
