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
import { SelectMenu } from './SelectMenu';
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
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Archive className="w-5 h-5 text-[var(--text-secondary)]" />
            <span>Incident History (Read-Only Archive)</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Completed medical incidents and preserved legacy records. Archived cases cannot be edited or reopened.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0">
          <Lock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="font-mono tabular-nums">{archivedIncidents.length}</span>
          <span>Archived Records</span>
        </span>
      </div>

      {/* Filters */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, outcome, area..."
            className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>

        <SelectMenu<'ALL' | IncidentPriority>
          ariaLabel="Filter archive by priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { value: 'ALL', label: 'All Priorities' },
            { value: 'Critical', label: 'Critical' },
            { value: 'Urgent', label: 'Urgent' },
            { value: 'Standard', label: 'Standard' },
            { value: 'Unassessed', label: 'Unassessed' },
          ]}
        />

        <SelectMenu<string>
          ariaLabel="Filter archive by category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'ALL', label: 'All Categories' },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeLegacy}
            onChange={(e) => setIncludeLegacy(e.target.checked)}
            className="accent-[var(--action-blue)]"
          />
          <span>Include Legacy / Out-of-Scope</span>
        </label>
      </div>

      {/* Archive List */}
      <div className="space-y-2.5">
        {archivedIncidents.length === 0 ? (
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-secondary)]">
            No archived incidents match the current filters.
          </div>
        ) : (
          archivedIncidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => setSelectedArchiveId(inc.id)}
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
                  {inc.legacyOutOfScope && <LegacyBadge />}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{inc.summary}</p>
                {inc.outcome && (
                  <p className="text-[11px] text-[var(--status-verified-text)]">
                    Outcome: {inc.outcome}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="font-mono tabular-nums">
                    Closed {formatRelativeTime(inc.closedAt || inc.updatedAt)}
                  </span>
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0"
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
