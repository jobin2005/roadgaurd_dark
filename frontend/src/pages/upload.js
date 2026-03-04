import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';
import { BACKEND_URL } from '../services/apiConfig.js';

let cameraStream = null;
let gpsWatchId = null;

export function renderUploadPage(container) {
  const app = document.createElement('div');
  app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;background:var(--bg-base);';
  app.appendChild(createNavbar('upload'));

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;padding:2rem 1.5rem;max-width:640px;margin:0 auto;width:100%;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:2rem;';
  header.innerHTML = `
    <h1 style="margin-bottom:0.35rem;font-size:1.5rem;">Report Pothole</h1>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin:0;">Capture a photo and we'll analyze it with AI</p>
  `;

  const form = document.createElement('form');
  form.id = 'uploadForm';
  form.style.cssText = 'display:flex;flex-direction:column;gap:1.5rem;';

  // ── Section: Photo ────────────────────────────────────────────────────
  const photoSection = document.createElement('div');
  photoSection.style.cssText = `
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius-l); padding: 1.5rem;
  `;

  const photoTitle = document.createElement('h3');
  photoTitle.textContent = 'Photo';
  photoTitle.style.cssText = 'margin-bottom: 1rem; font-size: 0.9rem;';

  const videoContainer = document.createElement('div');
  videoContainer.id = 'videoContainer';
  videoContainer.style.cssText = `
    border-radius: var(--radius-m); overflow: hidden;
    background: var(--bg-raised); aspect-ratio: 4/3;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--border);
  `;

  const video = document.createElement('video');
  video.id = 'cameraFeed';
  video.autoplay = true; video.playsInline = true; video.muted = true;
  video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:none;';

  const canvas = document.createElement('canvas');
  canvas.id = 'captureCanvas';
  canvas.style.display = 'none';

  const preview = document.createElement('img');
  preview.id = 'capturedPreview';
  preview.style.cssText = 'width:100%;height:100%;object-fit:cover;display:none;';

  const placeholder = document.createElement('div');
  placeholder.id = 'cameraPlaceholder';
  placeholder.style.cssText = 'text-align:center;padding:2rem;';
  placeholder.innerHTML = `
    <div style="font-size:2rem;margin-bottom:0.5rem;opacity:0.3;">📷</div>
    <p style="font-size:0.85rem;color:var(--text-secondary);margin:0;">Tap "Open Camera" to begin</p>
  `;

  videoContainer.appendChild(video);
  videoContainer.appendChild(canvas);
  videoContainer.appendChild(preview);
  videoContainer.appendChild(placeholder);

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:0.5rem;margin-top:1rem;';

  const startCameraBtn = document.createElement('button');
  startCameraBtn.type = 'button'; startCameraBtn.id = 'startCameraBtn';
  startCameraBtn.textContent = 'Open Camera';
  startCameraBtn.style.cssText = 'flex:1;font-size:0.85rem;';
  startCameraBtn.onclick = startCamera;

  const captureBtn = document.createElement('button');
  captureBtn.type = 'button'; captureBtn.id = 'captureBtn';
  captureBtn.textContent = 'Capture';
  captureBtn.style.cssText = 'flex:1;font-size:0.85rem;background:var(--success);display:none;';
  captureBtn.onclick = capturePhoto;

  const retakeBtn = document.createElement('button');
  retakeBtn.type = 'button'; retakeBtn.id = 'retakeBtn';
  retakeBtn.textContent = 'Retake';
  retakeBtn.style.cssText = `
    flex:1;font-size:0.85rem;display:none;
    background:transparent;border:1px solid var(--border);color:var(--text-secondary);
  `;
  retakeBtn.onclick = retakePhoto;

  controls.appendChild(startCameraBtn);
  controls.appendChild(captureBtn);
  controls.appendChild(retakeBtn);

  photoSection.appendChild(photoTitle);
  photoSection.appendChild(videoContainer);
  photoSection.appendChild(controls);
  form.appendChild(photoSection);

  // ── Section: Location ─────────────────────────────────────────────────
  const locationSection = document.createElement('div');
  locationSection.style.cssText = `
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius-l); padding: 1.5rem;
  `;
  locationSection.innerHTML = `
    <h3 style="margin-bottom:0.75rem;font-size:0.9rem;">Location</h3>
    <p id="gpsStatus" style="color:var(--text-secondary);font-size:0.85rem;margin:0;">Acquiring GPS position…</p>
  `;
  form.appendChild(locationSection);

  // ── Section: Notes ────────────────────────────────────────────────────
  const notesSection = document.createElement('div');
  notesSection.style.cssText = `
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius-l); padding: 1.5rem;
  `;
  notesSection.innerHTML = `
    <h3 style="margin-bottom:0.75rem;font-size:0.9rem;">Notes <span style="font-weight:400;color:var(--text-tertiary);">(optional)</span></h3>
  `;
  const descInput = document.createElement('textarea');
  descInput.id = 'description';
  descInput.placeholder = 'Add any details about the pothole…';
  descInput.style.cssText = 'width:100%;min-height:72px;resize:vertical;';
  notesSection.appendChild(descInput);
  form.appendChild(notesSection);

  // ── Actions ───────────────────────────────────────────────────────────
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:0.75rem;';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit'; submitBtn.id = 'submitReportBtn';
  submitBtn.textContent = 'Submit Report';
  submitBtn.disabled = true;
  submitBtn.style.cssText = 'flex:1;font-size:0.9rem;opacity:0.5;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex:1;font-size:0.9rem;
    background:transparent;border:1px solid var(--border);color:var(--text-secondary);
  `;

  actions.appendChild(submitBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  content.appendChild(header);
  content.appendChild(form);
  app.appendChild(content);
  container.appendChild(app);

  form.addEventListener('submit', handleUpload);
  cancelBtn.addEventListener('click', () => { stopCamera(); window.history.back(); });
  acquireGPS();
}

// === Camera functions (logic unchanged) ===

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    const video = document.getElementById('cameraFeed');
    document.getElementById('cameraPlaceholder').style.display = 'none';
    document.getElementById('capturedPreview').style.display = 'none';
    video.srcObject = cameraStream;
    video.style.display = 'block';
    document.getElementById('startCameraBtn').style.display = 'none';
    document.getElementById('captureBtn').style.display = 'block';
  } catch (err) {
    showAlert(err.name === 'NotAllowedError' ? 'Camera access denied.' : 'Camera error: ' + err.message, 'error');
  }
}

function capturePhoto() {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('captureCanvas');
  const preview = document.getElementById('capturedPreview');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  preview.src = canvas.toDataURL('image/jpeg', 0.85);
  preview.style.display = 'block'; video.style.display = 'none';
  stopCamera();
  document.getElementById('captureBtn').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'block';
  updateSubmitState();
  acquireGPS();
}

function retakePhoto() {
  document.getElementById('capturedPreview').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'none';
  const btn = document.getElementById('submitReportBtn');
  btn.disabled = true; btn.style.opacity = '0.5';
  startCamera();
}

function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
}

// === GPS functions (logic unchanged) ===

let capturedLocation = null;

function acquireGPS() {
  const el = document.getElementById('gpsStatus');
  if (!el) return;
  if (!('geolocation' in navigator)) { el.textContent = 'Geolocation not available'; el.style.color = 'var(--error)'; return; }
  el.textContent = 'Acquiring location…'; el.style.color = 'var(--warning)';
  if (gpsWatchId != null) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      capturedLocation = { latitude, longitude, accuracy: Math.round(accuracy), timestamp: new Date().toISOString() };
      const acc = Math.round(accuracy);
      el.innerHTML = accuracy > 5000
        ? `<span style="color:var(--warning);">Low accuracy (${acc}m)</span> · ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : `<span style="color:var(--success);">Located</span> · ${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ${acc}m`;
      updateSubmitState();
    },
    () => { el.textContent = 'Location denied'; el.style.color = 'var(--error)'; capturedLocation = null; updateSubmitState(); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function updateSubmitState() {
  const btn = document.getElementById('submitReportBtn');
  const preview = document.getElementById('capturedPreview');
  if (!btn) return;
  const ok = preview?.style.display !== 'none' && preview?.src && capturedLocation;
  btn.disabled = !ok; btn.style.opacity = ok ? '1' : '0.5';
}

// === Upload handler (logic unchanged) ===

async function handleUpload(e) {
  e.preventDefault();
  const canvas = document.getElementById('captureCanvas');
  const description = document.getElementById('description').value;
  if (!capturedLocation) { showAlert('Location not available.', 'error'); return; }
  if (!canvas || canvas.width === 0) { showAlert('Capture a photo first.', 'error'); return; }

  try {
    const user = window.getCurrentUser();
    if (!user) { showAlert('Please log in.', 'error'); return; }
    const btn = document.getElementById('submitReportBtn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
    const file = new File([blob], `pothole_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const fd = new FormData();
    fd.append('image', file); fd.append('user_id', user.id);
    fd.append('latitude', capturedLocation.latitude); fd.append('longitude', capturedLocation.longitude);
    fd.append('description', description);

    const res = await fetch(`${BACKEND_URL}/predict`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Prediction failed');

    showAlert(`${data.result} (${(data.confidence * 100).toFixed(1)}% confidence)`, data.result === 'Pothole' ? 'success' : 'info');
    if (data.result === 'Pothole') showAlert('Report submitted. Thank you!', 'success');

    document.getElementById('uploadForm').reset();
    document.getElementById('capturedPreview').style.display = 'none';
    document.getElementById('cameraPlaceholder').style.display = 'block';
    document.getElementById('retakeBtn').style.display = 'none';
    document.getElementById('startCameraBtn').style.display = 'block';
    capturedLocation = null; btn.textContent = 'Submit Report'; btn.disabled = true; btn.style.opacity = '0.5';
    acquireGPS();
  } catch (err) {
    showAlert(err.message || 'Upload failed', 'error');
    const btn = document.getElementById('submitReportBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Report'; btn.style.opacity = '1'; }
  }
}
