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
        return 'bg-[var(--status-verified-bg)] text-[var(--status-verified-text)] border-[var(--status-verified-border)]';
      case 'CONFIGURED_UNVERIFIED':
        return 'bg-[var(--action-blue-bg)] text-[var(--action-blue)] dark:text-[#60A5FA] border-[var(--action-blue-border)]';
      case 'SIMULATED':
        return 'bg-[var(--status-urgent-bg)] text-[var(--status-urgent-text)] border-[var(--status-urgent-border)]';
      case 'NOT_CONFIGURED':
      default:
        return 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]';
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
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <PlugZap className="w-5 h-5 text-[var(--action-blue)] dark:text-[#60A5FA]" />
            <span>System Integrations &amp; Adapters</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Transparent status for external AI, routing, telephony, and carrier location services. Unconfigured services are never reported as connected.
          </p>
        </div>

        <button
          type="button"
          disabled={resetting}
          onClick={handleResetDemo}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap shrink-0"
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
            className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {item.category}
                </div>
                <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
                  {item.name}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap shrink-0 ${badgeStyle(
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

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {item.details}
            </p>

            {item.envVars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)]">Env vars:</span>
                <span className="font-mono text-[11px] text-[var(--text-primary)]">
                  {item.envVars.join(' · ')}
                </span>
              </div>
            )}

            <div className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5 text-[11px] text-[var(--text-secondary)] space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">
                Configuration &amp; Verification Notes:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {item.setupSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                {item.statusLabel}
              </span>
              <button
                type="button"
                disabled={testingId === item.id}
                onClick={() => void handleTest(item.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] disabled:opacity-50 text-xs font-semibold text-[var(--text-on-solid)] whitespace-nowrap shrink-0"
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
      <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] p-4 space-y-3">
        <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
          Command Alert &amp; Notification Log ({notifications.length})
        </h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">
              No notifications recorded.
            </p>
          ) : (
            notifications.slice(0, 15).map((n) => (
              <div
                key={n.id}
                className="rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
                    <span className="font-bold text-[var(--action-blue)] dark:text-[#60A5FA]">
                      {n.channel}
                    </span>
                    <span className="text-[var(--text-muted)]">→ {n.recipient}</span>
                    <span className="text-[var(--status-urgent-text)]">[{n.status}]</span>
                  </div>
                  <p className="text-[var(--text-secondary)]">{n.message}</p>
                </div>
                <span className="font-mono tabular-nums text-[10px] text-[var(--text-muted)] shrink-0">
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
