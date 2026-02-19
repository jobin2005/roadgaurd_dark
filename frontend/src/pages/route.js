import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';
import { routeStore } from '../services/routeStore.js';
import { router } from '../router.js';

const OSRM_URL = 'https://router.project-osrm.org';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const BACKEND_URL = 'http://localhost:8000';

// Module-level state
let routeMap = null;
let routeLayers = [];       // Polyline layers for each route
let markerLayers = [];      // Start/end markers
let potholeLayer = [];      // Pothole markers
let allRoutes = [];         // OSRM route objects
let routePotholes = [];     // Potholes per route index
let selectedRouteIdx = 0;

export function renderRoutePage(container) {
  routeMap = null;
  routeLayers = [];
  markerLayers = [];
  potholeLayer = [];
  allRoutes = [];
  routePotholes = [];
  selectedRouteIdx = 0;

  const app = document.createElement('div');
  app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';
  app.appendChild(createNavbar());

  const content = document.createElement('div');
  content.style.cssText = `
    flex:1; display:flex; gap:0; 
    max-width:100%; width:100%; height:calc(100vh - 64px); overflow:hidden;
  `;

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar = document.createElement('div');
  sidebar.style.cssText = `
    width: 380px; min-width: 340px; max-width: 400px;
    display: flex; flex-direction: column;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    overflow-y: auto; flex-shrink: 0;
  `;

  const sidebarInner = document.createElement('div');
  sidebarInner.style.cssText = 'padding: 1.25rem; display:flex; flex-direction:column; gap:1rem;';

  const h1 = document.createElement('h2');
  h1.textContent = '🛣️ Route Planner';
  h1.style.cssText = 'margin:0; font-size:1.4rem;';

  sidebarInner.appendChild(h1);
  sidebarInner.appendChild(createRouteForm());

  const routeCardsArea = document.createElement('div');
  routeCardsArea.id = 'routeCards';
  sidebarInner.appendChild(routeCardsArea);

  const startJourneyBtn = document.createElement('button');
  startJourneyBtn.id = 'startJourneyBtn';
  startJourneyBtn.textContent = '🚗 Start Journey';
  startJourneyBtn.style.cssText = `
    display:none; width:100%; padding:0.9rem; font-size:1rem; font-weight:700;
    background: linear-gradient(135deg, #10b981, #059669);
    border:none; border-radius:0.75rem; cursor:pointer; color:white;
    box-shadow: 0 4px 15px rgba(16,185,129,0.4);
    transition: all 0.2s;
  `;
  startJourneyBtn.onmouseenter = () => startJourneyBtn.style.transform = 'translateY(-2px)';
  startJourneyBtn.onmouseleave = () => startJourneyBtn.style.transform = 'translateY(0)';
  startJourneyBtn.onclick = startJourney;
  sidebarInner.appendChild(startJourneyBtn);

  sidebar.appendChild(sidebarInner);

  // ── Map ───────────────────────────────────────────────────────────────────
  const mapContainer = document.createElement('div');
  mapContainer.id = 'routeMap';
  mapContainer.style.cssText = 'flex:1; overflow:hidden; position:relative;';

  // Legend
  const legend = document.createElement('div');
  legend.style.cssText = `
    position:absolute; bottom:2rem; right:0.75rem; z-index:999;
    background:rgba(30,41,59,0.92); border:1px solid var(--border);
    border-radius:0.75rem; padding:0.75rem 1rem; font-size:0.82rem;
    backdrop-filter:blur(8px);
  `;
  legend.innerHTML = `
    <p style="margin:0 0 0.4rem 0; font-weight:600; color:var(--text-primary);">Route Legend</p>
    <div style="display:flex;flex-direction:column;gap:0.3rem;">
      <div><span style="display:inline-block;width:18px;height:4px;background:#10b981;border-radius:2px;vertical-align:middle;margin-right:0.4rem;"></span>Safest Route</div>
      <div><span style="display:inline-block;width:18px;height:4px;background:#f59e0b;border-radius:2px;vertical-align:middle;margin-right:0.4rem;"></span>Alternative</div>
      <div style="margin-top:0.3rem;"><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:50%;vertical-align:middle;margin-right:0.4rem;"></span>High Severity</div>
      <div><span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:50%;vertical-align:middle;margin-right:0.4rem;"></span>Medium Severity</div>
    </div>
  `;
  mapContainer.appendChild(legend);

  content.appendChild(sidebar);
  content.appendChild(mapContainer);
  app.appendChild(content);
  container.appendChild(app);

  initializeRouteMap();
}

// ── Form ─────────────────────────────────────────────────────────────────────

function createRouteForm() {
  const form = document.createElement('form');
  form.id = 'routeForm';
  form.style.cssText = 'display:flex;flex-direction:column;gap:0.75rem;';

  // Start field
  const startWrap = document.createElement('div');
  startWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;';

  const startLabel = document.createElement('label');
  startLabel.textContent = 'Start Location';
  startLabel.style.cssText = 'font-weight:600; font-size:0.9rem;';

  const startInputGroup = document.createElement('div');
  startInputGroup.style.cssText = 'display:flex;gap:0.5rem;';

  const startInput = document.createElement('input');
  startInput.id = 'startLocation';
  startInput.type = 'text';
  startInput.placeholder = 'Address or lat, lng';
  startInput.style.cssText = 'flex:1;';

  const gpsBtn = document.createElement('button');
  gpsBtn.type = 'button';
  gpsBtn.textContent = '📍';
  gpsBtn.title = 'Use my location';
  gpsBtn.style.cssText = 'width:40px;padding:0;flex-shrink:0;font-size:1.1rem;';
  gpsBtn.onclick = async () => {
    gpsBtn.textContent = '⏳';
    const loc = await getUserLocation();
    if (loc) {
      startInput.value = `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
      startInput.dataset.lat = loc.latitude;
      startInput.dataset.lng = loc.longitude;
      if (routeMap) routeMap.setView([loc.latitude, loc.longitude], 13);
    } else {
      showAlert('Could not access your location', 'error');
    }
    gpsBtn.textContent = '📍';
  };

  startInputGroup.appendChild(startInput);
  startInputGroup.appendChild(gpsBtn);
  startWrap.appendChild(startLabel);
  startWrap.appendChild(startInputGroup);

  // Dest field
  const destWrap = document.createElement('div');
  destWrap.style.cssText = 'display:flex;flex-direction:column;gap:0.35rem;';

  const destLabel = document.createElement('label');
  destLabel.textContent = 'Destination';
  destLabel.style.cssText = 'font-weight:600; font-size:0.9rem;';

  const destInput = document.createElement('input');
  destInput.id = 'destLocation';
  destInput.type = 'text';
  destInput.placeholder = 'Address or lat, lng';
  destInput.style.cssText = 'width:100%;';

  destWrap.appendChild(destLabel);
  destWrap.appendChild(destInput);

  const hint = document.createElement('p');
  hint.textContent = 'Tip: Enter coordinates as "lat, lng" or a place name';
  hint.style.cssText = 'font-size:0.78rem; color:var(--text-secondary); margin:0;';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.id = 'findRoutesBtn';
  submitBtn.textContent = '🔍 Find Routes';
  submitBtn.style.cssText = 'padding:0.75rem; font-weight:700; width:100%;';

  form.appendChild(startWrap);
  form.appendChild(destWrap);
  form.appendChild(hint);
  form.appendChild(submitBtn);

  form.addEventListener('submit', handleRouteSearch);
  return form;
}

// ── Route Search ─────────────────────────────────────────────────────────────

async function handleRouteSearch(e) {
  e.preventDefault();

  const startVal = document.getElementById('startLocation').value.trim();
  const destVal = document.getElementById('destLocation').value.trim();
  const btn = document.getElementById('findRoutesBtn');
  const cardsArea = document.getElementById('routeCards');

  if (!startVal || !destVal) {
    showAlert('Please enter both start and destination', 'error');
    return;
  }

  btn.textContent = '⏳ Searching...';
  btn.disabled = true;
  cardsArea.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;">Fetching routes…</p>';
  document.getElementById('startJourneyBtn').style.display = 'none';

  try {
    // 1. Geocode both inputs
    const [startCoords, destCoords] = await Promise.all([
      geocode(startVal),
      geocode(destVal)
    ]);

    if (!startCoords) {
      showAlert('Could not find start location. Try "lat, lng" format.', 'error');
      cardsArea.innerHTML = '';
      return;
    }
    if (!destCoords) {
      showAlert('Could not find destination. Try "lat, lng" format.', 'error');
      cardsArea.innerHTML = '';
      return;
    }

    // 2. Fetch OSRM routes
    const osrmUrl = `${OSRM_URL}/route/v1/driving/${startCoords.lng},${startCoords.lat};${destCoords.lng},${destCoords.lat}?alternatives=true&geometries=geojson&overview=full&steps=false`;
    const osrmResp = await fetch(osrmUrl);
    if (!osrmResp.ok) throw new Error('OSRM routing failed');
    const osrmData = await osrmResp.json();

    if (!osrmData.routes || osrmData.routes.length === 0) {
      showAlert('No routes found between these locations', 'error');
      cardsArea.innerHTML = '';
      return;
    }

    allRoutes = osrmData.routes;

    // 3. Fetch potholes near start
    const nearbyResp = await fetch(
      `${BACKEND_URL}/potholes/nearby?lat=${startCoords.lat}&lng=${startCoords.lng}&radius_km=15`
    );
    const nearbyData = await nearbyResp.json();
    const potholes = nearbyData.potholes || [];

    // 4. Analyse each route
    routePotholes = allRoutes.map(route => analyzePotholesOnRoute(route, potholes));

    // 5. Find safest route (lowest risk score)
    const riskScores = routePotholes.map(rp => rp.riskScore);
    selectedRouteIdx = riskScores.indexOf(Math.min(...riskScores));

    // 6. Render route cards
    renderRouteCards(cardsArea, startCoords, destCoords);

    // 7. Draw on map
    drawRoutes(startCoords, destCoords);

  } catch (err) {
    console.error('Route search error:', err);
    showAlert('Route search failed: ' + err.message, 'error');
    cardsArea.innerHTML = '';
  } finally {
    btn.textContent = '🔍 Find Routes';
    btn.disabled = false;
  }
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocode(input) {
  // Try coordinate format first: "lat, lng"
  const coordMatch = input.replace(/\s/g, '').match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), label: input };
  }

  // Otherwise use Nominatim geocoding
  try {
    const resp = await fetch(
      `${NOMINATIM_URL}/search?q=${encodeURIComponent(input)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await resp.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name
      };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }
  return null;
}

// ── Route Analysis ──────────────────────────────────────────────────────────

function analyzePotholesOnRoute(route, potholes) {
  const coords = route.geometry.coordinates; // [[lng, lat], ...]
  const THRESHOLD_M = 35; // meters from route

  const potholeMatches = [];

  for (const pothole of potholes) {
    const pLat = pothole.latitude;
    const pLng = pothole.longitude;
    let minDist = Infinity;

    // Check distance to each segment
    for (let i = 0; i < coords.length - 1; i++) {
      const dist = pointToSegmentDistance(pLat, pLng, coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
      if (dist < minDist) minDist = dist;
    }

    if (minDist <= THRESHOLD_M) {
      potholeMatches.push({ ...pothole, distanceFromRoute: minDist });
    }
  }

  const highCount = potholeMatches.filter(p => p.severity === 'high').length;
  const mediumCount = potholeMatches.filter(p => p.severity === 'medium').length;
  const riskScore = highCount * 2 + mediumCount * 1;

  return { potholes: potholeMatches, highCount, mediumCount, riskScore };
}

function pointToSegmentDistance(pLat, pLng, aLat, aLng, bLat, bLng) {
  // Approximate in meters using flat-earth for small distances
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;

  const latScale = R * Math.PI / 180;
  const lngScale = R * Math.cos(toRad((aLat + bLat) / 2)) * Math.PI / 180;

  const px = (pLng - aLng) * lngScale;
  const py = (pLat - aLat) * latScale;
  const dx = (bLng - aLng) * lngScale;
  const dy = (bLat - aLat) * latScale;

  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));

  const nearX = dx * t - px;
  const nearY = dy * t - py;
  return Math.sqrt(nearX * nearX + nearY * nearY);
}

// ── Route Cards UI ────────────────────────────────────────────────────────────

function renderRouteCards(container, startCoords, destCoords) {
  container.innerHTML = '';

  const riskScores = routePotholes.map(rp => rp.riskScore);
  const safestIdx = riskScores.indexOf(Math.min(...riskScores));

  allRoutes.forEach((route, idx) => {
    const rp = routePotholes[idx];
    const isSafest = idx === safestIdx;
    const isSelected = idx === selectedRouteIdx;

    const distKm = (route.distance / 1000).toFixed(1);
    const mins = Math.round(route.duration / 60);
    const riskLabel = rp.riskScore === 0 ? 'Safe' : rp.riskScore <= 3 ? 'Moderate' : 'High Risk';
    const riskColor = rp.riskScore === 0 ? '#10b981' : rp.riskScore <= 3 ? '#f59e0b' : '#ef4444';
    const routeColors = ['#10b981', '#f59e0b', '#ef4444'];
    const routeColor = isSafest ? routeColors[0] : routeColors[Math.min(idx, 2)];

    const card = document.createElement('div');
    card.id = `routeCard-${idx}`;
    card.style.cssText = `
      padding: 1rem; border-radius: 0.75rem; cursor: pointer;
      border: 2px solid ${isSelected ? routeColor : 'var(--border)'};
      background: ${isSelected ? routeColor + '15' : 'var(--bg-tertiary)'};
      transition: all 0.2s; position: relative;
    `;

    const badge = isSafest ? `<span style="
      position:absolute; top:0.5rem; right:0.5rem;
      background:#10b981; color:white; font-size:0.7rem; font-weight:700;
      padding:0.2rem 0.5rem; border-radius:0.5rem; letter-spacing:0.5px;
    ">✓ SAFEST</span>` : '';

    card.innerHTML = `
      ${badge}
      <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.6rem;">
        <span style="width:14px;height:14px;border-radius:50%;background:${routeColor};flex-shrink:0;"></span>
        <strong style="font-size:0.95rem;">Route ${idx + 1}</strong>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.85rem;margin-bottom:0.6rem;">
        <div><span style="color:var(--text-secondary);">Distance</span><br><strong>${distKm} km</strong></div>
        <div><span style="color:var(--text-secondary);">Est. Time</span><br><strong>${mins} min</strong></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;">
        <div>
          <span style="color:var(--text-secondary);">Potholes: </span>
          <span style="color:#ef4444;font-weight:600;">${rp.highCount}H</span>
          <span style="color:var(--text-secondary);"> + </span>
          <span style="color:#f59e0b;font-weight:600;">${rp.mediumCount}M</span>
        </div>
        <span style="
          padding:0.2rem 0.6rem; border-radius:0.4rem; font-weight:700; font-size:0.78rem;
          color:${riskColor}; background:${riskColor}22;
        ">${riskLabel}</span>
      </div>
    `;

    card.onclick = () => selectRoute(idx, startCoords, destCoords);
    container.appendChild(card);
  });

  // Show start journey button
  const journeyBtn = document.getElementById('startJourneyBtn');
  journeyBtn.style.display = 'block';
}

function selectRoute(idx, startCoords, destCoords) {
  selectedRouteIdx = idx;

  // Update card styles
  allRoutes.forEach((_, i) => {
    const card = document.getElementById(`routeCard-${i}`);
    if (!card) return;
    const rp = routePotholes[i];
    const isSafest = i === allRoutes.findIndex((_, si) =>
      routePotholes[si].riskScore === Math.min(...routePotholes.map(r => r.riskScore))
    );
    const routeColors = ['#10b981', '#f59e0b', '#ef4444'];
    const routeColor = isSafest ? routeColors[0] : routeColors[Math.min(i, 2)];

    if (i === idx) {
      card.style.border = `2px solid ${routeColor}`;
      card.style.background = routeColor + '15';
    } else {
      card.style.border = '2px solid var(--border)';
      card.style.background = 'var(--bg-tertiary)';
    }
  });

  // Re-draw routes to highlight selected
  drawRoutes(startCoords, destCoords);
  _lastStartCoords = startCoords;
  _lastDestCoords = destCoords;
}

let _lastStartCoords = null;
let _lastDestCoords = null;

// ── Map Drawing ───────────────────────────────────────────────────────────────

function initializeRouteMap() {
  try {
    routeMap = L.map('routeMap').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(routeMap);
  } catch (err) {
    console.error('Route map init error:', err);
  }
}

function drawRoutes(startCoords, destCoords) {
  if (!routeMap) return;

  _lastStartCoords = startCoords;
  _lastDestCoords = destCoords;

  // Clear previous layers
  [...routeLayers, ...markerLayers, ...potholeLayer].forEach(l => {
    try { routeMap.removeLayer(l); } catch (_) { }
  });
  routeLayers = [];
  markerLayers = [];
  potholeLayer = [];

  const safestIdx = routePotholes.reduce((best, rp, i) =>
    rp.riskScore < routePotholes[best].riskScore ? i : best, 0);

  const routeColors = ['#10b981', '#f59e0b', '#ef4444'];
  const allBounds = [];

  allRoutes.forEach((route, idx) => {
    const isSafest = idx === safestIdx;
    const isSelected = idx === selectedRouteIdx;
    const routeColor = isSafest ? routeColors[0] : routeColors[Math.min(idx, 1)];

    // Convert coordinates [lng, lat] → [lat, lng]
    const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
    allBounds.push(...latlngs);

    const polyline = L.polyline(latlngs, {
      color: routeColor,
      weight: isSelected ? 7 : 4,
      opacity: isSelected ? 0.9 : 0.45,
      interactive: true
    });

    polyline.on('click', () => selectRoute(idx, startCoords, destCoords));
    polyline.bindTooltip(`Route ${idx + 1} – ${(route.distance / 1000).toFixed(1)} km`);
    polyline.addTo(routeMap);
    routeLayers.push(polyline);

    // Draw potholes for selected route only
    if (isSelected) {
      routePotholes[idx].potholes.forEach(p => {
        const color = p.severity === 'high' ? '#ef4444' : '#f59e0b';
        const circle = L.circleMarker([p.latitude, p.longitude], {
          radius: 7, fillColor: color, color: '#fff',
          weight: 1.5, opacity: 1, fillOpacity: 0.85
        });
        circle.bindPopup(`
          <div style="font-size:0.85rem;">
            <strong>Pothole</strong><br>
            Severity: <span style="color:${color};font-weight:700;">${p.severity.toUpperCase()}</span><br>
            ${p.description ? `Note: ${p.description}` : ''}
          </div>
        `);
        circle.addTo(routeMap);
        potholeLayer.push(circle);
      });
    }
  });

  // Start / End markers
  const startIcon = createDotIcon('#10b981');
  const endIcon = createDotIcon('#ef4444');

  const startMarker = L.marker([startCoords.lat, startCoords.lng], { icon: startIcon })
    .bindPopup(`<strong>Start</strong><br>${startCoords.label || ''}`)
    .addTo(routeMap);
  const endMarker = L.marker([destCoords.lat, destCoords.lng], { icon: endIcon })
    .bindPopup(`<strong>Destination</strong><br>${destCoords.label || ''}`)
    .addTo(routeMap);

  markerLayers = [startMarker, endMarker];

  // Fit bounds
  if (allBounds.length > 0) {
    routeMap.fitBounds(allBounds, { padding: [40, 40] });
  }
}

function createDotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

// ── Start Journey ─────────────────────────────────────────────────────────────

function startJourney() {
  if (allRoutes.length === 0) return;

  const route = allRoutes[selectedRouteIdx];
  const potholes = routePotholes[selectedRouteIdx].potholes;
  // Convert coordinates [lng, lat] → [lat, lng]
  const routeCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);

  routeStore.setRoute(route, potholes, routeCoords, _lastDestCoords);
  router.navigate('journey');
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function getUserLocation() {
  return new Promise(resolve => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      resolve(null);
    }
  });
}
