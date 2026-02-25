import { createNavbar } from "../components/navbar.js";
import { supabase } from "../services/supabaseClient.js";

export function renderMapPage(container) {
    const app = document.createElement("div");
    app.style.cssText = "display:flex;flex-direction:column;min-height:100vh;";
    app.appendChild(createNavbar());

    const content = document.createElement("div");
    content.style.cssText =
        "flex:1;display:flex;flex-direction:column;padding:1.25rem;gap:1rem;";

    const header = document.createElement("h1");
    header.textContent = "🗺️ Map View";
    header.style.marginBottom = "0.5rem";

    const mapWrapper = document.createElement("div");
    mapWrapper.style.cssText =
        "flex:1;position:relative;border-radius:1rem;overflow:hidden;border:1px solid var(--border);min-height:600px;";

    const mapContainer = document.createElement("div");
    mapContainer.id = "map";
    mapContainer.style.cssText = "width:100%;height:100%;min-height:600px;";

    const findMeBtn = document.createElement("button");
    findMeBtn.textContent = "Find Me";
    findMeBtn.style.cssText = `
        position:absolute; bottom:1.25rem; left:0.75rem; z-index:1000;
        padding:0.5rem 1rem; font-weight:600; font-size:0.85rem;
        background:var(--bg-secondary); border:1px solid var(--border);
        border-radius:0.6rem; cursor:pointer; color:var(--text-primary);
        backdrop-filter:blur(8px);
        `;
    findMeBtn.onclick = findUserLocation;
    mapWrapper.appendChild(findMeBtn);
    // Legend
    const legend = document.createElement("div");
    legend.style.cssText = `
    position:absolute; bottom:1.25rem; right:0.75rem; z-index:1000;
    background:rgba(30,41,59,0.92); border:1px solid var(--border);
    border-radius:0.75rem; padding:0.75rem 1rem; font-size:0.82rem;
    backdrop-filter:blur(8px); pointer-events:none;
  `;
    legend.innerHTML = `
    <p style="margin:0 0 0.5rem 0;font-weight:700;color:var(--text-primary);font-size:0.85rem;">Pothole Severity</p>
    <div style="display:flex;flex-direction:column;gap:0.35rem;color:var(--text-secondary);">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="width:12px;height:12px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0;"></span>
        High Severity
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="width:12px;height:12px;border-radius:50%;background:#f59e0b;display:inline-block;flex-shrink:0;"></span>
        Medium Severity
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="width:12px;height:12px;border-radius:50%;background:#3b82f6;display:inline-block;flex-shrink:0;"></span>
        Your Location
      </div>
    </div>
  `;

    mapWrapper.appendChild(mapContainer);
    mapWrapper.appendChild(legend);
    function findUserLocation() {
        if (!("geolocation" in navigator)) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                if (!map) return;
                map.setView([lat, lon], 18);
                if (userMarker) {
                    userMarker.setLatLng([lat, lon]);
                } else {
                    userMarker = L.circleMarker([lat, lon], {
                        radius: 10,
                        fillColor: "#3b82f6",
                        color: "#fff",
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 1,
                    })
                        .addTo(map)
                        .bindPopup("<strong>You are here</strong>");
                }
            },
            () => console.log("Geolocation denied"),
        );
    }
    content.appendChild(header);
    content.appendChild(mapWrapper);
    app.appendChild(content);
    container.appendChild(app);

    initializeMap();
}
function findUserLocation() {}
let map = null;
let userMarker = null;
let potholeMarkers = [];

function initializeMap() {
    try {
        map = L.map("map").setView([20.5937, 78.9629], 12);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 22,
        }).addTo(map);

        getUserLocationAndLoadPotholes();
    } catch (err) {
        console.error("Map initialization error:", err);
    }
}

async function getUserLocationAndLoadPotholes() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                if (map) {
                    map.setView([lat, lon], 18);

                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.circleMarker([lat, lon], {
                        radius: 10,
                        fillColor: "#3b82f6",
                        color: "#fff",
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 1,
                    })
                        .addTo(map)
                        .bindPopup("<strong>You are here</strong>");
                }

                loadPotholes();
            },
            () => {
                console.log("Geolocation access denied, loading default view");
                loadPotholes();
            },
        );
    } else {
        loadPotholes();
    }
}

async function loadPotholes() {
    try {
        // Only show active potholes (exclude removed)
        const { data: potholes, error } = await supabase
            .from("potholes")
            .select("*")
            .neq("status", "removed");

        if (error) throw error;

        potholeMarkers.forEach((marker) => map.removeLayer(marker));
        potholeMarkers = [];

        if (potholes) {
            potholes.forEach((pothole) => {
                const color =
                    pothole.severity === "high"
                        ? "#ef4444"
                        : pothole.severity === "medium"
                          ? "#f59e0b"
                          : "#10b981";

                const marker = L.circleMarker(
                    [pothole.latitude, pothole.longitude],
                    {
                        radius: 9,
                        fillColor: color,
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.85,
                    },
                ).addTo(map);

                const popupContent = `
          <div style="font-size:0.88rem;min-width:160px;">
            <strong style="color:${color};">${pothole.severity?.toUpperCase() || "UNKNOWN"} SEVERITY</strong><br><br>
            <strong>Lat:</strong> ${pothole.latitude?.toFixed(5)}<br>
            <strong>Lon:</strong> ${pothole.longitude?.toFixed(5)}<br>
            <strong>Reported:</strong> ${new Date(pothole.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}<br>
            ${pothole.description ? `<strong>Note:</strong> ${pothole.description}` : ""}
          </div>
        `;

                marker.bindPopup(popupContent);
                potholeMarkers.push(marker);
            });
        }
    } catch (err) {
        console.error("Error loading potholes:", err);
    }
}
