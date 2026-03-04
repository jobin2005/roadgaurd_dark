import { createNavbar } from "../components/navbar.js";
import { routeStore } from "../services/routeStore.js";
import { router } from "../router.js";
import { BACKEND_URL } from "../services/apiConfig.js";

const FLAG_WINDOW_SECONDS = 60;

// ── Vehicle profiles ──────────────────────────────────────────────────────────
const VEHICLE_PROFILES = {
    two_wheeler: {
        label: "Two Wheeler",
        description: "Motorcycle, scooter, bicycle",
        warningSeconds: 15,
        passageRadius: 40,
        beepFreq: 1000,
        beepDuration: 0.9,
        vibration: [300, 100, 300, 100, 300],
        color: "#ef4444",
        priority: "HIGH",
    },
    three_wheeler: {
        label: "Three Wheeler",
        description: "Auto rickshaw, tuk-tuk",
        warningSeconds: 13,
        passageRadius: 35,
        beepFreq: 880,
        beepDuration: 0.7,
        vibration: [200, 100, 200],
        color: "#f59e0b",
        priority: "ELEVATED",
    },
    four_wheeler: {
        label: "Four Wheeler",
        description: "Car, SUV, van",
        warningSeconds: 10,
        passageRadius: 30,
        beepFreq: 660,
        beepDuration: 0.5,
        vibration: [150],
        color: "#3b82f6",
        priority: "STANDARD",
    },
    truck: {
        label: "Truck",
        description: "Lorry, heavy vehicle",
        warningSeconds: 10,
        passageRadius: 30,
        beepFreq: 660,
        beepDuration: 0.5,
        vibration: [150],
        color: "#8b5cf6",
        priority: "STANDARD",
    },
};

let selectedVehicle = null;

// ── Entry point ───────────────────────────────────────────────────────────────

export function renderJourneyPage(container) {
    const routeCoords = routeStore.getRouteCoords();
    const potholes = routeStore.getPotholes();
    const destination = routeStore.getDestination();

    if (!routeCoords || routeCoords.length === 0) {
        router.navigate("route");
        return;
    }

    // Show vehicle selection first
    showVehicleSelector(container, routeCoords, potholes, destination);
}

// ── Vehicle Selector Modal ────────────────────────────────────────────────────

function showVehicleSelector(container, routeCoords, potholes, destination) {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:1rem;
  `;

    const modal = document.createElement("div");
    modal.className = 'glass-modal';
    modal.style.cssText = `
    border-radius:var(--radius-xl);padding:2rem;max-width:480px;width:100%;
    box-shadow:var(--shadow-xl);
  `;

    const title = document.createElement("h2");
    title.textContent = "Select Your Vehicle";
    title.style.cssText = "margin:0 0 0.4rem 0;font-size:1.3rem;font-weight:700;color:#F0F0F2;";

    const subtitle = document.createElement("p");
    subtitle.textContent =
        "Alert sensitivity will be adjusted based on your vehicle type.";
    subtitle.style.cssText =
        "margin:0 0 1.5rem 0;color:var(--text-secondary);font-size:0.85rem;";

    const grid = document.createElement("div");
    grid.style.cssText =
        "display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.5rem;";

    let selectedKey = null;
    const cards = {};

    Object.entries(VEHICLE_PROFILES).forEach(([key, profile]) => {
        const card = document.createElement("div");
        card.style.cssText = `
      padding:1rem;border-radius:var(--radius-m);cursor:pointer;
      border:1px solid var(--border);background:var(--bg-raised);
      transition:all 0.2s ease;text-align:center;
    `;

        card.innerHTML = `
      <div style="font-size:2rem;margin-bottom:0.4rem;">${profile.label.split(" ")[0]}</div>
      <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.2rem;">${profile.label.split(" ").slice(1).join(" ")}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.5rem;">${profile.description}</div>
      <span style="
        font-size:0.7rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:0.3rem;
        background:${profile.color}22;color:${profile.color};
      ">${profile.priority} ALERT</span>
    `;

        card.onmouseenter = () => {
            if (selectedKey !== key)
                card.style.borderColor = profile.color + "88";
        };
        card.onmouseleave = () => {
            if (selectedKey !== key) card.style.borderColor = "var(--border)";
        };

        card.onclick = () => {
            // Deselect previous
            if (selectedKey && cards[selectedKey]) {
                cards[selectedKey].style.borderColor = "var(--border)";
                cards[selectedKey].style.background = "var(--bg-raised)";
            }
            selectedKey = key;
            card.style.borderColor = profile.color;
            card.style.background = profile.color + "15";
            startBtn.disabled = false;
            startBtn.style.opacity = "1";
        };

        cards[key] = card;
        grid.appendChild(card);
    });

    // ── Voice Alerts toggle ──────────────────────────────────────────────
    const voiceRow = document.createElement("label");
    voiceRow.style.cssText = `
    display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.9rem;
    background:var(--bg-raised);border:1px solid var(--border);
    border-radius:var(--radius-m);cursor:pointer;margin-bottom:1rem;
    transition:border-color 0.2s ease;
  `;
    voiceRow.onmouseenter = () => { voiceRow.style.borderColor = 'var(--accent)'; };
    voiceRow.onmouseleave = () => { voiceRow.style.borderColor = 'var(--border)'; };

    const voiceCheck = document.createElement("input");
    voiceCheck.type = "checkbox";
    voiceCheck.checked = voiceEnabled;
    voiceCheck.style.cssText = `
    width:18px;height:18px;accent-color:var(--accent);cursor:pointer;
    border-radius:4px;flex-shrink:0;
  `;
    voiceCheck.onchange = () => {
        voiceEnabled = voiceCheck.checked;
        localStorage.setItem("rg_voiceEnabled", voiceEnabled);
    };

    const voiceLabel = document.createElement("span");
    voiceLabel.style.cssText = "font-size:0.88rem;font-weight:600;color:#F0F0F2;display:inline-flex;align-items:center;gap:0.4rem;";
    voiceLabel.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Voice Alerts';

    const voiceHint = document.createElement("span");
    voiceHint.style.cssText = "font-size:0.72rem;color:var(--text-secondary);margin-left:auto;";
    voiceHint.textContent = "Spoken pothole warnings";

    voiceRow.appendChild(voiceCheck);
    voiceRow.appendChild(voiceLabel);
    voiceRow.appendChild(voiceHint);

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Journey";
    startBtn.disabled = true;
    startBtn.style.cssText = `
    width:100%;padding:0.75rem;font-weight:600;font-size:0.9rem;
    background:var(--accent);
    border:none;border-radius:var(--radius-m);color:white;cursor:pointer;
    opacity:0.5;transition:all 0.2s ease;
  `;

    startBtn.onclick = () => {
        selectedVehicle = VEHICLE_PROFILES[selectedKey];
        // Prime speech synthesis on user gesture so browsers allow it later
        if (voiceEnabled && 'speechSynthesis' in window) {
            const primer = new SpeechSynthesisUtterance('');
            primer.volume = 0;
            window.speechSynthesis.speak(primer);
        }
        overlay.remove();
        renderJourneyUI(container, routeCoords, potholes, destination);
    };

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(grid);
    modal.appendChild(voiceRow);
    modal.appendChild(startBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// ── Journey UI ────────────────────────────────────────────────────────────────

function renderJourneyUI(container, routeCoords, potholes, destination) {
    const app = document.createElement("div");
    app.style.cssText =
        "display:flex;flex-direction:column;min-height:100vh;position:relative;";
    app.appendChild(createNavbar('journey'));

    const hud = document.createElement("div");
    hud.className = 'glass-hud';
    hud.style.cssText = `
    display:flex;align-items:center;gap:1rem;flex-wrap:wrap;
    padding:0.75rem 1.25rem;
    z-index:200;position:relative;
  `;

    const speedBox = createHudBox("Speed", "— km/h", "speedDisplay", "#FF6A00");
    const distBox = createHudBox(
        "Distance to Dest",
        "—",
        "distDisplay",
        "#8b5cf6",
    );
    const statusBox = createHudBox(
        "Status",
        "Locating...",
        "statusDisplay",
        "#10b981",
    );

    // Vehicle badge
    const vehicleBadge = document.createElement("div");
    vehicleBadge.style.cssText = `
    padding:0.4rem 0.9rem;
    background:${selectedVehicle.color}18;
    border:1px solid ${selectedVehicle.color}44;
    border-radius:0.5rem;font-size:0.85rem;font-weight:700;
    color:${selectedVehicle.color};
  `;
    vehicleBadge.textContent = selectedVehicle.label;

    const exitBtn = document.createElement("button");
    exitBtn.textContent = "Exit Journey";
    exitBtn.style.cssText = `
    margin-left:auto;padding:0.4rem 0.85rem;background:var(--error);
    border:none;border-radius:var(--radius-s);color:white;font-weight:600;
    cursor:pointer;font-size:0.82rem;min-height:auto;
  `;
    exitBtn.onclick = stopJourney;

    hud.appendChild(speedBox);
    hud.appendChild(distBox);
    hud.appendChild(statusBox);
    hud.appendChild(vehicleBadge);
    hud.appendChild(exitBtn);
    app.appendChild(hud);

    const mapDiv = document.createElement("div");
    mapDiv.id = "journeyMap";
    mapDiv.style.cssText = "flex:1;min-height:0;position:relative;";
    app.appendChild(mapDiv);

    const warningOverlay = createWarningOverlay();
    warningOverlay.id = "potholeWarning";
    document.body.appendChild(warningOverlay);

    const flagPanel = createFlagPanel();
    flagPanel.id = "flagPanel";
    document.body.appendChild(flagPanel);

    container.appendChild(app);

    setTimeout(() => initJourneyMap(routeCoords, potholes, destination), 50);
}

// ── HUD helpers ───────────────────────────────────────────────────────────────

function createHudBox(label, value, id, color) {
    const box = document.createElement("div");
    box.style.cssText = `
    padding:0.4rem 0.9rem;background:${color}10;
    border:1px solid ${color}25;border-radius:var(--radius-s);min-width:130px;
  `;
    box.innerHTML = `
    <div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
    <div id="${id}" style="font-size:1.1rem;font-weight:700;color:${color};">${value}</div>
  `;
    return box;
}

// ── Warning Overlay ───────────────────────────────────────────────────────────

function createWarningOverlay() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
    display:none;position:fixed;top:120px;left:50%;transform:translateX(-50%);
    z-index:9999;color:white;
    border-radius:16px;padding:1.2rem 2rem;text-align:center;
    min-width:300px;animation:warnPulse 0.5s ease-out;
    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  `;

    const style = document.createElement("style");
    style.textContent = `
    @keyframes warnPulse {
      0% { transform:translateX(-50%) scale(0.8);opacity:0; }
      100% { transform:translateX(-50%) scale(1);opacity:1; }
    }
  `;
    document.head.appendChild(style);

    overlay.innerHTML = `
    <div style="font-size:1.2rem;margin-bottom:0.3rem;font-weight:700;color:var(--warning);">WARNING</div>
    <div id="warningTitle" style="font-weight:800;font-size:1.15rem;margin-bottom:0.25rem;">POTHOLE AHEAD!</div>
    <div id="warningDetail" style="font-size:0.9rem;opacity:0.9;"></div>
    <div id="warningVehicle" style="font-size:0.8rem;opacity:0.75;margin-top:0.3rem;"></div>
  `;
    return overlay;
}

// ── Flag Panel ────────────────────────────────────────────────────────────────

function createFlagPanel() {
    const panel = document.createElement("div");
    panel.className = 'glass-modal';
    panel.style.cssText = `
    display:none;position:fixed;bottom:5rem;right:1.5rem;
    z-index:9998;
    border-radius:var(--radius-l);
    padding:1rem 1.25rem;max-width:270px;
    box-shadow:var(--shadow-lg);
  `;
    panel.innerHTML = `
    <p style="margin:0 0 0.6rem 0;font-weight:600;font-size:0.95rem;">Not a pothole?</p>
    <p style="margin:0 0 0.75rem 0;font-size:0.82rem;color:var(--text-secondary);" id="flagDetail"></p>
    <div style="display:flex;gap:0.5rem;">
      <button id="confirmFlagBtn" style="flex:1;padding:0.5rem;font-size:0.85rem;background:var(--accent);border:none;border-radius:var(--radius-s);color:white;font-weight:600;cursor:pointer;min-height:auto;">
        Flag as Fake
      </button>
      <button id="dismissFlagBtn" style="padding:0.5rem 0.75rem;font-size:0.85rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-s);color:var(--text-secondary);cursor:pointer;min-height:auto;">
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
let voiceEnabled = localStorage.getItem("rg_voiceEnabled") !== "false";
let currentlySpeaking = false;

// ── Voice Alert (TTS) ─────────────────────────────────────────────────────────

function speakAlert(text) {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    if (currentlySpeaking) return;

    try {
        // Cancel any lingering queued utterances
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        currentlySpeaking = true;
        utterance.onend = () => { currentlySpeaking = false; };
        utterance.onerror = () => { currentlySpeaking = false; };

        window.speechSynthesis.speak(utterance);
    } catch (_) {
        currentlySpeaking = false;
    }
}

function initJourneyMap(routeCoords, potholes, destination) {
    if (!document.getElementById("journeyMap")) return;

    const startCoord = routeCoords[0];
    journeyMap = L.map("journeyMap").setView(startCoord, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
    }).addTo(journeyMap);

    L.polyline(routeCoords, {
        color: "#FF6A00",
        weight: 6,
        opacity: 0.85,
    }).addTo(journeyMap);

    potholes.forEach((p) => {
        const color = p.severity === "high" ? "#ef4444" : "#f59e0b";
        const circle = L.circleMarker([p.latitude, p.longitude], {
            radius: 9,
            fillColor: color,
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
        });
        circle.bindPopup(`
      <strong>Pothole</strong><br>
      Severity: <span style="color:${color};font-weight:700;">${p.severity.toUpperCase()}</span>
    `);
        circle.addTo(journeyMap);
    });

    if (destination) {
        L.marker([destination.lat, destination.lng], {
            icon: L.divIcon({
                className: "",
                html: `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            }),
        })
            .bindPopup("<strong>Destination</strong>")
            .addTo(journeyMap);
    }

    document.getElementById("confirmFlagBtn").onclick = async () => {
        if (!currentFlagPothole) return;
        await submitFlag(currentFlagPothole);
        hideFlagPanel();
    };
    document.getElementById("dismissFlagBtn").onclick = hideFlagPanel;

    startGPS(routeCoords, potholes, destination);
}

function startGPS(routeCoords, potholes, destination) {
    if (!("geolocation" in navigator)) {
        updateStatus("GPS not available");
        return;
    }

    const statusEl = document.getElementById("statusDisplay");
    if (statusEl) statusEl.textContent = "Acquiring GPS...";

    watchId = navigator.geolocation.watchPosition(
        (pos) => onPositionUpdate(pos, routeCoords, potholes, destination),
        (err) => {
            console.error("GPS error:", err);
            updateStatus("GPS error");
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
}

function onPositionUpdate(pos, routeCoords, potholes, destination) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const now = Date.now();

    let speedKmh = pos.coords.speed != null ? pos.coords.speed * 3.6 : null;
    if (speedKmh == null && lastPos && lastPosTime) {
        const distM = haversineM(lat, lng, lastPos.lat, lastPos.lng);
        const dtSec = (now - lastPosTime) / 1000;
        speedKmh = dtSec > 0 ? (distM / dtSec) * 3.6 : 0;
    }
    lastPos = { lat, lng };
    lastPosTime = now;

    const speedEl = document.getElementById("speedDisplay");
    if (speedEl)
        speedEl.textContent =
            speedKmh != null ? `${speedKmh.toFixed(0)} km/h` : "— km/h";
    updateStatus("Live Tracking");

    if (destination) {
        const distKm =
            haversineM(lat, lng, destination.lat, destination.lng) / 1000;
        const distEl = document.getElementById("distDisplay");
        if (distEl)
            distEl.textContent =
                distKm < 1
                    ? `${Math.round(distKm * 1000)} m`
                    : `${distKm.toFixed(2)} km`;
    }

    if (journeyMap) {
        if (!userMarker) {
            userMarker = L.circleMarker([lat, lng], {
                radius: 10,
                fillColor: "#3b82f6",
                color: "#fff",
                weight: 3,
                opacity: 1,
                fillOpacity: 1,
            })
                .addTo(journeyMap)
                .bindPopup("You are here");
        } else {
            userMarker.setLatLng([lat, lng]);
        }
        journeyMap.panTo([lat, lng], { animate: true, duration: 0.5 });
    }

    // Use vehicle profile thresholds
    const vehicle = selectedVehicle;
    const effectiveSpeedMs =
        speedKmh != null && speedKmh > 1 ? speedKmh / 3.6 : 50 / 3.6;

    // Collect newly-warned potholes this tick for batched voice alert
    const newlyWarned = [];

    for (const pothole of potholes) {
        const pId = pothole.id;
        const distM = haversineM(lat, lng, pothole.latitude, pothole.longitude);

        if (distM <= vehicle.passageRadius && !passedPotholes.has(pId)) {
            passedPotholes.add(pId);
            recordPassage(pId);
            setTimeout(() => showFlagPanel(pothole), 20000);
        }

        if (!warnedPotholes.has(pId) && !passedPotholes.has(pId)) {
            const secondsToReach = distM / effectiveSpeedMs;
            if (secondsToReach <= vehicle.warningSeconds) {
                warnedPotholes.add(pId);
                triggerPotholeWarning(pothole, secondsToReach, true); // suppress individual voice
                newlyWarned.push({ pothole, secondsToReach });
            }
        }
    }

    // ── Batched voice alert ────────────────────────────────────────────
    const voiceWorthy = newlyWarned.filter(w => w.pothole.severity !== 'low');
    if (voiceWorthy.length > 1) {
        // Group by severity
        const highCount = voiceWorthy.filter(w => w.pothole.severity === 'high').length;
        const medCount = voiceWorthy.filter(w => w.pothole.severity === 'medium').length;
        const parts = [];
        if (highCount > 0) parts.push(`${highCount} high severity`);
        if (medCount > 0) parts.push(`${medCount} medium severity`);
        speakAlert(`Warning: multiple potholes ahead. ${parts.join(' and ')}.`);
    } else if (voiceWorthy.length === 1) {
        const w = voiceWorthy[0];
        speakAlert(`Warning: ${w.pothole.severity} severity pothole ahead, approximately ${Math.round(w.secondsToReach)} seconds away.`);
    }
}

// ── Warning ───────────────────────────────────────────────────────────────────

function triggerPotholeWarning(pothole, secondsAway, suppressVoice = false) {
    const overlay = document.getElementById("potholeWarning");
    const detail = document.getElementById("warningDetail");
    const vehicleEl = document.getElementById("warningVehicle");
    if (!overlay || !detail) return;

    const vehicle = selectedVehicle;

    // Style overlay based on vehicle priority color
    overlay.style.background = `rgba(${hexToRgb(vehicle.color)},0.95)`;
    overlay.style.boxShadow = `0 8px 32px rgba(${hexToRgb(vehicle.color)},0.5)`;

    detail.textContent = `${pothole.severity.toUpperCase()} severity — ~${Math.round(secondsAway)}s away`;
    if (vehicleEl)
        vehicleEl.textContent = `${vehicle.label} · ${vehicle.priority} alert mode`;

    overlay.style.display = "block";

    playBeep(vehicle.beepFreq, vehicle.beepDuration);

    if ("vibrate" in navigator) {
        navigator.vibrate(vehicle.vibration);
    }

    // Voice alert for non-low severity (only when not batched externally)
    if (!suppressVoice && pothole.severity !== 'low') {
        speakAlert(`Warning: ${pothole.severity} severity pothole ahead, approximately ${Math.round(secondsAway)} seconds away.`);
    }

    setTimeout(() => {
        overlay.style.display = "none";
    }, 6000);
}

function playBeep(freq = 880, duration = 0.6) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + duration,
        );
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (_) { }
}

// ── Flag Panel ────────────────────────────────────────────────────────────────

function showFlagPanel(pothole) {
    currentFlagPothole = pothole;
    const panel = document.getElementById("flagPanel");
    const detail = document.getElementById("flagDetail");
    if (!panel || !detail) return;

    detail.textContent = `Reported as ${pothole.severity} severity. Was this actually a pothole?`;
    panel.style.display = "block";

    if (flagTimeout) clearTimeout(flagTimeout);
    flagTimeout = setTimeout(hideFlagPanel, FLAG_WINDOW_SECONDS * 1000);
}

function hideFlagPanel() {
    const panel = document.getElementById("flagPanel");
    if (panel) panel.style.display = "none";
    currentFlagPothole = null;
    if (flagTimeout) clearTimeout(flagTimeout);
}

async function submitFlag(pothole) {
    try {
        const user = window.getCurrentUser();
        if (!user) return;

        const resp = await fetch(`${BACKEND_URL}/potholes/${pothole.id}/flag`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
        });
        const data = await resp.json();

        if (!resp.ok) {
            showTemporaryToast(
                data.error || "Could not submit flag",
                "#ef4444",
            );
        } else if (data.pothole_removed) {
            showTemporaryToast(
                "Pothole marked as removed. Thank you!",
                "#10b981",
            );
        } else {
            showTemporaryToast(
                `Flagged! (${data.total_flags} flags total)`,
                "#f59e0b",
            );
        }
    } catch (err) {
        console.error("Flag submit error:", err);
        showTemporaryToast("Flag failed – check connection", "#ef4444");
    }
}

async function recordPassage(potholeId) {
    try {
        const user = window.getCurrentUser();
        if (!user) return;
        await fetch(`${BACKEND_URL}/potholes/${potholeId}/passage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
        });
    } catch (_) { }
}

// ── Stop Journey ──────────────────────────────────────────────────────────────

function stopJourney() {
    if (watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    // Cancel any in-progress speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentlySpeaking = false;

    const warning = document.getElementById("potholeWarning");
    const flagPanel = document.getElementById("flagPanel");
    if (warning) warning.remove();
    if (flagPanel) flagPanel.remove();

    warnedPotholes.clear();
    passedPotholes.clear();
    currentFlagPothole = null;
    selectedVehicle = null;

    router.navigate("route");
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function updateStatus(text) {
    const el = document.getElementById("statusDisplay");
    if (el) el.textContent = text;
}

function haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

function showTemporaryToast(message, color) {
    const toast = document.createElement("div");
    toast.className = 'glass-toast';
    toast.style.cssText = `
    position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
    color:white;padding:0.6rem 1.25rem;
    border-radius:var(--radius-s);font-weight:600;z-index:99999;
    box-shadow:var(--shadow-md);font-size:0.85rem;
    border-left:3px solid ${color};
  `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
