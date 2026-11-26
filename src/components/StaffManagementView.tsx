import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Info,
  PlusCircle,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import type {
  StaffAccount,
  StaffAccountStatus,
  UserRole,
} from '../types/responda';
import { SelectMenu } from './SelectMenu';

interface StaffManagementViewProps {
  staffAccounts: StaffAccount[];
  currentAccountId: string;
  authFetch: typeof fetch;
  onStaffUpdated: (account: StaffAccount) => void;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

export function StaffManagementView({
  staffAccounts,
  currentAccountId,
  authFetch,
  onStaffUpdated,
  onToast,
}: StaffManagementViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StaffAccountStatus>('ALL');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Operations Staff');
  const [inviteBadge, setInviteBadge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        setInviteOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inviteOpen, submitting]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staffAccounts.filter((acc) => {
      if (statusFilter !== 'ALL' && acc.accountStatus !== statusFilter) return false;
      if (q) {
        const hay = `${acc.name} ${acc.email} ${acc.badgeCode} ${acc.role}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [staffAccounts, search, statusFilter]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setInviteNotice(null);
    setSubmitting(true);
    try {
      const res = await authFetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          badgeCode: inviteBadge || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Could not create staff invite.');
        return;
      }
      onStaffUpdated(data.account);
      setInviteNotice(
        data.notice ||
          'No external email is sent in this prototype — share the invite status with the team member.'
      );
      onToast(`Invited ${data.account.name} (${data.account.role}).`, 'success');
      setInviteName('');
      setInviteEmail('');
      setInviteBadge('');
      setInviteOpen(false);
    } catch {
      setErrorBanner('Failed to communicate with server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStaff = async (
    accountId: string,
    patch: { role?: UserRole; accountStatus?: StaffAccountStatus }
  ) => {
    setErrorBanner(null);
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/staff/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.error || 'Staff update rejected by server.');
        onToast(data.error || 'Staff update rejected.', 'error');
        return;
      }
      onStaffUpdated(data.account);
      onToast(`Updated account for ${data.account.name}.`, 'success');
    } catch {
      setErrorBanner('Network error updating staff account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <span>Staff Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage Operations Staff and Organisation Administrator accounts. At least one active Organisation Administrator is always required.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorBanner(null);
            setInviteOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Invite Staff Member</span>
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

      {inviteNotice && (
        <div className="rounded-xl bg-[var(--status-urgent-bg)] border border-[var(--status-urgent-border)] px-4 py-3 text-xs text-[var(--status-urgent-text)] flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{inviteNotice}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff name, email, or badge..."
            className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        <SelectMenu<'ALL' | StaffAccountStatus>
          ariaLabel="Filter staff by status"
          value={statusFilter}
          onChange={setStatusFilter}
          menuAlign="right"
          options={[
            { value: 'ALL', label: 'All Account Statuses' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INVITED', label: 'Invited' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
          buttonClassName="sm:w-52"
        />
      </div>

      {/* Staff Table */}
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredStaff.map((acc) => {
                const isSelf = acc.id === currentAccountId;
                return (
                  <tr
                    key={acc.id}
                    className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span>{acc.name}</span>
                        {isSelf && (
                          <span className="text-[11px] font-medium text-[var(--action-blue)] dark:text-[#60A5FA]">
                            · Current Session
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {acc.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[var(--text-secondary)]">
                      {acc.badgeCode}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Role for ${acc.name}`}
                        disabled={submitting}
                        value={acc.role}
                        onChange={(e) =>
                          void handleUpdateStaff(acc.id, {
                            role: e.target.value as UserRole,
                          })
                        }
                        className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]"
                      >
                        <option value="Operations Staff">Operations Staff</option>
                        <option value="Organisation Administrator">
                          Organisation Administrator
                        </option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap shrink-0 ${
                          acc.accountStatus === 'ACTIVE'
                            ? 'bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border-[var(--status-verified-border)]'
                            : acc.accountStatus === 'INVITED'
                            ? 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border-[var(--status-urgent-border)]'
                            : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]'
                        }`}
                      >
                        {acc.accountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {acc.accountStatus !== 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleUpdateStaff(acc.id, { accountStatus: 'ACTIVE' })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--action-emerald)] hover:bg-[var(--action-emerald-hover)] text-[var(--text-on-solid)] text-[11px] font-semibold whitespace-nowrap shrink-0"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Activate</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleUpdateStaff(acc.id, { accountStatus: 'INACTIVE' })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--bg-surface-elevated)] hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical-text)] hover:border-[var(--status-critical-border)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-semibold whitespace-nowrap shrink-0"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Deactivate</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Staff Modal */}
      {inviteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) {
              setInviteOpen(false);
            }
          }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-overlay)] p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-floating)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--action-blue)] dark:text-[#60A5FA]" />
                <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  Invite Team Member
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                aria-label="Close invite modal"
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-5 space-y-3 text-xs">
              <div className="rounded-lg bg-[var(--status-urgent-bg)] border border-[var(--status-urgent-border)] p-2.5 text-[11px] text-[var(--status-urgent-text)]">
                No external email is sent in this prototype — creating an invite registers an INVITED staff record that you can share or activate locally.
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g., Dr. Kemi Adesina"
                  className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@responda.demo"
                  className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-2.5 py-2 text-[var(--text-primary)]"
                  >
                    <option value="Operations Staff">Operations Staff</option>
                    <option value="Organisation Administrator">
                      Organisation Administrator
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Badge Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteBadge}
                    onChange={(e) => setInviteBadge(e.target.value)}
                    placeholder="OPS-105"
                    className="w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 font-mono tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-[var(--text-on-solid)] font-semibold whitespace-nowrap shrink-0"
                >
                  {submitting ? 'Creating...' : 'Create Staff Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
