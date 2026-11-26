import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type {
  IntegrationConnectionState,
  IntegrationStatus,
  NotificationLog,
} from '../types/responda';

interface SettingsIntegrationsViewProps {
  integrations: IntegrationStatus[];
  notifications: NotificationLog[];
  authFetch: typeof fetch;
  onRefreshBootstrap: () => Promise<void>;
  onToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

export function SettingsIntegrationsView({
  integrations,
  notifications,
  authFetch,
  onRefreshBootstrap,
  onToast,
}: SettingsIntegrationsViewProps) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const badgeStyle = (state: IntegrationConnectionState) => {
    switch (state) {
      case 'CONNECTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/35';
      case 'CONFIGURED_UNVERIFIED':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/35';
      case 'SIMULATED':
        return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35';
      case 'NOT_CONFIGURED':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-600/20 dark:text-slate-300 dark:border-slate-600/35';
    }
  };

  const stateLabelText = (state: IntegrationConnectionState) => {
    switch (state) {
      case 'CONNECTED':
        return 'Connected and working';
      case 'CONFIGURED_UNVERIFIED':
        return 'Configured, not verified';
      case 'SIMULATED':
        return 'Simulated in this prototype';
      case 'NOT_CONFIGURED':
      default:
        return 'Not configured';
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await authFetch(`/api/integrations/test/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || 'Integration test failed.', 'error');
        return;
      }
      onToast(data.message, data.ok ? 'success' : 'info');
      await onRefreshBootstrap();
    } catch {
      onToast('Network error testing integration.', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      const res = await authFetch('/api/demo/reset', { method: 'POST' });
      if (res.ok) {
        await onRefreshBootstrap();
        onToast('Competition demo dataset restored cleanly.', 'success');
      } else {
        const d = await res.json().catch(() => ({}));
        onToast(d.error || 'Could not reset demo dataset.', 'error');
      }
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <PlugZap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>System Integrations &amp; Adapters</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transparent status for external AI, routing, telephony, and carrier location services. Unconfigured services are never reported as connected.
          </p>
        </div>

        <button
          type="button"
          disabled={resetting}
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetting ? 'Resetting...' : 'Reset Demo Dataset'}</span>
        </button>
      </div>

      {/* Adapter Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {integrations.map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {item.category}
                </div>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {item.name}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badgeStyle(
                  item.state
                )}`}
              >
                {item.state === 'CONNECTED' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : item.state === 'NOT_CONFIGURED' || item.state === 'SIMULATED' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>{stateLabelText(item.state)}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {item.details}
            </p>

            {item.envVars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Env vars:</span>
                {item.envVars.map((env) => (
                  <code
                    key={env}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] font-mono text-[10px]"
                  >
                    {env}
                  </code>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Configuration &amp; Verification Notes:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {item.setupSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {item.statusLabel}
              </span>
              <button
                type="button"
                disabled={testingId === item.id}
                onClick={() => void handleTest(item.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${testingId === item.id ? 'animate-spin' : ''}`}
                />
                <span>{testingId === item.id ? 'Testing...' : 'Verify Status'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Notification Audit Log */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
        <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
          Command Alert &amp; Notification Log ({notifications.length})
        </h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              No notifications recorded.
            </p>
          ) : (
            notifications.slice(0, 15).map((n) => (
              <div
                key={n.id}
                className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      {n.channel}
                    </span>
                    <span className="text-slate-500">→ {n.recipient}</span>
                    <span className="text-amber-700 dark:text-amber-300">[{n.status}]</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200">{n.message}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
