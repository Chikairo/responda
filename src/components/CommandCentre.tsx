import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  MapPin,
  Play,
  Search,
  Truck,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  IncidentPriority,
  IncidentRecord,
  IncidentStatus,
  ResponseUnit,
  RouteResult,
  SimulationScenarioId,
  UserRole,
} from '../types/responda';
import {
  canTakeOver,
  computeDashboardMetrics,
  formatRelativeTime,
  INCIDENT_STATUS_ORDER,
  isActiveIncidentStatus,
  sortIncidents,
} from '../utils/incidentLogic';
import { computeCommandBriefing } from '../utils/guidedWorkflow';
import { SIMULATION_SCENARIOS } from '../utils/simulationEngine';
import { LagosMap } from './LagosMap';
import { SelectMenu } from './SelectMenu';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  VerificationBadge,
} from './StatusBadges';

interface CommandCentreProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  selectedIncidentId: string | null;
  selectedUnitId: string | null;
  activeRoute: RouteResult | null;
  simulationActive: boolean;
  selectedScenario: SimulationScenarioId;
  simulationAudioEnabled: boolean;
  onSelectScenario: (scenarioId: SimulationScenarioId) => void;
  onToggleSimulationAudio: () => void;
  onRunSimulation: () => void;
  onSelectIncident: (id: string) => void;
  onSelectUnit: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onTakeOver: (id: string) => Promise<void>;
  onOpenHistory: () => void;
  onOpenGuide: () => void;
}

export function CommandCentre({
  incidents,
  units,
  userRole,
  selectedIncidentId,
  selectedUnitId,
  activeRoute,
  simulationActive,
  selectedScenario,
  simulationAudioEnabled,
  onSelectScenario,
  onToggleSimulationAudio,
  onRunSimulation,
  onSelectIncident,
  onSelectUnit,
  onOpenWorkspace,
  onTakeOver,
  onOpenHistory,
  onOpenGuide,
}: CommandCentreProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IncidentPriority>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [sortBy, setSortBy] = useState<'priority' | 'newest'>('priority');
  const [busyId, setBusyId] = useState<string | null>(null);

  const metrics = useMemo(
    () => computeDashboardMetrics(incidents, units),
    [incidents, units]
  );

  const briefing = useMemo(
    () => computeCommandBriefing(incidents, units),
    [incidents, units]
  );

  const activeMedicalUnits = useMemo(
    () => units.filter((u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope),
    [units]
  );

  const activeIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (inc.legacyOutOfScope) return false;
      if (!isActiveIncidentStatus(inc.status)) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (q) {
        const hay = `${inc.id} ${inc.category} ${inc.summary} ${
          inc.location.correctedDescription || inc.location.description
        } ${inc.location.area || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortIncidents(list, sortBy);
  }, [incidents, priorityFilter, statusFilter, searchQuery, sortBy]);

  const mapIncidents = useMemo(
    () => incidents.filter((inc) => !inc.legacyOutOfScope && isActiveIncidentStatus(inc.status)),
    [incidents]
  );

  return (
    <div className="space-y-4">
      {/* Header Strip */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Medical Emergency Command Centre
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Live Lagos medical emergencies, human triage verification, and active ambulance dispatch coordination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compact 9-Stage Simulation Launcher */}
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-1">
            <SelectMenu<SimulationScenarioId>
              ariaLabel="Simulation Scenario"
              value={selectedScenario}
              disabled={simulationActive}
              onChange={onSelectScenario}
              options={(Object.keys(SIMULATION_SCENARIOS) as SimulationScenarioId[]).map((id) => ({
                value: id,
                label: SIMULATION_SCENARIOS[id].label,
                sublabel: SIMULATION_SCENARIOS[id].subtitle,
              }))}
              buttonClassName="border-transparent bg-transparent py-1 px-2 font-medium min-w-[210px]"
            />
            <button
              type="button"
              onClick={onToggleSimulationAudio}
              aria-label={simulationAudioEnabled ? 'Mute simulation voice' : 'Unmute simulation voice'}
              title={simulationAudioEnabled ? 'Simulation voice enabled' : 'Simulation voice muted'}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              {simulationAudioEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[var(--brand-teal)]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              )}
            </button>
            <button
              type="button"
              onClick={onRunSimulation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-xs font-semibold text-[var(--text-on-solid)] transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{simulationActive ? 'Restart Demo' : 'RUN SIMULATION'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Incident History</span>
          </button>

          <button
            type="button"
            onClick={onOpenGuide}
            title="Operator workflow guide"
            className="p-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-[var(--action-blue)] dark:text-[#60A5FA] transition-colors shrink-0"
            aria-label="Open operator guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Active Incidents</span>
            <AlertOctagon className="w-4 h-4 text-[var(--status-critical-text)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {metrics.activeCount}
            </span>
            {metrics.criticalCount > 0 && (
              <span className="text-xs font-semibold text-[var(--status-critical-text)] tabular-nums">
                {metrics.criticalCount} Critical
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Units Available</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--status-verified-text)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[var(--status-verified-text)] tabular-nums">
              {metrics.availableUnitsCount}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Active medical fleet
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Units Dispatched</span>
            <Truck className="w-4 h-4 text-[var(--status-standard-text)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[var(--status-standard-text)] tabular-nums">
              {metrics.respondingUnitsCount}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Responding / On Scene
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Incidents Awaiting Attention</span>
            <AlertTriangle className="w-4 h-4 text-[var(--status-urgent-text)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[var(--status-urgent-text)] tabular-nums">
              {metrics.awaitingReviewCount}
            </span>
            {metrics.unassessedCount > 0 && (
              <span className="text-xs font-semibold text-[var(--status-unassessed-text)] tabular-nums">
                {metrics.unassessedCount} Unassessed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Operational Focus Briefing Banner */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-xs">
          <div>
            <div className="text-[11px] font-semibold text-[var(--brand-teal)]">
              Current Situation
            </div>
            <p className="text-[var(--text-primary)] mt-0.5">{briefing.whatIsHappening}</p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[var(--status-urgent-text)]">
              Priority Attention
            </div>
            <p className="text-[var(--text-primary)] mt-0.5">{briefing.needsAttention}</p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[var(--status-verified-text)]">
              Next Recommended Action
            </div>
            <p className="text-[var(--text-secondary)] mt-0.5">{briefing.nextStepText}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (briefing.focusIncident) {
              onOpenWorkspace(briefing.focusIncident.id);
            } else {
              onRunSimulation();
            }
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-xs font-semibold text-[var(--text-on-solid)] transition-colors whitespace-nowrap shrink-0"
        >
          <span>{briefing.focusIncident ? briefing.focusActionLabel : 'RUN SIMULATION'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Split Workspace: ~58% Lagos Map / ~42% Active Medical Queue */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Map Column (7/12 = ~58%) */}
        <div className="xl:col-span-7 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
                Lagos Live Operational Map
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Showing <span className="font-mono tabular-nums">{mapIncidents.length}</span> active medical incident{mapIncidents.length === 1 ? '' : 's'} and{' '}
                <span className="font-mono tabular-nums">{activeMedicalUnits.length}</span> active medical unit{activeMedicalUnits.length === 1 ? '' : 's'}.
              </p>
            </div>
            {selectedIncidentId && (
              <button
                type="button"
                onClick={() => onOpenWorkspace(selectedIncidentId)}
                className="text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span className="font-mono tabular-nums">Open {selectedIncidentId}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <LagosMap
            incidents={mapIncidents}
            units={activeMedicalUnits}
            selectedIncidentId={selectedIncidentId}
            selectedUnitId={selectedUnitId}
            route={activeRoute}
            onSelectIncident={(id) => onSelectIncident(id)}
            onSelectUnit={(id) => onSelectUnit(id)}
            heightClass="h-[460px] lg:h-[520px]"
          />
        </div>

        {/* Active Incidents Queue Column (5/12 = ~42%) */}
        <div className="xl:col-span-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Active Medical Incidents (<span className="font-mono tabular-nums">{activeIncidents.length}</span>)
            </h2>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSortBy('priority')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === 'priority'
                    ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                    : 'bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Priority
              </button>
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className={`px-2.5 py-1 rounded font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === 'newest'
                    ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                    : 'bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Newest
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-1">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or area..."
                aria-label="Search active medical incidents"
                className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
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

            <SelectMenu<'ALL' | IncidentStatus>
              ariaLabel="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              menuAlign="right"
              options={[
                { value: 'ALL', label: 'All Active Statuses' },
                ...INCIDENT_STATUS_ORDER.filter((s) => s !== 'Closed').map((s) => ({
                  value: s,
                  label: s,
                })),
              ]}
            />
          </div>

          {/* Queue Cards */}
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
            {activeIncidents.length === 0 ? (
              <div className="rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-secondary)]">
                No active medical incidents match the current filter.
              </div>
            ) : (
              activeIncidents.map((inc) => {
                const isSelected = selectedIncidentId === inc.id;
                const isUnassessed = inc.priority === 'Unassessed';
                const needsTakeover = inc.status === 'New' && !inc.assignedOperator;
                const assignedUnit = inc.assignedUnitId
                  ? units.find((u) => u.id === inc.assignedUnitId) || null
                  : null;

                return (
                  <div
                    key={inc.id}
                    onClick={() => onSelectIncident(inc.id)}
                    className={`rounded-xl border p-3.5 space-y-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--action-blue-bg)] border-[var(--action-blue-border)]'
                        : isUnassessed
                        ? 'bg-[var(--status-unassessed-bg)] border-[var(--status-unassessed-border)]'
                        : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono tabular-nums text-xs font-bold text-[var(--text-primary)]">
                          {inc.id}
                        </span>
                        <PriorityBadge priority={inc.priority} />
                        <IncidentStatusBadge status={inc.status} />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                        {formatRelativeTime(inc.createdAt)}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-[var(--text-primary)]">
                        {inc.category} · {inc.location.area || 'Lagos'}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {inc.summary}
                      </p>
                    </div>

                    {isUnassessed && (
                      <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--status-unassessed-border)] px-2.5 py-1.5 text-[11px] text-[var(--status-unassessed-text)] font-medium flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Priority Unassessed — clinical triage required by operator.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <LocationSourceBadge source={inc.location.source} />
                        <VerificationBadge status={inc.location.verificationStatus} />
                        {assignedUnit && (
                          <span className="inline-flex items-center gap-1 font-mono text-[var(--brand-teal)]">
                            <MapPin className="w-3 h-3" />
                            {assignedUnit.callsign}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--status-urgent-accent)] hover:opacity-90 text-[#0B1519] text-[11px] font-bold transition-opacity whitespace-nowrap shrink-0"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Take Over</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenWorkspace(inc.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-[var(--text-on-solid)] text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
