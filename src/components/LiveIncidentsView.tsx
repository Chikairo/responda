import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Lock,
  Search,
} from 'lucide-react';
import type {
  IncidentPriority,
  IncidentRecord,
  ResponseUnit,
  UserRole,
} from '../types/responda';
import { formatRelativeTime, sortIncidents } from '../utils/incidentLogic';
import { IncidentWorkspace } from './IncidentWorkspace';
import {
  IncidentStatusBadge,
  LegacyBadge,
  LocationSourceBadge,
  PriorityBadge,
  VerificationBadge,
} from './StatusBadges';

interface LiveIncidentsViewProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  userRole: UserRole;
  operatorName: string;
  authFetch: typeof fetch;
  carrierConfigured: boolean;
}

export function LiveIncidentsView({
  incidents,
  units,
  userRole,
  operatorName,
  authFetch,
  carrierConfigured,
}: LiveIncidentsViewProps) {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | IncidentPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [includeLegacy, setIncludeLegacy] = useState(true);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);

  const archivedIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = incidents.filter((inc) => {
      if (inc.status !== 'Closed' && !inc.legacyOutOfScope) return false;
      if (!includeLegacy && inc.legacyOutOfScope) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
      if (q) {
        const hay = `${inc.id} ${inc.category} ${inc.summary} ${
          inc.outcome || ''
        } ${inc.location.area || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortIncidents(list, 'newest');
  }, [incidents, includeLegacy, priorityFilter, categoryFilter, search]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    incidents
      .filter((i) => i.status === 'Closed' || i.legacyOutOfScope)
      .forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [incidents]);

  const selectedIncident = selectedArchiveId
    ? archivedIncidents.find((i) => i.id === selectedArchiveId) || null
    : null;

  if (selectedIncident) {
    const noop = async () => {};
    return (
      <IncidentWorkspace
        incident={selectedIncident}
        incidents={archivedIncidents}
        units={units}
        userRole={userRole}
        operatorName={operatorName}
        authFetch={authFetch}
        readOnly={true}
        carrierConfigured={carrierConfigured}
        onBack={() => setSelectedArchiveId(null)}
        onSelectIncident={(id) => setSelectedArchiveId(id)}
        onTakeOver={noop}
        onUpdateMedicalDetails={noop}
        onVerifyLocation={noop}
        onUpdateStatus={noop}
        onDispatchUnit={noop}
        onTransportEvent={noop}
        onAddNote={noop}
        onSendOperatorMessage={noop}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <span>Incident History (Read-Only Archive)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Completed medical incidents and preserved legacy records. Archived cases cannot be edited or reopened.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-300">
          <Lock className="w-3.5 h-3.5" />
          <span>{archivedIncidents.length} Archived Records</span>
        </span>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5 shadow-2xs dark:shadow-none">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, outcome, area..."
            className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          aria-label="Filter archive by priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | IncidentPriority)}
          className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Priorities</option>
          <option value="Critical">Critical</option>
          <option value="Urgent">Urgent</option>
          <option value="Standard">Standard</option>
          <option value="Unassessed">Unassessed</option>
        </select>

        <select
          aria-label="Filter archive by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLegacy}
            onChange={(e) => setIncludeLegacy(e.target.checked)}
          />
          <span>Include Legacy / Out-of-Scope</span>
        </label>
      </div>

      {/* Archive List */}
      <div className="space-y-2.5">
        {archivedIncidents.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No archived incidents match the current filters.
          </div>
        ) : (
          archivedIncidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => setSelectedArchiveId(inc.id)}
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
                  {inc.legacyOutOfScope && <LegacyBadge />}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">{inc.summary}</p>
                {inc.outcome && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Outcome: {inc.outcome}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Closed {formatRelativeTime(inc.closedAt || inc.updatedAt)}</span>
                  <span>·</span>
                  <span>{inc.location.correctedDescription || inc.location.description}</span>
                  {inc.hospitalDestination && (
                    <>
                      <span>·</span>
                      <span>Hospital: {inc.hospitalDestination.name}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedArchiveId(inc.id);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0"
              >
                <span>Inspect Read-Only</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
