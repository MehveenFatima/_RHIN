import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Village coordinates (fictional locations in rural India)
const VILLAGE_COORDINATES: Record<string, [number, number]> = {
  Rampur: [26.9124, 75.7873],
  Govindpur: [26.8956, 75.8234],
  Lakshmipur: [26.9345, 75.7654],
  Chandanpur: [26.8789, 75.8012],
  Narayanpur: [26.9456, 75.7890],
  Sunderpur: [26.8678, 75.8123],
  Devpur: [26.9234, 75.8345],
  Kamalpur: [26.8890, 75.7789],
};

// Component to handle map controls
function MapControls() {
  const map = useMap();

  useEffect(() => {
    // Add custom controls
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend bg-white p-3 rounded shadow-lg border');
      div.innerHTML = `
        <h4 class="font-semibold mb-2">Risk Levels</h4>
        <div class="space-y-1 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>High Risk</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Medium Risk</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Low Risk</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Normal</span>
          </div>
        </div>
      `;
      return div;
    };

    legend.addTo(map);

    return () => {
      map.removeControl(legend);
    };
  }, [map]);

  return null;
}

interface VillageSurveillanceMapProps {
  villages: string[];
  alertedVillages: Set<string>;
  alerts: any[];
}

export default function VillageSurveillanceMap({ villages, alertedVillages, alerts }: VillageSurveillanceMapProps) {
  // Create custom markers with radar effect
  const createCustomIcon = (color: string, isAlerting: boolean, severity: string) => {
    const size = isAlerting ? 32 : 24;
    const iconHtml = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 15px rgba(0,0,0,0.4), 0 0 ${isAlerting ? '25px' : '10px'} ${color}40;
        position: relative;
        ${isAlerting ? 'animation: radar-pulse 2s infinite ease-in-out;' : ''}
      ">
        ${isAlerting ? `
          <div style="
            position: absolute;
            top: -2px;
            left: -2px;
            width: ${size + 4}px;
            height: ${size + 4}px;
            border: 2px solid ${color};
            border-radius: 50%;
            animation: radar-ring 3s infinite ease-out;
          "></div>
        ` : ''}
      </div>
      <style>
        @keyframes radar-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes radar-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  };

  const getMarkerColor = (village: string) => {
    const alert = alerts.find(a => a.village === village);
    if (!alert) return '#22c55e'; // green for no alerts

    switch (alert.severity) {
      case 'high': return '#ef4444'; // red
      case 'medium': return '#f97316'; // orange
      case 'low': return '#eab308'; // yellow
      default: return '#22c55e'; // green
    }
  };

  const getSeverityText = (village: string) => {
    const alert = alerts.find(a => a.village === village);
    if (!alert) return 'Normal';

    switch (alert.severity) {
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      default: return 'Normal';
    }
  };

  // Calculate center of all villages
  const centerLat = Object.values(VILLAGE_COORDINATES).reduce((sum, [lat]) => sum + lat, 0) / Object.values(VILLAGE_COORDINATES).length;
  const centerLng = Object.values(VILLAGE_COORDINATES).reduce((sum, [, lng]) => sum + lng, 0) / Object.values(VILLAGE_COORDINATES).length;

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border shadow-lg">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapControls />

        {villages.map((village) => {
          const coords = VILLAGE_COORDINATES[village];
          if (!coords) return null;

          const isAlerting = alertedVillages.has(village);
          const markerColor = getMarkerColor(village);
          const alert = alerts.find(a => a.village === village);

          return (
            <div key={village}>
              <Marker
                position={coords}
                icon={createCustomIcon(markerColor, isAlerting, alert?.severity || 'normal')}
              >
                <Popup>
                  <div className="p-3 min-w-48">
                    <h3 className="font-bold text-lg mb-2">{village}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: markerColor }}
                        ></div>
                        <span className="text-sm font-medium">{getSeverityText(village)}</span>
                      </div>
                      {alert && (
                        <div className="border-t pt-2 mt-2">
                          <p className="text-sm"><strong>Cases:</strong> {alert.caseCount}</p>
                          <p className="text-sm"><strong>Symptoms:</strong> {alert.symptoms.join(', ')}</p>
                          <p className="text-sm"><strong>Status:</strong> {alert.status}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Last updated: {new Date(alert.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Radar circles for alerting villages */}
              {isAlerting && (
                <>
                  <Circle
                    center={coords}
                    radius={300}
                    pathOptions={{
                      color: markerColor,
                      fillColor: markerColor,
                      fillOpacity: 0.1,
                      weight: 1,
                      dashArray: '5, 5',
                    }}
                  />
                  <Circle
                    center={coords}
                    radius={600}
                    pathOptions={{
                      color: markerColor,
                      fillColor: markerColor,
                      fillOpacity: 0.05,
                      weight: 1,
                      dashArray: '10, 10',
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}