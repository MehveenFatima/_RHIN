import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import type { OutbreakAlert, Severity } from "@shared/types";
import { VILLAGES } from "@shared/villages";
import { SEVERITY_COLORS, STATUS_LABELS, SYMPTOM_LABELS } from "@/lib/labels";

const NORMAL_COLOR = "hsl(152 60% 40%)";
const RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

const center: [number, number] = [
  VILLAGES.reduce((sum, village) => sum + village.lat, 0) / VILLAGES.length,
  VILLAGES.reduce((sum, village) => sum + village.lng, 0) / VILLAGES.length,
];

const LEGEND: { label: string; color: string }[] = [
  { label: "High", color: SEVERITY_COLORS.high },
  { label: "Medium", color: SEVERITY_COLORS.medium },
  { label: "Low", color: SEVERITY_COLORS.low },
  { label: "No open alert", color: NORMAL_COLOR },
];

/** Leaflet map of monitored villages, coloured by the most severe open alert in each. */
export default function SurveillanceMap({
  alerts,
  height = 340,
  showLabels = false,
}: {
  alerts: OutbreakAlert[];
  height?: number;
  /** Keep labels open for villages with alerts (otherwise they show on hover). */
  showLabels?: boolean;
}) {
  const open = alerts.filter((alert) => alert.status !== "resolved");

  return (
    // `isolate` keeps Leaflet's internal z-indexes (400–700) from painting over dialogs.
    <div className="relative isolate z-0 overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {VILLAGES.map((village) => {
          const villageAlerts = open.filter((alert) => alert.village === village.name);
          const worst = villageAlerts.reduce<OutbreakAlert | null>(
            (top, alert) => (!top || RANK[alert.severity] > RANK[top.severity] ? alert : top),
            null,
          );
          const cases = villageAlerts.reduce((sum, alert) => sum + alert.caseCount, 0);
          const color = worst ? SEVERITY_COLORS[worst.severity] : NORMAL_COLOR;

          return (
            <CircleMarker
              key={village.name}
              center={[village.lat, village.lng]}
              radius={worst ? Math.min(28, 10 + cases) : 7}
              pathOptions={{ color, fillColor: color, fillOpacity: worst ? 0.45 : 0.7, weight: 2 }}
            >
              {/* `permanent` is fixed at creation in Leaflet, so remount the tooltip when it changes. */}
              <Tooltip key={String(showLabels && Boolean(worst))} direction="top" offset={[0, -6]} permanent={showLabels && Boolean(worst)}>
                <span className="font-semibold">{village.name}</span>
                {villageAlerts.map((alert) => (
                  <span key={alert.id} className="block text-xs">
                    {alert.caseCount} {SYMPTOM_LABELS[alert.symptom].toLowerCase()} · {STATUS_LABELS[alert.status]}
                  </span>
                ))}
                {!worst && <span className="block text-xs">{village.block} · no open alert</span>}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-6 left-2 z-[400] rounded-lg border bg-card/95 px-3 py-2 text-xs shadow-sm">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
