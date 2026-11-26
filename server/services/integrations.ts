import type {
  IntegrationStatus,
  NotificationLog,
  RouteResult,
} from '../../src/types/responda.ts';
import { isGeminiConfigured } from './geminiService.ts';
import { voiceProvider } from './voiceProvider.ts';

export function getIntegrationStatuses(): IntegrationStatus[] {
  const geminiLive = isGeminiConfigured();
  const orsConfigured = Boolean(process.env.OPENROUTESERVICE_API_KEY?.trim());
  const carrierConfigured = Boolean(process.env.CARRIER_LOCATION_ENDPOINT?.trim());
  const voiceStatus = voiceProvider.getStatusSummary();

  return [
    {
      id: 'gemini',
      name: 'Gemini AI & Live Voice',
      category: 'AI Medical Intake & Triage',
      configured: geminiLive,
      state: geminiLive ? 'CONFIGURED_UNVERIFIED' : 'SIMULATED',
      statusLabel: geminiLive
        ? 'Configured (Run test to verify)'
        : 'Simulated for demonstration',
      details: geminiLive
        ? 'GEMINI_API_KEY detected on the server for structured medical intake and Gemini Live audio bridge.'
        : 'GEMINI_API_KEY is not set. Live Gemini intake is unavailable; Simulated Demo Intake mode remains active.',
      envVars: ['GEMINI_API_KEY'],
      setupSteps: [
        'Add GEMINI_API_KEY in AI Studio Settings > Secrets.',
        'Use Test Connection below to verify server-side access.',
      ],
    },
    {
      id: 'persistence',
      name: 'Atomic Server Persistence & Auth',
      category: 'Data Storage & Session Validation',
      configured: true,
      state: 'CONNECTED',
      statusLabel: 'Connected and working',
      details:
        'Server-side atomic JSON persistence (data/responda-db.json) with schema migration backups and HMAC-SHA256 Bearer session verification.',
      envVars: ['RESPONDA_SESSION_SECRET (optional override)'],
      setupSteps: [
        'Backups of legacy schemas are stored automatically in data/.',
        'Set RESPONDA_SESSION_SECRET in Secrets to persist sessions across restarts.',
      ],
    },
    {
      id: 'routing',
      name: 'OpenStreetMap & OpenRouteService',
      category: 'Maps & Driving Routing',
      configured: orsConfigured,
      state: orsConfigured ? 'CONFIGURED_UNVERIFIED' : 'SIMULATED',
      statusLabel: orsConfigured
        ? 'Configured (Run test to verify)'
        : 'Simulated for demonstration',
      details: orsConfigured
        ? 'OpenStreetMap Leaflet tiles active with OpenRouteService server-side driving routes.'
        : 'Interactive OpenStreetMap tiles are active. OPENROUTESERVICE_API_KEY is not set—simulated demo corridor routes are clearly labelled when active.',
      envVars: ['OPENROUTESERVICE_API_KEY'],
      setupSteps: [
        'Obtain an API key from openrouteservice.org.',
        'Set OPENROUTESERVICE_API_KEY in server environment secrets.',
      ],
    },
    {
      id: 'voice_telephony',
      name: 'Voice Provider Adapter (Provider-Independent)',
      category: 'Telephony & Voice Intake',
      configured: voiceStatus.realTelephonyConfigured,
      state: voiceStatus.realTelephonyConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      statusLabel: 'Not configured',
      details:
        'Using Local Simulation Voice Adapter. RESPONDA isolates AI intake and dispatch behind a replaceable VoiceProviderAdapter interface ready for future Nigerian telephony providers.',
      envVars: ['VoiceProviderAdapter (Local Simulation Active)'],
      setupSteps: [
        'Implement VoiceProviderAdapter for your chosen telephony partner.',
        'Bind incoming call webhooks and handover callbacks to /api/telephony/*.',
      ],
    },
    {
      id: 'carrier_location',
      name: 'Network / Carrier Location Provider',
      category: 'Authorised MNO AML / Cell Location',
      configured: carrierConfigured,
      state: carrierConfigured ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED',
      statusLabel: carrierConfigured
        ? 'Configured (Run test to verify)'
        : 'Not configured',
      details:
        'Carrier location integration not configured. Responda never fabricates cell-tower coordinates or infers GPS from a caller telephone number.',
      envVars: ['CARRIER_LOCATION_ENDPOINT'],
      setupSteps: [
        'Establish an authorised data-access agreement with an approved telecom operator or emergency location clearinghouse.',
        'Set CARRIER_LOCATION_ENDPOINT and mutual TLS credentials in server secrets.',
      ],
    },
  ];
}

export async function calculateDrivingRoute(params: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  allowSimulatedOverlay?: boolean;
}): Promise<RouteResult> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY?.trim();

  if (apiKey) {
    try {
      const res = await fetch(
        'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
        {
          method: 'POST',
          headers: {
            Authorization: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [params.fromLng, params.fromLat],
              [params.toLng, params.toLat],
            ],
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return {
          available: false,
          isSimulatedFallback: false,
          provider: 'OpenRouteService',
          message: `OpenRouteService returned HTTP ${res.status}: ${text.slice(0, 140)}`,
        };
      }

      const data = (await res.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number][] };
          properties?: { summary?: { distance?: number; duration?: number } };
        }>;
      };
      const feature = data.features?.[0];
      const coords = feature?.geometry?.coordinates?.map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
      const summary = feature?.properties?.summary;

      if (coords && coords.length > 0) {
        return {
          available: true,
          isSimulatedFallback: false,
          provider: 'OpenRouteService',
          distanceMeters: summary?.distance,
          durationSeconds: summary?.duration,
          coordinates: coords,
          message: 'Live route returned by OpenRouteService.',
        };
      }
    } catch (err) {
      return {
        available: false,
        isSimulatedFallback: false,
        provider: 'OpenRouteService',
        message: `Routing request failed: ${err instanceof Error ? err.message : 'Network error'}`,
      };
    }
  }

  if (params.allowSimulatedOverlay) {
    const mid1Lat = params.fromLat + (params.toLat - params.fromLat) * 0.33 + 0.0028;
    const mid1Lng = params.fromLng + (params.toLng - params.fromLng) * 0.33 - 0.0022;
    const mid2Lat = params.fromLat + (params.toLat - params.fromLat) * 0.68 + 0.0018;
    const mid2Lng = params.fromLng + (params.toLng - params.fromLng) * 0.68 - 0.0011;
    return {
      available: true,
      isSimulatedFallback: true,
      provider: 'Simulated Demo Route Corridor (No OpenRouteService Key)',
      coordinates: [
        [params.fromLat, params.fromLng],
        [mid1Lat, mid1Lng],
        [mid2Lat, mid2Lng],
        [params.toLat, params.toLng],
      ],
      message:
        'Simulated demo route shown (OPENROUTESERVICE_API_KEY not configured; real driving ETA withheld).',
    };
  }

  return {
    available: false,
    isSimulatedFallback: false,
    provider: 'OpenRouteService',
    message:
      'OpenRouteService API key is not configured. Map remains active; real driving distance and ETA are withheld rather than invented.',
  };
}

export async function sendDispatchNotification(params: {
  recipient: string;
  message: string;
  incidentId: string;
  unitId: string;
}): Promise<NotificationLog> {
  const now = new Date().toISOString();

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel: 'DISPATCH_ALERT',
    recipient: params.recipient,
    message: `[SIMULATED DISPATCH ALERT] ${params.message}`,
    incidentId: params.incidentId,
    unitId: params.unitId,
    status: 'DELIVERED_DEMO',
    providerResponse:
      'Simulated dispatch alert recorded in command log (no external carrier message sent).',
    timestamp: now,
    isSimulated: true,
  };
}

export interface CarrierLocationAdapterResult {
  configured: boolean;
  statusText: string;
  source: 'NETWORK_DERIVED';
  lat?: number;
  lng?: number;
  uncertaintyMeters?: number;
  timestamp: string;
}

export async function queryCarrierLocationAdapter(
  phoneNumber?: string
): Promise<CarrierLocationAdapterResult> {
  const endpoint = process.env.CARRIER_LOCATION_ENDPOINT?.trim();
  const now = new Date().toISOString();
  if (!endpoint) {
    return {
      configured: false,
      statusText: 'Carrier location integration not configured',
      source: 'NETWORK_DERIVED',
      timestamp: now,
    };
  }
  return {
    configured: true,
    statusText: `Authorised carrier lookup adapter ready for ${phoneNumber ? 'masked caller ID' : 'session'}`,
    source: 'NETWORK_DERIVED',
    timestamp: now,
  };
}
