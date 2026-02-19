import { createNavbar } from '../components/navbar.js';
import { routeStore } from '../services/routeStore.js';
import { router } from '../router.js';

const BACKEND_URL = 'http://localhost:8000';
const PASSAGE_RADIUS_M = 30;       // metres to consider "passed" a pothole
const WARNING_SECONDS = 10;        // warn if pothole is ≤ this many seconds away
const FLAG_WINDOW_SECONDS = 60;    // show flag button for 60 seconds after passing

export function renderJourneyPage(container) {
    const routeCoords = routeStore.getRouteCoords();
    const potholes = routeStore.getPotholes();
    const destination = routeStore.getDestination();

    if (!routeCoords || routeCoords.length === 0) {
        // No route data – redirect back
        router.navigate('route');
        return;
    }

    // ── Build UI ────────────────────────────────────────────────────────────────
    const app = document.createElement('div');
    app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;position:relative;';

    app.appendChild(createNavbar());

    // Top HUD bar
    const hud = document.createElement('div');
    hud.style.cssText = `
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 0.75rem 1.25rem;
    background: var(--bg-secondary); border-bottom: 1px solid var(--border);
    z-index: 200; position: relative;
  `;

    const speedBox = createHudBox('Speed', '— km/h', 'speedDisplay', '#3b82f6');
    const distBox = createHudBox('Distance to Dest', '—', 'distDisplay', '#8b5cf6');
    const statusBox = createHudBox('Status', '📡 Locating…', 'statusDisplay', '#10b981');

    const exitBtn = document.createElement('button');
    exitBtn.textContent = '✕ Exit Journey';
    exitBtn.style.cssText = `
    margin-left:auto; padding:0.5rem 1rem; background:var(--error);
    border:none; border-radius:0.5rem; color:white; font-weight:700;
    cursor:pointer; font-size:0.9rem;
  `;
    exitBtn.onclick = stopJourney;

    hud.appendChild(speedBox);
    hud.appendChild(distBox);
    hud.appendChild(statusBox);
    hud.appendChild(exitBtn);
    app.appendChild(hud);

    // Map
    const mapDiv = document.createElement('div');
    mapDiv.id = 'journeyMap';
    mapDiv.style.cssText = 'flex:1; min-height:0; position:relative;';
    app.appendChild(mapDiv);

    // Warning overlay (hidden by default)
    const warningOverlay = createWarningOverlay();
    warningOverlay.id = 'potholeWarning';
    document.body.appendChild(warningOverlay);

    // Flag panel (hidden by default)
    const flagPanel = createFlagPanel();
    flagPanel.id = 'flagPanel';
    document.body.appendChild(flagPanel);

    container.appendChild(app);

    // ── Bootstrap map after DOM is ready ───────────────────────────────────────
    setTimeout(() => initJourneyMap(routeCoords, potholes, destination), 50);
}

// ── HUD helpers ───────────────────────────────────────────────────────────────

function createHudBox(label, value, id, color) {
    const box = document.createElement('div');
    box.style.cssText = `
    padding: 0.4rem 0.9rem; background: ${color}18;
    border: 1px solid ${color}44; border-radius: 0.5rem;
    min-width: 130px;
  `;
    box.innerHTML = `
    <div style="font-size:0.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    <div id="${id}" style="font-size:1.1rem;font-weight:700;color:${color};">${value}</div>
  `;
    return box;
}

// ── Warning Overlay ───────────────────────────────────────────────────────────

function createWarningOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
    display: none; position: fixed; top: 120px; left: 50%; transform: translateX(-50%);
    z-index: 9999; background: rgba(239,68,68,0.95); color: white;
    border-radius: 1rem; padding: 1.2rem 2rem; text-align: center;
    box-shadow: 0 8px 32px rgba(239,68,68,0.5); min-width: 280px;
    animation: warnPulse 0.5s ease-out;
  `;

    const style = document.createElement('style');
    style.textContent = `
    @keyframes warnPulse {
      0% { transform: translateX(-50%) scale(0.8); opacity:0; }
      100% { transform: translateX(-50%) scale(1); opacity:1; }
    }
  `;
    document.head.appendChild(style);

    overlay.innerHTML = `
    <div style="font-size:2rem;margin-bottom:0.3rem;">⚠️</div>
    <div style="font-weight:800;font-size:1.1rem;margin-bottom:0.25rem;">POTHOLE AHEAD!</div>
    <div id="warningDetail" style="font-size:0.9rem;opacity:0.9;"></div>
  `;
    return overlay;
}

// ── Flag Panel ────────────────────────────────────────────────────────────────

function createFlagPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = `
    display: none; position: fixed; bottom: 5rem; right: 1.5rem;
    z-index: 9998; background: var(--bg-secondary);
    border: 2px solid var(--warning); border-radius: 1rem;
    padding: 1rem 1.25rem; max-width: 270px;
    box-shadow: 0 8px 24px rgba(245,158,11,0.3);
  `;
    panel.innerHTML = `
    <p style="margin:0 0 0.6rem 0;font-weight:600;font-size:0.95rem;">🚩 Not a pothole?</p>
    <p style="margin:0 0 0.75rem 0;font-size:0.82rem;color:var(--text-secondary);" id="flagDetail"></p>
    <div style="display:flex;gap:0.5rem;">
      <button id="confirmFlagBtn" style="flex:1;padding:0.5rem;font-size:0.85rem;background:#f59e0b;border:none;border-radius:0.5rem;color:white;font-weight:700;cursor:pointer;">
        🚩 Flag as Fake
      </button>
      <button id="dismissFlagBtn" style="padding:0.5rem 0.75rem;font-size:0.85rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);cursor:pointer;">
        ✕
      </button>
    </div>
  `;
    return panel;
}

// ── Map & Journey Logic ───────────────────────────────────────────────────────

let journeyMap = null;
let watchId = null;
let userMarker = null;
let warnedPotholes = new Set();
let passedPotholes = new Set();
let currentFlagPothole = null;
let flagTimeout = null;
let lastPos = null;
let lastPosTime = null;

function initJourneyMap(routeCoords, potholes, destination) {
    if (!document.getElementById('journeyMap')) return;

    const startCoord = routeCoords[0];
    journeyMap = L.map('journeyMap').setView(startCoord, 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(journeyMap);

    // Draw route
    L.polyline(routeCoords, {
        color: '#3b82f6', weight: 6, opacity: 0.85
    }).addTo(journeyMap);

    // Draw potholes
    potholes.forEach(p => {
        const color = p.severity === 'high' ? '#ef4444' : '#f59e0b';
        const circle = L.circleMarker([p.latitude, p.longitude], {
            radius: 9, fillColor: color, color: '#fff',
            weight: 2, opacity: 1, fillOpacity: 0.9
        });
        circle.bindPopup(`
      <strong>Pothole</strong><br>
      Severity: <span style="color:${color};font-weight:700;">${p.severity.toUpperCase()}</span>
    `);
        circle.addTo(journeyMap);
    });

    // Destination marker
    if (destination) {
        L.marker([destination.lat, destination.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
                iconSize: [18, 18], iconAnchor: [9, 9]
            })
        }).bindPopup('<strong>Destination</strong>').addTo(journeyMap);
    }

    // Set up flag panel buttons
    const confirmFlagBtn = document.getElementById('confirmFlagBtn');
    const dismissFlagBtn = document.getElementById('dismissFlagBtn');

    if (confirmFlagBtn) {
        confirmFlagBtn.onclick = async () => {
            if (!currentFlagPothole) return;
            await submitFlag(currentFlagPothole);
            hideFlagPanel();
        };
    }
    if (dismissFlagBtn) {
        dismissFlagBtn.onclick = hideFlagPanel;
    }

    // Start GPS tracking
    startGPS(routeCoords, potholes, destination);
}

function startGPS(routeCoords, potholes, destination) {
    if (!('geolocation' in navigator)) {
        updateStatus('❌ GPS not available');
        return;
    }

    const statusEl = document.getElementById('statusDisplay');
    if (statusEl) statusEl.textContent = '📡 Acquiring GPS…';

    watchId = navigator.geolocation.watchPosition(
        pos => onPositionUpdate(pos, routeCoords, potholes, destination),
        err => {
            console.error('GPS error:', err);
            updateStatus('❌ GPS error');
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
}

function onPositionUpdate(pos, routeCoords, potholes, destination) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const now = Date.now();

    // ── Speed calculation ──────────────────────────────────────────────────────
    let speedKmh = pos.coords.speed != null ? pos.coords.speed * 3.6 : null;
    if (speedKmh == null && lastPos && lastPosTime) {
        const distM = haversineM(lat, lng, lastPos.lat, lastPos.lng);
        const dtSec = (now - lastPosTime) / 1000;
        speedKmh = dtSec > 0 ? (distM / dtSec) * 3.6 : 0;
    }
    lastPos = { lat, lng };
    lastPosTime = now;

    // Update HUD
    const speedEl = document.getElementById('speedDisplay');
    if (speedEl) speedEl.textContent = speedKmh != null ? `${speedKmh.toFixed(0)} km/h` : '— km/h';
    updateStatus('🟢 Live Tracking');

    // Distance to destination
    if (destination) {
        const distKm = haversineM(lat, lng, destination.lat, destination.lng) / 1000;
        const distEl = document.getElementById('distDisplay');
        if (distEl) distEl.textContent = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(2)} km`;
    }

    // ── Update user marker ─────────────────────────────────────────────────────
    if (journeyMap) {
        if (!userMarker) {
            userMarker = L.circleMarker([lat, lng], {
                radius: 10, fillColor: '#3b82f6', color: '#fff',
                weight: 3, opacity: 1, fillOpacity: 1
            }).addTo(journeyMap).bindPopup('You are here');
        } else {
            userMarker.setLatLng([lat, lng]);
        }
        journeyMap.panTo([lat, lng], { animate: true, duration: 0.5 });
    }

    // ── Pothole proximity check ────────────────────────────────────────────────
    const effectiveSpeedMs = speedKmh != null && speedKmh > 1
        ? speedKmh / 3.6
        : 50 / 3.6;  // fallback: assume 50 km/h

    for (const pothole of potholes) {
        const pId = pothole.id;
        const distM = haversineM(lat, lng, pothole.latitude, pothole.longitude);

        // Record passage (within 30m)
        if (distM <= PASSAGE_RADIUS_M && !passedPotholes.has(pId)) {
            passedPotholes.add(pId);
            recordPassage(pId);
            // Show flag panel after 20 seconds
            setTimeout(() => showFlagPanel(pothole), 20000);
        }

        // Early warning (not yet warned, and pothole is ahead within 10s travel time)
        if (!warnedPotholes.has(pId) && !passedPotholes.has(pId)) {
            const secondsToReach = distM / effectiveSpeedMs;
            if (secondsToReach <= WARNING_SECONDS) {
                warnedPotholes.add(pId);
                triggerPotholeWarning(pothole, secondsToReach);
            }
        }
    }
}

// ── Warning ───────────────────────────────────────────────────────────────────

function triggerPotholeWarning(pothole, secondsAway) {
    const overlay = document.getElementById('potholeWarning');
    const detail = document.getElementById('warningDetail');
    if (!overlay || !detail) return;

    detail.textContent = `${pothole.severity.toUpperCase()} severity – ~${Math.round(secondsAway)}s away`;
    overlay.style.display = 'block';

    // Play audio beep
    playBeep(pothole.severity === 'high' ? 880 : 660);

    // Vibrate if supported
    if ('vibrate' in navigator) {
        navigator.vibrate(pothole.severity === 'high' ? [200, 100, 200] : [150]);
    }

    // Auto-hide after 6 seconds
    setTimeout(() => { overlay.style.display = 'none'; }, 6000);
}

function playBeep(freq = 880) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
    } catch (_) {
        // AudioContext not supported or blocked
    }
}

// ── Flag Panel ────────────────────────────────────────────────────────────────

function showFlagPanel(pothole) {
    currentFlagPothole = pothole;
    const panel = document.getElementById('flagPanel');
    const detail = document.getElementById('flagDetail');
    if (!panel || !detail) return;

    detail.textContent = `Reported as ${pothole.severity} severity. Was this actually a pothole?`;
    panel.style.display = 'block';

    // Auto-dismiss after FLAG_WINDOW_SECONDS
    if (flagTimeout) clearTimeout(flagTimeout);
    flagTimeout = setTimeout(hideFlagPanel, FLAG_WINDOW_SECONDS * 1000);
}

function hideFlagPanel() {
    const panel = document.getElementById('flagPanel');
    if (panel) panel.style.display = 'none';
    currentFlagPothole = null;
    if (flagTimeout) clearTimeout(flagTimeout);
}

async function submitFlag(pothole) {
    try {
        const user = window.getCurrentUser();
        if (!user) return;

        const resp = await fetch(`${BACKEND_URL}/potholes/${pothole.id}/flag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
        });
        const data = await resp.json();

        if (!resp.ok) {
            showTemporaryToast(data.error || 'Could not submit flag', '#ef4444');
        } else if (data.pothole_removed) {
            showTemporaryToast('✅ Pothole marked as removed — thank you!', '#10b981');
        } else {
            showTemporaryToast(`🚩 Flagged! (${data.total_flags} flags total)`, '#f59e0b');
        }
    } catch (err) {
        console.error('Flag submit error:', err);
        showTemporaryToast('Flag failed – check connection', '#ef4444');
    }
}

async function recordPassage(potholeId) {
    try {
        const user = window.getCurrentUser();
        if (!user) return;
        await fetch(`${BACKEND_URL}/potholes/${potholeId}/passage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
        });
    } catch (_) { }
}

// ── Stop Journey ──────────────────────────────────────────────────────────────

function stopJourney() {
    if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    // Remove overlays
    const warning = document.getElementById('potholeWarning');
    const flagPanel = document.getElementById('flagPanel');
    if (warning) warning.remove();
    if (flagPanel) flagPanel.remove();

    warnedPotholes.clear();
    passedPotholes.clear();
    currentFlagPothole = null;

    router.navigate('route');
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function updateStatus(text) {
    const el = document.getElementById('statusDisplay');
    if (el) el.textContent = text;
}

function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showTemporaryToast(message, color) {
    const toast = document.createElement('div');
    toast.style.cssText = `
    position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
    background: ${color}; color: white; padding: 0.75rem 1.5rem;
    border-radius: 0.75rem; font-weight: 600; z-index: 99999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-size: 0.9rem;
    animation: toastIn 0.3s ease-out;
  `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `@keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }`;
    document.head.appendChild(style);

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
