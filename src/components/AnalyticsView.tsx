import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MapPin,
  RotateCcw,
  Truck,
} from 'lucide-react';
import { IncidentRecord, ResponseUnit } from '../types/responda';
import {
  AnalyticsDateRange,
  AnalyticsFilters,
  computeAreaHotspots,
  computeDailyTrend,
  computeHourlyTrend,
  computeIncidentPerformanceRows,
  computeResolutionStats,
  computeResponseStageAverages,
  computeStatusSummaryGroups,
  filterAnalyticsIncidents,
  getAvailableLagosAreas,
} from '../utils/analyticsEngine';
import {
  computeCategoryBreakdown,
  computePriorityBreakdown,
  computeUnitUtilisation,
  EMERGENCY_CATEGORIES,
} from '../utils/incidentLogic';
import { LagosMap } from './LagosMap';
import { IncidentStatusBadge, PriorityBadge } from './StatusBadges';

interface AnalyticsViewProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  onOpenIncident?: (id: string) => void;
}

const CATEGORY_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#F97316',
  '#10B981',
  '#06B6D4',
  '#EAB308',
  '#8B5CF6',
  '#64748B',
];

const PRIORITY_COLOR_MAP: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#10B981',
};

export function AnalyticsView({
  incidents,
  units,
  onOpenIncident,
}: AnalyticsViewProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: 'ALL',
    category: 'ALL',
    area: 'ALL',
  });
  const [recordScope, setRecordScope] = useState<'ALL' | 'SIMULATION' | 'OPERATIONAL'>('ALL');
  const [trendMode, setTrendMode] = useState<'hourly' | 'daily'>('hourly');
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [hoveredPriority, setHoveredPriority] = useState<string | null>(null);
  const [hoveredLifecycle, setHoveredLifecycle] = useState<string | null>(null);

  const simIncidentCount = useMemo(
    () => incidents.filter((i) => i.isSimulated).length,
    [incidents]
  );
  const operationalIncidentCount = useMemo(
    () => incidents.filter((i) => !i.isSimulated).length,
    [incidents]
  );

  const scopedIncidents = useMemo(() => {
    if (recordScope === 'SIMULATION') return incidents.filter((i) => i.isSimulated);
    if (recordScope === 'OPERATIONAL') return incidents.filter((i) => !i.isSimulated);
    return incidents;
  }, [incidents, recordScope]);

  const availableAreas = useMemo(
    () => getAvailableLagosAreas(scopedIncidents, units),
    [scopedIncidents, units]
  );

  const filteredIncidents = useMemo(
    () => filterAnalyticsIncidents(scopedIncidents, filters),
    [scopedIncidents, filters]
  );

  const hasSimulatedData = filteredIncidents.some((i) => i.isSimulated);
  const hasActiveFilter =
    recordScope !== 'ALL' ||
    filters.dateRange !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.area !== 'ALL';

  const resolutionStats = useMemo(
    () => computeResolutionStats(filteredIncidents),
    [filteredIncidents]
  );
  const stageAverages = useMemo(
    () => computeResponseStageAverages(filteredIncidents),
    [filteredIncidents]
  );
  const categoryData = useMemo(
    () => computeCategoryBreakdown(filteredIncidents),
    [filteredIncidents]
  );
  const priorityData = useMemo(
    () => computePriorityBreakdown(filteredIncidents),
    [filteredIncidents]
  );
  const lifecycleGroups = useMemo(
    () => computeStatusSummaryGroups(filteredIncidents),
    [filteredIncidents]
  );
  const unitUtil = useMemo(() => computeUnitUtilisation(units), [units]);
  const hourlyTrend = useMemo(
    () => computeHourlyTrend(filteredIncidents),
    [filteredIncidents]
  );
  const dailyTrend = useMemo(
    () => computeDailyTrend(filteredIncidents, 7),
    [filteredIncidents]
  );
  const areaHotspots = useMemo(
    () => computeAreaHotspots(filteredIncidents, units),
    [filteredIncidents, units]
  );
  const performanceRows = useMemo(
    () => computeIncidentPerformanceRows(filteredIncidents, units),
    [filteredIncidents, units]
  );

  if (incidents.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-10 text-center space-y-2 shadow-2xs dark:shadow-none">
        <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No analytics records stored yet
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Create an incident via AI Intake or run the Demo Scenario to populate operational intelligence.
        </p>
      </div>
    );
  }

  const totalUnits = units.length;
  const deployedUnits = unitUtil.assigned + unitUtil.responding;
  const fleetUtilisationPct =
    totalUnits > 0 ? Math.round((deployedUnits / totalUnits) * 100) : 0;

  // Trend chart data
  const activeTrendSeries =
    trendMode === 'hourly'
      ? hourlyTrend.map((b) => ({
          label: b.shortLabel,
          tooltip: `${b.hour} — ${b.total} total (${b.critical} critical, ${b.resolved} resolved)`,
          total: b.total,
          critical: b.critical,
          resolved: b.resolved,
        }))
      : dailyTrend.map((b) => ({
          label: b.label,
          tooltip: `${b.label} — ${b.total} total (${b.critical} critical, ${b.resolved} resolved)`,
          total: b.total,
          critical: b.critical,
          resolved: b.resolved,
        }));

  const maxTrendVal = Math.max(
    1,
    ...activeTrendSeries.map((pt) => Math.max(pt.total, pt.critical, pt.resolved))
  );

  const svgW = 640;
  const svgH = 190;
  const padL = 28;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getPointXY = (idx: number, val: number) => {
    const step =
      activeTrendSeries.length > 1
        ? plotW / (activeTrendSeries.length - 1)
        : plotW;
    const x = padL + idx * step;
    const y = padT + plotH - (val / maxTrendVal) * plotH;
    return { x, y };
  };

  const buildPolyline = (vals: number[]) =>
    vals
      .map((v, idx) => {
        const { x, y } = getPointXY(idx, v);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  const totalLinePoints = buildPolyline(activeTrendSeries.map((s) => s.total));
  const criticalLinePoints = buildPolyline(
    activeTrendSeries.map((s) => s.critical)
  );
  const resolvedLinePoints = buildPolyline(
    activeTrendSeries.map((s) => s.resolved)
  );
  const totalAreaPoints = `${padL},${padT + plotH} ${totalLinePoints} ${
    padL + plotW
  },${padT + plotH}`;

  // Donut calculations
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filteredTotal = Math.max(1, filteredIncidents.length);

  let priorityOffset = 0;
  let lifecycleOffset = 0;
  const maxCategoryCount = Math.max(
    1,
    ...categoryData.map((c) => c.count)
  );
  const stageTimingBars = [
    {
      label: 'Intake → Acceptance',
      value: stageAverages.intakeToAcceptMin,
      color: '#3B82F6',
    },
    {
      label: 'Dispatch → Unit Ack',
      value: stageAverages.dispatchToAckMin,
      color: '#06B6D4',
    },
    {
      label: 'Intake → Resolution',
      value: stageAverages.intakeToResolveMin,
      color: '#10B981',
    },
  ];
  const maxStageMinutes = Math.max(
    1,
    ...stageTimingBars.map((s) => s.value ?? 0)
  );

  return (
    <div className="space-y-5">
      {/* Header & Interactive Filter Bar */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-4 shadow-2xs dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Analytics &amp; Operational Intelligence
              </h1>
              {hasSimulatedData && (
                <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/35 text-[11px] font-mono font-semibold text-amber-800 dark:text-amber-300">
                  INCLUDES SIMULATION DATA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Showing{' '}
              <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                {filteredIncidents.length}
              </strong>{' '}
              of{' '}
              <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                {incidents.length}
              </strong>{' '}
              incident records ({simIncidentCount} simulation · {operationalIncidentCount} operational) and{' '}
              <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                {units.length}
              </strong>{' '}
              response units.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-0.5 text-[11px] font-semibold">
              {(
                [
                  { id: 'ALL', label: `All (${incidents.length})` },
                  { id: 'SIMULATION', label: `Simulation (${simIncidentCount})` },
                  { id: 'OPERATIONAL', label: `Operational (${operationalIncidentCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRecordScope(tab.id)}
                  className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                    recordScope === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setRecordScope('ALL');
                  setFilters({ dateRange: 'ALL', category: 'ALL', area: 'ALL' });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-[#26364B]">
          <div>
            <label
              htmlFor="analytics-date-filter"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              <Filter className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              <span>Date Window</span>
            </label>
            <select
              id="analytics-date-filter"
              value={filters.dateRange}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  dateRange: e.target.value as AnalyticsDateRange,
                }))
              }
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Stored Dates</option>
              <option value="TODAY">Today</option>
              <option value="24H">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="analytics-category-filter"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Emergency Category
            </label>
            <select
              id="analytics-category-filter"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Emergency Categories</option>
              {EMERGENCY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="analytics-area-filter"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
            >
              Lagos Location / Area
            </label>
            <select
              id="analytics-area-filter"
              value={filters.area}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, area: e.target.value }))
              }
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">All Lagos Areas</option>
              {availableAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Empty Filter State */}
      {filteredIncidents.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-10 text-center space-y-3 shadow-2xs dark:shadow-none">
          <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No incidents match the selected filters
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clear or widen the date, emergency category, or Lagos area filters to inspect records.
          </p>
          <button
            type="button"
            onClick={() => {
              setRecordScope('ALL');
              setFilters({ dateRange: 'ALL', category: 'ALL', area: 'ALL' });
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <>
          {/* 6 KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Total Incidents</span>
                <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 mt-1.5">
                {resolutionStats.total}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {resolutionStats.active} active · {resolutionStats.awaitingOperator} awaiting review
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Resolution Rate</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                {resolutionStats.resolutionRatePct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {resolutionStats.resolvedOrClosed} resolved / closed
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Avg Intake → Accept</span>
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 mt-1.5">
                {stageAverages.intakeToAcceptMin !== null
                  ? `${stageAverages.intakeToAcceptMin}m`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {stageAverages.intakeToAcceptMin !== null
                  ? 'Operator takeover speed'
                  : 'No accepted timestamps'}
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Avg Dispatch → Ack</span>
                <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 mt-1.5">
                {stageAverages.dispatchToAckMin !== null
                  ? `${stageAverages.dispatchToAckMin}m`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {stageAverages.dispatchToAckMin !== null
                  ? 'Crew acknowledgement'
                  : 'No ack timestamps'}
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Unit Utilisation</span>
                <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-1.5">
                {fleetUtilisationPct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {unitUtil.available} avail · {deployedUnits} deployed
              </div>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3.5 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Critical &amp; Verified</span>
                <AlertOctagon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="font-display text-2xl font-bold tabular-nums text-red-700 dark:text-red-400 mt-1.5">
                {priorityData.find((p) => p.priority === 'CRITICAL')?.count ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {resolutionStats.verifiedLocationPct}% locations verified
              </div>
            </div>
          </div>

          {/* Row 1: Incident Trends Line Chart + Two Interactive Donuts */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Line Chart */}
            <div className="xl:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 min-w-0 shadow-2xs dark:shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Incident Volume &amp; Urgency Trends
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {trendMode === 'hourly'
                      ? '24-hour call intake distribution across Lagos'
                      : '7-day daily incident and resolution pattern'}
                  </p>
                </div>

                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-0.5 self-start">
                  <button
                    type="button"
                    onClick={() => {
                      setTrendMode('hourly');
                      setHoveredTrendIdx(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      trendMode === 'hourly'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Hourly Pattern
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrendMode('daily');
                      setHoveredTrendIdx(null);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      trendMode === 'daily'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Daily (7 Days)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    Total Incidents
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Critical
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Resolved
                  </span>
                </div>
                <span className="font-mono text-blue-700 dark:text-blue-300 min-h-[16px]">
                  {hoveredTrendIdx !== null && activeTrendSeries[hoveredTrendIdx]
                    ? activeTrendSeries[hoveredTrendIdx].tooltip
                    : 'Hover points for bucket breakdown'}
                </span>
              </div>

              <div className="w-full">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-48"
                  role="img"
                  aria-label="Incident trend line chart"
                >
                  <defs>
                    <linearGradient
                      id="respondaTrendArea"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {[0, 0.5, 1].map((frac, idx) => {
                    const y = padT + plotH * (1 - frac);
                    const tickVal = Math.round(maxTrendVal * frac);
                    return (
                      <g key={idx}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={padL + plotW}
                          y2={y}
                          className="stroke-slate-200 dark:stroke-[#26364B]"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 6}
                          y={y + 3}
                          textAnchor="end"
                          fill="#64748B"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {tickVal}
                        </text>
                      </g>
                    );
                  })}

                  <polygon
                    points={totalAreaPoints}
                    fill="url(#respondaTrendArea)"
                  />
                  <polyline
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                    points={totalLinePoints}
                  />
                  <polyline
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="1.8"
                    strokeDasharray="4 2"
                    strokeLinejoin="round"
                    points={criticalLinePoints}
                  />
                  <polyline
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    points={resolvedLinePoints}
                  />

                  {activeTrendSeries.map((pt, idx) => {
                    const { x, y } = getPointXY(idx, pt.total);
                    const showLabel =
                      trendMode === 'daily' || idx % 4 === 0 || idx === 23;
                    const active = hoveredTrendIdx === idx;
                    return (
                      <g
                        key={pt.label + idx}
                        onMouseEnter={() => setHoveredTrendIdx(idx)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={x - 10}
                          y={padT}
                          width={20}
                          height={plotH}
                          fill="transparent"
                        />
                        {(pt.total > 0 || active) && (
                          <circle
                            cx={x}
                            cy={y}
                            r={active ? 5 : 3.2}
                            fill={active ? '#1D4ED8' : '#3B82F6'}
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        )}
                        {showLabel && (
                          <text
                            x={x}
                            y={svgH - 8}
                            textAnchor="middle"
                            fill="#64748B"
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Dual Donut Charts: Priority & Lifecycle Distribution */}
            <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 min-w-0">
              {/* Priority Donut */}
              <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2.5 shadow-2xs dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Priority Distribution
                  </h2>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {hoveredPriority || 'All urgencies'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
                      {priorityData.map((item) => {
                        const frac = item.count / filteredTotal;
                        const dash = `${frac * circumference} ${circumference}`;
                        const offset = -priorityOffset * circumference;
                        priorityOffset += frac;
                        if (item.count === 0) return null;
                        return (
                          <circle
                            key={item.priority}
                            cx="65"
                            cy="65"
                            r={radius}
                            fill="transparent"
                            stroke={PRIORITY_COLOR_MAP[item.priority]}
                            strokeWidth={hoveredPriority === item.priority ? 18 : 14}
                            strokeDasharray={dash}
                            strokeDashoffset={offset}
                            onMouseEnter={() =>
                              setHoveredPriority(`${item.priority}: ${item.count}`)
                            }
                            onMouseLeave={() => setHoveredPriority(null)}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="font-display text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {filteredIncidents.length}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Cases</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 text-xs">
                    {priorityData.map((item) => {
                      const pct = Math.round((item.count / filteredTotal) * 100);
                      return (
                        <div
                          key={item.priority}
                          onMouseEnter={() =>
                            setHoveredPriority(`${item.priority}: ${item.count}`)
                          }
                          onMouseLeave={() => setHoveredPriority(null)}
                          className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-[#172438]"
                        >
                          <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{
                                backgroundColor: PRIORITY_COLOR_MAP[item.priority],
                              }}
                            />
                            <span>{item.priority}</span>
                          </span>
                          <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Lifecycle / Resolution Donut */}
              <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2.5 shadow-2xs dark:shadow-none">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Resolution &amp; Stage Status
                  </h2>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                    {hoveredLifecycle || `${resolutionStats.resolutionRatePct}% resolved`}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative w-28 h-28 shrink-0">
                    <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
                      {lifecycleGroups.map((group) => {
                        const frac = group.count / filteredTotal;
                        const dash = `${frac * circumference} ${circumference}`;
                        const offset = -lifecycleOffset * circumference;
                        lifecycleOffset += frac;
                        if (group.count === 0) return null;
                        return (
                          <circle
                            key={group.label}
                            cx="65"
                            cy="65"
                            r={radius}
                            fill="transparent"
                            stroke={group.color}
                            strokeWidth={hoveredLifecycle === group.label ? 18 : 14}
                            strokeDasharray={dash}
                            strokeDashoffset={offset}
                            onMouseEnter={() =>
                              setHoveredLifecycle(`${group.label}: ${group.count}`)
                            }
                            onMouseLeave={() => setHoveredLifecycle(null)}
                          />
                        );
                      })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="font-display text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {resolutionStats.resolutionRatePct}%
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Resolved</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5 text-xs">
                    {lifecycleGroups.map((group) => (
                      <div
                        key={group.label}
                        onMouseEnter={() =>
                          setHoveredLifecycle(`${group.label}: ${group.count}`)
                        }
                        onMouseLeave={() => setHoveredLifecycle(null)}
                        className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-[#172438]"
                      >
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="truncate">{group.label}</span>
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                          {group.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Emergency Categories Bar Chart + Response Performance & Unit Fleet */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Emergency Categories Bar Chart */}
            <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 min-w-0 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Emergency Categories Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any category bar to cross-filter the dashboard
                  </p>
                </div>
                {filters.category !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, category: 'ALL' }))
                    }
                    className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Clear category
                  </button>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                {categoryData.map((entry, idx) => {
                  const pct = Math.round((entry.count / maxCategoryCount) * 100);
                  const active = filters.category === entry.category;
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  return (
                    <button
                      key={entry.category}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          category:
                            prev.category === entry.category
                              ? 'ALL'
                              : entry.category,
                        }))
                      }
                      className={`w-full text-left rounded-lg p-2 border transition-colors ${
                        active
                          ? 'bg-blue-50 border-blue-500 dark:bg-[#172438] dark:border-blue-500/60'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B] dark:hover:border-slate-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {entry.category}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {entry.count} ({Math.round((entry.count / filteredTotal) * 100)}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-[#111C2E] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(8, pct)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Response Performance & Unit Fleet Utilisation */}
            <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-4 min-w-0 shadow-2xs dark:shadow-none">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Response Performance &amp; Unit Fleet Utilisation
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Average measured handling intervals and live fleet availability across Lagos
                </p>
              </div>

              <div className="space-y-2.5">
                {stageTimingBars.map((stage) => {
                  const widthPct =
                    stage.value !== null
                      ? Math.max(10, Math.round((stage.value / maxStageMinutes) * 100))
                      : 0;
                  return (
                    <div key={stage.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          {stage.label}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                          {stage.value !== null
                            ? `${stage.value} min`
                            : 'Insufficient records'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#0B1220] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: stage.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200 dark:border-[#26364B] text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Available</div>
                  <div className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                    {unitUtil.available}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Assigned / Ack</div>
                  <div className="font-display text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums mt-1">
                    {unitUtil.assigned}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">En Route / Scene</div>
                  <div className="font-display text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">
                    {unitUtil.responding}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Unavailable</div>
                  <div className="font-display text-xl font-bold text-slate-600 dark:text-slate-400 tabular-nums mt-1">
                    {unitUtil.unavailable}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Geographic Lagos Hotspot Map & Area Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 min-w-0 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Geographic Incident Hotspots — Lagos
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live spatial distribution of filtered incidents and Lagos response units
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 dark:text-blue-300">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{areaHotspots.length} sector(s)</span>
                </span>
              </div>

              <LagosMap
                incidents={filteredIncidents}
                units={units}
                onOpenIncidentWorkspace={onOpenIncident}
                heightClass="h-[340px]"
                showLegend={true}
                showInfoCard={false}
              />
            </div>

            <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 min-w-0 shadow-2xs dark:shadow-none">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    Lagos Area Hotspot Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any Lagos area to filter charts and audit table
                  </p>
                </div>
                {filters.area !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, area: 'ALL' }))
                    }
                    className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    All areas
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {areaHotspots.map((row) => {
                  const pct = Math.round((row.total / filteredTotal) * 100);
                  const selected = filters.area === row.area;
                  return (
                    <button
                      key={row.area}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          area: prev.area === row.area ? 'ALL' : row.area,
                        }))
                      }
                      className={`w-full text-left rounded-lg p-3 border transition-colors ${
                        selected
                          ? 'bg-blue-50 border-blue-500 dark:bg-[#172438] dark:border-blue-500/60'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-[#0B1220] dark:border-[#26364B] dark:hover:border-slate-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {row.area}
                        </span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                          {row.total} incident(s) ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#111C2E] overflow-hidden my-2">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.max(8, pct)}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className={row.critical > 0 ? 'text-red-700 dark:text-red-300 font-medium' : ''}>
                          Critical: {row.critical}
                        </span>
                        <span>Verified: {row.verified}/{row.total}</span>
                        <span>Units in sector: {row.unitsCount}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 4: Operational Breakdown Table */}
          <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Incident Resolution &amp; Response Timing Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Measured acceptance, unit acknowledgement, and resolution times per record
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {performanceRows.length} record(s)
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#26364B] text-[11px] text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Incident ID</th>
                    <th className="py-2.5 px-3 font-semibold">Source</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold">Priority</th>
                    <th className="py-2.5 px-3 font-semibold">Lagos Area</th>
                    <th className="py-2.5 px-3 font-semibold">Assigned Unit</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Accept</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Ack</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Resolve</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    {onOpenIncident && (
                      <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#26364B]/70">
                  {performanceRows.map((row) => {
                    const isSim = incidents.find((i) => i.id === row.id)?.isSimulated ?? true;
                    return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#172438]/60 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                            isSim
                              ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35'
                          }`}
                        >
                          {isSim ? 'SIMULATION' : 'OPERATIONAL'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <PriorityBadge priority={row.priority} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.area}
                        {!row.verifiedLocation && (
                          <span className="ml-1.5 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                            (Unverified)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.unitCallsign || 'Unassigned'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.acceptMin !== null ? `${row.acceptMin}m` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.ackMin !== null ? `${row.ackMin}m` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {row.resolveMin !== null ? `${row.resolveMin}m` : '—'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <IncidentStatusBadge status={row.status as IncidentRecord['status']} />
                      </td>
                      {onOpenIncident && (
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onOpenIncident(row.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-600 dark:bg-[#0B1220] dark:hover:bg-blue-600 border border-slate-200 dark:border-[#26364B] text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:text-white transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
