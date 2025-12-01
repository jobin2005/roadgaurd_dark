import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';

export function renderMapPage(container) {
  const app = document.createElement('div');
  app.style.cssText = `
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  `;

  app.appendChild(createNavbar());

  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  `;

  const header = document.createElement('h1');
  header.textContent = 'Map View';
  header.style.marginBottom = '1rem';

  const mapContainer = document.createElement('div');
  mapContainer.id = 'map';
  mapContainer.style.cssText = `
    flex: 1;
    border-radius: 1rem;
    border: 1px solid var(--border);
    overflow: hidden;
    background: var(--bg-secondary);
    min-height: 600px;
  `;

  content.appendChild(header);
  content.appendChild(mapContainer);

  app.appendChild(content);
  container.appendChild(app);

  initializeMap();
}

let map = null;
let userMarker = null;
let potholeMarkers = [];

function initializeMap() {
  try {
    map = L.map('map').setView([20.5937, 78.9629], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    getUserLocationAndLoadPotholes();
  } catch (err) {
    console.error('Map initialization error:', err);
  }
}

async function getUserLocationAndLoadPotholes() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (map) {
          map.setView([lat, lon], 14);

          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: '#3b82f6',
            color: '#2563eb',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map).bindPopup('Your Location');
        }

        loadPotholes();
      },
      () => {
        console.log('Geolocation access denied, loading default view');
        loadPotholes();
      }
    );
  } else {
    loadPotholes();
  }
}

async function loadPotholes() {
  try {
    const { data: potholes, error } = await supabase
      .from('potholes')
      .select('*');

    if (error) throw error;

    potholeMarkers.forEach(marker => map.removeLayer(marker));
    potholeMarkers = [];

    if (potholes) {
      potholes.forEach(pothole => {
        const color = pothole.severity === 'high' ? '#ef4444' :
                      pothole.severity === 'medium' ? '#f59e0b' : '#10b981';

        const marker = L.circleMarker([pothole.latitude, pothole.longitude], {
          radius: 8,
          fillColor: color,
          color: color,
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.7
        }).addTo(map);

        const popupContent = `
          <div style="font-size: 0.9rem; color: var(--text-primary);">
            <strong>Severity:</strong> ${pothole.severity}<br>
            <strong>Lat:</strong> ${pothole.latitude.toFixed(4)}<br>
            <strong>Lon:</strong> ${pothole.longitude.toFixed(4)}<br>
            <strong>Reported:</strong> ${new Date(pothole.created_at).toLocaleDateString()}
          </div>
        `;

        marker.bindPopup(popupContent);
        potholeMarkers.push(marker);
      });
    }
  } catch (err) {
    console.error('Error loading potholes:', err);
  }
}
