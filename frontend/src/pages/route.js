import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';

export function renderRoutePage(container) {
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
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  `;

  const sidebar = document.createElement('div');
  sidebar.style.cssText = `
    width: 100%;
    max-width: 350px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  `;

  const header = document.createElement('h1');
  header.textContent = 'Route Planner';
  header.style.marginBottom = '1rem';

  const form = createRouteForm();
  const resultContainer = document.createElement('div');
  resultContainer.id = 'resultContainer';
  resultContainer.style.display = 'none';

  sidebar.appendChild(header);
  sidebar.appendChild(form);
  sidebar.appendChild(resultContainer);

  const mapContainer = document.createElement('div');
  mapContainer.id = 'routeMap';
  mapContainer.style.cssText = `
    flex: 1;
    border-radius: 1rem;
    border: 1px solid var(--border);
    overflow: hidden;
    background: var(--bg-secondary);
    min-height: 600px;
  `;

  content.appendChild(sidebar);
  content.appendChild(mapContainer);

  app.appendChild(content);
  container.appendChild(app);

  form.addEventListener('submit', (e) => handleRouteSearch(e, resultContainer));
  initializeRouteMap();
}

let routeMap = null;

function createRouteForm() {
  const form = document.createElement('form');
  form.id = 'routeForm';
  form.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 1rem;
  `;

  const startLabel = document.createElement('label');
  startLabel.textContent = 'Starting Point';
  startLabel.style.cssText = `
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  `;

  const startInput = document.createElement('input');
  startInput.id = 'startLocation';
  startInput.type = 'text';
  startInput.placeholder = 'Your location (click to use GPS)';
  startInput.style.cssText = 'width: 100%;';

  const useGPSBtn = document.createElement('button');
  useGPSBtn.type = 'button';
  useGPSBtn.textContent = '📍 Use My Location';
  useGPSBtn.className = 'btn-small btn-secondary';
  useGPSBtn.style.cssText = 'width: 100%; margin-top: -0.5rem;';

  useGPSBtn.onclick = async () => {
    const location = await getUserLocation();
    if (location) {
      startInput.value = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
      startInput.dataset.lat = location.latitude;
      startInput.dataset.lng = location.longitude;
    } else {
      showAlert('Could not access your location', 'error');
    }
  };

  const destLabel = document.createElement('label');
  destLabel.textContent = 'Destination';
  destLabel.style.cssText = `
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    margin-top: 1rem;
  `;

  const destInput = document.createElement('input');
  destInput.id = 'destLocation';
  destInput.type = 'text';
  destInput.placeholder = 'Enter destination (lat, lng)';
  destInput.style.cssText = 'width: 100%;';

  const example = document.createElement('p');
  example.textContent = 'E.g., 28.7041, 77.1025';
  example.style.cssText = `
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0.25rem 0 0 0;
  `;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Find Potholes on Route';
  submitBtn.style.cssText = `
    margin-top: 1rem;
    padding: 0.75rem;
    font-weight: 600;
  `;

const startButton = document.createElement('button');
startButton.type = 'button'; 
startButton.textContent = 'Start Driving';
startButton.style.cssText = `
  margin-top: 1rem;
  padding: 0.75rem;
  font-weight: 600;
  width: 100%;
`;


  form.appendChild(startLabel);
  form.appendChild(startInput);
  form.appendChild(useGPSBtn);
  form.appendChild(destLabel);
  form.appendChild(destInput);
  form.appendChild(example);
  form.appendChild(submitBtn);
  form.appendChild(startButton);

  return form;
}

async function handleRouteSearch(e, resultContainer) {
  e.preventDefault();

  const startInput = document.getElementById('startLocation').value;
  const destInput = document.getElementById('destLocation').value;

  if (!startInput || !destInput) {
    showAlert('Please enter both start and destination', 'error');
    return;
  }

  const [startLat, startLng] = parseCoordinates(startInput);
  const [destLat, destLng] = parseCoordinates(destInput);

  if (!startLat || !destLat) {
    showAlert('Invalid coordinates. Use format: latitude, longitude', 'error');
    return;
  }

  try {
    const { data: potholes } = await supabase
      .from('potholes')
      .select('*');

    const pothelesOnRoute = findPothelesOnRoute(
      { lat: startLat, lng: startLng },
      { lat: destLat, lng: destLng },
      potholes || []
    );

    displayRouteResults(pothelesOnRoute, resultContainer);
    displayRouteOnMap(startLat, startLng, destLat, destLng, pothelesOnRoute);

  } catch (err) {
    showAlert('Error finding potholes on route', 'error');
    console.error(err);
  }
}

function parseCoordinates(input) {
  const parts = input.replace(/\s/g, '').split(',');
  if (parts.length !== 2) return [null, null];

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) return [null, null];
  return [lat, lng];
}

function findPothelesOnRoute(start, end, potholes) {
  const ROUTE_WIDTH = 0.02;

  return potholes.filter(pothole => {
    const distance = pointToLineDistance(
      { lat: pothole.latitude, lng: pothole.longitude },
      start,
      end
    );
    return distance < ROUTE_WIDTH;
  }).sort((a, b) => {
    const distA = calculateDistance(start.lat, start.lng, a.latitude, a.longitude);
    const distB = calculateDistance(start.lat, start.lng, b.latitude, b.longitude);
    return distA - distB;
  });
}

function pointToLineDistance(point, lineStart, lineEnd) {
  const A = point.lat - lineStart.lat;
  const B = point.lng - lineStart.lng;
  const C = lineEnd.lat - lineStart.lat;
  const D = lineEnd.lng - lineStart.lng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = lineStart.lat;
    yy = lineStart.lng;
  } else if (param > 1) {
    xx = lineEnd.lat;
    yy = lineEnd.lng;
  } else {
    xx = lineStart.lat + param * C;
    yy = lineStart.lng + param * D;
  }

  const dx = point.lat - xx;
  const dy = point.lng - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function displayRouteResults(potholes, container) {
  container.innerHTML = '';
  container.style.display = 'block';

  const title = document.createElement('h2');
  title.textContent = `Found ${potholes.length} Pothole(s)`;
  title.style.marginBottom = '1rem';

  container.appendChild(title);

  if (potholes.length === 0) {
    const message = document.createElement('p');
    message.textContent = 'Good news! No potholes found on this route.';
    message.style.color = 'var(--success)';
    container.appendChild(message);
    return;
  }

  potholes.forEach((pothole, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginBottom = '0.75rem';

    const severityColor = pothole.severity === 'high' ? 'var(--error)' :
                          pothole.severity === 'medium' ? 'var(--warning)' : 'var(--success)';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
        <div>
          <p style="margin: 0 0 0.25rem 0; font-weight: 600;">Pothole ${index + 1}</p>
          <p style="margin: 0 0 0.25rem 0; font-size: 0.9rem; color: var(--text-secondary);">
            ${pothole.latitude.toFixed(4)}, ${pothole.longitude.toFixed(4)}
          </p>
          <p style="margin: 0; font-size: 0.9rem;">
            Severity: <span style="color: ${severityColor}; font-weight: 600;">${pothole.severity}</span>
          </p>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function initializeRouteMap() {
  try {
    routeMap = L.map('routeMap').setView([28.7041, 77.1025], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(routeMap);
  } catch (err) {
    console.error('Route map initialization error:', err);
  }
}

function displayRouteOnMap(startLat, startLng, endLat, endLng, potholes) {
  if (!routeMap) return;

  routeMap.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      routeMap.removeLayer(layer);
    }
  });

  L.marker([startLat, startLng], {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2310b981"><circle cx="12" cy="12" r="8"/></svg>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(routeMap).bindPopup('Start');

  L.marker([endLat, endLng], {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ef4444"><circle cx="12" cy="12" r="8"/></svg>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(routeMap).bindPopup('Destination');

  L.polyline([[startLat, startLng], [endLat, endLng]], {
    color: 'var(--accent-primary)',
    weight: 2,
    opacity: 0.7,
    dashArray: '5, 5'
  }).addTo(routeMap);

  potholes.forEach(pothole => {
    const color = pothole.severity === 'high' ? '#ef4444' :
                  pothole.severity === 'medium' ? '#f59e0b' : '#10b981';

    L.circleMarker([pothole.latitude, pothole.longitude], {
      radius: 8,
      fillColor: color,
      color: color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.7
    }).addTo(routeMap).bindPopup(`Severity: ${pothole.severity}`);
  });

  routeMap.fitBounds([[startLat, startLng], [endLat, endLng]], { padding: [50, 50] });
}

function getUserLocation() {
  return new Promise((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null)
      );
    } else {
      resolve(null);
    }
  });
}
