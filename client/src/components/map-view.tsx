import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Icon, latLngBounds } from "leaflet";
import { memo, useEffect } from "react";
import type { Project } from "@shared/schema-mongo";
import { ASSETS } from "@/lib/cdn-assets";

// Fix for default marker icon - using centralized CDN assets
const icon = new Icon({
  iconUrl: ASSETS.mapMarker,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface FitBoundsProps {
  projects: Project[];
}

function FitBounds({ projects }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    const valid = projects.filter(
      (p) => p.location && typeof p.location.lat === "number" && typeof p.location.lng === "number",
    );
    if (valid.length === 0) return;

    if (valid.length === 1) {
      const { lat, lng } = valid[0].location!;
      map.setView([lat, lng], 12);
      return;
    }

    const bounds = latLngBounds(
      valid.map((p) => [p.location!.lat, p.location!.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, projects]);

  return null;
}

interface MapViewProps {
  projects: Project[];
  className?: string;
}

export const MapView = memo(function MapView({ projects, className }: MapViewProps) {
  // Filter out projects without valid location (e.g. open-ended projects that omit it)
  const projectsWithLocation = projects.filter(
    (p) => p.location && typeof p.location.lat === "number" && typeof p.location.lng === "number",
  );
  const hasProjects = projectsWithLocation.length > 0;
  const center = hasProjects
    ? ([projectsWithLocation[0].location!.lat, projectsWithLocation[0].location!.lng] as [
        number,
        number,
      ])
    : ([20, -60] as [number, number]); // Americas-centric fallback
  const zoom = hasProjects ? (projectsWithLocation.length === 1 ? 12 : 4) : 3;

  return (
    <MapContainer center={center} zoom={zoom} className={`h-[400px] w-full ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds projects={projectsWithLocation} />
      {projectsWithLocation.map((project) => (
        <Marker
          key={project.id}
          position={[project.location!.lat, project.location!.lng]}
          icon={icon}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold">{project.title}</h3>
              <p className="text-sm text-muted-foreground">{project.location!.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
});
