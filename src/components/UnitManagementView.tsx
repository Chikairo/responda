import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  PlusCircle,
  Power,
  Stethoscope,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  PREDEFINED_MEDICAL_CAPABILITIES,
  type CrewMemberRecord,
  type MedicalCapability,
  type ResponseUnit,
  type UnitAvailability,
  type UnitRegistrationStatus,
  type UnitType,
} from '../types/responda';
import { SelectMenu } from './SelectMenu';
import {
  LegacyBadge,
  UnitAvailabilityBadge,
  UnitRegistrationBadge,
} from './StatusBadges';

interface UnitManagementViewProps {
  units: ResponseUnit[];
  organisationName: string;
  authFetch: typeof fetch;
  onUnitUpdated: (unit: ResponseUnit) => void;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

type DetailTab = 'overview' | 'capabilities' | 'crew' | 'activity';

export function UnitManagementView({
  units,
  organisationName,
  authFetch,
  onUnitUpdated,
  onToast,
}: UnitManagementViewProps) {
  const [filterReg, setFilterReg] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(units[0]?.id || null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Selected Unit Edit Form State
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const [editCallsign, setEditCallsign] = useState('');
  const [editRegPlate, setEditRegPlate] = useState('');
  const [editType, setEditType] = useState<UnitType>('Ambulance');
  const [editBase, setEditBase] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editLat, setEditLat] = useState('6.5244');
  const [editLng, setEditLng] = useState('3.3792');
  const [editAvail, setEditAvail] = useState<UnitAvailability>('Available');
  const [editNotes, setEditNotes] = useState('');
  const [editCaps, setEditCaps] = useState<MedicalCapability[]>([]);
  const [editCustomEquip, setEditCustomEquip] = useState('');
  const [editCrew, setEditCrew] = useState<CrewMemberRecord[]>([]);

  useEffect(() => {
    if (!selectedUnit) return;
    setEditCallsign(selectedUnit.callsign);
    setEditRegPlate(selectedUnit.vehicleRegistration);
    setEditType(selectedUnit.unitType);
    setEditBase(selectedUnit.operationalBase);
    setEditArea(selectedUnit.area);
    setEditLat(String(selectedUnit.lat));
    setEditLng(String(selectedUnit.lng));
    setEditAvail(selectedUnit.availability);
    setEditNotes(selectedUnit.adminNotes || '');
    setEditCaps(selectedUnit.medicalCapabilities || []);
    setEditCustomEquip((selectedUnit.customEquipment || []).join(', '));
    setEditCrew(selectedUnit.crewMembers || []);
  }, [selectedUnit]);

  // Register New Medical Unit Modal State (Exact 4 Sections)
  const [createOpen, setCreateOpen] = useState(false);
  const [newCallsign, setNewCallsign] = useState('');
  const [newRegPlate, setNewRegPlate] = useState('');
  const [newType, setNewType] = useState<UnitType>('Ambulance');
  const [newBase, setNewBase] = useState('');
  const [newArea, setNewArea] = useState('Lagos');
  const [newCaps, setNewCaps] = useState<MedicalCapability[]>([
    'Basic Life Support (BLS)',
    'Patient transport',
  ]);
  const [newCustomEquip, setNewCustomEquip] = useState('');
  const [newCrew, setNewCrew] = useState<CrewMemberRecord[]>([
    { id: 'new-cr-1', name: '', medicalRole: 'Paramedic', qualification: 'BLS' },
  ]);
  const [newRegStatus, setNewRegStatus] = useState<UnitRegistrationStatus>('Active');
  const [newAvail, setNewAvail] = useState<UnitAvailability>('Available');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    if (!createOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [createOpen, busy]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (filterReg === 'Active') {
        return u.registrationStatus === 'Active' && !u.legacyOutOfScope;
      }
      if (filterReg === 'Inactive') {
        return u.registrationStatus === 'Inactive' || Boolean(u.legacyOutOfScope);
      }
      return true;
    });
  }, [units, filterReg]);

  const toggleCap = (list: MedicalCapability[], cap: string): MedicalCapability[] =>
    list.includes(cap) ? list.filter((c) => c !== cap) : [...list, cap];

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign: newCallsign,
          organisation: organisationName,
          unitType: newType,
          vehicleRegistration: newRegPlate,
          operationalBase: newBase,
          area: newArea,
          medicalCapabilities: newCaps,
          customEquipment: newCustomEquip
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          crewMembers: newCrew.filter((m) => m.name.trim()),
          registrationStatus: newRegStatus,
          availability: newAvail,
          adminNotes: newNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Could not register medical unit.');
        return;
      }
      onUnitUpdated(data.unit);
      setSelectedUnitId(data.unit.id);
      setCreateOpen(false);
      setNewCallsign('');
      setNewRegPlate('');
      setNewBase('');
      setNewNotes('');
      onToast(`Registered medical unit ${data.unit.callsign}.`, 'success');
    } catch {
      setErrorBanner('Network error registering unit.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSelected = async () => {
    if (!selectedUnit) return;
    setErrorBanner(null);
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/units/${selectedUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callsign: editCallsign,
          vehicleRegistration: editRegPlate,
          unitType: editType,
          operationalBase: editBase,
          area: editArea,
          lat: Number(editLat),
          lng: Number(editLng),
          availability: editAvail,
          adminNotes: editNotes,
          medicalCapabilities: editCaps,
          customEquipment: editCustomEquip
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          crewMembers: editCrew.filter((m) => m.name.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Failed to update unit.');
        return;
      }
      onUnitUpdated(data.unit);
      onToast(`Saved updates for ${data.unit.callsign}.`, 'success');
    } catch {
      setErrorBanner('Network error saving unit.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRegistration = async (
    unit: ResponseUnit,
    target: UnitRegistrationStatus
  ) => {
    setErrorBanner(null);
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/units/${unit.id}/registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationStatus: target,
          reason: `Administrator changed registration to ${target}.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Could not change unit registration.');
        onToast(data.error || 'Unit registration update blocked.', 'error');
        return;
      }
      onUnitUpdated(data.unit);
      onToast(`${data.unit.callsign} marked ${target}.`, 'success');
    } catch {
      setErrorBanner('Network error toggling unit registration.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <span>Medical Fleet &amp; Unit Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Register medical ambulances and rapid response vehicles, manage crew and equipment, or deactivate unassigned units.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorBanner(null);
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Register Medical Unit</span>
        </button>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl bg-[var(--status-critical-bg)] border border-[var(--status-critical-border)] px-4 py-3 text-xs text-[var(--status-critical-text)] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Fleet Table (Left) */}
        <div className="xl:col-span-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Registered Fleet (<span className="font-mono tabular-nums">{filteredUnits.length}</span>)
            </h2>
            <SelectMenu<'ALL' | 'Active' | 'Inactive'>
              ariaLabel="Filter registered fleet"
              value={filterReg}
              onChange={setFilterReg}
              menuAlign="right"
              options={[
                { value: 'ALL', label: 'All Units' },
                { value: 'Active', label: 'Active Medical' },
                { value: 'Inactive', label: 'Inactive / Legacy' },
              ]}
              buttonClassName="min-w-[140px]"
            />
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {filteredUnits.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUnitId(u.id)}
                className={`w-full text-left rounded-xl border p-3 space-y-1.5 transition-colors ${
                  selectedUnitId === u.id
                    ? 'bg-[var(--action-blue-bg)] border-[var(--action-blue-border)]'
                    : 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="font-bold text-xs text-[var(--text-primary)]">
                    {u.callsign}
                  </span>
                  <div className="flex items-center gap-1">
                    <UnitRegistrationBadge status={u.registrationStatus} />
                    <UnitAvailabilityBadge availability={u.availability} />
                  </div>
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                  {u.unitType} · {u.vehicleRegistration} · {u.area}
                </div>
                {u.legacyOutOfScope && (
                  <div className="pt-0.5">
                    <LegacyBadge />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Unit 4-Section Detail Panel (Right) */}
        <div className="xl:col-span-7 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-4">
          {!selectedUnit ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              Select a medical unit from the list to inspect or manage its profile.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                      {selectedUnit.callsign}
                    </h2>
                    <UnitRegistrationBadge status={selectedUnit.registrationStatus} />
                    <UnitAvailabilityBadge availability={selectedUnit.availability} />
                    {selectedUnit.legacyOutOfScope && <LegacyBadge />}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] mt-0.5">
                    ID: {selectedUnit.id} · {selectedUnit.vehicleRegistration}
                  </div>
                </div>

                {!selectedUnit.legacyOutOfScope && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void handleToggleRegistration(
                        selectedUnit,
                        selectedUnit.registrationStatus === 'Active' ? 'Inactive' : 'Active'
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 ${
                      selectedUnit.registrationStatus === 'Active'
                        ? 'bg-[var(--status-critical-bg)] hover:opacity-90 text-[var(--status-critical-text)] border-[var(--status-critical-border)]'
                        : 'bg-[var(--action-emerald)] hover:bg-[var(--action-emerald-hover)] text-[var(--text-on-solid)] border-transparent'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>
                      {selectedUnit.registrationStatus === 'Active'
                        ? 'Deactivate Unit'
                        : 'Reactivate Unit'}
                    </span>
                  </button>
                )}
              </div>

              {/* 4 Detail Section Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'overview', label: '1. Overview' },
                    { id: 'capabilities', label: '2. Capabilities' },
                    { id: 'crew', label: '3. Crew' },
                    { id: 'activity', label: '4. Activity' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      detailTab === t.id
                        ? 'bg-[var(--action-blue)] text-[var(--text-on-solid)]'
                        : 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailTab === 'overview' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Unit Callsign
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editCallsign}
                      onChange={(e) => setEditCallsign(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Vehicle Registration
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editRegPlate}
                      onChange={(e) => setEditRegPlate(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 font-mono tabular-nums text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Medical Unit Type
                    </label>
                    <select
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as UnitType)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    >
                      <option value="Ambulance">Ambulance</option>
                      <option value="Rapid response vehicle">Rapid response vehicle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Operational Base
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editBase}
                      onChange={(e) => setEditBase(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Lagos Area
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Default Availability (when unassigned)
                    </label>
                    <select
                      disabled={
                        Boolean(selectedUnit.legacyOutOfScope) ||
                        Boolean(selectedUnit.currentAssignmentId)
                      }
                      value={editAvail}
                      onChange={(e) => setEditAvail(e.target.value as UnitAvailability)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    >
                      <option value="Available">Available</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Admin Notes
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {detailTab === 'capabilities' && (
                <div className="space-y-3 text-xs">
                  <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-[var(--action-blue)] dark:text-[#60A5FA]" />
                    <span>Predefined Medical Capabilities</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PREDEFINED_MEDICAL_CAPABILITIES.map((cap) => (
                      <label
                        key={cap}
                        className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5 cursor-pointer text-[var(--text-primary)]"
                      >
                        <input
                          type="checkbox"
                          disabled={Boolean(selectedUnit.legacyOutOfScope)}
                          checked={editCaps.includes(cap)}
                          onChange={() => setEditCaps((prev) => toggleCap(prev, cap))}
                          className="accent-[var(--action-blue)]"
                        />
                        <span>{cap}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Custom Medical Equipment (comma-separated)
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(selectedUnit.legacyOutOfScope)}
                      value={editCustomEquip}
                      onChange={(e) => setEditCustomEquip(e.target.value)}
                      placeholder="e.g., Portable ventilator, Trauma spine board"
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                </div>
              )}

              {detailTab === 'crew' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[var(--action-blue)] dark:text-[#60A5FA]" />
                      <span>
                        Assigned Medical Crew (<span className="font-mono tabular-nums">{editCrew.length}</span>)
                      </span>
                    </span>
                    {!selectedUnit.legacyOutOfScope && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditCrew((prev) => [
                            ...prev,
                            {
                              id: `cr-${Date.now()}`,
                              name: '',
                              medicalRole: 'Paramedic',
                              qualification: 'BLS',
                            },
                          ])
                        }
                        className="px-2.5 py-1 rounded-md bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0"
                      >
                        + Add Crew Member
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {editCrew.map((member, idx) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5"
                      >
                        <input
                          type="text"
                          disabled={Boolean(selectedUnit.legacyOutOfScope)}
                          value={member.name}
                          onChange={(e) =>
                            setEditCrew((prev) =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, name: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Crew name"
                          className="sm:col-span-4 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          disabled={Boolean(selectedUnit.legacyOutOfScope)}
                          value={member.medicalRole}
                          onChange={(e) =>
                            setEditCrew((prev) =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, medicalRole: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Role"
                          className="sm:col-span-4 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                        <input
                          type="text"
                          disabled={Boolean(selectedUnit.legacyOutOfScope)}
                          value={member.qualification}
                          onChange={(e) =>
                            setEditCrew((prev) =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, qualification: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Qualification"
                          className="sm:col-span-3 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 py-1 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                        {!selectedUnit.legacyOutOfScope && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditCrew((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="sm:col-span-1 p-1 text-[var(--status-critical-text)] hover:opacity-80 justify-self-end"
                            aria-label="Remove crew member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'activity' && (
                <div className="space-y-2 max-h-[340px] overflow-y-auto text-xs">
                  {(selectedUnit.activityLog || []).length === 0 ? (
                    <p className="text-[var(--text-muted)] py-4 text-center">
                      No unit activity logged yet.
                    </p>
                  ) : (
                    (selectedUnit.activityLog || []).map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5 space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                            <History className="w-3.5 h-3.5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
                            {ev.action}
                          </span>
                          <span className="font-mono tabular-nums text-[10px] text-[var(--text-muted)]">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">{ev.details}</p>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {ev.actor} · {ev.actorRole}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!selectedUnit.legacyOutOfScope && detailTab !== 'activity' && (
                <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveSelected}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Unit Changes</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Register New Medical Unit Modal — Exact 4 Sections */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setCreateOpen(false);
            }
          }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-overlay)] p-4"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-floating)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
                Register New Medical Response Unit
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close registration modal"
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="p-5 space-y-5 text-xs">
              {/* Section A: Unit Identification */}
              <div className="space-y-2.5">
                <h3 className="font-bold text-[var(--text-primary)] tracking-wide text-xs">
                  A. Unit Identification
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Callsign *
                    </label>
                    <input
                      type="text"
                      required
                      value={newCallsign}
                      onChange={(e) => setNewCallsign(e.target.value)}
                      placeholder="e.g., Ikeja Ambulance Alpha-3"
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Vehicle Registration *
                    </label>
                    <input
                      type="text"
                      required
                      value={newRegPlate}
                      onChange={(e) => setNewRegPlate(e.target.value)}
                      placeholder="LAS-502-MED"
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 font-mono tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Unit Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as UnitType)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)]"
                    >
                      <option value="Ambulance">Ambulance</option>
                      <option value="Rapid response vehicle">Rapid response vehicle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Operational Base *
                    </label>
                    <input
                      type="text"
                      required
                      value={newBase}
                      onChange={(e) => setNewBase(e.target.value)}
                      placeholder="Gbagada Medical Station"
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Lagos Area
                    </label>
                    <input
                      type="text"
                      value={newArea}
                      onChange={(e) => setNewArea(e.target.value)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Medical Capabilities & Equipment */}
              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <h3 className="font-bold text-[var(--text-primary)] tracking-wide text-xs">
                  B. Medical Capabilities &amp; Equipment
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--text-primary)]">
                  {PREDEFINED_MEDICAL_CAPABILITIES.map((cap) => (
                    <label key={cap} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCaps.includes(cap)}
                        onChange={() => setNewCaps((prev) => toggleCap(prev, cap))}
                        className="accent-[var(--action-blue)]"
                      />
                      <span>{cap}</span>
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  value={newCustomEquip}
                  onChange={(e) => setNewCustomEquip(e.target.value)}
                  placeholder="Optional custom equipment (comma-separated)"
                  className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              {/* Section C: Assigned Medical Crew */}
              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[var(--text-primary)] tracking-wide text-xs">
                    C. Assigned Medical Crew
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setNewCrew((prev) => [
                        ...prev,
                        {
                          id: `new-cr-${Date.now()}`,
                          name: '',
                          medicalRole: 'EMT',
                          qualification: 'BLS',
                        },
                      ])
                    }
                    className="text-[11px] font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] whitespace-nowrap shrink-0"
                  >
                    + Add Crew Row
                  </button>
                </div>
                {newCrew.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        setNewCrew((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, name: e.target.value } : m))
                        )
                      }
                      placeholder="Full name"
                      className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                    <input
                      type="text"
                      value={row.medicalRole}
                      onChange={(e) =>
                        setNewCrew((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, medicalRole: e.target.value } : m
                          )
                        )
                      }
                      placeholder="Medical role"
                      className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                    <input
                      type="text"
                      value={row.qualification}
                      onChange={(e) =>
                        setNewCrew((prev) =>
                          prev.map((m, i) =>
                            i === idx ? { ...m, qualification: e.target.value } : m
                          )
                        )
                      }
                      placeholder="Qualification"
                      className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2.5 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                ))}
              </div>

              {/* Section D: Registration & Availability */}
              <div className="space-y-2.5 pt-3 border-t border-[var(--border-subtle)]">
                <h3 className="font-bold text-[var(--text-primary)] tracking-wide text-xs">
                  D. Registration &amp; Availability
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Registration Status
                    </label>
                    <select
                      value={newRegStatus}
                      onChange={(e) =>
                        setNewRegStatus(e.target.value as UnitRegistrationStatus)
                      }
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)]"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Initial Availability
                    </label>
                    <select
                      value={newAvail}
                      onChange={(e) => setNewAvail(e.target.value as UnitAvailability)}
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)]"
                    >
                      <option value="Available">Available</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Inspection or onboarding notes..."
                      className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-[var(--text-on-solid)] font-semibold whitespace-nowrap shrink-0"
                >
                  {busy ? 'Registering...' : 'Register Medical Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
