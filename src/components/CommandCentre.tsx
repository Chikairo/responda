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
  PlusCircle,
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
  onGoToIntake: () => void;
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
  onGoToIntake,
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
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            Medical Emergency Command Centre
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Live Lagos medical emergencies, human triage verification, and active ambulance dispatch coordination.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compact 9-Stage Simulation Launcher */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-1">
            <label htmlFor="cc-sim-scenario" className="sr-only">
              Simulation Scenario
            </label>
            <select
              id="cc-sim-scenario"
              value={selectedScenario}
              onChange={(e) => onSelectScenario(e.target.value as SimulationScenarioId)}
              disabled={simulationActive}
              className="bg-transparent px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none disabled:opacity-60"
            >
              {(Object.keys(SIMULATION_SCENARIOS) as SimulationScenarioId[]).map((id) => (
                <option
                  key={id}
                  value={id}
                  className="bg-white text-slate-900 dark:bg-[#111C2E] dark:text-slate-100"
                >
                  {SIMULATION_SCENARIOS[id].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onToggleSimulationAudio}
              aria-label={simulationAudioEnabled ? 'Mute simulation voice' : 'Unmute simulation voice'}
              title={simulationAudioEnabled ? 'Simulation voice enabled' : 'Simulation voice muted'}
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-[#172438]"
            >
              {simulationAudioEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onRunSimulation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{simulationActive ? 'Restart Demo' : 'RUN SIMULATION'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onGoToIntake}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Emergency Intake</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Incident History</span>
          </button>

          <button
            type="button"
            onClick={onOpenGuide}
            title="Operator workflow guide"
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-blue-700 dark:text-blue-300 transition-colors"
            aria-label="Open operator guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Incidents</span>
            <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {metrics.activeCount}
            </span>
            {metrics.criticalCount > 0 && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                {metrics.criticalCount} Critical
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Units Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {metrics.availableUnitsCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Active medical fleet
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Units Dispatched</span>
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
              {metrics.respondingUnitsCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Responding / On Scene
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Incidents Awaiting Attention</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
              {metrics.awaitingReviewCount}
            </span>
            {metrics.unassessedCount > 0 && (
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {metrics.unassessedCount} Unassessed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Operational Focus Briefing Banner */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-xs">
          <div>
            <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              Current Situation
            </div>
            <p className="text-slate-700 dark:text-slate-200 mt-0.5">{briefing.whatIsHappening}</p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Priority Attention
            </div>
            <p className="text-slate-700 dark:text-slate-200 mt-0.5">{briefing.needsAttention}</p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Next Recommended Action
            </div>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5">{briefing.nextStepText}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (briefing.focusIncident) {
              onOpenWorkspace(briefing.focusIncident.id);
            } else {
              onGoToIntake();
            }
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
        >
          <span>{briefing.focusActionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Split Workspace: ~58% Lagos Map / ~42% Active Medical Queue */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Map Column (7/12 = ~58%) */}
        <div className="xl:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Lagos Live Operational Map
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing {mapIncidents.length} active medical incident{mapIncidents.length === 1 ? '' : 's'} and{' '}
                {activeMedicalUnits.length} active medical unit{activeMedicalUnits.length === 1 ? '' : 's'}.
              </p>
            </div>
            {selectedIncidentId && (
              <button
                type="button"
                onClick={() => onOpenWorkspace(selectedIncidentId)}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Open {selectedIncidentId}</span>
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
        <div className="xl:col-span-5 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Active Medical Incidents ({activeIncidents.length})
            </h2>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSortBy('priority')}
                className={`px-2 py-1 rounded font-semibold ${
                  sortBy === 'priority'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-[#0B1220] dark:text-slate-300'
                }`}
              >
                Priority
              </button>
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className={`px-2 py-1 rounded font-semibold ${
                  sortBy === 'newest'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-[#0B1220] dark:text-slate-300'
                }`}
              >
                Newest
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or area..."
                aria-label="Search active medical incidents"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | IncidentPriority)}
              className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="Urgent">Urgent</option>
              <option value="Unassessed">Unassessed</option>
              <option value="Standard">Standard</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | IncidentStatus)}
              className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Active Statuses</option>
              {INCIDENT_STATUS_ORDER.filter((s) => s !== 'Closed').map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Queue Cards */}
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
            {activeIncidents.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-6 text-center text-xs text-slate-500 dark:text-slate-400">
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
                        ? 'bg-blue-50/70 border-blue-400 dark:bg-blue-500/10 dark:border-blue-500/60'
                        : isUnassessed
                        ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400 dark:bg-amber-500/5 dark:border-amber-500/35'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B] dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {inc.id}
                        </span>
                        <PriorityBadge priority={inc.priority} />
                        <IncidentStatusBadge status={inc.status} />
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {formatRelativeTime(inc.createdAt)}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {inc.category} · {inc.location.area || 'Lagos'}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                        {inc.summary}
                      </p>
                    </div>

                    {isUnassessed && (
                      <div className="rounded-lg bg-amber-100/80 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200 font-medium flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Priority Unassessed — clinical triage required by operator.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80 dark:border-[#26364B]">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <LocationSourceBadge source={inc.location.source} />
                        <VerificationBadge status={inc.location.verificationStatus} />
                        {assignedUnit && (
                          <span className="inline-flex items-center gap-1 font-mono text-blue-700 dark:text-blue-300">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-colors"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
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
