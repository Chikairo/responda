import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import type { OrganisationSettings } from '../types/responda';

interface OrganisationSettingsViewProps {
  settings: OrganisationSettings;
  authFetch: typeof fetch;
  onUpdated: (settings: OrganisationSettings) => void;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

export function OrganisationSettingsView({
  settings,
  authFetch,
  onUpdated,
  onToast,
}: OrganisationSettingsViewProps) {
  const [form, setForm] = useState<OrganisationSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || 'Failed to save organisation settings.', 'error');
        return;
      }
      onUpdated(data.organisationSettings);
      onToast('Organisation policy and profile saved.', 'success');
    } catch {
      onToast('Network error saving organisation settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none">
        <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>Organisation Settings &amp; Dispatch Policy</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure command profile, operational zone defaults, and verification enforcement rules.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-5 space-y-4 shadow-2xs dark:shadow-none text-xs"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Organisation Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Primary City
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Operations Contact Email
            </label>
            <input
              type="email"
              required
              value={form.contactEmail}
              onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Command Contact Phone
            </label>
            <input
              type="text"
              required
              value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Default Operational Coverage Area
            </label>
            <input
              type="text"
              required
              value={form.defaultOperationalArea}
              onChange={(e) =>
                setForm((f) => ({ ...f, defaultOperationalArea: e.target.value }))
              }
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Clinical Triage &amp; Disclaimer Notice
            </label>
            <textarea
              rows={2}
              value={form.clinicalTriageNotice}
              onChange={(e) =>
                setForm((f) => ({ ...f, clinicalTriageNotice: e.target.value }))
              }
              className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requireLocationVerificationBeforeDispatch}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                requireLocationVerificationBeforeDispatch: e.target.checked,
              }))
            }
            className="mt-0.5 rounded border-slate-300"
          />
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Require Location Verification Before Unit Dispatch
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              When enabled, the server enforces that Operations Staff must confirm and verify the Lagos location pin before approving any ambulance dispatch.
            </p>
          </div>
        </label>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-[#26364B]">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Organisation Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
