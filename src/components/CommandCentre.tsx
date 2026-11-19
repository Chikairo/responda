import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Clock,
  ExternalLink,
  Filter,
  HelpCircle,
  Navigation,
  Play,
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
  onSelectIncident: (id: string) => void;
  onSelectUnit: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onTakeOver: (id: string) => void;
  onStartDemoScenario: () => void;
  onGoToIntake: () => void;
  onOpenGuide: () => void;
}

export function CommandCentre({
  incidents,
  units,
  userRole,
  selectedIncidentId,
  selectedUnitId,
  activeRoute,
  onSelectIncident,
  onSelectUnit,
  onOpenWorkspace,
  onTakeOver,
  onStartDemoScenario,
  onGoToIntake,
  onOpenGuide,
}: CommandCentreProps) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ACTIVE' | 'ALL'>('ACTIVE');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY'>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>('priority');
  const [feedTab, setFeedTab] = useState<'feed' | 'audit'>('feed');

  const metrics = useMemo(
    () => computeDashboardMetrics(incidents, units),
    [incidents, units]
  );

  const briefing = useMemo(
    () => computeCommandBriefing(incidents, units),
    [incidents, units]
  );

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
    const todayStr = new Date().toISOString().slice(0, 10);
    const q = search.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (statusFilter === 'ACTIVE' && !isActiveIncidentStatus(inc.status)) return false;
      if (statusFilter !== 'ACTIVE' && statusFilter !== 'ALL' && inc.status !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (locationFilter !== 'ALL' && inc.location.area !== locationFilter) return false;
      if (dateFilter === 'TODAY' && inc.createdAt.slice(0, 10) !== todayStr) return false;
      if (q) {
        const hay = [
          inc.id,
          inc.category,
          inc.summary,
          inc.location.description,
          inc.location.area,
          inc.callerName,
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
    dateFilter,
    sortBy,
  ]);

  const recentAuditEvents = useMemo(() => {
    return incidents
      .flatMap((inc) =>
        inc.timeline.map((ev) => ({
          ...ev,
          incidentId: inc.id,
          incidentCategory: inc.category,
        }))
      )
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 20);
  }, [incidents]);

  return (
    <div className="space-y-5">
      {/* Operational Sub-Header & Demo Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Command Centre
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lagos Operations · {metrics.totalToday} incidents today (Simulated Demo Dataset) · Avg acceptance{' '}
            <span className="font-mono font-semibold text-slate-200">
              {metrics.avgAcceptanceMinutes !== null
                ? `${metrics.avgAcceptanceMinutes} min`
                : 'N/A'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onGoToIntake}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-100 transition-colors whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>New AI Intake</span>
          </button>
          <button
            type="button"
            onClick={onStartDemoScenario}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors whitespace-nowrap shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Demo Scenario</span>
          </button>
        </div>
      </div>

      {/* 5 Top Operational Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Incidents</span>
            <span className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-slate-50">
              {metrics.activeCount}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {metrics.totalToday} today
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Critical Incidents</span>
            <span className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-red-400">
              {metrics.criticalCount}
            </span>
            <span className="text-[11px] text-slate-400">Immediate priority</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Awaiting Review</span>
            <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-amber-300">
              {metrics.awaitingReviewCount}
            </span>
            <span className="text-[11px] text-slate-400">Needs takeover</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Available Units</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-emerald-400">
              {metrics.availableUnitsCount}
            </span>
            <span className="text-[11px] text-slate-400">Ready to assign</span>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Units Responding</span>
            <span className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tabular-nums text-cyan-300">
              {metrics.respondingUnitsCount}
            </span>
            <span className="text-[11px] text-slate-400">Active assignments</span>
          </div>
        </div>
      </div>

      {/* 3-Question Situation Briefing Strip */}
      <section
        aria-label="Operator situation briefing"
        className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 text-xs">
          <div>
            <div className="text-[11px] font-semibold text-blue-300">
              1. What is happening?
            </div>
            <p className="text-slate-200 mt-0.5 leading-snug">
              {briefing.whatIsHappening}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-300">
              2. What needs attention?
            </div>
            <p className="text-slate-200 mt-0.5 leading-snug">
              {briefing.needsAttention}
            </p>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-300">
              3. What should I do next?
            </div>
            <p className="text-slate-300 mt-0.5 leading-snug">
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
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4" />
                <span>{briefing.focusActionLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenWorkspace(briefing.focusIncident!.id)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{briefing.focusActionLabel}</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onGoToIntake}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Activity className="w-4 h-4" />
              <span>Start AI Intake</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenGuide}
            title="View plain-English guide to Responda's 8-step workflow"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>How It Works</span>
          </button>
        </div>
      </section>

      {/* Main 60 / 40 Operational Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* LEFT (60% -> 7 cols): LIVE INCIDENT MAP */}
        <section className="xl:col-span-7 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-100">
                Live Incident Map — Lagos
              </h2>
              <p className="text-xs text-slate-400">
                Click any incident pin or response unit marker to inspect status and coordinates
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              {filteredIncidents.length} mapped · {units.length} units
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
            heightClass="h-[340px] sm:h-[420px] xl:h-[520px]"
          />

          {/* Tablet & Mobile Quick Actions Strip (matches responsive tablet layout) */}
          {selectedIncident && (
            <div className="xl:hidden rounded-xl bg-[#0B1220] border border-[#26364B] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-blue-300">
                    Quick Actions · {selectedIncident.id}
                  </div>
                  <div className="text-xs text-slate-200 font-medium">
                    {selectedIncident.category} — {selectedIncident.location.area || 'Lagos'}
                  </div>
                </div>
                <PriorityBadge priority={selectedIncident.priority} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(selectedIncident.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Incident</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(selectedIncident.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-100"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assign Unit</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedNeedsTakeover || !canTakeOver(userRole)}
                  onClick={() => onTakeOver(selectedIncident.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] disabled:opacity-45 text-xs font-semibold text-amber-300"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Take Over</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT (40% -> 5 cols): ACTIVE INCIDENT FEED & AUDIT LOG */}
        <section className="xl:col-span-5 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26364B] pb-3">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B1220] border border-[#26364B] max-w-full">
              <button
                type="button"
                onClick={() => setFeedTab('feed')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  feedTab === 'feed'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Active Queue ({filteredIncidents.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedTab('audit')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  feedTab === 'audit'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Recent Activity
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="cc-sort" className="sr-only">
                Sort incidents
              </label>
              <select
                id="cc-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'priority')}
                className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="priority">Sort: Highest Priority</option>
                <option value="newest">Sort: Newest First</option>
              </select>
            </div>
          </div>

          {feedTab === 'feed' ? (
            <>
              {/* Search and Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search ID, area, landmark, summary..."
                    aria-label="Search incidents"
                    className="w-full rounded-lg bg-[#0B1220] border border-[#26364B] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <select
                    aria-label="Filter by priority"
                    value={priorityFilter}
                    onChange={(e) =>
                      setPriorityFilter(e.target.value as IncidentPriority | 'ALL')
                    }
                    className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <select
                    aria-label="Filter by category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">All Categories</option>
                    {EMERGENCY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as IncidentStatus | 'ACTIVE' | 'ALL')
                    }
                    className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ACTIVE">Active Only</option>
                    <option value="ALL">All Statuses</option>
                    {INCIDENT_STATUS_ORDER.map((st) => (
                      <option key={st} value={st}>
                        {st.replace('_', ' ')}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by Lagos area"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">All Lagos Areas</option>
                    {uniqueAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as 'ALL' | 'TODAY')}
                    className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">All Dates</option>
                    <option value="TODAY">Today Only</option>
                  </select>

                  {(search ||
                    priorityFilter !== 'ALL' ||
                    categoryFilter !== 'ALL' ||
                    statusFilter !== 'ACTIVE' ||
                    locationFilter !== 'ALL' ||
                    dateFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setPriorityFilter('ALL');
                        setCategoryFilter('ALL');
                        setStatusFilter('ACTIVE');
                        setLocationFilter('ALL');
                        setDateFilter('ALL');
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#172438] border border-[#26364B] px-2 py-1.5 text-xs text-blue-300 hover:bg-[#1E293B]"
                    >
                      <Filter className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Incident Feed Items */}
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[420px] pr-1">
                {filteredIncidents.length === 0 ? (
                  <div className="rounded-xl bg-[#0B1220] border border-[#26364B] p-6 text-center space-y-2">
                    <ShieldAlert className="w-7 h-7 text-slate-500 mx-auto" />
                    <div className="text-sm font-semibold text-slate-200">
                      No matching incidents
                    </div>
                    <p className="text-xs text-slate-400">
                      Adjust your active filters or initiate a new AI emergency intake session.
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
                            ? 'bg-[#172438] border-blue-500/60'
                            : 'bg-[#0B1220]/70 border-[#26364B] hover:border-slate-500/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectIncident(inc.id)}
                            className="text-left flex-1 min-w-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-100">
                                {inc.id}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="text-xs font-semibold text-slate-200">
                                {inc.category}
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {formatRelativeTime(inc.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                              {inc.location.correctedDescription || inc.location.description}
                            </p>
                          </button>
                          <PriorityBadge priority={inc.priority} />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <IncidentStatusBadge status={inc.status} />
                          <LocationSourceBadge source={inc.location.source} />
                          <VerificationBadge status={inc.location.verificationStatus} />
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#26364B]/80 text-[11px] text-slate-400">
                          <div className="truncate">
                            {inc.assignedOperator
                              ? `Operator: ${inc.assignedOperator}`
                              : 'Unassigned'}
                            {assignedUnit ? ` · Unit: ${assignedUnit.callsign}` : ''}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {needsTakeover && canTakeOver(userRole) && (
                              <button
                                type="button"
                                onClick={() => onTakeOver(inc.id)}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Take Over</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenWorkspace(inc.id)}
                              className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/35 text-blue-300 font-semibold transition-colors"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1">
              {recentAuditEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100">{ev.title}</span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {formatRelativeTime(ev.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-300">{ev.description}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-mono text-blue-400">{ev.incidentId}</span>
                    <span>·</span>
                    <span>
                      {ev.actor} ({ev.actorRole})
                    </span>
                    {ev.isSimulated && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300">Simulated</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
