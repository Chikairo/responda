import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  Filter,
  HelpCircle,
  Navigation,
  Search,
  ShieldAlert,
  Truck,
  UserCheck,
} from 'lucide-react';
import {
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
  EMERGENCY_CATEGORIES,
  formatRelativeTime,
  INCIDENT_STATUS_ORDER,
  isActiveIncidentStatus,
  sortIncidents,
} from '../utils/incidentLogic';
import { computeCommandBriefing } from '../utils/guidedWorkflow';
import { LagosMap } from './LagosMap';
import { IncidentStatusBadge, PriorityBadge } from './StatusBadges';
import { SimulationLaunchBar } from './SimulationControlPanel';

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
  onSelectScenario: (id: SimulationScenarioId) => void;
  onToggleSimulationAudio: () => void;
  onRunSimulation: () => void;
  onSelectIncident: (id: string) => void;
  onSelectUnit: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onTakeOver: (id: string) => void;
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
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ACTIVE' | 'ALL'>('ACTIVE');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('priority');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const metrics = useMemo(
    () => computeDashboardMetrics(incidents, units),
    [incidents, units]
  );

  const briefing = useMemo(
    () => computeCommandBriefing(incidents, units),
    [incidents, units]
  );

  const awaitingAttentionCount = useMemo(() => {
    return incidents.filter(
      (i) =>
        isActiveIncidentStatus(i.status) &&
        (i.status === 'NEW' ||
          i.status === 'AI_INTAKE' ||
          i.status === 'AWAITING_OPERATOR' ||
          i.status === 'UNDER_REVIEW' ||
          (i.status === 'VERIFIED' && !i.assignedUnitId))
    ).length;
  }, [incidents]);

  const selectedIncident = useMemo(
    () =>
      incidents.find((i) => i.id === selectedIncidentId) ||
      briefing.focusIncident ||
      null,
    [incidents, selectedIncidentId, briefing.focusIncident]
  );

  const selectedNeedsTakeover = Boolean(
    selectedIncident &&
      (selectedIncident.status === 'NEW' ||
        selectedIncident.status === 'AI_INTAKE' ||
        selectedIncident.status === 'AWAITING_OPERATOR')
  );

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    for (const inc of incidents) {
      if (inc.location.area) set.add(inc.location.area);
    }
    return Array.from(set).sort();
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (statusFilter === 'ACTIVE' && !isActiveIncidentStatus(inc.status)) return false;
      if (statusFilter !== 'ACTIVE' && statusFilter !== 'ALL' && inc.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (locationFilter !== 'ALL' && inc.location.area !== locationFilter) return false;
      if (q) {
        const hay = [
          inc.id,
          inc.category,
          inc.summary,
          inc.location.correctedDescription,
          inc.location.description,
          inc.location.area,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortIncidents(list, sortBy);
  }, [
    incidents,
    search,
    priorityFilter,
    categoryFilter,
    statusFilter,
    locationFilter,
    sortBy,
  ]);

  const recentOperationalActivity = useMemo(() => {
    return incidents
      .flatMap((inc) =>
        inc.timeline.map((ev) => ({
          ...ev,
          incidentId: inc.id,
          incidentCategory: inc.category,
        }))
      )
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 5);
  }, [incidents]);

  const hasExtraFilters =
    categoryFilter !== 'ALL' || locationFilter !== 'ALL' || statusFilter !== 'ACTIVE';

  return (
    <div className="space-y-5">
      {/* Clean Operational Header & Primary Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Command Centre
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lagos Private Emergency Operations · Simulated Demo Dataset
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGoToIntake}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 dark:bg-[#172438] dark:hover:bg-[#1E293B] dark:border-[#26364B] dark:text-slate-100 transition-colors whitespace-nowrap shadow-xs"
          >
            <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>New AI Intake</span>
          </button>
          {!simulationActive && (
            <SimulationLaunchBar
              selectedScenario={selectedScenario}
              onSelectScenario={onSelectScenario}
              audioEnabled={simulationAudioEnabled}
              onToggleAudio={onToggleSimulationAudio}
              onRunSimulation={onRunSimulation}
            />
          )}
        </div>
      </div>

      {/* 4 Essential Operational Overview Cards */}
      <div
        data-testid="cc-overview-cards"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <div className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Incidents
            </span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {metrics.activeCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.criticalCount} critical
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Units Available
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {metrics.availableUnitsCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Ready to dispatch
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Units Dispatched
            </span>
            <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-cyan-700 dark:text-cyan-300">
              {metrics.respondingUnitsCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Responding / on scene
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Incidents Awaiting Attention
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {awaitingAttentionCount}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Needs operator action
            </span>
          </div>
        </div>
      </div>

      {/* Clear 3-Question Operator Focus Bar */}
      <section
        aria-label="Immediate operator focus"
        className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 flex-1 text-xs">
          <div>
            <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              1. What is happening?
            </div>
            <p className="text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
              {briefing.whatIsHappening}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              2. What needs attention?
            </div>
            <p className="text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">
              {briefing.needsAttention}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              3. What should I do next?
            </div>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
              {briefing.nextStepText}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {briefing.focusIncident ? (
            briefing.focusAction === 'TAKE_OVER' && canTakeOver(userRole) ? (
              <button
                type="button"
                onClick={() => {
                  onTakeOver(briefing.focusIncident!.id);
                  onOpenWorkspace(briefing.focusIncident!.id);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" />
                <span>{briefing.focusActionLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenWorkspace(briefing.focusIncident!.id)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{briefing.focusActionLabel}</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onGoToIntake}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Activity className="w-4 h-4" />
              <span>Start AI Intake</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenGuide}
            title="Plain-language operator guide"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 dark:bg-[#172438] dark:hover:bg-[#1E293B] dark:border-[#26364B] dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Guide</span>
          </button>
        </div>
      </section>

      {/* Balanced 2-Column Main Workspace: Left = Active Incident List, Right = Operational Map */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN: ACTIVE INCIDENT LIST */}
        <section className="xl:col-span-5 rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col gap-3 min-w-0 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-[#26364B]">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Active Incident List ({filteredIncidents.length})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select an incident to inspect on the map or take action
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFiltersOpen((f) => !f)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  filtersOpen || hasExtraFilters
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/35 dark:text-blue-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-300 dark:hover:bg-[#172438]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
              <label htmlFor="cc-sort" className="sr-only">
                Sort incidents
              </label>
              <select
                id="cc-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'priority')}
                className="rounded-lg bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] px-2.5 py-1.5 text-xs dark:text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="priority">Highest Priority</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
          </div>

          {/* Search + Essential Priority Selector */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, category, or Lagos area..."
                aria-label="Search incidents"
                className="w-full rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 dark:bg-[#0B1220] dark:border-[#26364B] pl-8 pr-3 py-1.5 text-xs dark:text-slate-100 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as IncidentPriority | 'ALL')
              }
              className="rounded-lg bg-slate-50 border border-slate-200 text-slate-800 dark:bg-[#0B1220] dark:border-[#26364B] px-2.5 py-1.5 text-xs dark:text-slate-200"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Optional Secondary Filters (Collapsed by Default) */}
          {filtersOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B]">
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg bg-white border border-slate-200 text-slate-800 dark:bg-[#111C2E] dark:border-[#26364B] px-2 py-1.5 text-xs dark:text-slate-200"
              >
                <option value="ALL">All Categories</option>
                {EMERGENCY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Lagos area"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-lg bg-white border border-slate-200 text-slate-800 dark:bg-[#111C2E] dark:border-[#26364B] px-2 py-1.5 text-xs dark:text-slate-200"
              >
                <option value="ALL">All Lagos Areas</option>
                {uniqueAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as IncidentStatus | 'ACTIVE' | 'ALL')
                }
                className="rounded-lg bg-white border border-slate-200 text-slate-800 dark:bg-[#111C2E] dark:border-[#26364B] px-2 py-1.5 text-xs dark:text-slate-200"
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ALL">All Statuses</option>
                {INCIDENT_STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {st === 'AWAITING_OPERATOR'
                      ? 'Awaiting Review'
                      : st.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clean Scannable Incident Rows */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[460px] pr-1">
            {filteredIncidents.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] p-6 text-center space-y-2">
                <ShieldAlert className="w-7 h-7 text-slate-400 dark:text-slate-500 mx-auto" />
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No matching incidents
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Clear active filters or start a new AI Intake session.
                </p>
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = inc.id === selectedIncidentId;
                const assignedUnit = inc.assignedUnitId
                  ? units.find((u) => u.id === inc.assignedUnitId)
                  : null;
                const needsTakeover =
                  inc.status === 'AWAITING_OPERATOR' ||
                  inc.status === 'AI_INTAKE' ||
                  inc.status === 'NEW';

                return (
                  <div
                    key={inc.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 dark:bg-[#172438] dark:border-blue-500/60'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220]/70 dark:border-[#26364B] dark:hover:border-slate-500/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectIncident(inc.id)}
                        className="text-left flex-1 min-w-0"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {inc.category}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">·</span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {inc.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                          {inc.location.correctedDescription || inc.location.description}
                        </p>
                      </button>
                      <PriorityBadge priority={inc.priority} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-200 dark:border-[#26364B]/80">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <IncidentStatusBadge status={inc.status} />
                        <span className="font-mono tabular-nums">
                          {formatRelativeTime(inc.createdAt)}
                        </span>
                        {assignedUnit && (
                          <span className="font-medium text-cyan-700 dark:text-cyan-300">
                            · {assignedUnit.callsign}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {needsTakeover && canTakeOver(userRole) ? (
                          <button
                            type="button"
                            onClick={() => {
                              onTakeOver(inc.id);
                              onOpenWorkspace(inc.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:border-amber-500/40 dark:text-amber-300 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Review &amp; Take Over</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenWorkspace(inc.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 dark:bg-blue-600/20 dark:hover:bg-blue-600/35 dark:border-blue-500/35 dark:text-blue-300 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: OPERATIONAL LAGOS MAP */}
        <section className="xl:col-span-7 rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Operational Map — Lagos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active emergency locations alongside available and dispatched response units
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
              {filteredIncidents.length} incidents · {units.length} units
            </span>
          </div>

          <LagosMap
            incidents={filteredIncidents}
            units={units}
            selectedIncidentId={selectedIncidentId}
            selectedUnitId={selectedUnitId}
            route={activeRoute}
            onSelectIncident={onSelectIncident}
            onSelectUnit={onSelectUnit}
            onOpenIncidentWorkspace={onOpenWorkspace}
            heightClass="h-[340px] sm:h-[420px] xl:h-[500px]"
          />

          {/* Compact Mobile & Tablet Quick Action Bar */}
          {selectedIncident && (
            <div className="xl:hidden rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] p-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  Selected: {selectedIncident.id} · {selectedIncident.category}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                  {selectedIncident.location.correctedDescription ||
                    selectedIncident.location.description}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedNeedsTakeover && canTakeOver(userRole) && (
                  <button
                    type="button"
                    onClick={() => onTakeOver(selectedIncident.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                  >
                    Take Over
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(selectedIncident.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  Open Incident
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Concise Recent Operational Activity + Link to Full Incident History */}
      <section
        aria-label="Recent operational activity"
        className="rounded-xl bg-white border border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B] p-4 space-y-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#26364B]">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Recent Operational Activity
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Latest updates across emergency intake, verification, dispatch, arrival, and closure
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            data-testid="cc-view-history-link"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 whitespace-nowrap"
          >
            <span>View Full Incident History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOperationalActivity.length === 0 ? (
          <div className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center">
            No operational events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-[#26364B]">
            {recentOperationalActivity.map((ev) => (
              <div
                key={ev.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {ev.title}
                    </span>
                    <span className="font-mono text-[11px] text-blue-700 dark:text-blue-400">
                      {ev.incidentId}
                    </span>
                    {ev.isSimulated && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300">
                        · Simulated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {ev.description}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatRelativeTime(ev.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(ev.incidentId)}
                    className="text-xs font-semibold text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300 whitespace-nowrap"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
