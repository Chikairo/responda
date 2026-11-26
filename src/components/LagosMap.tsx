import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
} from 'lucide-react';
import type {
  IncidentRecord,
  ResponseUnit,
  RouteResult,
} from '../types/responda';
import { formatDistanceKm, formatDurationMinutes, formatRelativeTime } from '../utils/incidentLogic';
import {
  IncidentStatusBadge,
  LocationFreshnessBadge,
  LocationSourceBadge,
  PriorityBadge,
  UnitAvailabilityBadge,
  VerificationBadge,
} from './StatusBadges';

interface LagosMapProps {
  incidents: IncidentRecord[];
  units: ResponseUnit[];
  selectedIncidentId?: string | null;
  selectedUnitId?: string | null;
  route?: RouteResult | null;
  onSelectIncident?: (id: string) => void;
  onSelectUnit?: (id: string) => void;
  onOpenIncidentWorkspace?: (id: string) => void;
  editablePin?: boolean;
  onPinMove?: (lat: number, lng: number) => void;
  heightClass?: string;
  showLegend?: boolean;
  showInfoCard?: boolean;
  radarCoords?: [number, number] | null;
  focusBoundsPoints?: [number, number][] | null;
  hospitalMarker?: { name: string; area?: string; lat: number; lng: number } | null;
  hospitalRouteCoordinates?: [number, number][] | null;
}

const LAGOS_CENTER: [number, number] = [6.505, 3.392];

function getIncidentColor(priority: IncidentRecord['priority']): string {
  switch (priority) {
    case 'Critical':
      return '#EF4444';
    case 'Urgent':
      return '#F59E0B';
    case 'Standard':
      return '#38BDF8';
    case 'Unassessed':
    default:
      return '#A855F7';
  }
}

function getUnitColor(unit: ResponseUnit): string {
  if (unit.availability === 'Available') return '#10B981';
  if (unit.availability === 'Unavailable') return '#64748B';
  if (unit.availability === 'Transporting') return '#38BDF8';
  return '#1EB6A3';
}

function createIncidentIcon(
  incident: IncidentRecord,
  selected: boolean,
  isDarkTiles: boolean
): L.DivIcon {
  const color = getIncidentColor(incident.priority);
  const ringBorder = isDarkTiles ? '#F8FAFC' : '#0F172A';
  const ring = selected
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${ringBorder};background:${color}22;"></span>`
    : '';
  const symbol = incident.priority === 'Unassessed' ? '?' : '!';
  return L.divIcon({
    className: 'responda-incident-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      ${ring}
      <div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid ${
      isDarkTiles ? '#0B1519' : '#FFFFFF'
    };color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,0.35);">${symbol}</div>
    </div>`,
  });
}

function createUnitIcon(
  unit: ResponseUnit,
  selected: boolean,
  isDarkTiles: boolean
): L.DivIcon {
  const color = getUnitColor(unit);
  const shortTag = unit.unitType === 'Ambulance' ? 'A' : 'R';
  const bg = isDarkTiles ? '#101E24' : '#FFFFFF';
  const selectedBorder = isDarkTiles ? '#F8FAFC' : '#0F172A';

  return L.divIcon({
    className: 'responda-unit-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:24px;height:24px;border-radius:7px;background:${bg};border:2px solid ${
      selected ? selectedBorder : color
    };color:${color};font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,0.3);">
      ${shortTag}
    </div>`,
  });
}

function createHospitalIcon(isDarkTiles: boolean): L.DivIcon {
  const bg = isDarkTiles ? '#101E24' : '#ECFDF5';
  const border = '#10B981';
  const text = isDarkTiles ? '#34D399' : '#047857';
  return L.divIcon({
    className: 'responda-hospital-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:26px;height:26px;border-radius:8px;background:${bg};border:2px solid ${border};color:${text};font-family:'JetBrains Mono',monospace;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(15,23,42,0.35);">
      H
    </div>`,
  });
}

function isDarkModeActive(): boolean {
  if (typeof document === 'undefined') return true;
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light') return false;
  if (attr === 'dark') return true;
  return document.documentElement.classList.contains('dark');
}

export function LagosMap({
  incidents,
  units,
  selectedIncidentId,
  selectedUnitId,
  route,
  onSelectIncident,
  onSelectUnit,
  onOpenIncidentWorkspace,
  editablePin = false,
  onPinMove,
  heightClass = 'h-[480px]',
  showLegend = true,
  showInfoCard = true,
  radarCoords = null,
  focusBoundsPoints = null,
  hospitalMarker = null,
  hospitalRouteCoordinates = null,
}: LagosMapProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<'dark' | 'osm'>(() =>
    isDarkModeActive() ? 'dark' : 'osm'
  );
  const [tileError, setTileError] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(false);

  const onPinMoveRef = useRef(onPinMove);
  onPinMoveRef.current = onPinMove;
  const editablePinRef = useRef(editablePin);
  editablePinRef.current = editablePin;
  const lastBoundsCountRef = useRef<string>('');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncWithTheme = () => {
      setTileMode(isDarkModeActive() ? 'dark' : 'osm');
    };
    syncWithTheme();
    const observer = new MutationObserver(syncWithTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center: LAGOS_CENTER,
      zoom: 12,
      zoomControl: false,
      zoomAnimation: false,
      fadeAnimation: false,
      attributionControl: true,
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (editablePinRef.current && onPinMoveRef.current) {
        onPinMoveRef.current(
          Number(e.latlng.lat.toFixed(5)),
          Number(e.latlng.lng.toFixed(5))
        );
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapElRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    const layer = L.tileLayer(url, {
      attribution,
      maxZoom: 19,
    });

    layer.on('tileerror', () => {
      setTileError(true);
    });
    layer.on('load', () => {
      setTileError(false);
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileMode]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (route?.available && route.coordinates && route.coordinates.length > 1) {
      L.polyline(route.coordinates, {
        color: route.isSimulatedFallback ? '#1EB6A3' : '#2563EB',
        weight: 4,
        opacity: 0.9,
        dashArray: route.isSimulatedFallback ? '8 8' : undefined,
      }).addTo(group);
    }

    if (hospitalRouteCoordinates && hospitalRouteCoordinates.length > 1) {
      L.polyline(hospitalRouteCoordinates, {
        color: '#10B981',
        weight: 3,
        opacity: 0.85,
        dashArray: '6 6',
      }).addTo(group);
    }

    const isDarkTiles = tileMode === 'dark';

    if (hospitalMarker && Number.isFinite(hospitalMarker.lat) && Number.isFinite(hospitalMarker.lng)) {
      const hMarker = L.marker([hospitalMarker.lat, hospitalMarker.lng], {
        icon: createHospitalIcon(isDarkTiles),
        zIndexOffset: 200,
      });
      hMarker.bindTooltip(
        `${hospitalMarker.name} (Confirmed Receiving Hospital)`,
        { direction: 'top', offset: [0, -12] }
      );
      hMarker.addTo(group);
    }

    for (const unit of units) {
      if (unit.registrationStatus === 'Inactive' || unit.legacyOutOfScope) continue;
      const marker = L.marker([unit.lat, unit.lng], {
        icon: createUnitIcon(unit, unit.id === selectedUnitId, isDarkTiles),
      });
      marker.bindTooltip(
        `${unit.callsign} (${unit.availability} · ${unit.locationFreshness})`,
        {
          direction: 'top',
          offset: [0, -10],
        }
      );
      marker.on('click', () => {
        onSelectUnit?.(unit.id);
      });
      marker.addTo(group);
    }

    for (const inc of incidents) {
      if (typeof inc.location.lat !== 'number' || typeof inc.location.lng !== 'number') {
        continue;
      }
      const isSelected = inc.id === selectedIncidentId;
      const marker = L.marker([inc.location.lat, inc.location.lng], {
        icon: createIncidentIcon(inc, isSelected, isDarkTiles),
        zIndexOffset: isSelected ? 500 : 100,
      });
      marker.bindTooltip(`${inc.id} · ${inc.category} (${inc.priority})`, {
        direction: 'top',
        offset: [0, -12],
      });
      marker.on('click', () => {
        onSelectIncident?.(inc.id);
      });
      marker.addTo(group);
    }

    if (radarCoords && Number.isFinite(radarCoords[0]) && Number.isFinite(radarCoords[1])) {
      const radarIcon = L.divIcon({
        className: 'responda-radar-overlay',
        iconSize: [110, 110],
        iconAnchor: [55, 55],
        html: `<div style="position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
          <span class="responda-radar-ring" style="position:absolute;width:84px;height:84px;border-radius:9999px;border:2px solid #2563EB;background:rgba(37,99,235,0.12);"></span>
          <span class="responda-radar-ring-delayed" style="position:absolute;width:84px;height:84px;border-radius:9999px;border:1.5px solid #1EB6A3;background:rgba(30,182,163,0.08);"></span>
        </div>`,
      });
      L.marker(radarCoords, {
        icon: radarIcon,
        interactive: false,
        zIndexOffset: 50,
      }).addTo(group);
    }
  }, [
    incidents,
    units,
    selectedIncidentId,
    selectedUnitId,
    route,
    hospitalMarker,
    hospitalRouteCoordinates,
    tileMode,
    radarCoords,
    onSelectIncident,
    onSelectUnit,
  ]);

  const focusBoundsKey = focusBoundsPoints
    ? focusBoundsPoints.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|')
    : '';

  useEffect(() => {
    setCardDismissed(false);
    const map = mapRef.current;
    if (!map) return;

    if (focusBoundsPoints && focusBoundsPoints.length >= 2) {
      if (lastBoundsCountRef.current !== focusBoundsKey) {
        const valid = focusBoundsPoints.filter(
          (pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1])
        );
        if (valid.length >= 2) {
          lastBoundsCountRef.current = focusBoundsKey;
          map.fitBounds(L.latLngBounds(valid), {
            padding: [48, 48],
            maxZoom: 15,
            animate: false,
          });
        }
      }
      return;
    }

    lastBoundsCountRef.current = '';

    if (radarCoords && Number.isFinite(radarCoords[0]) && Number.isFinite(radarCoords[1])) {
      map.setView(radarCoords, 15, { animate: false });
      return;
    }

    if (!selectedIncidentId) return;
    const target = incidents.find((i) => i.id === selectedIncidentId);
    if (target?.location.lat && target.location.lng) {
      map.setView([target.location.lat, target.location.lng], Math.max(map.getZoom(), 14), {
        animate: false,
      });
    }
  }, [selectedIncidentId, incidents, focusBoundsKey, focusBoundsPoints, radarCoords]);

  useEffect(() => {
    if (selectedUnitId) setCardDismissed(false);
  }, [selectedUnitId]);

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId) || null;
  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;
  const assignedUnitForSelected = selectedIncident?.assignedUnitId
    ? units.find((u) => u.id === selectedIncident.assignedUnitId)
    : null;

  return (
    <div
      data-testid="lagos-map-container"
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-canvas)]`}
    >
      <div
        ref={mapElRef}
        className={`responda-leaflet-container ${
          tileMode === 'dark' ? 'responda-dark-tiles' : ''
        } w-full h-full z-0`}
      />

      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in map"
          className="w-8 h-8 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] flex items-center justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out map"
          className="w-8 h-8 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] flex items-center justify-center transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.setView(LAGOS_CENTER, 12, { animate: true })}
          aria-label="Center map on Lagos"
          title="Recenter on Lagos"
          className="w-8 h-8 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] flex items-center justify-center transition-colors"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        {editablePin && (
          <div className="px-2.5 py-1.5 rounded-lg bg-[var(--action-blue)] text-[var(--text-on-solid)] text-xs font-medium border border-[var(--action-blue-border)] shadow-[var(--shadow-card)] whitespace-nowrap">
            Click map to position verified pin
          </div>
        )}
        <button
          type="button"
          onClick={() => setTileMode((m) => (m === 'dark' ? 'osm' : 'dark'))}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-card)] transition-colors whitespace-nowrap shrink-0"
        >
          <Layers className="w-3.5 h-3.5 text-[var(--brand-teal)]" />
          <span>{tileMode === 'dark' ? 'OSM Street' : 'Dark Ops'}</span>
        </button>
      </div>

      {tileError && (
        <div className="absolute top-14 right-3 z-[400] max-w-xs px-3 py-2 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--status-urgent-border)] text-[11px] text-[var(--status-urgent-text)] shadow-[var(--shadow-card)]">
          Map tiles unreachable in offline sandbox; Lagos coordinates and unit overlays remain active.
        </div>
      )}

      {showInfoCard && !cardDismissed && (selectedIncident || selectedUnit) && (
        <div className="absolute bottom-11 left-3 right-3 sm:right-auto sm:w-72 z-[400] rounded-xl bg-[var(--bg-surface)]/95 border border-[var(--border-strong)] p-3 shadow-[var(--shadow-floating)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setCardDismissed(true)}
            aria-label="Close map selection card"
            className="absolute top-2 right-2 w-6 h-6 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] flex items-center justify-center text-xs"
          >
            ✕
          </button>
          {selectedIncident ? (
            <div className="space-y-2 pr-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono tabular-nums text-xs font-semibold text-[var(--text-secondary)]">
                    {selectedIncident.id}
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedIncident.category}
                  </div>
                </div>
                <PriorityBadge priority={selectedIncident.priority} />
              </div>

              <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                <MapPin className="w-3.5 h-3.5 text-[var(--brand-teal)] shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {selectedIncident.location.correctedDescription ||
                    selectedIncident.location.description}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <LocationSourceBadge source={selectedIncident.location.source} />
                <VerificationBadge status={selectedIncident.location.verificationStatus} />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                <span>Received {formatRelativeTime(selectedIncident.createdAt)}</span>
                <IncidentStatusBadge status={selectedIncident.status} />
              </div>

              {assignedUnitForSelected && (
                <div className="text-[11px] text-[var(--brand-teal)] flex items-center gap-1.5">
                  <Navigation className="w-3 h-3" />
                  <span>
                    Assigned: {assignedUnitForSelected.callsign} (
                    {assignedUnitForSelected.availability})
                  </span>
                </div>
              )}

              {route && (
                <div className="text-[11px] px-2 py-1 rounded bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                  {route.available ? (
                    route.isSimulatedFallback ? (
                      <span>Simulated demo route corridor shown (no ORS key)</span>
                    ) : (
                      <span className="font-mono tabular-nums">
                        Route: {formatDistanceKm(route.distanceMeters)} · ETA{' '}
                        {formatDurationMinutes(route.durationSeconds)}
                      </span>
                    )
                  ) : (
                    <span>{route.message}</span>
                  )}
                </div>
              )}

              {onOpenIncidentWorkspace && (
                <button
                  type="button"
                  onClick={() => onOpenIncidentWorkspace(selectedIncident.id)}
                  className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue-hover)] text-[var(--text-on-solid)] text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Open in Incident Management</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : selectedUnit ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono tabular-nums text-xs text-[var(--text-secondary)]">
                    {selectedUnit.id} · {selectedUnit.vehicleRegistration}
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedUnit.callsign}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {selectedUnit.unitType} · {selectedUnit.organisation}
                  </div>
                </div>
                <UnitAvailabilityBadge availability={selectedUnit.availability} />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {selectedUnit.locationName} ({selectedUnit.area})
                </span>
                <LocationFreshnessBadge freshness={selectedUnit.locationFreshness} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                <span className="font-mono tabular-nums">
                  {selectedUnit.currentAssignmentId
                    ? `Assigned: ${selectedUnit.currentAssignmentId}`
                    : 'No active assignment'}
                </span>
                <span>Updated {formatRelativeTime(selectedUnit.lastLocationUpdate)}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {showLegend && (
        <div className="absolute bottom-2 left-3 z-[400] hidden md:flex items-center gap-3 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)]/95 border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            Critical
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            Urgent
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
            Unassessed
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#10B981] bg-[var(--bg-surface)]" />
            Available Unit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#1EB6A3] bg-[var(--bg-surface)]" />
            Responding
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--status-verified-text)]">
            <CheckCircle2 className="w-3 h-3" />
            Lagos OSM
          </span>
        </div>
      )}
    </div>
  );
}
