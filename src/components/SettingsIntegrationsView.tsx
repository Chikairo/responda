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

  const triggerSimulatedVoiceCall = async () => {
    setSimulatingCall(true);
    try {
      const res = await fetch('/api/telephony/simulate-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sessionId: `SIM-VOICE-${Math.floor(1000 + Math.random() * 9000)}`,
          callerNumber: '+234-800-010-9999',
          callerName: 'Simulated Voice Caller',
          areaHint: 'Yaba, Lagos',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await onRefreshBootstrap();
        onToast(
          `Local Simulation Voice Adapter logged call session ${data.incident.id}.`,
          'success'
        );
      } else {
        onToast('Voice adapter simulation failed.', 'error');
      }
    } catch {
      onToast('Network error testing voice provider adapter.', 'error');
    } finally {
      setSimulatingCall(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Settings &amp; Provider Integrations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All credentials are stored strictly in server-side environment secrets. Missing keys fall back cleanly to demonstration mode.
          </p>
        </div>

        <button
          type="button"
          onClick={triggerSimulatedVoiceCall}
          disabled={simulatingCall}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap shadow-2xs dark:shadow-none"
        >
          <PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>
            {simulatingCall
              ? 'Simulating Voice Session...'
              : 'Simulate Voice Provider Call'}
          </span>
        </button>
      </div>

      {/* Modular Voice Provider Architecture Banner */}
      <div className="rounded-xl bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display font-bold text-slate-900 dark:text-slate-100">
            Provider-Independent Telephony Architecture
          </div>
          <span className="font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            Real telephone integration not configured.
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          RESPONDA routes call events, speech transcription, TTS playback, and human handover through a replaceable{' '}
          <span className="font-mono text-blue-700 dark:text-blue-300">VoiceProviderAdapter</span>{' '}
          interface. Today it runs on the{' '}
          <strong className="text-slate-900 dark:text-slate-100">Local Simulation Voice Adapter</strong>{' '}
          and is prepared for future providers such as{' '}
          <strong className="text-slate-900 dark:text-slate-100">Voicebip</strong> or{' '}
          <strong className="text-slate-900 dark:text-slate-100">PressOne Signals</strong>{' '}
          without changing AI intake or dispatch workflows.
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const result = testResults[item.id];
          return (
            <div
              key={item.id}
              className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 flex flex-col justify-between gap-3 shadow-2xs dark:shadow-none"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.category}</div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                      {item.name}
                    </h2>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                      item.mode === 'LIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/35'
                        : item.mode === 'DEMO_FALLBACK'
                        ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
                        : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-600/20 dark:text-slate-300 dark:border-slate-600/40'
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

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.details}</p>

                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Adapter &amp; Environment Keys</span>
                  </div>
                  <div className="font-mono text-blue-700 dark:text-blue-300">
                    {item.envVars.join(' · ')}
                  </div>
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-0.5">
                    {item.setupSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {result && (
                  <div
                    className={`rounded-lg px-3 py-2 text-xs border ${
                      result.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/35 dark:text-emerald-200'
                        : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/35 dark:text-amber-200'
                    }`}
                  >
                    {result.message}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#26364B]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Server className="w-3 h-3" />
                  Server-side adapter
                </span>
                <button
                  type="button"
                  disabled={testingId === item.id}
                  onClick={() => runTest(item.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200"
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
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
        <div>
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            Simulated Dispatch Alert &amp; Notification Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dispatch alerts are recorded only after explicit human operator approval. No external SMS gateway is active in prototype mode.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#26364B] text-slate-600 dark:text-slate-400">
                <th className="py-2 px-3">Channel</th>
                <th className="py-2 px-3">Recipient</th>
                <th className="py-2 px-3">Message</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#26364B]">
              {notifications.slice(0, 12).map((n) => (
                <tr key={n.id}>
                  <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {n.channel}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {n.recipient}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-md">{n.message}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        n.status === 'SENT_LIVE'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : n.status === 'FAILED'
                          ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      }`}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
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
