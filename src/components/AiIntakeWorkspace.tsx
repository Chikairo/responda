import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  LocateFixed,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  ShieldAlert,
  UserCheck,
  Volume2,
} from 'lucide-react';
import {
  IncidentRecord,
  IntakeExtraction,
  TranscriptMessage,
} from '../types/responda';
import { buildLocationFromIntake } from '../utils/intakeParser';
import { LocationSourceBadge, PriorityBadge, VerificationBadge } from './StatusBadges';

type IntakeCallState =
  | 'WAITING_FOR_CALLER'
  | 'LISTENING'
  | 'PROCESSING'
  | 'AI_RESPONDING'
  | 'WAITING_FOR_OPERATOR'
  | 'HUMAN_OPERATOR_CONNECTED'
  | 'CALL_ENDED';

interface AiIntakeWorkspaceProps {
  geminiConfigured: boolean;
  activeIncident: IncidentRecord | null;
  onIncidentCreated: (incident: IncidentRecord) => void;
  onOpenIncident: (id: string) => void;
}

function pcmFloatToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32Pcm(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(new ArrayBuffer(int16.length * 4));
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export function AiIntakeWorkspace({
  geminiConfigured,
  activeIncident,
  onIncidentCreated,
  onOpenIncident,
}: AiIntakeWorkspaceProps) {
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [intakeEngine, setIntakeEngine] = useState<'gemini' | 'simulated'>(
    geminiConfigured ? 'gemini' : 'simulated'
  );
  const [callState, setCallState] = useState<IntakeCallState>('WAITING_FOR_CALLER');
  const [messages, setMessages] = useState<TranscriptMessage[]>([
    {
      id: 'init-ai-1',
      speaker: 'AI',
      text: "Hello, this is Responda's automated emergency intake assistant. Please tell me calmly what happened and where in Lagos you are located.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [extraction, setExtraction] = useState<IntakeExtraction | null>(null);
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    accuracyMeters?: number;
    timestamp: string;
  } | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  // Voice & waveform refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceActiveRef = useRef<boolean>(false);

  const linkedIncident =
    activeIncident && createdId && activeIncident.id === createdId
      ? activeIncident
      : null;
  const operatorTookOver = Boolean(
    linkedIncident && (!linkedIncident.aiIntakeActive || linkedIncident.assignedOperator)
  );

  useEffect(() => {
    if (operatorTookOver) {
      setCallState('HUMAN_OPERATOR_CONNECTED');
      stopVoiceSession();
    }
  }, [operatorTookOver]);

  // Call duration timer only while active
  useEffect(() => {
    if (
      callState === 'WAITING_FOR_CALLER' ||
      callState === 'CALL_ENDED'
    ) {
      return;
    }
    const timer = setInterval(() => {
      setDurationSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [callState]);

  // Waveform canvas drawing (flat baseline when inactive; real amplitude only when mic is active)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = isDark ? '#0B1220' : '#F1F5F9';
      ctx.fillRect(0, 0, w, h);

      const bars = 40;
      const barW = Math.max(3, Math.floor((w - bars * 3) / bars));
      let freqData: Uint8Array<ArrayBuffer> | null = null;
      if (voiceActiveRef.current && analyserRef.current) {
        freqData = new Uint8Array(
          new ArrayBuffer(analyserRef.current.frequencyBinCount)
        );
        analyserRef.current.getByteFrequencyData(freqData);
      }

      for (let i = 0; i < bars; i++) {
        const amp = freqData ? freqData[i % freqData.length] / 255 : 0.04;
        const barH = Math.max(4, Math.round(amp * (h - 14)));
        const x = 6 + i * (barW + 3);
        const y = Math.round((h - barH) / 2);
        ctx.fillStyle = voiceActiveRef.current
          ? '#3B82F6'
          : isDark
          ? '#26364B'
          : '#CBD5E1';
        ctx.fillRect(x, y, barW, barH);
      }

      if (voiceActiveRef.current) {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    const observer = new MutationObserver(() => {
      if (!voiceActiveRef.current) draw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [callState, mode]);

  const stopVoiceSession = () => {
    voiceActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    try {
      wsRef.current?.send(JSON.stringify({ type: 'stop' }));
      wsRef.current?.close();
    } catch {
      // ignore
    }
    wsRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    inputCtxRef.current?.close().catch(() => undefined);
    inputCtxRef.current = null;
    outputCtxRef.current?.close().catch(() => undefined);
    outputCtxRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => {
    return () => stopVoiceSession();
  }, []);

  const requestBrowserGps = () => {
    setGpsNotice(null);
    if (!navigator.geolocation) {
      setGpsNotice(
        'Geolocation is not supported in this browser. Please describe the Lagos location manually.'
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracyMeters: Math.round(pos.coords.accuracy),
          timestamp: new Date().toISOString(),
        });
        setGpsNotice(
          `GPS coordinates captured (±${Math.round(pos.coords.accuracy)}m). Location remains unverified until an operator confirms.`
        );
      },
      () => {
        setGpsNotice(
          'Location permission denied or unavailable. You can describe the street, estate, or landmark manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const startVoiceSession = async () => {
    setErrorMsg(null);
    if (operatorTookOver) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextPlayTimeRef.current = outputCtx.currentTime;

      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws/live-intake`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as {
          type: string;
          text?: string;
          data?: string;
          message?: string;
        };

        if (msg.type === 'error') {
          setErrorMsg(msg.message || 'Voice intake error.');
          stopVoiceSession();
          setCallState('CALL_ENDED');
          return;
        }

        if (msg.type === 'ready') {
          voiceActiveRef.current = true;
          setCallState('LISTENING');
          const source = inputCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          source.connect(processor);
          processor.connect(inputCtx.destination);
          processor.onaudioprocess = (e) => {
            if (!voiceActiveRef.current || ws.readyState !== WebSocket.OPEN) return;
            const b64 = pcmFloatToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: b64 }));
          };
        }

        if (msg.type === 'input_transcript' && msg.text) {
          setMessages((prev) => [
            ...prev,
            {
              id: `v-in-${Date.now()}`,
              speaker: 'CALLER',
              text: msg.text!,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        if (msg.type === 'output_transcript' && msg.text) {
          setCallState('AI_RESPONDING');
          setMessages((prev) => [
            ...prev,
            {
              id: `v-out-${Date.now()}`,
              speaker: 'AI',
              text: msg.text!,
              timestamp: new Date().toISOString(),
            },
          ]);
        }

        if (msg.type === 'turn_complete') {
          if (voiceActiveRef.current) setCallState('LISTENING');
        }

        if (msg.type === 'audio' && msg.data && outputCtxRef.current) {
          const ctx = outputCtxRef.current;
          const samples = base64ToFloat32Pcm(msg.data);
          const buf = ctx.createBuffer(1, samples.length, 24000);
          buf.copyToChannel(samples, 0);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
          src.start(startAt);
          nextPlayTimeRef.current = startAt + buf.duration;
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket voice connection failed.');
        stopVoiceSession();
        setCallState('CALL_ENDED');
      };
    } catch {
      setErrorMsg(
        'Microphone permission denied or unavailable. Use Text Simulation Mode to continue intake.'
      );
      setCallState('WAITING_FOR_CALLER');
    }
  };

  const sendTextMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || submitting || operatorTookOver) return;

    setErrorMsg(null);
    const callerMsg: TranscriptMessage = {
      id: `c-${Date.now()}`,
      speaker: 'CALLER',
      text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, callerMsg];
    setMessages(nextHistory);
    setInputText('');
    setCallState('PROCESSING');
    setSubmitting(true);

    try {
      const res = await fetch('/api/intake/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          mode: intakeEngine,
          hasGps: Boolean(gps),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Intake request failed.');
        setCallState('WAITING_FOR_CALLER');
        setSubmitting(false);
        return;
      }

      const ext = data.extraction as IntakeExtraction;
      setExtraction(ext);
      setCallState(ext.readyForIncidentCreation ? 'WAITING_FOR_OPERATOR' : 'AI_RESPONDING');
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          speaker: 'AI',
          text: ext.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      setErrorMsg('Network error reaching intake server.');
      setCallState('WAITING_FOR_CALLER');
    } finally {
      setSubmitting(false);
    }
  };

  const createStructuredIncident = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: extraction?.category || 'Other urgent incident',
          priority: extraction?.suggestedPriority || 'HIGH',
          priorityReason:
            extraction?.priorityReason || 'Submitted from Responda intake workspace.',
          summary:
            extraction?.summary ||
            messages.filter((m) => m.speaker === 'CALLER').map((m) => m.text).join(' '),
          description:
            extraction?.description ||
            messages.filter((m) => m.speaker === 'CALLER').map((m) => m.text).join(' '),
          callerName: callerName || extraction?.callerName,
          callerPhone: callerPhone || extraction?.callerPhone,
          peopleAffected: extraction?.peopleAffected ?? null,
          immediateDanger: extraction?.immediateDanger ?? false,
          dangerDetails: extraction?.dangerDetails,
          missingInfoFlags: extraction?.missingInfoFlags || [],
          transcript: messages,
          locationDescription: extraction?.locationDescription,
          landmark: extraction?.landmark,
          area: extraction?.area,
          gps,
          callChannel: mode === 'voice' ? 'WEB_VOICE' : 'WEB_TEXT',
          isSimulated: intakeEngine === 'simulated',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to create incident.');
        return;
      }
      setCreatedId(data.incident.id);
      setCallState('WAITING_FOR_OPERATOR');
      onIncidentCreated(data.incident);
    } catch {
      setErrorMsg('Network error creating incident.');
    } finally {
      setSubmitting(false);
    }
  };

  const previewLocation = buildLocationFromIntake({
    callerDescription: extraction?.locationDescription,
    landmark: extraction?.landmark,
    area: extraction?.area,
    gps,
  });

  const callStateLabels: Record<IntakeCallState, { text: string; cls: string }> = {
    WAITING_FOR_CALLER: {
      text: 'Ready — Waiting for caller',
      cls: 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/15',
    },
    LISTENING: {
      text: 'Listening — Microphone active',
      cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15',
    },
    PROCESSING: {
      text: 'Processing caller details...',
      cls: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
    },
    AI_RESPONDING: {
      text: 'Intake updated — AI responding',
      cls: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
    },
    WAITING_FOR_OPERATOR: {
      text: 'Completed — Ready for operator takeover',
      cls: 'text-amber-800 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15',
    },
    HUMAN_OPERATOR_CONNECTED: {
      text: 'Completed — Human operator connected',
      cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/20',
    },
    CALL_ENDED: {
      text: 'Completed — Call ended',
      cls: 'text-slate-700 bg-slate-200 dark:text-slate-300 dark:bg-slate-600/25',
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            AI Emergency Intake
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calm, progressive intake extraction. AI never dispatches units or promises arrival times.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Engine Mode Selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] shadow-2xs dark:shadow-none">
            <button
              type="button"
              onClick={() => setIntakeEngine('gemini')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                intakeEngine === 'gemini'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Gemini AI {geminiConfigured ? '(Ready)' : '(Key Required)'}
            </button>
            <button
              type="button"
              onClick={() => setIntakeEngine('simulated')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                intakeEngine === 'simulated'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Simulated Demo Intake
            </button>
          </div>

          {/* Text vs Voice Mode */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] shadow-2xs dark:shadow-none">
            <button
              type="button"
              onClick={() => {
                stopVoiceSession();
                setMode('text');
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'text'
                  ? 'bg-slate-900 text-white dark:bg-[#172438] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Text Simulation
            </button>
            <button
              type="button"
              onClick={() => setMode('voice')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'voice'
                  ? 'bg-slate-900 text-white dark:bg-[#172438] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Voice (Gemini Live)
            </button>
          </div>
        </div>
      </div>

      {/* Plain-English 3-Step Intake Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="font-semibold text-blue-700 dark:text-blue-300">Step 1 · Gather Report</div>
          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
            Type or speak the emergency report below, including area or landmark.
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="font-semibold text-amber-800 dark:text-amber-300">Step 2 · Review Extracted Facts</div>
          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
            Check the detected category, priority, and any missing details on the right.
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-3 shadow-2xs dark:shadow-none">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">Step 3 · Send to Command Centre</div>
          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
            Click &ldquo;Create Incident&rdquo; so a human operator can verify and dispatch a unit.
          </p>
        </div>
      </div>

      {/* Human Takeover Banner */}
      {operatorTookOver && linkedIncident && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-emerald-900 dark:text-emerald-200">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold">
                Human Operator Connected ({linkedIncident.assignedOperator})
              </div>
              <div className="text-xs text-emerald-800 dark:text-emerald-200/80">
                Automated AI intake has been stopped for {linkedIncident.id}. Operator now controls the case.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenIncident(linkedIncident.id)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
          >
            Open Incident Workspace
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 p-3.5 text-xs text-red-800 dark:text-red-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          {intakeEngine === 'gemini' && (
            <button
              type="button"
              onClick={() => {
                setIntakeEngine('simulated');
                setErrorMsg(null);
              }}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-semibold whitespace-nowrap"
            >
              Use Simulated Mode
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: CONVERSATION / VOICE CONSOLE */}
        <div className="lg:col-span-7 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 flex flex-col gap-4 shadow-2xs dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#26364B]">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${callStateLabels[callState].cls}`}
              >
                {callStateLabels[callState].text}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {String(Math.floor(durationSec / 60)).padStart(2, '0')}:
                {String(durationSec % 60).padStart(2, '0')}
              </span>
            </div>

            <button
              type="button"
              onClick={requestBrowserGps}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-[#172438] dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#26364B] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
            >
              <LocateFixed className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Share Browser GPS (Optional)</span>
            </button>
          </div>

          {gpsNotice && (
            <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
              {gpsNotice}
            </div>
          )}

          {/* Voice Mode Controls */}
          {mode === 'voice' && (
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {callState === 'LISTENING' || callState === 'AI_RESPONDING' ? (
                    <button
                      type="button"
                      onClick={() => {
                        stopVoiceSession();
                        setCallState('CALL_ENDED');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>End Voice Intake</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={operatorTookOver}
                      onClick={startVoiceSession}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Start Microphone Intake</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {callState === 'LISTENING' ? (
                    <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <MicOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  )}
                  <span>16kHz PCM → Gemini Live</span>
                </div>
              </div>

              <canvas
                ref={canvasRef}
                width={520}
                height={56}
                className="w-full h-14 rounded-lg border border-slate-200 dark:border-[#26364B]"
              />

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Privacy notice: Microphone audio is streamed only while active to assist intake transcription. For telephone calls, seamless cellular transfer requires Africa&apos;s Talking SIP configuration.
              </p>
            </div>
          )}

          {/* Transcript Feed */}
          <div className="flex-1 space-y-3 min-h-[280px] max-h-[380px] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 text-xs border ${
                  m.speaker === 'CALLER'
                    ? 'bg-slate-50 border-slate-200 dark:bg-[#0B1220] dark:border-[#26364B] ml-10'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 mr-10'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {m.speaker === 'CALLER' ? 'Caller' : 'Responda AI Intake'}
                  </span>
                  <span className="font-mono">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-800 dark:text-slate-100 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>

          {/* Text Simulation Input */}
          <form onSubmit={sendTextMessage} className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-[#26364B]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="Caller name (optional)"
                aria-label="Caller name"
                className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <input
                type="text"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="Callback phone (optional)"
                aria-label="Callback phone"
                className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                disabled={submitting || operatorTookOver}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Describe what happened, Lagos location/landmark, injuries, people affected..."
                aria-label="Emergency report message"
                className="flex-1 rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={submitting || operatorTookOver || !inputText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Analysing...' : 'Send'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: LIVE STRUCTURED EXTRACTION & INCIDENT CREATION */}
        <div className="lg:col-span-5 rounded-xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#26364B] p-4 space-y-4 shadow-2xs dark:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#26364B] pb-3">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              Structured Incident Extraction
            </h2>
            {extraction && <PriorityBadge priority={extraction.suggestedPriority} />}
          </div>

          {!extraction ? (
            <div className="rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-5 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Awaiting caller report details
              </div>
              <p>
                As the caller responds, Responda extracts category, priority suggestion, people affected, danger indicators, missing fields, and location source without inventing unconfirmed facts.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Detected Category</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {extraction.category}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-2.5">
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">People Affected</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {extraction.peopleAffected !== null
                      ? extraction.peopleAffected
                      : 'Unknown'}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-1">
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">Structured Summary</div>
                <div className="text-slate-900 dark:text-slate-100">{extraction.summary}</div>
                <div className="text-slate-500 dark:text-slate-400 pt-1">
                  Priority Rationale: {extraction.priorityReason}
                </div>
              </div>

              {extraction.immediateDanger && (
                <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/35 p-2.5 text-red-800 dark:text-red-200 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>Immediate danger flagged — prompt human review requested.</span>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#26364B] p-3 space-y-2">
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">Location Assessment</div>
                <div className="flex flex-wrap gap-1.5">
                  <LocationSourceBadge source={previewLocation.source} />
                  <VerificationBadge status={previewLocation.verificationStatus} />
                </div>
                <div className="text-slate-800 dark:text-slate-200">{previewLocation.description}</div>
              </div>

              {extraction.missingInfoFlags.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/35 p-3 space-y-1 text-amber-900 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                    <span>Missing Information</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {extraction.missingInfoFlags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-[#26364B] space-y-2">
            {createdId ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/35 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    Incident <strong className="font-mono">{createdId}</strong> created and queued on Command Centre.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenIncident(createdId)}
                  className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  Open {createdId} in Operator Workspace
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={
                  submitting ||
                  messages.filter((m) => m.speaker === 'CALLER').length === 0
                }
                onClick={createStructuredIncident}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                Create Incident &amp; Alert Command Centre
              </button>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Creates an AWAITING_OPERATOR record. Human approval is required before dispatching any unit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
