import http from 'http';
import { type LiveServerMessage, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import { getGeminiClient } from './services/geminiService.ts';

const eventClients = new Set<WebSocket>();

export function broadcastEvent(event: string, payload: unknown): void {
  const msg = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  for (const ws of eventClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function attachWebSocketServers(server: http.Server): void {
  const eventsWss = new WebSocketServer({ noServer: true });
  const liveWss = new WebSocketServer({ noServer: true });

  eventsWss.on('connection', (ws) => {
    eventClients.add(ws);
    ws.send(
      JSON.stringify({
        event: 'connected',
        payload: { clients: eventClients.size },
        timestamp: new Date().toISOString(),
      })
    );
    ws.on('close', () => {
      eventClients.delete(ws);
    });
  });

  liveWss.on('connection', async (clientWs) => {
    const ai = getGeminiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          code: 'GEMINI_NOT_CONFIGURED',
          message:
            'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to use Gemini Live voice intake, or switch to Simulated Text Intake.',
        })
      );
      clientWs.close();
      return;
    }

    let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let closed = false;

    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction:
            'You are Responda automated emergency intake assistant in Lagos, Nigeria. Speak calmly, briefly, and clearly. Ask one focused question at a time: what happened, exact location or Lagos landmark, injuries or immediate danger, number of people affected, and caller name/callback. Never diagnose, promise an ambulance, or claim help has been dispatched—explain that a human operator is reviewing immediately.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (closed || clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                  })
                );
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  code: 'LIVE_SESSION_ERROR',
                  message: err?.message || 'Gemini Live connection error',
                })
              );
            }
          },
          onclose: () => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'session_closed' }));
            }
          },
        },
      });

      clientWs.send(JSON.stringify({ type: 'ready' }));
    } catch (err) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          code: 'LIVE_CONNECT_FAILED',
          message:
            err instanceof Error
              ? err.message
              : 'Could not initialize Gemini Live session.',
        })
      );
      clientWs.close();
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session || closed) return;
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          audio?: string;
          text?: string;
        };
        if (msg.type === 'stop') {
          closed = true;
          session.close();
          clientWs.close();
          return;
        }
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch {
        // Ignore malformed client audio packet
      }
    });

    clientWs.on('close', () => {
      closed = true;
      try {
        session?.close();
      } catch {
        // Ignore close error
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws/events') {
      eventsWss.handleUpgrade(request, socket, head, (ws) => {
        eventsWss.emit('connection', ws, request);
      });
    } else if (reqUrl.pathname === '/ws/live-intake') {
      liveWss.handleUpgrade(request, socket, head, (ws) => {
        liveWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });
}
