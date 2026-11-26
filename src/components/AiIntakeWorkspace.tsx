import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  LocateFixed,
  Mic,
  MicOff,
  PhoneCall,
  Send,
  ShieldAlert,
  Sparkles,
  User,
} from 'lucide-react';
import type {
  ClinicalDetails,
  IncidentPriority,
  IncidentRecord,
  IntakeExtraction,
  MedicalEmergencyCategory,
  TranscriptMessage,
} from '../types/responda';
import { MEDICAL_CATEGORIES } from '../utils/incidentLogic';

interface AiIntakeWorkspaceProps {
  geminiConfigured: boolean;
  authFetch: typeof fetch;
  activeIncident?: IncidentRecord | null;
  embedded?: boolean;
  onCloseEmbedded?: () => void;
  onIncidentCreated: (incident: IncidentRecord) => void;
  onOpenIncident: (id: string) => void;
}

const DEMO_SCRIPTED_PROMPTS = [
  {
    label: 'Yaba Road Accident',
    text: 'Hello! There is a bad bus and car accident near UNILAG main gate in Yaba. Two people are injured and bleeding, and one car door is jammed.',
  },
  {
    label: 'Ikeja Medical Collapse',
    text: 'Please help, my colleague just collapsed outside our office near Allen Avenue Roundabout in Ikeja and is struggling to breathe. His name is Emeka.',
  },
  {
    label: 'Incomplete / Unclear Call',
    text: 'Someone fell sick near Surulere stadium, please send help quickly.',
  },
];

export function AiIntakeWorkspace({
  geminiConfigured,
  authFetch,
  activeIncident,
  embedded = false,
  onCloseEmbedded,
  onIncidentCreated,
  onOpenIncident,
}: AiIntakeWorkspaceProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([
    {
      id: 'init-ai-1',
      speaker: 'AI',
      text: 'Responda Medical Intake active. Describe the medical emergency, patient condition, and nearest Lagos landmark. Note: this is a demonstration prototype — call 112/767 for real emergencies.',
      timestamp: new Date().toISOString(),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [mode, setMode] = useState<'auto' | 'simulated' | 'gemini'>(
    geminiConfigured ? 'auto' : 'simulated'
  );
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [telephonyTesting, setTelephonyTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Structured extraction + manual clinical override
  const [category, setCategory] = useState<MedicalEmergencyCategory>('Medical');
  const [priority, setPriority] = useState<IncidentPriority>('Unassessed');
  const [priorityReason, setPriorityReason] = useState(
    'Awaiting sufficient clinical information for operator triage.'
  );
  const [summary, setSummary] = useState('');
  const [peopleAffected, setPeopleAffected] = useState<string>('');
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [dangerDetails, setDangerDetails] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [area, setArea] = useState('');
  const [missingInfoFlags, setMissingInfoFlags] = useState<string[]>([
    'Exact street or landmark',
    'Clinical severity & consciousness check',
  ]);
  const [clinicalDetails, setClinicalDetails] = useState<ClinicalDetails>({
    chiefComplaint: '',
    consciousness: '',
    breathing: '',
    bleedingOrInjury: '',
  });

  // Device GPS state (opt-in browser Geolocation only — never auto-verifies)
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    accuracyMeters?: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Not captured');

  // Browser Web Speech API dictation
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  const speechAvailable = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const handleRequestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Browser geolocation unavailable on this device.');
      return;
    }
    setGpsStatus('Requesting device GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracyMeters: Math.round(pos.coords.accuracy),
        });
        setGpsStatus(
          `Captured (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(
            4
          )}, ±${Math.round(pos.coords.accuracy)}m) — stays UNVERIFIED until operator confirms`
        );
      },
      () => {
        setGpsStatus('Permission denied or unavailable — using caller location text.');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const toggleVoiceDictation = () => {
    if (listening) {
      try {
        (recognitionRef.current as { stop?: () => void })?.stop?.();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;

    const rec = new Rec();
    rec.lang = 'en-NG';
    rec.interimResults = false;
    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) {
        setInputText((prev) => (prev ? `${prev} ${text}` : text));
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const applyExtraction = (ex: IntakeExtraction) => {
    setCategory(ex.category);
    setPriority(ex.suggestedPriority);
    if (ex.priorityReason) setPriorityReason(ex.priorityReason);
    if (ex.summary) setSummary(ex.summary);
    if (ex.peopleAffected !== null && ex.peopleAffected !== undefined) {
      setPeopleAffected(String(ex.peopleAffected));
    }
    setImmediateDanger(Boolean(ex.immediateDanger));
    if (ex.dangerDetails) setDangerDetails(ex.dangerDetails);
    if (ex.locationDescription) setLocationDescription(ex.locationDescription);
    if (ex.landmark) setLandmark(ex.landmark);
    if (ex.area) setArea(ex.area);
    if (ex.callerName && !callerName) setCallerName(ex.callerName);
    if (ex.callerPhone && !callerPhone) setCallerPhone(ex.callerPhone);
    setMissingInfoFlags(ex.missingInfoFlags || []);
  };

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!text || sending) return;

    setErrorMsg(null);
    const callerMsg: TranscriptMessage = {
      id: `m-${Date.now()}`,
      speaker: 'CALLER',
      text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, callerMsg];
    setMessages(nextHistory);
    if (!textOverride) setInputText('');
    setSending(true);

    try {
      const res = await authFetch('/api/intake/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
          mode,
          hasGps: Boolean(gps),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Intake assistant returned an error.');
        return;
      }

      const extraction = data.extraction as IntakeExtraction;
      applyExtraction(extraction);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          speaker: 'AI',
          text: extraction.reply,
          timestamp: new Date().toISOString(),
          extractedTags: [
            extraction.category,
            extraction.suggestedPriority,
            ...(extraction.area ? [extraction.area] : []),
          ],
        },
      ]);
    } catch {
      setErrorMsg('Network error communicating with RESPONDA intake service.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateIncident = async () => {
    const desc =
      messages
        .filter((m) => m.speaker === 'CALLER')
        .map((m) => m.text)
        .join(' ') || summary;

    if (!desc.trim() && !summary.trim()) {
      setErrorMsg('Please enter caller details or a summary before creating the incident.');
      return;
    }

    setCreating(true);
    setErrorMsg(null);
    try {
      const parsedCount =
        peopleAffected.trim() !== '' && Number.isFinite(Number(peopleAffected))
          ? Math.max(0, Math.round(Number(peopleAffected)))
          : null;

      const res = await authFetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          priority,
          priorityReason,
          summary: summary.trim() || desc.slice(0, 140),
          description: desc.trim() || summary.trim(),
          callerName: callerName.trim() || undefined,
          callerPhone: callerPhone.trim() || undefined,
          peopleAffected: parsedCount,
          immediateDanger,
          dangerDetails: dangerDetails.trim() || undefined,
          clinicalDetails,
          missingInfoFlags,
          transcript: messages,
          locationDescription: locationDescription.trim() || undefined,
          landmark: landmark.trim() || undefined,
          area: area.trim() || undefined,
          gps,
          callChannel: 'WEB_TEXT',
          isSimulated: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not create medical incident.');
        return;
      }
      onIncidentCreated(data.incident);
      onOpenIncident(data.incident.id);
    } catch {
      setErrorMsg('Failed to submit emergency intake to server.');
    } finally {
      setCreating(false);
    }
  };

  const handleSimulateVoiceCall = async () => {
    setTelephonyTesting(true);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/telephony/simulate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName: callerName.trim() || 'Demo Voice Caller',
          callerNumber: callerPhone.trim() || '+234-800-010-9999',
          areaHint: area.trim() || 'Lagos',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Simulated voice call failed.');
        return;
      }
      onIncidentCreated(data.incident);
      onOpenIncident(data.incident.id);
    } catch {
      setErrorMsg('Failed to trigger simulated voice call.');
    } finally {
      setTelephonyTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 shadow-2xs dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {embedded && onCloseEmbedded && (
            <button
              type="button"
              onClick={onCloseEmbedded}
              className="mt-0.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Incidents</span>
            </button>
          )}
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Medical Emergency Intake &amp; AI Triage</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Captures structured clinical symptoms, Lagos location clues, and transcripts without fabricating GPS or autonomous dispatch.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Intake assistant mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'auto' | 'simulated' | 'gemini')}
            className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="simulated">Simulated Demo Intake</option>
            <option value="auto" disabled={!geminiConfigured}>
              Gemini Live Intake {geminiConfigured ? '(Ready)' : '(Key Missing)'}
            </option>
          </select>

          <button
            type="button"
            disabled={telephonyTesting}
            onClick={handleSimulateVoiceCall}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{telephonyTesting ? 'Creating Call...' : 'Simulate Voice Call'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 px-4 py-3 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: AI Conversation & Voice Dictation */}
        <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3 shadow-2xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-[#26364B]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Intake Conversation</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_SCRIPTED_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => void sendMessage(p.text)}
                  disabled={sending}
                  className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#0B1220] dark:hover:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-[11px] font-medium text-slate-700 dark:text-slate-300"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 text-xs space-y-1 border ${
                  m.speaker === 'CALLER'
                    ? 'bg-blue-50/70 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 ml-6'
                    : 'bg-slate-50 border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] mr-6'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    {m.speaker === 'CALLER' ? (
                      <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Bot className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {m.speaker === 'CALLER' ? 'Caller' : 'Responda AI Intake'}
                  </span>
                  <span className="font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-800 dark:text-slate-100 leading-relaxed">{m.text}</p>
                {m.extractedTags && m.extractedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {m.extractedTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] font-mono text-[10px] text-slate-600 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#26364B]">
            {speechAvailable && (
              <button
                type="button"
                onClick={toggleVoiceDictation}
                title="Dictate caller message using browser microphone"
                aria-label={listening ? 'Stop voice dictation' : 'Start voice dictation'}
                className={`p-2 rounded-lg border transition-colors ${
                  listening
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-[#0B1220] dark:border-[#26364B] dark:text-slate-300'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Enter caller statement (symptoms, injuries, Lagos landmark)..."
              aria-label="Caller statement input"
              className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={sending || !inputText.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Processing...' : 'Send'}</span>
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Telephony &amp; Location Honesty</span>
            </div>
            <p>
              Local Simulation Voice Adapter active (real telephone integration not configured). Carrier network location is unconfigured; device GPS is captured only via explicit browser permission and stays UNVERIFIED until confirmed by an operator.
            </p>
          </div>
        </div>

        {/* Right: Structured Medical Extraction & Create Form */}
        <div className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-3.5 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#26364B]">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Structured Medical Incident Fields
            </h3>
            {activeIncident && (
              <button
                type="button"
                onClick={() => onOpenIncident(activeIncident.id)}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Open {activeIncident.id} →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Medical Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MedicalEmergencyCategory)}
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-2 text-slate-900 dark:text-slate-100"
              >
                {MEDICAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Suggested Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IncidentPriority)}
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-2.5 py-2 text-slate-900 dark:text-slate-100"
              >
                <option value="Unassessed">Unassessed (Insufficient assessment)</option>
                <option value="Critical">Critical</option>
                <option value="Urgent">Urgent</option>
                <option value="Standard">Standard</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Incident Summary
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Concise medical summary..."
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Caller Name
              </label>
              <input
                type="text"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Caller Phone
              </label>
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="+234..."
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Lagos Area / District
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g., Yaba, Ikeja, Surulere"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nearest Landmark
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g., UNILAG Main Gate"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Caller-Described Location
              </label>
              <input
                type="text"
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="Street name, junction, or caller description..."
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Chief Complaint
              </label>
              <input
                type="text"
                value={clinicalDetails.chiefComplaint || ''}
                onChange={(e) =>
                  setClinicalDetails((c) => ({ ...c, chiefComplaint: e.target.value }))
                }
                placeholder="e.g., Chest pain, trauma"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Patients Affected
              </label>
              <input
                type="number"
                min={0}
                value={peopleAffected}
                onChange={(e) => setPeopleAffected(e.target.value)}
                placeholder="Unknown"
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Consciousness
              </label>
              <input
                type="text"
                value={clinicalDetails.consciousness || ''}
                onChange={(e) =>
                  setClinicalDetails((c) => ({ ...c, consciousness: e.target.value }))
                }
                placeholder="Alert, drowsy, unresponsive..."
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Breathing Status
              </label>
              <input
                type="text"
                value={clinicalDetails.breathing || ''}
                onChange={(e) =>
                  setClinicalDetails((c) => ({ ...c, breathing: e.target.value }))
                }
                placeholder="Normal, laboured, absent..."
                className="w-full rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5">
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong className="text-slate-800 dark:text-slate-100">Device GPS:</strong>{' '}
                {gpsStatus}
              </div>
              <button
                type="button"
                onClick={handleRequestGps}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-[#172438] border border-slate-200 dark:border-[#26364B] text-[11px] font-semibold text-blue-700 dark:text-blue-300"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Capture Browser GPS</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-[#26364B] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Creates a <strong>New</strong> incident (unverified) for Operations Staff review.
            </span>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreateIncident}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{creating ? 'Creating Incident...' : 'Create Medical Incident'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
