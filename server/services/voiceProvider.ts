/**
 * Provider-Independent Voice & Telephony Adapter Architecture
 *
 * Isolates RESPONDA's AI intake, transcript intelligence, incident creation,
 * and dispatch workflows from any specific telephony vendor.
 *
 * Today: LocalSimulationVoiceAdapter handles simulated emergency voice sessions.
 * Future: Swap in VoicebipAdapter or PressOneSignalsAdapter implementing
 * VoiceProviderAdapter without modifying core incident or dispatch logic.
 */

export type VoiceCallSessionStatus =
  | 'RINGING'
  | 'CONNECTED_AI'
  | 'HUMAN_HANDOVER'
  | 'COMPLETED';

export interface IncomingVoiceCallEvent {
  sessionId: string;
  callerNumber: string;
  callerName?: string;
  areaHint?: string;
  receivedAt: string;
  isSimulated: boolean;
}

export interface VoiceCallSession {
  sessionId: string;
  providerId: string;
  callerNumber: string;
  status: VoiceCallSessionStatus;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  operatorName?: string;
  recordingReference?: string;
  isSimulated: boolean;
}

export interface FutureVoiceProviderInfo {
  name: string;
  category: string;
  status: 'PLANNED_ADAPTER';
  notes: string;
}

export interface VoiceProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly isRealTelephonyConfigured: boolean;
  readonly statusLabel: string;
  readonly supportedFutureProviders: FutureVoiceProviderInfo[];

  onIncomingCall(event: IncomingVoiceCallEvent): Promise<VoiceCallSession>;
  answerCall(sessionId: string): Promise<VoiceCallSession | null>;
  updateCallStatus(
    sessionId: string,
    status: VoiceCallSessionStatus
  ): Promise<VoiceCallSession | null>;
  streamAudio(
    sessionId: string,
    payload: { speaker: 'CALLER' | 'AI' | 'OPERATOR'; durationMs: number }
  ): Promise<{ accepted: boolean; mode: 'SIMULATED' | 'LIVE_STREAM' }>;
  transcribeSpeech(
    sessionId: string,
    spokenText: string
  ): Promise<{ text: string; isSimulated: boolean; timestamp: string }>;
  synthesizeSpeech(
    sessionId: string,
    text: string,
    speaker: 'AI' | 'OPERATOR'
  ): Promise<{ queued: boolean; engine: string }>;
  recordCall(
    sessionId: string
  ): Promise<{ recorded: boolean; reference: string; note: string }>;
  handoverToHuman(
    sessionId: string,
    operatorName: string
  ): Promise<VoiceCallSession | null>;
  completeCall(sessionId: string): Promise<VoiceCallSession | null>;
  getStatusSummary(): {
    adapterId: string;
    adapterName: string;
    realTelephonyConfigured: boolean;
    statusMessage: string;
    supportedFutureProviders: FutureVoiceProviderInfo[];
    activeSessions: number;
  };
}

export class LocalSimulationVoiceAdapter implements VoiceProviderAdapter {
  readonly id = 'local_simulation_voice';
  readonly name = 'Local Simulation Voice Adapter';
  readonly isRealTelephonyConfigured = false;
  readonly statusLabel = 'Real telephone integration not configured.';
  readonly supportedFutureProviders: FutureVoiceProviderInfo[] = [
    {
      name: 'Voicebip',
      category: 'Programmable Voice / SIP Trunking',
      status: 'PLANNED_ADAPTER',
      notes: 'Connect via VoiceProviderAdapter without changing intake or dispatch logic.',
    },
    {
      name: 'PressOne Signals',
      category: 'Nigerian Business Cloud Telephony',
      status: 'PLANNED_ADAPTER',
      notes: 'Supports Nigerian DID routing, call events, and operator transfer webhooks.',
    },
  ];

  private sessions = new Map<string, VoiceCallSession>();

  async onIncomingCall(event: IncomingVoiceCallEvent): Promise<VoiceCallSession> {
    const session: VoiceCallSession = {
      sessionId: event.sessionId,
      providerId: this.id,
      callerNumber: event.callerNumber,
      status: 'RINGING',
      startedAt: event.receivedAt,
      recordingReference: `sim-transcript://${event.sessionId}`,
      isSimulated: true,
    };
    this.sessions.set(event.sessionId, session);
    return session;
  }

  async answerCall(sessionId: string): Promise<VoiceCallSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return null;
    existing.status = 'CONNECTED_AI';
    existing.answeredAt = new Date().toISOString();
    return existing;
  }

  async updateCallStatus(
    sessionId: string,
    status: VoiceCallSessionStatus
  ): Promise<VoiceCallSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return null;
    existing.status = status;
    return existing;
  }

  async streamAudio(
    _sessionId: string,
    _payload: { speaker: 'CALLER' | 'AI' | 'OPERATOR'; durationMs: number }
  ): Promise<{ accepted: boolean; mode: 'SIMULATED' | 'LIVE_STREAM' }> {
    return { accepted: true, mode: 'SIMULATED' };
  }

  async transcribeSpeech(
    _sessionId: string,
    spokenText: string
  ): Promise<{ text: string; isSimulated: boolean; timestamp: string }> {
    return {
      text: spokenText,
      isSimulated: true,
      timestamp: new Date().toISOString(),
    };
  }

  async synthesizeSpeech(
    _sessionId: string,
    _text: string,
    _speaker: 'AI' | 'OPERATOR'
  ): Promise<{ queued: boolean; engine: string }> {
    return {
      queued: true,
      engine: 'Browser Web Speech API (Generated Demo Speech)',
    };
  }

  async recordCall(
    sessionId: string
  ): Promise<{ recorded: boolean; reference: string; note: string }> {
    return {
      recorded: true,
      reference: `sim-transcript://${sessionId}`,
      note: 'Transcript and demo speech timeline preserved (no real PSTN audio recording attached).',
    };
  }

  async handoverToHuman(
    sessionId: string,
    operatorName: string
  ): Promise<VoiceCallSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return null;
    existing.status = 'HUMAN_HANDOVER';
    existing.operatorName = operatorName;
    return existing;
  }

  async completeCall(sessionId: string): Promise<VoiceCallSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) return null;
    existing.status = 'COMPLETED';
    existing.endedAt = new Date().toISOString();
    return existing;
  }

  getStatusSummary() {
    return {
      adapterId: this.id,
      adapterName: this.name,
      realTelephonyConfigured: this.isRealTelephonyConfigured,
      statusMessage: this.statusLabel,
      supportedFutureProviders: this.supportedFutureProviders,
      activeSessions: Array.from(this.sessions.values()).filter(
        (s) => s.status !== 'COMPLETED'
      ).length,
    };
  }
}

export const voiceProvider: VoiceProviderAdapter = new LocalSimulationVoiceAdapter();
