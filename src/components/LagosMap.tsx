import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Minus,
} from 'lucide-react';
import {
  IncidentRecord,
  ResponseUnit,
  RouteResult,
} from '../types/responda';
import { formatDistanceKm, formatDurationMinutes, formatRelativeTime } from '../utils/incidentLogic';
import {
  IncidentStatusBadge,
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
}

const LAGOS_CENTER: [number, number] = [6.505, 3.392];

function getIncidentColor(priority: IncidentRecord['priority']): string {
  switch (priority) {
    case 'CRITICAL':
      return '#EF4444';
    case 'HIGH':
      return '#F97316';
    case 'MEDIUM':
      return '#EAB308';
    case 'LOW':
      return '#22C55E';
  }
}

function getUnitColor(unit: ResponseUnit): string {
  if (unit.availability === 'AVAILABLE') return '#22C55E';
  if (unit.availability === 'UNAVAILABLE') return '#64748B';
  if (unit.unitType === 'Security patrol') return '#3B82F6';
  if (unit.unitType === 'Fire-response partner') return '#F97316';
  return '#06B6D4';
}

function createIncidentIcon(incident: IncidentRecord, selected: boolean): L.DivIcon {
  const color = getIncidentColor(incident.priority);
  const ring = selected
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid #F8FAFC;background:${color}22;"></span>`
    : '';
  return L.divIcon({
    className: 'responda-incident-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      ${ring}
      <div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid #0B1220;color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">!</div>
    </div>`,
  });
}

function createUnitIcon(unit: ResponseUnit, selected: boolean): L.DivIcon {
  const color = getUnitColor(unit);
  const shortTag =
    unit.unitType === 'Ambulance'
      ? 'A'
      : unit.unitType === 'Security patrol'
      ? 'S'
      : unit.unitType === 'Fire-response partner'
      ? 'F'
      : unit.unitType === 'Rescue team'
      ? 'R'
      : 'V';

  return L.divIcon({
    className: 'responda-unit-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:24px;height:24px;border-radius:7px;background:#111C2E;border:2px solid ${
      selected ? '#F8FAFC' : color
    };color:${color};font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">
      ${shortTag}
    </div>`,
  });
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
}: LagosMapProps) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [tileMode, setTileMode] = useState<'dark' | 'osm'>('dark');
  const [tileError, setTileError] = useState(false);
  const [cardDismissed, setCardDismissed] = useState(false);

  const onPinMoveRef = useRef(onPinMove);
  onPinMoveRef.current = onPinMove;
  const editablePinRef = useRef(editablePin);
  editablePinRef.current = editablePin;

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

    // Draw route if available
    if (route?.available && route.coordinates && route.coordinates.length > 1) {
      L.polyline(route.coordinates, {
        color: route.isSimulatedFallback ? '#22D3EE' : '#3B82F6',
        weight: 4,
        opacity: 0.9,
        dashArray: route.isSimulatedFallback ? '8 8' : undefined,
      }).addTo(group);
    }

    // Draw unit markers
    for (const unit of units) {
      const marker = L.marker([unit.lat, unit.lng], {
        icon: createUnitIcon(unit, unit.id === selectedUnitId),
      });
      marker.bindTooltip(`${unit.callsign} (${unit.availability.replace('_', ' ')})`, {
        direction: 'top',
        offset: [0, -10],
      });
      marker.on('click', () => {
        onSelectUnit?.(unit.id);
      });
      marker.addTo(group);
    }

    // Draw incident markers
    for (const inc of incidents) {
      if (typeof inc.location.lat !== 'number' || typeof inc.location.lng !== 'number') {
        continue;
      }
      const isSelected = inc.id === selectedIncidentId;
      const marker = L.marker([inc.location.lat, inc.location.lng], {
        icon: createIncidentIcon(inc, isSelected),
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
  }, [incidents, units, selectedIncidentId, selectedUnitId, route, onSelectIncident, onSelectUnit]);

  // Center map smoothly when selected incident changes
  useEffect(() => {
    setCardDismissed(false);
    const map = mapRef.current;
    if (!map || !selectedIncidentId) return;
    const target = incidents.find((i) => i.id === selectedIncidentId);
    if (target?.location.lat && target.location.lng) {
      map.setView([target.location.lat, target.location.lng], Math.max(map.getZoom(), 13), {
        animate: false,
      });
    }
  }, [selectedIncidentId, incidents]);

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
      className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-[#26364B] bg-[#0B1220]`}
    >
      <div
        ref={mapElRef}
        className={`responda-leaflet-container ${
          tileMode === 'dark' ? 'responda-dark-tiles' : ''
        } w-full h-full z-0`}
      />

      {/* Map Controls Top-Left */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in map"
          className="w-8 h-8 rounded-lg bg-[#111C2E]/95 border border-[#26364B] text-slate-200 hover:bg-[#172438] flex items-center justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out map"
          className="w-8 h-8 rounded-lg bg-[#111C2E]/95 border border-[#26364B] text-slate-200 hover:bg-[#172438] flex items-center justify-center transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.setView(LAGOS_CENTER, 12, { animate: true })}
          aria-label="Center map on Lagos"
          title="Recenter on Lagos"
          className="w-8 h-8 rounded-lg bg-[#111C2E]/95 border border-[#26364B] text-slate-200 hover:bg-[#172438] flex items-center justify-center transition-colors"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* Tile switcher & editable hint Top-Right */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
        {editablePin && (
          <div className="px-2.5 py-1.5 rounded-lg bg-blue-600/90 text-white text-xs font-medium border border-blue-400/50 shadow-sm">
            Click map to position verified pin
          </div>
        )}
        <button
          type="button"
          onClick={() => setTileMode((m) => (m === 'dark' ? 'osm' : 'dark'))}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#111C2E]/95 border border-[#26364B] text-xs font-medium text-slate-200 hover:bg-[#172438] transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>{tileMode === 'dark' ? 'OSM Street' : 'Dark Ops'}</span>
        </button>
      </div>

      {tileError && (
        <div className="absolute top-14 right-3 z-[400] max-w-xs px-3 py-2 rounded-lg bg-[#111C2E]/95 border border-amber-500/40 text-[11px] text-amber-200">
          Map tiles unreachable in offline sandbox; Lagos coordinates and unit overlays remain active.
        </div>
      )}

      {/* Floating Info Panel for Selected Incident or Unit */}
      {showInfoCard && !cardDismissed && (selectedIncident || selectedUnit) && (
        <div className="absolute bottom-11 left-3 right-3 sm:right-auto sm:w-72 z-[400] rounded-xl bg-[#111C2E]/95 border border-[#26364B] p-3 shadow-xl backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setCardDismissed(true)}
            aria-label="Close map selection card"
            className="absolute top-2 right-2 w-6 h-6 rounded-md text-slate-400 hover:text-white hover:bg-[#172438] flex items-center justify-center text-xs"
          >
            ✕
          </button>
          {selectedIncident ? (
            <div className="space-y-2 pr-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs font-semibold text-slate-300">
                    {selectedIncident.id}
                  </div>
                  <div className="text-sm font-semibold text-slate-50">
                    {selectedIncident.category}
                  </div>
                </div>
                <PriorityBadge priority={selectedIncident.priority} />
              </div>

              <div className="flex items-start gap-1.5 text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {selectedIncident.location.correctedDescription ||
                    selectedIncident.location.description}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <LocationSourceBadge source={selectedIncident.location.source} />
                <VerificationBadge status={selectedIncident.location.verificationStatus} />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#26364B] text-[11px] text-slate-400">
                <span>Received {formatRelativeTime(selectedIncident.createdAt)}</span>
                <IncidentStatusBadge status={selectedIncident.status} />
              </div>

              {assignedUnitForSelected && (
                <div className="text-[11px] text-cyan-300 flex items-center gap-1.5">
                  <Navigation className="w-3 h-3" />
                  <span>
                    Assigned: {assignedUnitForSelected.callsign} (
                    {assignedUnitForSelected.availability.replace('_', ' ')})
                  </span>
                </div>
              )}

              {route && (
                <div className="text-[11px] px-2 py-1 rounded bg-[#172438] border border-[#26364B] text-slate-300">
                  {route.available ? (
                    route.isSimulatedFallback ? (
                      <span>Simulated demo route corridor shown (no ORS key)</span>
                    ) : (
                      <span className="font-mono">
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
                  className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <span>Open Incident Workspace</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : selectedUnit ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-slate-400">{selectedUnit.id}</div>
                  <div className="text-sm font-semibold text-slate-50">
                    {selectedUnit.callsign}
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedUnit.unitType} · {selectedUnit.organisation}
                  </div>
                </div>
                <UnitAvailabilityBadge availability={selectedUnit.availability} />
              </div>
              <div className="text-xs text-slate-300">
                Location: {selectedUnit.locationName} ({selectedUnit.area})
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-[#26364B]">
                <span>
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

      {/* Map Legend */}
      {showLegend && (
        <div className="absolute bottom-2 left-3 z-[400] hidden md:flex items-center gap-3 px-2.5 py-1 rounded-lg bg-[#111C2E]/92 border border-[#26364B] text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            Critical
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            High
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            Medium
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-emerald-400 bg-[#111C2E]" />
            Available Unit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm border border-cyan-400 bg-[#111C2E]" />
            Responding
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Lagos OSM
          </span>
        </div>
      )}
    </div>
  );
}
