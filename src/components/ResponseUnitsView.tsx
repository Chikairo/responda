import React, { useState } from 'react';
import { List, Map as MapIcon, Truck } from 'lucide-react';
import {
  IncidentRecord,
  ResponseUnit,
  UnitAvailability,
  UserRole,
} from '../types/responda';
import { canUpdateUnitStatus, formatRelativeTime } from '../utils/incidentLogic';
import { LagosMap } from './LagosMap';
import { UnitAvailabilityBadge } from './StatusBadges';

interface ResponseUnitsViewProps {
  units: ResponseUnit[];
  incidents: IncidentRecord[];
  userRole: UserRole;
  onUpdateUnitStatus: (
    unitId: string,
    availability: UnitAvailability | 'COMPLETED' | 'CANCELLED'
  ) => Promise<void>;
  onOpenIncident: (id: string) => void;
}

export function ResponseUnitsView({
  units,
  incidents,
  userRole,
  onUpdateUnitStatus,
  onOpenIncident,
}: ResponseUnitsViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(
    units[0]?.id || null
  );
  const [filterAvail, setFilterAvail] = useState<UnitAvailability | 'ALL'>('ALL');
  const [busy, setBusy] = useState(false);

  const filteredUnits = units.filter((u) =>
    filterAvail === 'ALL' ? true : u.availability === filterAvail
  );
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const assignedIncident = selectedUnit?.currentAssignmentId
    ? incidents.find((i) => i.id === selectedUnit.currentAssignmentId) || null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-50">
            Response Units Fleet
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated Lagos private ambulance, rapid response, security, rescue, and fire partner units.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter units by availability"
            value={filterAvail}
            onChange={(e) => setFilterAvail(e.target.value as UnitAvailability | 'ALL')}
            className="rounded-lg bg-[#111C2E] border border-[#26364B] px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Statuses ({units.length})</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="EN_ROUTE">En route</option>
            <option value="ON_SCENE">On scene</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#111C2E] border border-[#26364B]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${
                viewMode === 'map' ? 'bg-blue-600 text-white' : 'text-slate-400'
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
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-3">
          <div className="text-slate-400">Available Now</div>
          <div className="font-display text-xl font-bold tabular-nums text-emerald-400 mt-0.5">
            {units.filter((u) => u.availability === 'AVAILABLE').length}
          </div>
        </div>
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-3">
          <div className="text-slate-400">Assigned / En Route</div>
          <div className="font-display text-xl font-bold tabular-nums text-blue-400 mt-0.5">
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
        <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-3">
          <div className="text-slate-400">Unavailable</div>
          <div className="font-display text-xl font-bold tabular-nums text-slate-400 mt-0.5">
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
              {/* Mobile Vertical Unit Cards (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredUnits.map((unit) => {
                  const active = unit.id === selectedUnitId;
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setSelectedUnitId(unit.id)}
                      className={`w-full text-left rounded-xl border p-3.5 space-y-2 text-xs transition-colors ${
                        active
                          ? 'bg-[#172438] border-blue-500/60'
                          : 'bg-[#111C2E] border-[#26364B]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-100">{unit.callsign}</div>
                          <div className="text-[11px] text-slate-400">
                            {unit.unitType} · {unit.locationName}, {unit.area}
                          </div>
                        </div>
                        <UnitAvailabilityBadge availability={unit.availability} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{unit.currentAssignmentId ? `Assigned: ${unit.currentAssignmentId}` : 'Ready for assignment'}</span>
                        <span className="font-mono">{formatRelativeTime(unit.lastLocationUpdate)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Desktop & Tablet Units Table (>= md) */}
              <div className="hidden md:block rounded-xl bg-[#111C2E] border border-[#26364B] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#26364B] bg-[#0B1220]/70 text-slate-400">
                      <th className="py-3 px-4 font-semibold">Unit</th>
                      <th className="py-3 px-4 font-semibold">Type &amp; Crew</th>
                      <th className="py-3 px-4 font-semibold">Location</th>
                      <th className="py-3 px-4 font-semibold">Availability</th>
                      <th className="py-3 px-4 font-semibold">Assignment</th>
                      <th className="py-3 px-4 font-semibold text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26364B]">
                    {filteredUnits.map((unit) => {
                      const active = unit.id === selectedUnitId;
                      return (
                        <tr
                          key={unit.id}
                          onClick={() => setSelectedUnitId(unit.id)}
                          className={`cursor-pointer transition-colors ${
                            active ? 'bg-[#172438]' : 'hover:bg-[#172438]/60'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-100">
                              {unit.callsign}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {unit.id} · {unit.organisation}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-slate-200">{unit.unitType}</div>
                            <div className="text-[11px] text-slate-400">
                              {unit.crewDescription}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-200">
                            <div>{unit.locationName}</div>
                            <div className="text-[11px] text-slate-400">{unit.area}</div>
                          </td>
                          <td className="py-3 px-4">
                            <UnitAvailabilityBadge availability={unit.availability} />
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {unit.currentAssignmentId || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {formatRelativeTime(unit.lastLocationUpdate)}
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
        <div className="lg:col-span-4 rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-4">
          {!selectedUnit ? (
            <div className="text-center py-10 text-xs text-slate-400">
              <Truck className="w-7 h-7 mx-auto mb-2 text-slate-500" />
              Select a response unit to inspect details.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#26364B]">
                <div>
                  <div className="font-mono text-xs text-slate-400">
                    {selectedUnit.id} {selectedUnit.isSimulated ? '· SIMULATED' : ''}
                  </div>
                  <h2 className="font-display text-base font-bold text-slate-50">
                    {selectedUnit.callsign}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {selectedUnit.unitType} · {selectedUnit.organisation}
                  </p>
                </div>
                <UnitAvailabilityBadge availability={selectedUnit.availability} />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Crew</span>
                  <span className="text-slate-200 text-right">
                    {selectedUnit.crewDescription}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Position</span>
                  <span className="text-slate-200 text-right">
                    {selectedUnit.locationName}, {selectedUnit.area}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinates</span>
                  <span className="font-mono text-slate-300">
                    {selectedUnit.lat.toFixed(4)}, {selectedUnit.lng.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Assignment</span>
                  {assignedIncident ? (
                    <button
                      type="button"
                      onClick={() => onOpenIncident(assignedIncident.id)}
                      className="font-mono text-blue-400 hover:underline"
                    >
                      {assignedIncident.id} ({assignedIncident.category})
                    </button>
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </div>
              </div>

              <LagosMap
                incidents={assignedIncident ? [assignedIncident] : []}
                units={[selectedUnit]}
                selectedUnitId={selectedUnit.id}
                heightClass="h-[190px]"
                showLegend={false}
              />

              {canUpdateUnitStatus(userRole) && (
                <div className="space-y-2 pt-2 border-t border-[#26364B]">
                  <div className="text-xs font-semibold text-slate-300">
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
                            className="px-2.5 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-medium text-slate-200"
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
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/35 text-emerald-300 text-xs font-semibold disabled:opacity-40"
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
                          className="px-2.5 py-1.5 rounded-lg bg-slate-600/20 border border-slate-500/35 text-slate-300 text-xs font-semibold disabled:opacity-40"
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
