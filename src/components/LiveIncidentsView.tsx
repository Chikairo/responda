import React, { useMemo, useState } from 'react';
import { ExternalLink, Search, ShieldAlert, UserCheck } from 'lucide-react';
import {
  IncidentPriority,
  IncidentRecord,
  ResponseUnit,
  UserRole,
} from '../types/responda';
import {
  canTakeOver,
  EMERGENCY_CATEGORIES,
  formatRelativeTime,
  isActiveIncidentStatus,
  sortIncidents,
} from '../utils/incidentLogic';
import {
  IncidentStatusBadge,
  LocationSourceBadge,
  PriorityBadge,
  VerificationBadge,
} from './StatusBadges';

interface LiveIncidentsViewProps {
  mode: 'live' | 'history';
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  onOpenWorkspace: (id: string) => void;
  onTakeOver: (id: string) => void;
}

export function LiveIncidentsView({
  mode,
  incidents,
  units,
  userRole,
  onOpenWorkspace,
  onTakeOver,
}: LiveIncidentsViewProps) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<IncidentPriority | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'priority'>(
    mode === 'live' ? 'priority' : 'newest'
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = incidents.filter((inc) => {
      const active = isActiveIncidentStatus(inc.status);
      if (mode === 'live' && !active) return false;
      if (mode === 'history' && active) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (q) {
        const hay = [
          inc.id,
          inc.category,
          inc.summary,
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
    return sortIncidents(filtered, sortBy);
  }, [incidents, mode, search, priorityFilter, categoryFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-50">
            {mode === 'live' ? 'Live Incidents Queue' : 'Incident History & Archive'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'live'
              ? 'All open incidents requiring human review, verification, or active field coordination.'
              : 'Resolved and closed emergency records with preserved transcripts and audit trails.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search incidents..."
              aria-label="Search incidents"
              className="rounded-lg bg-[#111C2E] border border-[#26364B] pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <select
            aria-label="Filter priority"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as IncidentPriority | 'ALL')
            }
            className="rounded-lg bg-[#111C2E] border border-[#26364B] px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            aria-label="Filter category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg bg-[#111C2E] border border-[#26364B] px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Categories</option>
            {EMERGENCY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort list"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'priority')}
            className="rounded-lg bg-[#111C2E] border border-[#26364B] px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="newest">Newest First</option>
            <option value="priority">Highest Priority</option>
          </select>
        </div>
      </div>

      {mode === 'live' && rows.length > 0 && (
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            Showing <strong className="text-slate-100">{rows.length}</strong> open incident{rows.length === 1 ? '' : 's'}. Urgent and awaiting-takeover cases appear at the top — click <strong className="text-blue-300">Open Workspace</strong> to verify location or assign a unit.
          </span>
          <span className="font-mono text-[11px] text-amber-300">
            {rows.filter((r) => r.status === 'AWAITING_OPERATOR' || r.status === 'AI_INTAKE' || r.status === 'NEW').length} awaiting takeover
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-10 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-200">
            {mode === 'live' ? 'No active incidents match your filters' : 'No closed or resolved incidents found'}
          </div>
          <p className="text-xs text-slate-400">
            {mode === 'live'
              ? 'New reports submitted via AI Intake will appear here immediately.'
              : 'Resolved and closed cases appear here once field operations conclude.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Vertical Cards (< md) */}
          <div className="md:hidden space-y-3">
            {rows.map((inc) => {
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
                  className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-100">{inc.id}</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {formatRelativeTime(inc.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-100 mt-0.5">
                        {inc.category}
                      </div>
                    </div>
                    <PriorityBadge priority={inc.priority} />
                  </div>

                  <p className="text-slate-300 leading-snug">
                    {inc.location.correctedDescription || inc.location.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    <IncidentStatusBadge status={inc.status} />
                    <LocationSourceBadge source={inc.location.source} />
                    <VerificationBadge status={inc.location.verificationStatus} />
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Operator: {inc.assignedOperator || 'Unassigned'}
                    {assignedUnit ? ` · Unit: ${assignedUnit.callsign}` : ''}
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-[#26364B]">
                    {mode === 'live' && needsTakeover && canTakeOver(userRole) && (
                      <button
                        type="button"
                        onClick={() => onTakeOver(inc.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Take Over Incident</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenWorkspace(inc.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                    >
                      <span>Open Workspace</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop & Tablet Table (>= md) */}
          <div className="hidden md:block rounded-xl bg-[#111C2E] border border-[#26364B] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#26364B] bg-[#0B1220]/70 text-slate-400">
                  <th className="py-3 px-4 font-semibold">Incident</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Location &amp; Source</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Operator / Unit</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26364B]">
                {rows.map((inc) => {
                  const assignedUnit = inc.assignedUnitId
                    ? units.find((u) => u.id === inc.assignedUnitId)
                    : null;
                  const needsTakeover =
                    inc.status === 'AWAITING_OPERATOR' ||
                    inc.status === 'AI_INTAKE' ||
                    inc.status === 'NEW';

                  return (
                    <tr
                      key={inc.id}
                      className="hover:bg-[#172438]/60 transition-colors"
                    >
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100">
                            {inc.id}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="font-semibold text-slate-200">
                            {inc.category}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5 line-clamp-1">
                          {inc.summary}
                        </p>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {formatRelativeTime(inc.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <PriorityBadge priority={inc.priority} />
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-slate-200 line-clamp-1">
                          {inc.location.correctedDescription || inc.location.description}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <LocationSourceBadge source={inc.location.source} />
                          <VerificationBadge status={inc.location.verificationStatus} />
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <IncidentStatusBadge status={inc.status} />
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <div>{inc.assignedOperator || 'Unassigned'}</div>
                        <div className="text-[11px] text-slate-400">
                          {assignedUnit ? assignedUnit.callsign : 'No unit assigned'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {mode === 'live' && needsTakeover && canTakeOver(userRole) && (
                            <button
                              type="button"
                              onClick={() => onTakeOver(inc.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold whitespace-nowrap"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Take Over</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenWorkspace(inc.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/35 text-blue-300 font-semibold whitespace-nowrap"
                          >
                            <span>Workspace</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
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
