import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

type MapPickerProps = {
  point: MapPoint | null;
  onPointChange: (point: MapPoint) => void;
};

export function MapPicker({ point, onPointChange }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPointChangeRef = useRef(onPointChange);

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      worldCopyJump: true,
    }).setView([-14.2, -51.9], 4);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("click", (event) => {
      onPointChangeRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) {
      return;
    }

    const latLng: L.LatLngExpression = [point.latitude, point.longitude];
    map.setView(latLng, Math.max(map.getZoom(), 7), { animate: true });

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng).addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }
  }, [point]);

  return (
    <div className="map-frame">
      <div ref={containerRef} className="map-canvas" aria-label="Mapa" />
      <div className="map-hint">Clique no mapa para selecionar outro ponto</div>
    </div>
  );
}
