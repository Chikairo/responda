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
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Medical Response Units</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {availableCount} active medical units available · {activeDispatchCount} currently deployed. Operational status overrides require a recorded reason.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Show Inactive / Legacy</span>
          </label>

          <select
            aria-label="Filter units by availability"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as 'ALL' | UnitAvailability)}
            className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Availability States</option>
            <option value="Available">Available</option>
            <option value="Responding">Responding</option>
            <option value="At Scene">At Scene</option>
            <option value="Transporting">Transporting</option>
            <option value="Unavailable">Unavailable</option>
          </select>

          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#111C2E] text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-[#111C2E] text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
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
        <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/35 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <strong className="text-blue-900 dark:text-blue-200">
              Comparing medical fleet for {focusedIncident.id}:
            </strong>{' '}
            <span className="text-blue-800 dark:text-blue-300">
              {focusedIncident.category} ({focusedIncident.priority}) —{' '}
              {focusedIncident.location.correctedDescription || focusedIncident.location.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenIncident(focusedIncident.id)}
            className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            Return to Incident Workspace →
          </button>
        </div>
      )}

      {viewMode === 'map' ? (
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
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
                className={`rounded-xl bg-white dark:bg-[#111C2E] border p-4 space-y-3 shadow-2xs dark:shadow-none ${
                  rankInfo?.recommended
                    ? 'border-blue-400 dark:border-blue-500/60'
                    : isInactive
                    ? 'border-slate-300 opacity-80 dark:border-[#26364B]'
                    : 'border-slate-200 dark:border-[#26364B]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {unit.callsign}
                      </span>
                      <UnitRegistrationBadge status={unit.registrationStatus} />
                      <UnitAvailabilityBadge availability={unit.availability} />
                      {unit.legacyOutOfScope && <LegacyBadge />}
                      {rankInfo?.recommended && (
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {unit.unitType} · {unit.vehicleRegistration} · {unit.operationalBase} ({unit.area})
                    </div>
                  </div>

                  <div className="text-right text-[11px] space-y-1">
                    <LocationFreshnessBadge freshness={unit.locationFreshness} />
                    {rankInfo?.distanceKm !== null && rankInfo?.distanceKm !== undefined && (
                      <div className="font-mono font-semibold text-blue-700 dark:text-blue-300">
                        {rankInfo.distanceKm} km away
                      </div>
                    )}
                  </div>
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1.5">
                  {unit.medicalCapabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] text-[11px] text-slate-700 dark:text-slate-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Crew & Coordinates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] rounded-lg p-2.5">
                  <div className="flex items-start gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                    <span className="text-slate-700 dark:text-slate-200">
                      {unit.crewDescription}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-right font-mono">
                    {unit.locationName} · updated {formatRelativeTime(unit.lastLocationUpdate)}
                  </div>
                </div>

                {/* Active Assignment & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-[#26364B]">
                  {assignedInc ? (
                    <button
                      type="button"
                      onClick={() => onOpenIncident(assignedInc.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      <span>Assigned to {assignedInc.id}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Select for Dispatch</span>
                        </button>
                      )}

                    {!isInactive && canUpdateUnitStatus(userRole) && (
                      <select
                        aria-label={`Override operational status for ${unit.callsign}`}
                        value=""
                        onChange={(e) => {
                          const target = e.target.value as UnitAvailability | 'CANCELLED';
                          if (!target) return;
                          setPendingOverride({ unit, targetStatus: target });
                        }}
                        className="rounded-lg bg-slate-100 dark:bg-[#172438] border border-slate-200 dark:border-[#26364B] px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <option value="">Override Status...</option>
                        <option value="Available">Available</option>
                        <option value="Responding">Responding</option>
                        <option value="At Scene">At Scene</option>
                        <option value="Transporting">Transporting</option>
                        <option value="Unavailable">Unavailable</option>
                        {unit.currentAssignmentId && (
                          <option value="CANCELLED">Cancel Assignment</option>
                        )}
                      </select>
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
