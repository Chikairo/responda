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
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <span>Organisation Administration Overview</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Administrative workspace for staff accounts, medical fleet registration, dispatch policy, and adapter status. Live dispatch actions are restricted to Operations Staff.
          </p>
        </div>
      </div>

      {/* 4 Clean Summary Cards (No Analytics Charts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Organisation Profile</span>
            <Building2 className="w-4 h-4 text-[var(--action-blue)] dark:text-[#60A5FA]" />
          </div>
          <div className="font-display text-sm font-bold text-[var(--text-primary)]">
            {organisationSettings.name}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {organisationSettings.city} · {organisationSettings.defaultOperationalArea}
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('organisation-settings')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline pt-1 whitespace-nowrap shrink-0"
          >
            <span>Edit Organisation Policy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Staff Accounts</span>
            <Users className="w-4 h-4 text-[var(--status-verified-text)]" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
            {activeStaff}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-muted)]">Active</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
            {invitedStaff} Invited · {inactiveStaff} Inactive
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('staff-management')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline pt-1 whitespace-nowrap shrink-0"
          >
            <span>Manage Staff Roles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Medical Fleet Registry</span>
            <Truck className="w-4 h-4 text-[var(--brand-teal)]" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
            {activeUnits}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
              Active Medical
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
            {inactiveUnits} Inactive / Legacy archived
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('unit-management')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline pt-1 whitespace-nowrap shrink-0"
          >
            <span>Manage Medical Fleet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>System Adapters</span>
            <PlugZap className="w-4 h-4 text-[var(--status-urgent-text)]" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
            {connectedIntegrations}{' '}
            <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
              Connected
            </span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
            {unverifiedOrNotConfigured} Not Configured / Unverified
          </div>
          <button
            type="button"
            onClick={() => onNavigateAdmin('integrations')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--action-blue)] dark:text-[#60A5FA] hover:underline pt-1 whitespace-nowrap shrink-0"
          >
            <span>Inspect Integrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dispatch Governance Summary */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-2 text-xs">
        <div className="font-display text-sm font-bold text-[var(--text-primary)]">
          Active Operational Policy Summary
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] font-semibold text-[var(--text-muted)]">
              Location Verification Policy
            </div>
            <div className="mt-1 font-semibold text-[var(--text-primary)]">
              {organisationSettings.requireLocationVerificationBeforeDispatch
                ? 'Strict: Location verification required before unit dispatch'
                : 'Advisory: Operators notified if location is unverified'}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-3">
            <div className="text-[11px] font-semibold text-[var(--text-muted)]">
              Clinical Triage Notice
            </div>
            <div className="mt-1 text-[var(--text-secondary)]">
              {organisationSettings.clinicalTriageNotice}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
