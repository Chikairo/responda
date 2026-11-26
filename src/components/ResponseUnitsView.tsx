import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  List,
  MapPin,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import type {
  IncidentRecord,
  ResponseUnit,
  UnitAvailability,
  UserRole,
} from '../types/responda';
import { canUpdateUnitStatus, formatRelativeTime } from '../utils/incidentLogic';
import { rankUnitsForIncident } from '../utils/simulationEngine';
import { ConfirmActionModal } from './ConfirmActionModal';
import { LagosMap } from './LagosMap';
import { SelectMenu } from './SelectMenu';
import {
  LegacyBadge,
  LocationFreshnessBadge,
  UnitAvailabilityBadge,
  UnitRegistrationBadge,
} from './StatusBadges';

interface ResponseUnitsViewProps {
  units: ResponseUnit[];
  incidents: IncidentRecord[];
  userRole: UserRole;
  focusedIncident: IncidentRecord | null;
  recommendedUnitId: string | null;
  onUpdateUnitStatus: (
    unitId: string,
    availability: UnitAvailability | 'CANCELLED',
    reason: string
  ) => Promise<void>;
  onOpenIncident: (id: string) => void;
  onSelectUnitForIncident: (unitId: string, incidentId: string) => void;
}

export function ResponseUnitsView({
  units,
  incidents,
  userRole,
  focusedIncident,
  recommendedUnitId,
  onUpdateUnitStatus,
  onOpenIncident,
  onSelectUnitForIncident,
}: ResponseUnitsViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | UnitAvailability>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{
    unit: ResponseUnit;
    targetStatus: UnitAvailability | 'CANCELLED';
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visibleUnits = useMemo(() => {
    return units.filter((u) => {
      const isInactiveOrLegacy = u.registrationStatus !== 'Active' || Boolean(u.legacyOutOfScope);
      if (!showInactive && isInactiveOrLegacy) return false;
      if (availabilityFilter !== 'ALL' && u.availability !== availabilityFilter) return false;
      return true;
    });
  }, [units, showInactive, availabilityFilter]);

  const rankedMap = useMemo(() => {
    if (!focusedIncident) return new Map<string, { distanceKm: number | null; recommended: boolean }>();
    const ranked = rankUnitsForIncident(
      units,
      focusedIncident,
      recommendedUnitId || undefined
    );
    return new Map(
      ranked.map((r) => [r.unit.id, { distanceKm: r.distanceKm, recommended: r.recommended }])
    );
  }, [units, focusedIncident, recommendedUnitId]);

  const activeFleet = units.filter((u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope);
  const availableCount = activeFleet.filter((u) => u.availability === 'Available').length;
  const activeDispatchCount = activeFleet.filter(
    (u) =>
      u.availability === 'Responding' ||
      u.availability === 'At Scene' ||
      u.availability === 'Transporting'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <span>Medical Response Units</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            <span className="font-mono tabular-nums">{availableCount}</span> active medical units available ·{' '}
            <span className="font-mono tabular-nums">{activeDispatchCount}</span> currently deployed. Operational status overrides require a recorded reason.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-[var(--action-blue)]"
            />
            <span>Show Inactive / Legacy</span>
          </label>

          <SelectMenu<'ALL' | UnitAvailability>
            ariaLabel="Filter units by availability"
            value={availabilityFilter}
            onChange={setAvailabilityFilter}
            options={[
              { value: 'ALL', label: 'All Availability States' },
              { value: 'Available', label: 'Available' },
              { value: 'Responding', label: 'Responding' },
              { value: 'At Scene', label: 'At Scene' },
              { value: 'Transporting', label: 'Transporting' },
              { value: 'Unavailable', label: 'Unavailable' },
            ]}
            buttonClassName="min-w-[170px]"
          />

          <div className="inline-flex rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'list'
                  ? 'bg-[var(--bg-surface)] text-[var(--action-blue)] dark:text-[#60A5FA] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'map'
                  ? 'bg-[var(--bg-surface)] text-[var(--action-blue)] dark:text-[#60A5FA] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Focused Incident Context Banner */}
      {focusedIncident && focusedIncident.status !== 'Closed' && !focusedIncident.assignedUnitId && (
        <div className="rounded-xl bg-[var(--action-blue-bg)] border border-[var(--action-blue-border)] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-[var(--text-primary)]">
            <strong className="font-mono tabular-nums">
              Comparing medical fleet for {focusedIncident.id}:
            </strong>{' '}
            <span className="text-[var(--text-secondary)]">
              {focusedIncident.category} ({focusedIncident.priority}) —{' '}
              {focusedIncident.location.correctedDescription || focusedIncident.location.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenIncident(focusedIncident.id)}
            className="text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
          >
            Return to Incident Workspace →
          </button>
        </div>
      )}

      {viewMode === 'map' ? (
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4">
          <LagosMap
            incidents={focusedIncident ? [focusedIncident] : incidents.filter((i) => i.status !== 'Closed' && !i.legacyOutOfScope)}
            units={visibleUnits}
            selectedIncidentId={focusedIncident?.id || null}
            onSelectIncident={onOpenIncident}
            heightClass="h-[520px]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {visibleUnits.map((unit) => {
            const rankInfo = rankedMap.get(unit.id);
            const assignedInc = unit.currentAssignmentId
              ? incidents.find((i) => i.id === unit.currentAssignmentId) || null
              : null;
            const isInactive = unit.registrationStatus !== 'Active' || Boolean(unit.legacyOutOfScope);

            return (
              <div
                key={unit.id}
                className={`rounded-xl bg-[var(--bg-surface)] border shadow-[var(--shadow-card)] p-4 space-y-3 ${
                  rankInfo?.recommended
                    ? 'border-[var(--action-blue-border)]'
                    : isInactive
                    ? 'border-[var(--border-subtle)] opacity-80'
                    : 'border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                        {unit.callsign}
                      </span>
                      <UnitRegistrationBadge status={unit.registrationStatus} />
                      <UnitAvailabilityBadge availability={unit.availability} />
                      {unit.legacyOutOfScope && <LegacyBadge />}
                      {rankInfo?.recommended && (
                        <span className="px-2 py-0.5 rounded bg-[var(--action-blue)] text-[var(--text-on-solid)] text-[10px] font-bold whitespace-nowrap shrink-0">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 font-mono tabular-nums">
                      {unit.unitType} · {unit.vehicleRegistration} · {unit.operationalBase} ({unit.area})
                    </div>
                  </div>

                  <div className="text-right text-[11px] space-y-1">
                    <LocationFreshnessBadge freshness={unit.locationFreshness} />
                    {rankInfo?.distanceKm !== null && rankInfo?.distanceKm !== undefined && (
                      <div className="font-mono tabular-nums font-semibold text-[var(--brand-teal)]">
                        {rankInfo.distanceKm} km away
                      </div>
                    )}
                  </div>
                </div>

                {/* Capabilities */}
                <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-semibold text-[var(--text-primary)]">Capabilities: </span>
                  {unit.medicalCapabilities.join(' · ')}
                </div>

                {/* Crew & Coordinates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg p-2.5">
                  <div className="flex items-start gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
                    <span className="text-[var(--text-primary)]">
                      {unit.crewDescription}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] sm:text-right font-mono tabular-nums">
                    {unit.locationName} · updated {formatRelativeTime(unit.lastLocationUpdate)}
                  </div>
                </div>

                {/* Active Assignment & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  {assignedInc ? (
                    <button
                      type="button"
                      onClick={() => onOpenIncident(assignedInc.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      <span className="font-mono tabular-nums">Assigned to {assignedInc.id}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isInactive ? 'Inactive registration — cannot dispatch' : 'No active incident assignment'}
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {!isInactive &&
                      focusedIncident &&
                      focusedIncident.status !== 'Closed' &&
                      !focusedIncident.assignedUnitId &&
                      unit.availability === 'Available' && (
                        <button
                          type="button"
                          onClick={() => onSelectUnitForIncident(unit.id, focusedIncident.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--action-emerald)] hover:bg-[var(--action-emerald-hover)] text-[var(--text-on-solid)] text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Select for Dispatch</span>
                        </button>
                      )}

                    {!isInactive && canUpdateUnitStatus(userRole) && (
                      <SelectMenu<'' | UnitAvailability | 'CANCELLED'>
                        ariaLabel={`Override operational status for ${unit.callsign}`}
                        value=""
                        placeholder="Override Status..."
                        menuAlign="right"
                        onChange={(target) => {
                          if (!target) return;
                          setPendingOverride({ unit, targetStatus: target });
                        }}
                        options={[
                          { value: 'Available', label: 'Available' },
                          { value: 'Responding', label: 'Responding' },
                          { value: 'At Scene', label: 'At Scene' },
                          { value: 'Transporting', label: 'Transporting' },
                          { value: 'Unavailable', label: 'Unavailable' },
                          ...(unit.currentAssignmentId
                            ? [{ value: 'CANCELLED' as const, label: 'Cancel Assignment' }]
                            : []),
                        ]}
                        buttonClassName="bg-[var(--bg-surface-elevated)] font-semibold min-w-[155px]"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingOverride && (
        <ConfirmActionModal
          title={`Update ${pendingOverride.unit.callsign} Status → ${pendingOverride.targetStatus}`}
          description="Operational unit availability overrides require a recorded reason for the medical unit activity log and incident audit trail."
          confirmLabel="Confirm Status Override"
          reasonLabel="Operational Reason (Required)"
          reasonPlaceholder="e.g., Crew shift handover complete, vehicle maintenance, or field radio confirmation..."
          requireReason={true}
          tone="warning"
          submitting={submitting}
          onCancel={() => setPendingOverride(null)}
          onConfirm={async (reason) => {
            setSubmitting(true);
            await onUpdateUnitStatus(
              pendingOverride.unit.id,
              pendingOverride.targetStatus,
              reason
            );
            setSubmitting(false);
            setPendingOverride(null);
          }}
        />
      )}
    </div>
  );
}
