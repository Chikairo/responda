import {
  IntegrationStatus,
  NotificationLog,
  RouteResult,
} from '../../src/types/responda';
import { isGeminiConfigured } from './geminiService';

export function getIntegrationStatuses(): IntegrationStatus[] {
  const geminiLive = isGeminiConfigured();
  const orsConfigured = Boolean(process.env.OPENROUTESERVICE_API_KEY?.trim());
  const firebaseConfigured = Boolean(process.env.FIREBASE_PROJECT_ID?.trim());
  const atConfigured = Boolean(
    process.env.AFRICAS_TALKING_API_KEY?.trim() &&
      process.env.AFRICAS_TALKING_USERNAME?.trim()
  );
  const termiiConfigured = Boolean(process.env.TERMII_API_KEY?.trim());
  const carrierConfigured = Boolean(process.env.CARRIER_LOCATION_ENDPOINT?.trim());

  return [
    {
      id: 'gemini',
      name: 'Gemini AI & Live Voice',
      category: 'AI Intake & Structured Triage',
      configured: geminiLive,
      mode: geminiLive ? 'LIVE' : 'DEMO_FALLBACK',
      statusLabel: geminiLive ? 'Connected (gemini-4-hydrogen / gemini-3.8-live)' : 'Demo Fallback Active',
      details: geminiLive
        ? 'Server-side @google/genai client configured for structured intake extraction and Gemini Live audio bridge.'
        : 'GEMINI_API_KEY is not set. Live Gemini calls return configuration guidance; Simulated Demo Intake mode remains available.',
      envVars: ['GEMINI_API_KEY'],
      setupSteps: [
        'Add GEMINI_API_KEY in AI Studio Settings > Secrets.',
        'Restart the server to enable live structured intake and Gemini Live microphone voice sessions.',
      ],
    },
    {
      id: 'firebase',
      name: 'Firebase Auth & Cloud Firestore',
      category: 'Persistence & Identity',
      configured: firebaseConfigured,
      mode: firebaseConfigured ? 'LIVE' : 'DEMO_FALLBACK',
      statusLabel: firebaseConfigured
        ? `Configured (${process.env.FIREBASE_PROJECT_ID})`
        : 'Local Persistent Store (Demo)',
      details: firebaseConfigured
        ? 'Firebase project identifier configured.'
        : 'Using local server-side atomic JSON persistence (data/responda-db.json) and demo role accounts for competition testing.',
      envVars: ['FIREBASE_PROJECT_ID'],
      setupSteps: [
        'Provision a Firebase project with Authentication and Firestore enabled.',
        'Set FIREBASE_PROJECT_ID and service credentials in environment secrets.',
      ],
    },
    {
      id: 'routing',
      name: 'OpenStreetMap & OpenRouteService',
      category: 'Maps & Driving Routing',
      configured: orsConfigured,
      mode: orsConfigured ? 'LIVE' : 'DEMO_FALLBACK',
      statusLabel: orsConfigured
        ? 'Live Routing Active'
        : 'Map Active · Routing Key Not Configured',
      details: orsConfigured
        ? 'OpenStreetMap Leaflet tiles active with OpenRouteService server-side driving routes.'
        : 'Interactive OpenStreetMap tiles are active. OpenRouteService API key is not configured—real driving ETAs are disabled unless simulated demo overlay is explicitly selected.',
      envVars: ['OPENROUTESERVICE_API_KEY'],
      setupSteps: [
        'Obtain a free API key from openrouteservice.org.',
        'Set OPENROUTESERVICE_API_KEY in server environment secrets.',
      ],
    },
    {
      id: 'africas_talking',
      name: "Africa's Talking Voice API",
      category: 'Telephony & SIP Call Intake',
      configured: atConfigured,
      mode: atConfigured ? 'LIVE' : 'NOT_CONFIGURED',
      statusLabel: atConfigured
        ? 'Webhook & Credentials Ready'
        : 'Not Configured (Simulated Call Mode)',
      details:
        'Webhook endpoint /api/integrations/africas-talking/voice is active for call-session logging. Live cellular AI-to-human call bridging requires provider SIP/transfer setup; public emergency numbers are not connected.',
      envVars: ['AFRICAS_TALKING_API_KEY', 'AFRICAS_TALKING_USERNAME'],
      setupSteps: [
        'Create an Africa\'s Talking voice application in sandbox or production.',
        'Point the voice callback URL to <APP_URL>/api/integrations/africas-talking/voice.',
        'Set AFRICAS_TALKING_API_KEY and AFRICAS_TALKING_USERNAME in server secrets.',
      ],
    },
    {
      id: 'termii',
      name: 'Termii SMS Notifications',
      category: 'Unit & Caller SMS Alerts',
      configured: termiiConfigured,
      mode: termiiConfigured ? 'LIVE' : 'DEMO_FALLBACK',
      statusLabel: termiiConfigured
        ? 'Live SMS Gateway Ready'
        : 'Demo Notification Logs Only',
      details: termiiConfigured
        ? 'Server-side Termii SMS adapter sends unit alerts only after explicit human dispatcher approval.'
        : 'TERMII_API_KEY is not configured. Dispatch alerts are recorded as clearly labelled [SIMULATED DEMO] logs.',
      envVars: ['TERMII_API_KEY', 'TERMII_SENDER_ID'],
      setupSteps: [
        'Register a Termii account and approve a Sender ID.',
        'Set TERMII_API_KEY and TERMII_SENDER_ID in server secrets.',
      ],
    },
    {
      id: 'carrier_location',
      name: 'Network / Carrier Location Provider',
      category: 'Authorised MNO AML / Cell Location',
      configured: carrierConfigured,
      mode: carrierConfigured ? 'LIVE' : 'NOT_CONFIGURED',
      statusLabel: carrierConfigured
        ? 'Authorised Endpoint Configured'
        : 'Carrier location integration not configured',
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

  // Never invent distances or travel times when no routing provider is configured.
  // Only return a visual straight/corridor line if caller explicitly requested a simulated demo overlay.
  if (params.allowSimulatedOverlay) {
    const midLat = (params.fromLat + params.toLat) / 2 + 0.004;
    const midLng = (params.fromLng + params.toLng) / 2 - 0.003;
    return {
      available: true,
      isSimulatedFallback: true,
      provider: 'Simulated Demo Overlay (No OpenRouteService Key)',
      coordinates: [
        [params.fromLat, params.fromLng],
        [midLat, midLng],
        [params.toLat, params.toLng],
      ],
      message:
        'Simulated demo corridor overlay shown. Configure OPENROUTESERVICE_API_KEY for real road routing, distance, and ETA.',
    };
  }

  return {
    available: false,
    isSimulatedFallback: false,
    provider: 'OpenRouteService',
    message:
      'OpenRouteService API key is not configured. Map remains active; travel distance and ETA are withheld rather than invented.',
  };
}

export async function sendDispatchNotification(params: {
  recipient: string;
  message: string;
  incidentId: string;
  unitId: string;
}): Promise<NotificationLog> {
  const apiKey = process.env.TERMII_API_KEY?.trim();
  const senderId = process.env.TERMII_SENDER_ID?.trim() || 'Responda';
  const now = new Date().toISOString();

  if (apiKey && params.recipient.startsWith('+')) {
    try {
      const res = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: params.recipient.replace(/[^0-9]/g, ''),
          from: senderId,
          sms: params.message,
          type: 'plain',
          channel: 'generic',
          api_key: apiKey,
        }),
      });
      const bodyText = await res.text();
      return {
        id: `notif-${Date.now()}`,
        channel: 'TERMII_SMS',
        recipient: params.recipient,
        message: params.message,
        incidentId: params.incidentId,
        unitId: params.unitId,
        status: res.ok ? 'SENT_LIVE' : 'FAILED',
        providerResponse: `Termii HTTP ${res.status}: ${bodyText.slice(0, 160)}`,
        timestamp: now,
        isSimulated: false,
      };
    } catch (err) {
      return {
        id: `notif-${Date.now()}`,
        channel: 'TERMII_SMS',
        recipient: params.recipient,
        message: params.message,
        incidentId: params.incidentId,
        unitId: params.unitId,
        status: 'FAILED',
        providerResponse: err instanceof Error ? err.message : 'Termii request error',
        timestamp: now,
        isSimulated: false,
      };
    }
  }

  return {
    id: `notif-${Date.now()}`,
    channel: 'DEMO_SMS',
    recipient: params.recipient,
    message: `[SIMULATED DEMO] ${params.message}`,
    incidentId: params.incidentId,
    unitId: params.unitId,
    status: 'DELIVERED_DEMO',
    providerResponse: 'Simulated dispatch notification logged (Termii live SMS not invoked).',
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
