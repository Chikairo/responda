import React, { useState } from 'react';
import {
  CheckCircle2,
  PhoneCall,
  RefreshCw,
  Server,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { IntegrationStatus, NotificationLog } from '../types/responda';

interface SettingsIntegrationsViewProps {
  integrations: IntegrationStatus[];
  notifications: NotificationLog[];
  onRefreshBootstrap: () => Promise<void>;
  onToast: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}

export function SettingsIntegrationsView({
  integrations,
  notifications,
  onRefreshBootstrap,
  onToast,
}: SettingsIntegrationsViewProps) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});
  const [simulatingCall, setSimulatingCall] = useState(false);

  const runTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/integrations/test/${id}`, { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; message: string };
      setTestResults((prev) => ({ ...prev, [id]: data }));
      onToast(data.message, data.ok ? 'success' : 'info');
    } catch {
      onToast('Integration test request failed.', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const triggerAfricasTalkingTest = async () => {
    setSimulatingCall(true);
    try {
      const res = await fetch('/api/integrations/africas-talking/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sessionId: `AT-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
          callerNumber: '+2348000109999',
          isActive: '1',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshBootstrap();
        onToast(
          `Africa's Talking webhook logged simulated call session ${data.incident.id}.`,
          'success'
        );
      } else {
        onToast('Webhook simulation failed.', 'error');
      }
    } catch {
      onToast('Network error testing Africa\'s Talking webhook.', 'error');
    } finally {
      setSimulatingCall(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-50">
            Settings &amp; Provider Integrations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            All credentials are stored strictly in server-side environment secrets. Missing keys fall back cleanly to demonstration mode.
          </p>
        </div>

        <button
          type="button"
          onClick={triggerAfricasTalkingTest}
          disabled={simulatingCall}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-100 whitespace-nowrap"
        >
          <PhoneCall className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {simulatingCall
              ? 'Simulating Webhook...'
              : "Simulate Africa's Talking Inbound Call"}
          </span>
        </button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const result = testResults[item.id];
          return (
            <div
              key={item.id}
              className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400">{item.category}</div>
                    <h2 className="font-display text-sm font-bold text-slate-50">
                      {item.name}
                    </h2>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                      item.mode === 'LIVE'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
                        : item.mode === 'DEMO_FALLBACK'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                        : 'bg-slate-600/20 text-slate-300 border-slate-600/40'
                    }`}
                  >
                    {item.mode === 'LIVE' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <ShieldAlert className="w-3 h-3" />
                    )}
                    <span>{item.statusLabel}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{item.details}</p>

                <div className="rounded-lg bg-[#0B1220] border border-[#26364B] p-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Wrench className="w-3.5 h-3.5 text-blue-400" />
                    <span>Setup &amp; Environment Keys</span>
                  </div>
                  <div className="font-mono text-blue-300">
                    {item.envVars.join(' · ')}
                  </div>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5">
                    {item.setupSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {result && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs border ${
                      result.ok
                        ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
                        : 'bg-amber-500/10 border-amber-500/35 text-amber-200'
                    }`}
                  >
                    {result.message}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#26364B]">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  Server-side adapter
                </span>
                <button
                  type="button"
                  disabled={testingId === item.id}
                  onClick={() => runTest(item.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#172438] hover:bg-[#1E293B] border border-[#26364B] text-xs font-semibold text-slate-200"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${testingId === item.id ? 'animate-spin' : ''}`}
                  />
                  <span>Test Adapter</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification Delivery Audit Log */}
      <div className="rounded-xl bg-[#111C2E] border border-[#26364B] p-4 space-y-3">
        <div>
          <h2 className="font-display text-sm font-bold text-slate-100">
            Notification &amp; SMS Delivery Log
          </h2>
          <p className="text-xs text-slate-400">
            Notifications are triggered only after explicit human-approved actions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#26364B] text-slate-400">
                <th className="py-2 px-3">Channel</th>
                <th className="py-2 px-3">Recipient</th>
                <th className="py-2 px-3">Message</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26364B]">
              {notifications.slice(0, 12).map((n) => (
                <tr key={n.id}>
                  <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                    {n.channel}
                  </td>
                  <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                    {n.recipient}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 max-w-md">{n.message}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        n.status === 'SENT_LIVE'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : n.status === 'FAILED'
                          ? 'bg-red-500/15 text-red-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                    {new Date(n.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
