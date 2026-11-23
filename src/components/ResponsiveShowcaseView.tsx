import React, { useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  LayoutDashboard,
  MapPin,
  Menu,
  Monitor,
  Navigation,
  Settings,
  ShieldCheck,
  Smartphone,
  Tablet,
  Truck,
  UserCheck,
} from 'lucide-react';
import {
  AppSection,
  IncidentRecord,
  ResponseUnit,
  UserRole,
} from '../types/responda';
import {
  canTakeOver,
  computeDashboardMetrics,
  formatRelativeTime,
  isActiveIncidentStatus,
  sortIncidents,
} from '../utils/incidentLogic';
import {
  IncidentStatusBadge,
  PriorityBadge,
  RespondaLogo,
} from './StatusBadges';

interface ResponsiveShowcaseViewProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  operatorName: string;
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onTakeOver: (id: string) => Promise<void> | void;
  onNavigateSection: (section: AppSection) => void;
}

export function ResponsiveShowcaseView({
  incidents,
  units,
  userRole,
  operatorName,
  selectedIncidentId,
  onSelectIncident,
  onOpenWorkspace,
  onTakeOver,
  onNavigateSection,
}: ResponsiveShowcaseViewProps) {
  const metrics = useMemo(
    () => computeDashboardMetrics(incidents, units),
    [incidents, units]
  );

  const activeIncidents = useMemo(
    () =>
      sortIncidents(
        incidents.filter((i) => isActiveIncidentStatus(i.status)),
        'priority'
      ),
    [incidents]
  );

  const focusedIncident =
    activeIncidents.find((i) => i.id === selectedIncidentId) ||
    activeIncidents[0] ||
    incidents[0] ||
    null;

  const needsTakeover =
    focusedIncident &&
    (focusedIncident.status === 'NEW' ||
      focusedIncident.status === 'AI_INTAKE' ||
      focusedIncident.status === 'AWAITING_OPERATOR');

  const operatorInitials = operatorName
    .split(' ')
    .filter((p) => !p.endsWith('.'))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  // Map projection helper to keep all 3 live Lagos previews consistent with real coordinates
  const toPreviewCoords = (lat?: number, lng?: number) => {
    const safeLat = typeof lat === 'number' ? lat : 6.5244;
    const safeLng = typeof lng === 'number' ? lng : 3.3792;
    const xPct = Math.min(88, Math.max(12, ((safeLng - 3.28) / (3.55 - 3.28)) * 100));
    const yPct = Math.min(82, Math.max(16, (1 - (safeLat - 6.42) / (6.64 - 6.42)) * 100));
    return { xPct, yPct };
  };

  return (
    <div className="space-y-6">
      {/* Header & Explanation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Responsive Design Showcase — Desktop, Tablet &amp; Mobile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All three views render the same live RESPONDA state, visual identity, and human-controlled workflows. Click any incident in any device frame to sync across all three previews or jump into its live workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateSection('command-centre')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Open Live Command Centre</span>
          </button>
          {focusedIncident && (
            <button
              type="button"
              onClick={() => onOpenWorkspace(focusedIncident.id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Open {focusedIncident.id}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. DESKTOP COMMAND CENTRE PREVIEW */}
      <section aria-label="Desktop Command Centre preview" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Desktop View — Full Command Centre (1280px+ Layout)</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Full navigation sidebar · 5 KPI cards · Large Lagos map · Live active incident feed
          </span>
        </div>

        <div className="rounded-2xl border-2 border-slate-300 dark:border-[#26364B] bg-[#0B1220] shadow-xl dark:shadow-2xl overflow-hidden">
          <div className="flex flex-col lg:flex-row min-h-[430px]">
            {/* Desktop Preview Sidebar */}
            <div className="w-full lg:w-52 bg-[#111C2E] border-b lg:border-b-0 lg:border-r border-[#26364B] p-3 flex flex-col justify-between gap-3 shrink-0">
              <div className="space-y-3">
                <div className="pb-2 border-b border-[#26364B]">
                  <RespondaLogo />
                </div>
                <div className="space-y-1 text-[11px] font-semibold">
                  {[
                    { id: 'command-centre' as AppSection, label: 'Command Centre', icon: <LayoutDashboard className="w-3.5 h-3.5" />, active: true },
                    { id: 'live-incidents' as AppSection, label: 'Live Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" />, active: false },
                    { id: 'ai-intake' as AppSection, label: 'AI Intake', icon: <Bot className="w-3.5 h-3.5" />, active: false },
                    { id: 'response-units' as AppSection, label: 'Response Units', icon: <Truck className="w-3.5 h-3.5" />, active: false },
                    { id: 'analytics' as AppSection, label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" />, active: false },
                    { id: 'settings' as AppSection, label: 'Settings', icon: <Settings className="w-3.5 h-3.5" />, active: false },
                  ].map((nav) => (
                    <button
                      key={nav.id}
                      type="button"
                      onClick={() => onNavigateSection(nav.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        nav.active
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-[#172438]'
                      }`}
                    >
                      {nav.icon}
                      <span>{nav.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg bg-red-500/15 border border-red-500/35 px-2.5 py-2 text-[11px] text-red-200">
                  <div className="font-semibold">Simulated Demo Ops</div>
                  <div className="text-[10px] text-red-200/80">Human approval required</div>
                </div>
                <div className="rounded-lg bg-[#0B1220] border border-[#26364B] px-2.5 py-1.5 flex items-center gap-2 text-[10px] text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>System Online · Synced</span>
                </div>
              </div>
            </div>

            {/* Desktop Preview Main Canvas */}
            <div className="flex-1 p-4 space-y-3.5 min-w-0">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-display text-sm font-bold text-slate-50">
                    Welcome, {operatorName.split(' ')[0]} · Lagos Operations
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Live snapshot: {metrics.activeCount} active cases, {metrics.awaitingReviewCount} awaiting takeover
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-semibold">
                    Operational
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#111C2E] border border-[#26364B] text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
                      {operatorInitials || 'OP'}
                    </span>
                    <span>{userRole}</span>
                  </span>
                </div>
              </div>

              {/* 5 KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { label: 'Active Incidents', val: metrics.activeCount, color: 'text-blue-400' },
                  { label: 'Critical Incidents', val: metrics.criticalCount, color: 'text-red-400' },
                  { label: 'Awaiting Review', val: metrics.awaitingReviewCount, color: 'text-amber-300' },
                  { label: 'Available Units', val: metrics.availableUnitsCount, color: 'text-emerald-400' },
                  { label: 'Units Responding', val: metrics.respondingUnitsCount, color: 'text-cyan-300' },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5"
                  >
                    <div className="text-[10px] text-slate-400 truncate">{kpi.label}</div>
                    <div className={`font-display text-lg font-bold tabular-nums mt-0.5 ${kpi.color}`}>
                      {kpi.val}
                    </div>
                  </div>
                ))}
              </div>

              {/* 60/40 Split: Lagos Map + Active Incident List */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* Interactive Lagos Sector Map Preview */}
                <div className="lg:col-span-7 rounded-xl bg-[#111C2E] border border-[#26364B] p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-400" />
                      <span>Live Incident Map — Lagos</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {activeIncidents.length} active · {units.length} units
                    </span>
                  </div>

                  <div className="relative flex-1 min-h-[220px] rounded-xl bg-[#0D1729] border border-[#26364B] overflow-hidden">
                    {/* Subtle Lagos grid lines */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, #26364B 1px, transparent 1px), linear-gradient(to bottom, #26364B 1px, transparent 1px)',
                        backgroundSize: '36px 36px',
                      }}
                    />
                    <div className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Lagos Operational Grid
                    </div>

                    {/* Response Unit Pins */}
                    {units.slice(0, 6).map((u) => {
                      const pos = toPreviewCoords(u.lat, u.lng);
                      return (
                        <div
                          key={u.id}
                          style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
                          title={`${u.callsign} (${u.availability})`}
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-emerald-600/90 border border-emerald-300 text-white flex items-center justify-center shadow"
                        >
                          <Truck className="w-3 h-3" />
                        </div>
                      );
                    })}

                    {/* Incident Pins */}
                    {activeIncidents.slice(0, 5).map((inc) => {
                      const pos = toPreviewCoords(inc.location.lat, inc.location.lng);
                      const isFocused = focusedIncident?.id === inc.id;
                      const pinColor =
                        inc.priority === 'CRITICAL'
                          ? 'bg-red-600 border-red-300'
                          : inc.priority === 'HIGH'
                          ? 'bg-orange-500 border-orange-200'
                          : 'bg-yellow-500 border-yellow-200';
                      return (
                        <button
                          key={inc.id}
                          type="button"
                          onClick={() => onSelectIncident(inc.id)}
                          aria-label={`Desktop preview select ${inc.id}`}
                          style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${pinColor} ${
                            isFocused ? 'w-7 h-7 scale-110 ring-4 ring-blue-500/40 z-20' : 'w-5 h-5 z-10'
                          }`}
                        >
                          !
                        </button>
                      );
                    })}

                    {/* Focused Incident Callout */}
                    {focusedIncident && (
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:right-auto sm:w-64 rounded-lg bg-[#111C2E]/95 border border-[#26364B] p-2.5 text-[11px] shadow-xl z-30">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-slate-100">
                            {focusedIncident.id}
                          </span>
                          <PriorityBadge priority={focusedIncident.priority} />
                        </div>
                        <div className="text-slate-300 mt-0.5 truncate">
                          {focusedIncident.category} — {focusedIncident.location.area || 'Lagos'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Incidents List */}
                <div className="lg:col-span-5 rounded-xl bg-[#111C2E] border border-[#26364B] p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">Active Incidents</span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('live-incidents')}
                      className="text-[11px] text-blue-400 hover:underline"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[225px] pr-0.5">
                    {activeIncidents.slice(0, 4).map((inc) => {
                      const isFocused = focusedIncident?.id === inc.id;
                      return (
                        <button
                          key={inc.id}
                          type="button"
                          onClick={() => onSelectIncident(inc.id)}
                          className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                            isFocused
                              ? 'bg-[#172438] border-blue-500/60'
                              : 'bg-[#0B1220] border-[#26364B] hover:border-slate-500/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-100">
                              {inc.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <PriorityBadge priority={inc.priority} />
                              <span className="text-[10px] text-slate-400 font-mono">
                                {formatRelativeTime(inc.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1 truncate">
                            {inc.category} — {inc.location.area || inc.location.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TABLET & MOBILE PREVIEWS SIDE BY SIDE */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* TABLET COMMAND CENTRE PREVIEW */}
        <section
          aria-label="Tablet Command Centre preview"
          className="xl:col-span-7 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Tablet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Tablet View — Reorganised Command Centre (768px–1024px)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Collapsible menu · Compact KPI strip · Map + Quick Actions panel
            </span>
          </div>

          <div className="rounded-2xl border-2 border-slate-300 dark:border-[#26364B] bg-[#0B1220] shadow-xl dark:shadow-2xl overflow-hidden p-3.5 space-y-3">
            {/* Tablet Top Header */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#26364B]">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-[#172438] border border-[#26364B] text-slate-300">
                  <Menu className="w-3.5 h-3.5" />
                </span>
                <RespondaLogo compact />
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                  Operational
                </span>
                <Bell className="w-3.5 h-3.5 text-slate-300" />
                <span className="w-6 h-6 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center text-white">
                  {operatorInitials || 'OP'}
                </span>
              </div>
            </div>

            {/* Tablet Mini Nav + Content */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Compact Left Icon/Label Strip */}
              <div className="sm:col-span-3 rounded-xl bg-[#111C2E] border border-[#26364B] p-2 space-y-1 text-[11px] font-semibold">
                {[
                  { id: 'command-centre' as AppSection, label: 'Command', active: true },
                  { id: 'live-incidents' as AppSection, label: 'Incidents', active: false },
                  { id: 'ai-intake' as AppSection, label: 'AI Intake', active: false },
                  { id: 'response-units' as AppSection, label: 'Units', active: false },
                  { id: 'analytics' as AppSection, label: 'Analytics', active: false },
                ].map((nav) => (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => onNavigateSection(nav.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg ${
                      nav.active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-[#172438]'
                    }`}
                  >
                    {nav.label}
                  </button>
                ))}
              </div>

              {/* Tablet Body */}
              <div className="sm:col-span-9 space-y-3">
                {/* 5 Compact KPIs */}
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: 'Active', val: metrics.activeCount, cls: 'text-blue-400' },
                    { label: 'Critical', val: metrics.criticalCount, cls: 'text-red-400' },
                    { label: 'Pending', val: metrics.awaitingReviewCount, cls: 'text-amber-300' },
                    { label: 'Units', val: metrics.availableUnitsCount, cls: 'text-emerald-400' },
                    { label: 'Resp.', val: metrics.respondingUnitsCount, cls: 'text-cyan-300' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-[#111C2E] border border-[#26364B] p-2"
                    >
                      <div className={`font-display text-sm font-bold tabular-nums ${item.cls}`}>
                        {item.val}
                      </div>
                      <div className="text-[10px] text-slate-400">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Map + Quick Actions Card */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-7 rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5 flex flex-col justify-between min-h-[165px]">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                      <span>Lagos Map</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {focusedIncident?.id || 'No active case'}
                      </span>
                    </div>
                    {focusedIncident ? (
                      <div className="mt-2 rounded-lg bg-[#0D1729] border border-[#26364B] p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-slate-100">
                            {focusedIncident.id}
                          </span>
                          <PriorityBadge priority={focusedIncident.priority} />
                        </div>
                        <div className="text-[11px] text-slate-300 line-clamp-1">
                          {focusedIncident.location.correctedDescription ||
                            focusedIncident.location.description}
                        </div>
                        <IncidentStatusBadge status={focusedIncident.status} />
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 py-6 text-center">
                        All incidents resolved
                      </div>
                    )}
                  </div>

                  {/* Quick Actions Panel matching mockup */}
                  <div className="sm:col-span-5 rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5 space-y-2">
                    <div className="text-xs font-bold text-slate-100">Quick Actions</div>
                    <button
                      type="button"
                      disabled={!focusedIncident}
                      onClick={() => focusedIncident && onOpenWorkspace(focusedIncident.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[11px] font-semibold text-white"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Incident</span>
                    </button>
                    <button
                      type="button"
                      disabled={!focusedIncident}
                      onClick={() => focusedIncident && onOpenWorkspace(focusedIncident.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-[11px] font-semibold text-slate-100"
                    >
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Assign Unit</span>
                    </button>
                    <button
                      type="button"
                      disabled={!focusedIncident || !needsTakeover || !canTakeOver(userRole)}
                      onClick={() => focusedIncident && onTakeOver(focusedIncident.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] disabled:opacity-45 text-[11px] font-semibold text-amber-300"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Take Over</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. MOBILE INTERFACE PREVIEW */}
        <section
          aria-label="Mobile Interface preview"
          className="xl:col-span-5 space-y-2.5 flex flex-col items-center xl:items-stretch"
        >
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Mobile View — Touch-Friendly (&lt;768px)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              2x2 KPIs · Urgent card · Bottom nav
            </span>
          </div>

          <div className="w-full max-w-[340px] mx-auto rounded-[28px] border-4 border-slate-300 dark:border-[#26364B] bg-[#0B1220] shadow-xl dark:shadow-2xl overflow-hidden flex flex-col">
            {/* Mobile Top Header */}
            <div className="px-4 py-3 bg-[#111C2E] border-b border-[#26364B] flex items-center justify-between">
              <RespondaLogo compact />
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                  Live
                </span>
                <Bell className="w-4 h-4 text-slate-300" />
              </div>
            </div>

            {/* Mobile Content Body */}
            <div className="p-3.5 space-y-3 flex-1">
              <div>
                <div className="font-display text-sm font-bold text-slate-50">
                  Good Shift, {operatorName.split(' ')[0]}
                </div>
                <div className="text-[11px] text-slate-400">
                  Prioritised Lagos operations summary
                </div>
              </div>

              {/* 2x2 KPI Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Active</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="font-display text-lg font-bold tabular-nums text-slate-50 mt-1">
                    {metrics.activeCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Critical</span>
                    <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div className="font-display text-lg font-bold tabular-nums text-red-400 mt-1">
                    {metrics.criticalCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Pending</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="font-display text-lg font-bold tabular-nums text-amber-300 mt-1">
                    {metrics.awaitingReviewCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Units</span>
                    <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-display text-lg font-bold tabular-nums text-emerald-400 mt-1">
                    {metrics.availableUnitsCount}
                  </div>
                </div>
              </div>

              {/* Priority Active Incident Card */}
              {focusedIncident && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/35 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-50">
                      {focusedIncident.id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300">
                      {formatRelativeTime(focusedIncident.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-medium">
                    {focusedIncident.category} · {focusedIncident.location.area || 'Lagos'}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenWorkspace(focusedIncident.id)}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              )}
            </div>

            {/* Mobile 5-Tab Bottom Bar matching mockup */}
            <div className="bg-[#111C2E] border-t border-[#26364B] grid grid-cols-5 py-2 text-[10px]">
              {[
                { id: 'command-centre' as AppSection, label: 'Home', icon: <LayoutDashboard className="w-3.5 h-3.5" />, active: true },
                { id: 'live-incidents' as AppSection, label: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" />, active: false },
                { id: 'response-units' as AppSection, label: 'Units', icon: <Truck className="w-3.5 h-3.5" />, active: false },
                { id: 'analytics' as AppSection, label: 'Analytics', icon: <Activity className="w-3.5 h-3.5" />, active: false },
                { id: 'settings' as AppSection, label: 'More', icon: <Menu className="w-3.5 h-3.5" />, active: false },
              ].map((tab) => (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => onNavigateSection(tab.id)}
                  className={`flex flex-col items-center gap-0.5 ${
                    tab.active ? 'text-blue-400 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Consistency Footer */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs shadow-2xs dark:shadow-none">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">Unified Data &amp; Controls</div>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Desktop, tablet, and mobile share identical human takeover, location verification, and dispatch approval rules.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">Zero Hidden Actions</div>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Mobile prioritises urgent incidents and touch targets without horizontal scrolling; tablet surfaces Quick Actions beside the map.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Archive className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">Test Real Responsive Breakpoints</div>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Resize your browser window or open Command Centre on tablet/phone to interact directly with the adaptive layout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
