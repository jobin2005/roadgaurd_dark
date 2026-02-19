import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';

export function renderProfilePage(container) {
  const app = document.createElement('div');
  app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;';
  app.appendChild(createNavbar());

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;padding:2rem 1rem;max-width:1000px;margin:0 auto;width:100%;';

  const header = document.createElement('h1');
  header.textContent = 'My Profile';
  header.style.marginBottom = '2rem';

  const mainContainer = document.createElement('div');
  mainContainer.id = 'profileContainer';
  mainContainer.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2rem;';

  content.appendChild(header);
  content.appendChild(mainContainer);
  app.appendChild(content);
  container.appendChild(app);

  loadProfile();
}

async function loadProfile() {
  try {
    const user = window.getCurrentUser();
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    displayProfile(user, profile);
    displayContributions(user);
  } catch (err) {
    showAlert('Error loading profile', 'error');
    console.error(err);
  }
}

function displayProfile(user, profile) {
  const container = document.getElementById('profileContainer');

  const profileCard = document.createElement('div');
  profileCard.className = 'card';
  profileCard.style.cssText = 'padding:2rem;height:fit-content;';

  profileCard.innerHTML = `
    <div style="text-align:center;margin-bottom:2rem;">
      <div style="
        width:90px;height:90px;
        background:linear-gradient(135deg,var(--accent-primary),#8b5cf6);
        border-radius:50%;margin:0 auto 1rem;
        display:flex;align-items:center;justify-content:center;font-size:2.5rem;
      ">👤</div>
    </div>
    <form id="profileForm">
      <div style="margin-bottom:1.25rem;">
        <label style="display:block;margin-bottom:0.5rem;font-weight:500;">Full Name</label>
        <input type="text" id="fullName" value="${profile?.full_name || ''}" style="width:100%;">
      </div>
      <div style="margin-bottom:1.25rem;">
        <label style="display:block;margin-bottom:0.5rem;font-weight:500;">Email</label>
        <input type="email" value="${user.email}" disabled style="width:100%;background:var(--bg-tertiary);cursor:not-allowed;">
      </div>
      <div style="margin-bottom:1.5rem;">
        <label style="display:block;margin-bottom:0.5rem;font-weight:500;">Account Created</label>
        <p style="margin:0;color:var(--text-secondary);">${new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <button type="submit" style="width:100%;padding:0.75rem;font-weight:600;">Save Changes</button>
    </form>
  `;

  profileCard.querySelector('#profileForm').addEventListener('submit', e => handleProfileUpdate(e, user.id));
  container.appendChild(profileCard);
}

async function displayContributions(user) {
  try {
    const { data: potholes, error } = await supabase
      .from('potholes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const container = document.getElementById('profileContainer');

    const statsCard = document.createElement('div');
    statsCard.className = 'card';
    statsCard.style.cssText = 'padding:2rem;';

    const statsTitle = document.createElement('h2');
    statsTitle.textContent = 'Your Contributions';
    statsTitle.style.marginTop = '0';

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem;';

    const active = potholes?.filter(p => !p.status || p.status === 'active').length || 0;
    const removed = potholes?.filter(p => p.status === 'removed').length || 0;
    const highCount = potholes?.filter(p => p.severity === 'high').length || 0;

    statsGrid.appendChild(createStatBox('Total Reports', potholes?.length || 0, 'var(--accent-primary)'));
    statsGrid.appendChild(createStatBox('Active', active, 'var(--success)'));
    statsGrid.appendChild(createStatBox('High Severity', highCount, 'var(--error)'));

    statsCard.appendChild(statsTitle);
    statsCard.appendChild(statsGrid);

    const reportsTitle = document.createElement('h3');
    reportsTitle.textContent = 'My Reports';
    reportsTitle.style.cssText = 'margin-top:1rem;margin-bottom:0.75rem;';
    statsCard.appendChild(reportsTitle);

    if (!potholes || potholes.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No reports yet. Start by uploading pothole images!';
      emptyMsg.style.color = 'var(--text-secondary)';
      statsCard.appendChild(emptyMsg);
    } else {
      // Show ALL reports (no limit)
      const reportsContainer = document.createElement('div');
      reportsContainer.style.cssText = 'max-height: 520px; overflow-y: auto; display:flex;flex-direction:column;gap:0.5rem;padding-right:0.25rem;';

      potholes.forEach((pothole, index) => {
        const reportItem = createReportItem(pothole, index);
        reportsContainer.appendChild(reportItem);
      });

      statsCard.appendChild(reportsContainer);
    }

    container.appendChild(statsCard);
  } catch (err) {
    console.error('Error loading contributions:', err);
  }
}

function getStatusConfig(status) {
  switch (status) {
    case 'removed':
      return { label: 'Removed', color: '#94a3b8', bg: '#94a3b822' };
    case 'pending':
      return { label: 'Pending', color: '#f59e0b', bg: '#f59e0b22' };
    default: // 'active' or null
      return { label: 'Active', color: '#10b981', bg: '#10b98122' };
  }
}

function createReportItem(pothole, index) {
  const reportItem = document.createElement('div');
  reportItem.style.cssText = `
    padding:0.875rem;background:var(--bg-tertiary);border-radius:0.6rem;
    display:flex;justify-content:space-between;align-items:center;
    cursor:pointer;transition:all 0.15s;border:1px solid transparent;
  `;
  reportItem.onmouseenter = () => { reportItem.style.borderColor = 'var(--accent-primary)'; };
  reportItem.onmouseleave = () => { reportItem.style.borderColor = 'transparent'; };

  const severityColor = pothole.severity === 'high' ? 'var(--error)' :
    pothole.severity === 'medium' ? 'var(--warning)' : 'var(--success)';
  const date = new Date(pothole.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const statusCfg = getStatusConfig(pothole.status);

  reportItem.innerHTML = `
    <div style="flex:1;">
      <p style="margin:0 0 0.2rem 0;font-weight:600;font-size:0.9rem;">Report #${index + 1}</p>
      <p style="margin:0;font-size:0.8rem;color:var(--text-secondary);">${date}</p>
    </div>
    <div style="display:flex;align-items:center;gap:0.5rem;">
      <span style="padding:0.25rem 0.6rem;background:${severityColor}22;color:${severityColor};border-radius:0.35rem;font-size:0.78rem;font-weight:700;">
        ${pothole.severity?.toUpperCase() || 'N/A'}
      </span>
      <span style="padding:0.25rem 0.6rem;background:${statusCfg.bg};color:${statusCfg.color};border-radius:0.35rem;font-size:0.78rem;font-weight:700;">
        ${statusCfg.label}
      </span>
      <span style="color:var(--text-secondary);font-size:0.85rem;">›</span>
    </div>
  `;

  reportItem.onclick = () => showReportModal(pothole, index);
  return reportItem;
}

function showReportModal(pothole, index) {
  const existing = document.getElementById('reportModal');
  if (existing) existing.remove();

  const statusCfg = getStatusConfig(pothole.status);
  const severityColor = pothole.severity === 'high' ? '#ef4444' :
    pothole.severity === 'medium' ? '#f59e0b' : '#10b981';

  const overlay = document.createElement('div');
  overlay.id = 'reportModal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:1rem;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:var(--bg-secondary);border:1px solid var(--border);
    border-radius:1rem;padding:2rem;max-width:480px;width:100%;
    max-height:90vh;overflow-y:auto;position:relative;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
  `;

  const date = new Date(pothole.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  modal.innerHTML = `
    <button id="closeModal" style="
      position:absolute;top:1rem;right:1rem;
      background:var(--bg-tertiary);border:1px solid var(--border);
      color:var(--text-primary);width:32px;height:32px;padding:0;
      border-radius:50%;cursor:pointer;font-size:1rem;
    ">×</button>

    <h2 style="margin:0 0 1.25rem 0;font-size:1.3rem;">Report #${index + 1} Details</h2>

    ${pothole.image_url ? `
      <img src="${pothole.image_url}" alt="Pothole image"
        style="width:100%;border-radius:0.6rem;margin-bottom:1.25rem;max-height:220px;object-fit:cover;">
    ` : `
      <div style="width:100%;border-radius:0.6rem;margin-bottom:1.25rem;height:120px;
        background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;
        color:var(--text-secondary);font-size:2rem;">📷</div>
    `}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem;">
      <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
        <p style="margin:0 0 0.2rem 0;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">Status</p>
        <p style="margin:0;font-weight:700;color:${statusCfg.color};">${statusCfg.label}</p>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
        <p style="margin:0 0 0.2rem 0;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">Severity</p>
        <p style="margin:0;font-weight:700;color:${severityColor};">${pothole.severity?.toUpperCase() || 'N/A'}</p>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
        <p style="margin:0 0 0.2rem 0;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">Location</p>
        <p style="margin:0;font-size:0.85rem;font-weight:600;">${pothole.latitude?.toFixed(5)}, ${pothole.longitude?.toFixed(5)}</p>
      </div>
      <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
        <p style="margin:0 0 0.2rem 0;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">Reported</p>
        <p style="margin:0;font-size:0.85rem;font-weight:600;">${date}</p>
      </div>
    </div>

    ${pothole.description ? `
      <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;margin-bottom:0;">
        <p style="margin:0 0 0.25rem 0;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">Description</p>
        <p style="margin:0;font-size:0.9rem;">${pothole.description}</p>
      </div>
    ` : ''}

    ${pothole.status === 'removed' ? `
      <div style="margin-top:1rem;padding:0.75rem;background:#94a3b815;border:1px solid #94a3b844;border-radius:0.6rem;font-size:0.85rem;color:#94a3b8;">
        ℹ️ This pothole was removed after community verification (90%+ users flagged it as non-existent).
      </div>
    ` : ''}
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  modal.querySelector('#closeModal').onclick = () => overlay.remove();
}

function createStatBox(label, value, color) {
  const box = document.createElement('div');
  box.style.cssText = `
    background:${color}15;border:1px solid ${color}40;
    border-radius:0.75rem;padding:1rem;text-align:center;
  `;

  const num = document.createElement('div');
  num.style.cssText = `font-size:2rem;font-weight:700;color:${color};margin-bottom:0.25rem;`;
  num.textContent = value;

  const lbl = document.createElement('p');
  lbl.textContent = label;
  lbl.style.cssText = 'margin:0;color:var(--text-secondary);font-size:0.82rem;';

  box.appendChild(num);
  box.appendChild(lbl);
  return box;
}

async function handleProfileUpdate(e, userId) {
  e.preventDefault();
  const fullName = document.getElementById('fullName').value;
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    showAlert('Profile updated successfully!', 'success');
  } catch (err) {
    showAlert('Error updating profile', 'error');
    console.error(err);
  }
}
