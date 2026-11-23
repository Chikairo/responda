import React, { useMemo, useState } from 'react';
import { List, Map as MapIcon, ShieldCheck, Truck } from 'lucide-react';
import {
  IncidentRecord,
  ResponseUnit,
  UnitAvailability,
  UserRole,
} from '../types/responda';
import { canApproveDispatch, canUpdateUnitStatus, formatRelativeTime } from '../utils/incidentLogic';
import { rankUnitsForIncident } from '../utils/simulationEngine';
import { LagosMap } from './LagosMap';
import { UnitAvailabilityBadge } from './StatusBadges';

interface ResponseUnitsViewProps {
  units: ResponseUnit[];
  incidents: IncidentRecord[];
  userRole: UserRole;
  focusedIncident?: IncidentRecord | null;
  recommendedUnitId?: string | null;
  onUpdateUnitStatus: (
    unitId: string,
    availability: UnitAvailability | 'COMPLETED' | 'CANCELLED'
  ) => Promise<void>;
  onOpenIncident: (id: string) => void;
  onSelectUnitForIncident?: (unitId: string, incidentId: string) => void;
}

export function ResponseUnitsView({
  units,
  incidents,
  userRole,
  focusedIncident = null,
  recommendedUnitId = null,
  onUpdateUnitStatus,
  onOpenIncident,
  onSelectUnitForIncident,
}: ResponseUnitsViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    recommendedUnitId || units[0]?.id || null
  );
  const [filterAvail, setFilterAvail] = useState<UnitAvailability | 'ALL'>('ALL');
  const [busy, setBusy] = useState(false);

  const filteredUnits = units.filter((u) =>
    filterAvail === 'ALL' ? true : u.availability === filterAvail
  );

  const rankedEntries = useMemo(() => {
    if (focusedIncident) {
      return rankUnitsForIncident(
        filteredUnits,
        focusedIncident,
        recommendedUnitId || undefined
      );
    }
    return filteredUnits.map((unit) => ({
      unit,
      distanceKm: null as number | null,
      recommended: false,
      reason: unit.area,
    }));
  }, [filteredUnits, focusedIncident, recommendedUnitId]);

  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const selectedRank = rankedEntries.find((r) => r.unit.id === selectedUnitId) || null;
  const assignedIncident = selectedUnit?.currentAssignmentId
    ? incidents.find((i) => i.id === selectedUnit.currentAssignmentId) || null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Response Units Fleet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simulated Lagos private ambulance, rapid response, security, rescue, and fire partner units.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter units by availability"
            value={filterAvail}
            onChange={(e) => setFilterAvail(e.target.value as UnitAvailability | 'ALL')}
            className="rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Statuses ({units.length})</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="EN_ROUTE">En route</option>
            <option value="ON_SCENE">On scene</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'map' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Immediate Availability & Assignment Visibility Strip */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="text-slate-500 dark:text-slate-400">Available Now</div>
          <div className="font-display text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
            {units.filter((u) => u.availability === 'AVAILABLE').length}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="text-slate-500 dark:text-slate-400">Assigned / En Route</div>
          <div className="font-display text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400 mt-0.5">
            {
              units.filter(
                (u) =>
                  u.availability === 'ASSIGNED' ||
                  u.availability === 'ACKNOWLEDGED' ||
                  u.availability === 'EN_ROUTE' ||
                  u.availability === 'ON_SCENE'
              ).length
            }
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="text-slate-500 dark:text-slate-400">Unavailable</div>
          <div className="font-display text-xl font-bold tabular-nums text-slate-600 dark:text-slate-400 mt-0.5">
            {units.filter((u) => u.availability === 'UNAVAILABLE').length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          {viewMode === 'map' ? (
            <LagosMap
              incidents={incidents.filter((i) => i.status !== 'CLOSED' && i.status !== 'RESOLVED')}
              units={filteredUnits}
              selectedUnitId={selectedUnitId}
              onSelectUnit={(id) => setSelectedUnitId(id)}
              heightClass="h-[520px]"
            />
          ) : (
            <>
              {focusedIncident && (
                <div className="mb-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/35 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-blue-900 dark:text-blue-200">
                    Ranked by proximity to{' '}
                    <strong className="font-mono">{focusedIncident.id}</strong> (
                    {focusedIncident.category} · {focusedIncident.location.area || 'Lagos'})
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenIncident(focusedIncident.id)}
                    className="font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Return to {focusedIncident.id} Workspace →
                  </button>
                </div>
              )}

              {/* Mobile Vertical Unit Cards (< md) */}
              <div className="md:hidden space-y-2.5">
                {rankedEntries.map(({ unit, distanceKm, recommended }) => {
                  const active = unit.id === selectedUnitId;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`w-full text-left rounded-xl border p-3.5 space-y-2 text-xs transition-colors ${
                        active
                          ? 'bg-blue-50 border-blue-500 dark:bg-[#172438] dark:border-blue-500/60'
                          : 'bg-white border-slate-200 dark:bg-[#111C2E] dark:border-[#26364B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                            <span>{unit.callsign}</span>
                            {recommended && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {unit.unitType} · {unit.locationName}, {unit.area}
                            {distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km away` : ''}
                          </div>
                        </div>
                        <UnitAvailabilityBadge availability={unit.availability} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{unit.currentAssignmentId ? `Assigned: ${unit.currentAssignmentId}` : 'Ready for assignment'}</span>
                        <span className="font-mono">{formatRelativeTime(unit.lastLocationUpdate)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop & Tablet Units Table (>= md) */}
              <div className="hidden md:block rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden shadow-2xs dark:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220]/70 text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4 font-semibold">Unit</th>
                      <th className="py-3 px-4 font-semibold">Type &amp; Crew</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      {focusedIncident && (
                        <th className="py-3 px-4 font-semibold text-right">Distance</th>
                      )}
                      <th className="py-3 px-4 font-semibold">Availability</th>
                      <th className="py-3 px-4 font-semibold">Assignment</th>
                      <th className="py-3 px-4 font-semibold text-right">Action / Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#26364B]">
                    {rankedEntries.map(({ unit, distanceKm, recommended }) => {
                      const active = unit.id === selectedUnitId;
                      return (
                        <tr
                          key={unit.id}
                          onClick={() => setSelectedUnitId(unit.id)}
                          className={`cursor-pointer transition-colors ${
                            active
                              ? 'bg-blue-50 dark:bg-[#172438]'
                              : 'hover:bg-slate-50 dark:hover:bg-[#172438]/60'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                              <span>{unit.callsign}</span>
                              {recommended && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {unit.id} · {unit.organisation}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-800 dark:text-slate-200">{unit.unitType}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {unit.crewDescription}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                            <div>{unit.locationName}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{unit.area}</div>
                          </td>
                          {focusedIncident && (
                            <td className="py-3 px-4 text-right font-mono font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                              {distanceKm !== null ? `${distanceKm.toFixed(1)} km` : '—'}
                            </td>
                          )}
                          <td className="py-3 px-4">
                            <UnitAvailabilityBadge availability={unit.availability} />
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {unit.currentAssignmentId || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {focusedIncident &&
                            !focusedIncident.assignedUnitId &&
                            unit.availability === 'AVAILABLE' &&
                            canApproveDispatch(userRole) &&
                            onSelectUnitForIncident ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectUnitForIncident(unit.id, focusedIncident.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white whitespace-nowrap"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Select for Dispatch</span>
                              </button>
                            ) : (
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                {formatRelativeTime(unit.lastLocationUpdate)}
                              </span>
                            )}
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

        {/* Unit Detail Panel */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-4 shadow-2xs dark:shadow-none">
          {!selectedUnit ? (
            <div className="text-center py-10 text-xs text-slate-500 dark:text-slate-400">
              <Truck className="w-7 h-7 mx-auto mb-2 text-slate-400 dark:text-slate-500" />
              Select a response unit to inspect details.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#26364B]">
                <div>
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {selectedUnit.id} {selectedUnit.isSimulated ? '· SIMULATED' : ''}
                  </div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    {selectedUnit.callsign}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedUnit.unitType} · {selectedUnit.organisation}
                  </p>
                </div>
                <UnitAvailabilityBadge availability={selectedUnit.availability} />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Crew</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">
                    {selectedUnit.crewDescription}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Position</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">
                    {selectedUnit.locationName}, {selectedUnit.area}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Coordinates</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedUnit.lat.toFixed(4)}, {selectedUnit.lng.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current Assignment</span>
                  {assignedIncident ? (
                    <button
                      type="button"
                      onClick={() => onOpenIncident(assignedIncident.id)}
                      className="font-mono text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      {assignedIncident.id} ({assignedIncident.category})
                    </button>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">None</span>
                  )}
                </div>
              </div>

              <LagosMap
                incidents={
                  assignedIncident
                    ? [assignedIncident]
                    : focusedIncident
                    ? [focusedIncident]
                    : []
                }
                units={[selectedUnit]}
                selectedUnitId={selectedUnit.id}
                heightClass="h-[190px]"
                showLegend={false}
              />

              {focusedIncident &&
                !focusedIncident.assignedUnitId &&
                selectedUnit.availability === 'AVAILABLE' &&
                canApproveDispatch(userRole) &&
                onSelectUnitForIncident && (
                  <button
                    type="button"
                    onClick={() =>
                      onSelectUnitForIncident(selectedUnit.id, focusedIncident.id)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Select {selectedUnit.callsign} for {focusedIncident.id}
                      {selectedRank?.distanceKm !== null && selectedRank?.distanceKm !== undefined
                        ? ` (${selectedRank.distanceKm.toFixed(1)} km)`
                        : ''}
                    </span>
                  </button>
                )}

              {canUpdateUnitStatus(userRole) && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#26364B]">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Unit Status Actions {selectedUnit.isSimulated ? '(Simulated Mode)' : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedUnit.currentAssignmentId ? (
                      <>
                        {(
                          [
                            { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
                            { key: 'EN_ROUTE', label: 'En route' },
                            { key: 'ON_SCENE', label: 'On scene' },
                            { key: 'COMPLETED', label: 'Completed' },
                            { key: 'CANCELLED', label: 'Cancel Assignment' },
                          ] as const
                        ).map((act) => (
                          <button
                            key={act.key}
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              await onUpdateUnitStatus(selectedUnit.id, act.key);
                              setBusy(false);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-medium text-slate-700 dark:text-slate-200"
                          >
                            {act.label}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busy || selectedUnit.availability === 'AVAILABLE'}
                          onClick={async () => {
                            setBusy(true);
                            await onUpdateUnitStatus(selectedUnit.id, 'AVAILABLE');
                            setBusy(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 dark:bg-emerald-600/20 dark:border-emerald-500/35 dark:text-emerald-300 text-xs font-semibold disabled:opacity-40"
                        >
                          Mark Available
                        </button>
                        <button
                          type="button"
                          disabled={busy || selectedUnit.availability === 'UNAVAILABLE'}
                          onClick={async () => {
                            setBusy(true);
                            await onUpdateUnitStatus(selectedUnit.id, 'UNAVAILABLE');
                            setBusy(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-700 dark:bg-slate-600/20 dark:border-slate-500/35 dark:text-slate-300 text-xs font-semibold disabled:opacity-40"
                        >
                          Mark Unavailable
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
