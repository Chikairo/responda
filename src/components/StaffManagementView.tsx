import React, { useMemo, useState } from 'react';
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
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Staff Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage Operations Staff and Organisation Administrator accounts. At least one active Organisation Administrator is always required.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorBanner(null);
            setInviteOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Invite Staff Member</span>
        </button>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {inviteNotice && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{inviteNotice}</span>
        </div>
      )}

      {/* Search & Filter */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 flex flex-col sm:flex-row gap-2.5 shadow-2xs dark:shadow-none">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff name, email, or badge..."
            className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <select
          aria-label="Filter staff by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | StaffAccountStatus)}
          className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
        >
          <option value="ALL">All Account Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Staff Table */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] overflow-hidden shadow-2xs dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0B1220] border-b border-slate-200 dark:border-[#26364B] text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#26364B]">
              {filteredStaff.map((acc) => {
                const isSelf = acc.id === currentAccountId;
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/70 dark:hover:bg-[#172438]/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{acc.name}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 text-[10px]">
                            Current Session
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {acc.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
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
                        className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <option value="Operations Staff">Operations Staff</option>
                        <option value="Organisation Administrator">
                          Organisation Administrator
                        </option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          acc.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/35'
                            : acc.accountStatus === 'INVITED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
                            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-600/20 dark:text-slate-400 dark:border-slate-600/35'
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 dark:bg-[#172438] dark:hover:bg-red-500/15 dark:hover:text-red-300 border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
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
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 dark:bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#26364B] bg-slate-50 dark:bg-[#0B1220]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Invite Team Member
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                aria-label="Close invite modal"
                className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-5 space-y-3 text-xs">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                No external email is sent in this prototype — creating an invite registers an INVITED staff record that you can share or activate locally.
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g., Dr. Kemi Adesina"
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@responda.demo"
                  className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-2 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Operations Staff">Operations Staff</option>
                    <option value="Organisation Administrator">
                      Organisation Administrator
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Badge Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteBadge}
                    onChange={(e) => setInviteBadge(e.target.value)}
                    placeholder="OPS-105"
                    className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#26364B]">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#26364B] text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
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
