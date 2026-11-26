import React from 'react';
import {
  ArrowRight,
  Building2,
  PlugZap,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import type {
  AdminSection,
  IntegrationStatus,
  OrganisationSettings,
  ResponseUnit,
  StaffAccount,
} from '../types/responda';

interface AdminOverviewViewProps {
  organisationSettings: OrganisationSettings;
  staffAccounts: StaffAccount[];
  units: ResponseUnit[];
  integrations: IntegrationStatus[];
  onNavigateAdmin: (section: AdminSection) => void;
}

export function AdminOverviewView({
  organisationSettings,
  staffAccounts,
  units,
  integrations,
  onNavigateAdmin,
}: AdminOverviewViewProps) {
  const activeStaff = staffAccounts.filter((s) => s.accountStatus === 'ACTIVE').length;
  const invitedStaff = staffAccounts.filter((s) => s.accountStatus === 'INVITED').length;
  const inactiveStaff = staffAccounts.filter((s) => s.accountStatus === 'INACTIVE').length;

  const activeUnits = units.filter(
    (u) => u.registrationStatus === 'Active' && !u.legacyOutOfScope
  ).length;
  const inactiveUnits = units.filter(
    (u) => u.registrationStatus === 'Inactive' || Boolean(u.legacyOutOfScope)
  ).length;

  const connectedIntegrations = integrations.filter((i) => i.state === 'CONNECTED').length;
  const unverifiedOrNotConfigured = integrations.filter(
    (i) => i.state === 'NOT_CONFIGURED' || i.state === 'CONFIGURED_UNVERIFIED'
  ).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Organisation Administration Overview</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Administrative workspace for staff accounts, medical fleet registration, dispatch policy, and adapter status. Live dispatch actions are restricted to Operations Staff.
          </p>
        </div>
      </div>

      {/* 4 Clean Summary Cards (No Analytics Charts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Organisation Profile</span>
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            {organisationSettings.name}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {organisationSettings.city} · {organisationSettings.defaultOperationalArea}
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('organisation-settings')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-1"
          >
            <span>Edit Organisation Policy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Staff Accounts</span>
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">
            {activeStaff}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">Active</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {invitedStaff} Invited · {inactiveStaff} Inactive
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('staff-management')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-1"
          >
            <span>Manage Staff Roles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Medical Fleet Registry</span>
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">
            {activeUnits}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">Active Medical</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {inactiveUnits} Inactive / Legacy archived
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('unit-management')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-1"
          >
            <span>Manage Medical Fleet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>System Adapters</span>
            <PlugZap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">
            {connectedIntegrations}{' '}
            <span className="text-xs font-sans font-normal text-slate-500">Connected</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {unverifiedOrNotConfigured} Not Configured / Unverified
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('integrations')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-1"
          >
            <span>Inspect Integrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dispatch Governance Summary */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 shadow-2xs dark:shadow-none text-xs">
        <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
          Active Operational Policy Summary
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Location Verification Policy
            </div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              {organisationSettings.requireLocationVerificationBeforeDispatch
                ? 'Strict: Location verification required before unit dispatch'
                : 'Advisory: Operators notified if location is unverified'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Clinical Triage Notice
            </div>
            <div className="mt-1 text-slate-700 dark:text-slate-200">
              {organisationSettings.clinicalTriageNotice}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
