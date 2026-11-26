import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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
import { IncidentWorkspace, type IncidentWorkspaceDraft } from './IncidentWorkspace';
import { SelectMenu } from './SelectMenu';
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
  carrierConfigured: boolean;
  requireLocationVerificationBeforeDispatch: boolean;
  selectedIncidentId: string | null;
  workspaceOpen: boolean;
  initialTab: IncidentWorkspaceTabId;
  simState: SimulationRuntimeState;
  preselectedUnitId: string | null;
  draftsByIncidentId: Record<string, IncidentWorkspaceDraft>;
  onUpdateDraft: (incidentId: string, patch: Partial<IncidentWorkspaceDraft>) => void;
  onSelectIncident: (id: string) => void;
  onOpenWorkspace: (id: string, tab?: IncidentWorkspaceTabId) => void;
  onCloseWorkspace: () => void;
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
  carrierConfigured,
  requireLocationVerificationBeforeDispatch,
  selectedIncidentId,
  workspaceOpen,
  initialTab,
  simState,
  preselectedUnitId,
  draftsByIncidentId,
  onUpdateDraft,
  onSelectIncident,
  onOpenWorkspace,
  onCloseWorkspace,
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
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Incident Management
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Review incoming AI call intakes and unassessed reports, verify Lagos locations, and manage dispatch through closure.
          </p>
        </div>
      </div>

      {/* Status Filter Tabs & Dropdowns */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                statusTab === tab.id
                  ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                  : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, caller, area, or symptom..."
              className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <SelectMenu<'ALL' | IncidentPriority>
            ariaLabel="Filter by priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: 'ALL', label: 'All Priorities' },
              { value: 'Critical', label: 'Critical' },
              { value: 'Urgent', label: 'Urgent' },
              { value: 'Unassessed', label: 'Unassessed' },
              { value: 'Standard', label: 'Standard' },
            ]}
          />

          <SelectMenu<'ALL' | MedicalEmergencyCategory>
            ariaLabel="Filter by medical category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'ALL', label: 'All Medical Categories' },
              ...MEDICAL_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-2.5">
        {openIncidents.length === 0 ? (
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-secondary)]">
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
                className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] shadow-[var(--shadow-card)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums text-sm font-bold text-[var(--text-primary)]">
                      {inc.id}
                    </span>
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {inc.category}
                    </span>
                    <PriorityBadge priority={inc.priority} />
                    <IncidentStatusBadge status={inc.status} />
                    <LocationSourceBadge source={inc.location.source} />
                    <VerificationBadge status={inc.location.verificationStatus} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{inc.summary}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                    <span className="font-mono tabular-nums">
                      Received {formatRelativeTime(inc.createdAt)}
                    </span>
                    <span>·</span>
                    <span>
                      Location:{' '}
                      {inc.location.correctedDescription || inc.location.description}
                    </span>
                    {assignedUnit && (
                      <>
                        <span>·</span>
                        <span className="font-semibold text-[var(--brand-teal)]">
                          Unit: {assignedUnit.callsign} ({assignedUnit.availability})
                        </span>
                      </>
                    )}
                  </div>
                  {inc.priority === 'Unassessed' && (
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-[var(--status-unassessed-text)] font-medium">
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
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[var(--status-urgent-accent)] hover:opacity-90 text-[#0B1519] text-xs font-bold whitespace-nowrap shrink-0"
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
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-[var(--text-on-solid)] text-xs font-semibold whitespace-nowrap shrink-0"
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
