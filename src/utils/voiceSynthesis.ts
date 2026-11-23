/**
 * Browser Web Speech API wrapper for RESPONDA Live Simulation.
 *
 * Uses generated demo speech via window.speechSynthesis with distinct
 * voice characteristics per speaker (CALLER vs AI vs OPERATOR), plus clean
 * fallback support when speechSynthesis is unavailable or muted.
 */

export type DemoSpeakerRole = 'CALLER' | 'AI' | 'OPERATOR';

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}

function pickVoiceForSpeaker(
  speaker: DemoSpeakerRole,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const ngVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith('en-ng')
  );
  const enVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith('en')
  );
  const pool = ngVoices.length > 0 ? ngVoices : enVoices.length > 0 ? enVoices : voices;

  if (speaker === 'CALLER') {
    return (
      pool.find((v) => /female|samantha|victoria|zira|karen|libby|sonia/i.test(v.name)) ||
      pool[0] ||
      null
    );
  }
  if (speaker === 'AI') {
    return (
      pool.find((v) => /google|natural|aria|jenny|daniel|oliver/i.test(v.name)) ||
      pool[Math.min(1, pool.length - 1)] ||
      pool[0] ||
      null
    );
  }
  return (
    pool.find((v) => /male|david|george|ryan|guy/i.test(v.name)) ||
    pool[pool.length - 1] ||
    null
  );
}

export interface SpeakTurnOptions {
  speaker: DemoSpeakerRole;
  text: string;
  enabled: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export function stopAllSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore browser speech errors
    }
  }
}

export function pauseSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
    } catch {
      // ignore
    }
  }
}

export function resumeSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  }
}

export function speakSimulationTurn(options: SpeakTurnOptions): () => void {
  const { speaker, text, enabled, onStart, onEnd } = options;

  if (!enabled || !isSpeechSynthesisSupported()) {
    onStart?.();
    const fallbackMs = Math.min(4500, Math.max(1800, text.length * 26));
    const timer = window.setTimeout(() => {
      onEnd?.();
    }, fallbackMs);
    return () => {
      window.clearTimeout(timer);
    };
  }

  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    onEnd?.();
  };

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const chosen = pickVoiceForSpeaker(speaker, voices);
    if (chosen) utter.voice = chosen;

    if (speaker === 'CALLER') {
      utter.rate = 1.08;
      utter.pitch = 1.1;
    } else if (speaker === 'AI') {
      utter.rate = 0.96;
      utter.pitch = 0.98;
    } else {
      utter.rate = 1.0;
      utter.pitch = 0.9;
    }

    utter.onstart = () => {
      onStart?.();
    };
    utter.onend = () => {
      finishOnce();
    };
    utter.onerror = () => {
      finishOnce();
    };

    onStart?.();
    window.speechSynthesis.speak(utter);

    // Safety guard in case browser speechSynthesis stalls without firing onend
    const maxTimeoutMs = Math.min(11000, Math.max(3500, text.length * 75));
    const safetyTimer = window.setTimeout(finishOnce, maxTimeoutMs);

    return () => {
      window.clearTimeout(safetyTimer);
      finished = true;
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  } catch {
    onStart?.();
    const fallbackTimer = window.setTimeout(finishOnce, 2200);
    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }
}
