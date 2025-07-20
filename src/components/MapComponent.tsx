import React, { useEffect, useState, useRef, useCallback } from "react";
import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap
} from "react-leaflet";
import L from "leaflet";
import styles from "./MapComponent.module.css";

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

const vehicleIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiB5PSIxNiIgcng9IjgiIGZpbGw9IiNmZjAwMDAiLz4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjMyIiB4PSI4IiB5PSIyMCIgcnk9IjQiIGZpbGw9IiNmZjAwMDAiLz4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjgiIHg9IjgiIHk9IjQ4IiByeD0iNCIgZmlsbD0iI2ZmZmZmZiIvPgo8Y2lyY2xlIGN4PSIxNiIgY3k9IjU2IiByPSI0IiBmaWxsPSIjMDAwMDAwIi8+CjxjaXJjbGUgY3g9IjQ4IiBjeT0iNTYiIHI9IjQiIGZpbGw9IiMwMDAwMDAiLz4KPC9zdmc+Cg==',
  iconSize: [30, 30],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});


function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MapComponent() {
  const [route, setRoute] = useState<LocationPoint[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [distanceTravelled, setDistanceTravelled] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const lastPositionRef = useRef<[number, number] | null>(null);
  const progressRef = useRef<number>(0);

  useEffect(() => {
    fetch("/dummy-route.json")
      .then(res => res.json())
      .then((data: LocationPoint[]) => setRoute(data));
  }, []);

  useEffect(() => {
    if (!playing) {
      setCurrentIndex(0);
      setElapsedTime(0);
      setDistanceTravelled(0);
      setSpeed(0);
      progressRef.current = 0;
      lastTimestampRef.current = null;
      lastPositionRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, [playing, route]);

  const animate = useCallback(() => {
    if (!playing || route.length === 0) return;

    const current = route[currentIndex];
    const next = route[currentIndex + 1];

    if (!next) {
      setPlaying(false);
      return;
    }

    const currentTime = Date.now();
    if (!startTimeRef.current) startTimeRef.current = currentTime;
    const elapsed = (currentTime - startTimeRef.current) / 1000;
    setElapsedTime(elapsed);

    const timeDiff = (new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime()) / 1000;
    const segmentElapsed = elapsed - (currentIndex * timeDiff);
    progressRef.current = Math.min(segmentElapsed / timeDiff, 1);

    const lat = current.latitude + (next.latitude - current.latitude) * progressRef.current;
    const lng = current.longitude + (next.longitude - current.longitude) * progressRef.current;

    if (lastPositionRef.current) {
      const dist = haversineDistance(lastPositionRef.current[0], lastPositionRef.current[1], lat, lng);
      setDistanceTravelled(prev => prev + dist);

      const secDiff = (currentTime - (lastTimestampRef.current ? new Date(lastTimestampRef.current).getTime() : currentTime)) / 1000;
      if (secDiff > 0) setSpeed(dist / secDiff);
    }

    lastPositionRef.current = [lat, lng];
    lastTimestampRef.current = new Date(current.timestamp).toISOString();

    if (progressRef.current >= 1) {
      setCurrentIndex(prev => Math.min(prev + 1, route.length - 1));
      progressRef.current = 0;
      startTimeRef.current = Date.now();
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [playing, currentIndex, route]);

  useEffect(() => {
    if (playing) {
      startTimeRef.current = null;
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playing, animate]);

  if (route.length === 0) return <p>Loading...</p>;

  const current = route[currentIndex];
  const next = route[Math.min(currentIndex + 1, route.length - 1)];
  const lat = current.latitude + (next.latitude - current.latitude) * progressRef.current;
  const lng = current.longitude + (next.longitude - current.longitude) * progressRef.current;
  const currentPos: [number, number] = [lat, lng];
  const traveledPath = route.slice(0, currentIndex + 1).map(p => [p.latitude, p.longitude]);

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>🚗 Vehicle Route Simulator</h2>

      <div className={styles.mapWrapper}>
        <MapContainer center={currentPos} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <Marker position={currentPos} icon={vehicleIcon} />
          <Polyline positions={traveledPath as L.LatLngTuple[]} color="blue" />
          <RecenterMap coords={currentPos} />
        </MapContainer>
      </div>

      <div className={styles.controls}>
        <button onClick={() => setPlaying(!playing)} className={styles.button}>
          {playing ? "⏸ Pause" : "▶️ Play"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCurrentIndex(0);
            setElapsedTime(0);
            setDistanceTravelled(0);
            setSpeed(0);
            progressRef.current = 0;
            lastTimestampRef.current = null;
            lastPositionRef.current = null;
          }}
          className={styles.button}
        >
          🔄 Reset
        </button>
      </div>

      <div className={styles.info}>
        <p><strong>Coordinates:</strong> {lat.toFixed(6)}, {lng.toFixed(6)}</p>
        <p><strong>Timestamp:</strong> {current.timestamp.replace('T', ' ').replace('Z', '')}</p>
        <p><strong>Elapsed Time:</strong> {Math.floor(elapsedTime)} sec</p>
        <p><strong>Distance:</strong> {distanceTravelled.toFixed(2)} m</p>
      </div>
    </div>
  );
}

function RecenterMap({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(coords);
  }, [coords]);
  return null;
}

export default MapComponent;
