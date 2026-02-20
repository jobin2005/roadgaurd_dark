import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const KERALA_DISTRICTS = [
  'All Districts', 'Thiruvananthapuram', 'Kollam', 'Pathanamthitta',
  'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur',
  'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
];

// ── District cache to avoid re-fetching ──────────────────────────────────────
const districtCache = new Map(); // "lat,lng" → district string

async function getDistrict(lat, lng) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (districtCache.has(key)) return districtCache.get(key);
  try {
    const resp = await fetch(
      `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await resp.json();
    // Nominatim returns district in county or state_district for Kerala
    const district = data.address?.county
      || data.address?.state_district
      || data.address?.district
      || 'Unknown';
    // Normalize: strip "District" suffix if present
    const clean = district.replace(/\s*district$/i, '').trim();
    districtCache.set(key, clean);
    return clean;
  } catch {
    return 'Unknown';
  }
}

// ── Module state ─────────────────────────────────────────────────────────────
let allPotholes = [];         // raw potholes from DB (with district populated)
let resolvedPotholes = [];    // from resolved_potholes table
let pothole_views_count = 0;
let userLocation = null;
let activeFilters = {
  district: 'All Districts',
  severity: 'all',
  status: 'all',
  recency: 'all',
  sortBy: 'newest',
};
let activeTab = 'dashboard';

// ── Entry point ───────────────────────────────────────────────────────────────

export async function renderAdminPage(container) {
  const user = window.getCurrentUser();
  if (!user) {
    container.innerHTML = '<p style="padding:2rem;">Please log in.</p>';
    return;
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;min-height:100vh;">
        ${createNavbar().outerHTML}
        <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;padding:2rem;text-align:center;">
          <div style="font-size:4rem;">🚫</div>
          <h2 style="margin:0;">Access Denied</h2>
          <p style="color:var(--text-secondary);">You don't have admin privileges.</p>
        </div>
      </div>
    `;
    return;
  }

  // Build shell
  const app = document.createElement('div');
  app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;background:var(--bg-primary);';
  app.appendChild(createNavbar());

  // Admin header bar
  const adminBar = document.createElement('div');
  adminBar.style.cssText = `
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 0.75rem;
  `;
  adminBar.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;">
      <span style="font-size:1.5rem;">🛡️</span>
      <div>
        <div style="font-weight:700;font-size:1.1rem;">Admin Panel</div>
        <div style="font-size:0.78rem;color:var(--text-secondary);">Logged in as ${profile.full_name || user.email}</div>
      </div>
    </div>
    <div id="adminTabBar" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      ${['dashboard','potholes','users'].map(tab => `
        <button class="adminTab" data-tab="${tab}" style="
          padding:0.4rem 1rem; border-radius:0.5rem; font-size:0.85rem; font-weight:600; cursor:pointer;
          border: 1px solid var(--border); transition: all 0.15s;
          background:${tab === 'dashboard' ? 'var(--accent-primary)' : 'var(--bg-tertiary)'};
          color:${tab === 'dashboard' ? 'white' : 'var(--text-primary)'};
        ">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
      `).join('')}
    </div>
  `;

  // Main content area
  const main = document.createElement('div');
  main.id = 'adminMain';
  main.style.cssText = 'flex:1;padding:1.5rem;max-width:1400px;width:100%;margin:0 auto;';

  app.appendChild(adminBar);
  app.appendChild(main);
  container.appendChild(app);

  // Tab switching
  adminBar.querySelectorAll('.adminTab').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      adminBar.querySelectorAll('.adminTab').forEach(b => {
        b.style.background = b.dataset.tab === activeTab ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
        b.style.color = b.dataset.tab === activeTab ? 'white' : 'var(--text-primary)';
      });
      renderActiveTab();
    };
  });

  // Load data and render
  await loadAllData();
  renderActiveTab();
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadAllData() {
  const main = document.getElementById('adminMain');
  if (main) main.innerHTML = '<p style="color:var(--text-secondary);padding:1rem;">Loading data…</p>';

  try {
    // Get user location (optional, for proximity filter)
    userLocation = await getUserLocation();

    // Fetch potholes
    const { data: potholes, error: pErr } = await supabase
  .from('potholes')
  .select('*')
  .order('created_at', { ascending: false });

if (pErr) throw pErr;

// Fetch all profiles separately and merge
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('id, full_name, email');

const profileMap = {};
(profiles || []).forEach(p => { profileMap[p.id] = p; });

allPotholes = (potholes || []).map(p => ({
  ...p,
  user_profiles: profileMap[p.user_id] || null
}));

  } catch (err) {
    console.error('Admin data load error:', err);
    showAlert('Error loading admin data: ' + err.message, 'error');
  }
}

async function enrichWithDistricts(potholes) {
  // Process in batches of 5, with 300ms delay between batches to respect Nominatim rate limits
  const BATCH = 5;
  for (let i = 0; i < potholes.length; i += BATCH) {
    const batch = potholes.slice(i, i + BATCH);
    await Promise.all(batch.map(async p => {
      p.district = await getDistrict(p.latitude, p.longitude);
    }));
    if (i + BATCH < potholes.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
}

// ── Tab rendering ─────────────────────────────────────────────────────────────

function renderActiveTab() {
  const main = document.getElementById('adminMain');
  if (!main) return;
  main.innerHTML = '';

  if (activeTab === 'dashboard') renderDashboard(main);
  else if (activeTab === 'potholes') renderPotholesTab(main);
  else if (activeTab === 'users') renderUsersTab(main);
}

// ── DASHBOARD TAB ─────────────────────────────────────────────────────────────

function renderDashboard(container) {
  const active = allPotholes.filter(p => !p.status || p.status === 'active').length;
  const fixed = resolvedPotholes.length;
  const removed = allPotholes.filter(p => p.status === 'removed').length;
  const highSeverity = allPotholes.filter(p => p.severity === 'high').length;
  const total = allPotholes.length;

  // District filter for dashboard
  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap;';
  filterRow.innerHTML = `
    <label style="font-weight:600;font-size:0.9rem;">Filter by District:</label>
    <select id="dashDistrictFilter" style="padding:0.4rem 0.75rem;border-radius:0.5rem;min-width:180px;">
      ${KERALA_DISTRICTS.map(d => `<option value="${d}" ${d === activeFilters.district ? 'selected' : ''}>${d}</option>`).join('')}
    </select>
    ${!userLocation ? `<span style="font-size:0.8rem;color:var(--text-secondary);">📍 Location unavailable — proximity filter disabled</span>` : `<span style="font-size:0.8rem;color:#10b981;">📍 Location active</span>`}
  `;
  container.appendChild(filterRow);

  filterRow.querySelector('#dashDistrictFilter').onchange = (e) => {
    activeFilters.district = e.target.value;
    renderDashboard(container);
  };

  const filtered = filterByDistrict(allPotholes, activeFilters.district);
  const filteredResolved = activeFilters.district === 'All Districts'
    ? resolvedPotholes
    : resolvedPotholes.filter(r => {
        const d = districtCache.get(`${r.latitude?.toFixed(3)},${r.longitude?.toFixed(3)}`);
        return d && d.toLowerCase().includes(activeFilters.district.toLowerCase());
      });

  const filteredActive = filtered.filter(p => !p.status || p.status === 'active').length;
  const filteredHigh = filtered.filter(p => p.severity === 'high').length;
  const filteredViews = pothole_views_count; // can't filter views by district easily without joining

  // Stat cards
  const statsGrid = document.createElement('div');
  statsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;';

  const stats = [
    { label: 'Total Reported', value: filtered.length, icon: '📍', color: '#3b82f6', sub: `of ${total} total` },
    { label: 'Active', value: filteredActive, icon: '🔴', color: '#ef4444', sub: 'unresolved' },
    { label: 'Fixed', value: filteredResolved.length, icon: '✅', color: '#10b981', sub: 'resolved' },
    { label: 'Removed (fake)', value: filtered.filter(p => p.status === 'removed').length, icon: '🗑️', color: '#94a3b8', sub: 'community flagged' },
    { label: 'High Severity', value: filteredHigh, icon: '⚠️', color: '#f59e0b', sub: 'critical potholes' },
    { label: 'Encounters', value: filteredViews, icon: '👁️', color: '#8b5cf6', sub: 'journey passages' },
  ];

  stats.forEach(s => {
    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--bg-secondary); border:1px solid var(--border);
      border-radius:0.875rem; padding:1.25rem;
      border-left: 4px solid ${s.color};
    `;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div style="font-size:2rem;font-weight:800;color:${s.color};">${s.value}</div>
          <div style="font-weight:600;font-size:0.9rem;margin-top:0.1rem;">${s.label}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.15rem;">${s.sub}</div>
        </div>
        <span style="font-size:1.8rem;opacity:0.7;">${s.icon}</span>
      </div>
    `;
    statsGrid.appendChild(card);
  });
  container.appendChild(statsGrid);

  // District breakdown table
  const districtTitle = document.createElement('h3');
  districtTitle.textContent = 'Breakdown by District';
  districtTitle.style.cssText = 'margin:0 0 0.75rem 0;';
  container.appendChild(districtTitle);

  const districtMap = {};
  allPotholes.forEach(p => {
    const d = p.district || 'Unknown';
    if (!districtMap[d]) districtMap[d] = { total: 0, active: 0, high: 0, fixed: 0 };
    districtMap[d].total++;
    if (!p.status || p.status === 'active') districtMap[d].active++;
    if (p.severity === 'high') districtMap[d].high++;
  });
  resolvedPotholes.forEach(r => {
    const key = `${r.latitude?.toFixed(3)},${r.longitude?.toFixed(3)}`;
    const d = districtCache.get(key) || 'Unknown';
    if (!districtMap[d]) districtMap[d] = { total: 0, active: 0, high: 0, fixed: 0 };
    districtMap[d].fixed++;
  });

  const districtTable = document.createElement('div');
  districtTable.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:0.875rem;overflow:hidden;margin-bottom:2rem;';

  const thead = `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:0.75rem 1rem;background:var(--bg-tertiary);font-size:0.8rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">
      <div>District</div><div style="text-align:center;">Total</div><div style="text-align:center;">Active</div><div style="text-align:center;">High</div><div style="text-align:center;">Fixed</div>
    </div>
  `;

  const rows = Object.entries(districtMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([dist, data], i) => `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;padding:0.75rem 1rem;
        border-top:1px solid var(--border);font-size:0.88rem;
        background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
        <div style="font-weight:600;">${dist}</div>
        <div style="text-align:center;">${data.total}</div>
        <div style="text-align:center;color:#ef4444;font-weight:600;">${data.active}</div>
        <div style="text-align:center;color:#f59e0b;font-weight:600;">${data.high}</div>
        <div style="text-align:center;color:#10b981;font-weight:600;">${data.fixed}</div>
      </div>
    `).join('');

  districtTable.innerHTML = thead + rows;
  container.appendChild(districtTable);

  // Recent activity
  const recentTitle = document.createElement('h3');
  recentTitle.textContent = 'Recently Reported (Last 7 Days)';
  recentTitle.style.cssText = 'margin:0 0 0.75rem 0;';
  container.appendChild(recentTitle);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = allPotholes.filter(p => new Date(p.created_at) > sevenDaysAgo);

  if (recent.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No potholes reported in the last 7 days.';
    empty.style.color = 'var(--text-secondary)';
    container.appendChild(empty);
  } else {
    const recentList = document.createElement('div');
    recentList.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';
    recent.slice(0, 10).forEach(p => {
      recentList.appendChild(createPotholeRow(p, true));
    });
    container.appendChild(recentList);
  }
}

// ── POTHOLES TAB ──────────────────────────────────────────────────────────────

function renderPotholesTab(container) {
  // Filter bar
  const filterBar = document.createElement('div');
  filterBar.style.cssText = `
    background:var(--bg-secondary); border:1px solid var(--border);
    border-radius:0.875rem; padding:1rem 1.25rem; margin-bottom:1rem;
    display:flex; flex-wrap:wrap; gap:0.75rem; align-items:center;
  `;
  filterBar.innerHTML = `
    <span style="font-weight:700;font-size:0.9rem;flex-shrink:0;">🔍 Filters</span>

    <select id="fDistrict" style="padding:0.4rem 0.6rem;border-radius:0.5rem;font-size:0.85rem;">
      ${KERALA_DISTRICTS.map(d => `<option value="${d}" ${d === activeFilters.district ? 'selected' : ''}>${d}</option>`).join('')}
    </select>

    <select id="fSeverity" style="padding:0.4rem 0.6rem;border-radius:0.5rem;font-size:0.85rem;">
      <option value="all" ${activeFilters.severity === 'all' ? 'selected' : ''}>All Severities</option>
      <option value="high" ${activeFilters.severity === 'high' ? 'selected' : ''}>High</option>
      <option value="medium" ${activeFilters.severity === 'medium' ? 'selected' : ''}>Medium</option>
      <option value="low" ${activeFilters.severity === 'low' ? 'selected' : ''}>Low</option>
    </select>

    <select id="fStatus" style="padding:0.4rem 0.6rem;border-radius:0.5rem;font-size:0.85rem;">
      <option value="all" ${activeFilters.status === 'all' ? 'selected' : ''}>All Statuses</option>
      <option value="active" ${activeFilters.status === 'active' ? 'selected' : ''}>Active</option>
      <option value="removed" ${activeFilters.status === 'removed' ? 'selected' : ''}>Removed</option>
    </select>

    <select id="fRecency" style="padding:0.4rem 0.6rem;border-radius:0.5rem;font-size:0.85rem;">
      <option value="all" ${activeFilters.recency === 'all' ? 'selected' : ''}>All Time</option>
      <option value="24h" ${activeFilters.recency === '24h' ? 'selected' : ''}>Last 24h</option>
      <option value="7d" ${activeFilters.recency === '7d' ? 'selected' : ''}>Last 7 Days</option>
      <option value="30d" ${activeFilters.recency === '30d' ? 'selected' : ''}>Last 30 Days</option>
    </select>

    <select id="fSort" style="padding:0.4rem 0.6rem;border-radius:0.5rem;font-size:0.85rem;">
      <option value="newest" ${activeFilters.sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
      <option value="oldest" ${activeFilters.sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
      <option value="severity" ${activeFilters.sortBy === 'severity' ? 'selected' : ''}>Severity</option>
      ${userLocation ? `<option value="proximity" ${activeFilters.sortBy === 'proximity' ? 'selected' : ''}>Nearest to Me</option>` : ''}
    </select>

    <div id="filteredCount" style="margin-left:auto;font-size:0.82rem;color:var(--text-secondary);"></div>
  `;
  container.appendChild(filterBar);

  ['fDistrict', 'fSeverity', 'fStatus', 'fRecency', 'fSort'].forEach(id => {
    filterBar.querySelector(`#${id}`).onchange = (e) => {
      const key = { fDistrict: 'district', fSeverity: 'severity', fStatus: 'status', fRecency: 'recency', fSort: 'sortBy' }[id];
      activeFilters[key] = e.target.value;
      renderPotholeList();
    };
  });

  const listContainer = document.createElement('div');
  listContainer.id = 'potholeList';
  container.appendChild(listContainer);

  renderPotholeList();

  function renderPotholeList() {
    const listEl = document.getElementById('potholeList');
    const countEl = document.getElementById('filteredCount');
    if (!listEl) return;

    let data = [...allPotholes];

    // District filter
    data = filterByDistrict(data, activeFilters.district);

    // Severity filter
    if (activeFilters.severity !== 'all') data = data.filter(p => p.severity === activeFilters.severity);

    // Status filter
    if (activeFilters.status !== 'all') {
      if (activeFilters.status === 'active') data = data.filter(p => !p.status || p.status === 'active');
      else data = data.filter(p => p.status === activeFilters.status);
    }

    // Recency filter
    if (activeFilters.recency !== 'all') {
      const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[activeFilters.recency];
      const cutoff = new Date(Date.now() - ms);
      data = data.filter(p => new Date(p.created_at) > cutoff);
    }

    // Sort
    if (activeFilters.sortBy === 'newest') data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (activeFilters.sortBy === 'oldest') data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (activeFilters.sortBy === 'severity') {
      const sOrder = { high: 0, medium: 1, low: 2 };
      data.sort((a, b) => (sOrder[a.severity] ?? 3) - (sOrder[b.severity] ?? 3));
    } else if (activeFilters.sortBy === 'proximity' && userLocation) {
      data.sort((a, b) =>
        haversineM(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) -
        haversineM(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
      );
    }

    if (countEl) countEl.textContent = `${data.length} pothole${data.length !== 1 ? 's' : ''} shown`;

    listEl.innerHTML = '';

    if (data.length === 0) {
      listEl.innerHTML = '<p style="color:var(--text-secondary);padding:1rem;">No potholes match the current filters.</p>';
      return;
    }

    // Table header
    const header = document.createElement('div');
    header.style.cssText = `
      display:grid; grid-template-columns: 60px 100px 120px 130px 160px 1fr 180px;
      padding:0.6rem 1rem; background:var(--bg-tertiary);
      border:1px solid var(--border); border-radius:0.75rem 0.75rem 0 0;
      font-size:0.78rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;
      gap:0.5rem;
    `;
    header.innerHTML = `
      <div>#</div><div>Severity</div><div>Status</div>
      <div>District</div><div>Reporter</div><div>Date</div><div>Actions</div>
    `;
    listEl.appendChild(header);

    const rowsContainer = document.createElement('div');
    rowsContainer.style.cssText = 'border:1px solid var(--border);border-top:none;border-radius:0 0 0.75rem 0.75rem;overflow:hidden;';

    data.forEach((p, i) => {
      rowsContainer.appendChild(createPotholeRow(p, false, i + 1));
    });

    listEl.appendChild(rowsContainer);
  }
}

// ── Pothole Row ───────────────────────────────────────────────────────────────

function createPotholeRow(p, compact = false, index = null) {
  const row = document.createElement('div');
  const severityColor = p.severity === 'high' ? '#ef4444' : p.severity === 'medium' ? '#f59e0b' : '#10b981';
  const statusCfg = p.status === 'removed'
    ? { label: 'Removed', color: '#94a3b8' }
    : p.status === 'fixed'
    ? { label: 'Fixed', color: '#10b981' }
    : { label: 'Active', color: '#3b82f6' };

  const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const reporterName = p.user_profiles?.full_name || p.user_profiles?.email || p.user_id?.slice(0, 8) + '…';
  const isFixed = resolvedPotholes.some(r => r.original_pothole_id === p.id);
  const distanceText = userLocation
    ? `${(haversineM(userLocation.latitude, userLocation.longitude, p.latitude, p.longitude) / 1000).toFixed(1)} km`
    : '';

  if (compact) {
    // Compact card for dashboard
    row.style.cssText = `
      background:var(--bg-secondary); border:1px solid var(--border);
      border-radius:0.6rem; padding:0.75rem 1rem;
      display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;
    `;
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:200px;">
        <span style="padding:0.2rem 0.5rem;background:${severityColor}22;color:${severityColor};border-radius:0.35rem;font-size:0.75rem;font-weight:700;white-space:nowrap;">${p.severity?.toUpperCase()}</span>
        <span style="font-size:0.85rem;">${p.district || 'Unknown'}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary);">${date}</span>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;">
        ${distanceText ? `<span style="font-size:0.78rem;color:var(--text-secondary);">📍 ${distanceText}</span>` : ''}
        ${!isFixed && (!p.status || p.status === 'active')
          ? `<button class="fixBtn" data-id="${p.id}" data-lat="${p.latitude}" data-lng="${p.longitude}"
              style="padding:0.3rem 0.7rem;font-size:0.8rem;background:#10b981;border:none;border-radius:0.4rem;color:white;font-weight:600;cursor:pointer;">
              ✅ Mark Fixed
            </button>`
          : `<span style="font-size:0.8rem;color:#10b981;">✅ Fixed</span>`
        }
        <button class="viewUserBtn" data-userid="${p.user_id}"
          style="padding:0.3rem 0.7rem;font-size:0.8rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.4rem;cursor:pointer;">
          👤 Reporter
        </button>
      </div>
    `;
  } else {
    // Full table row
    row.style.cssText = `
      display:grid; grid-template-columns: 60px 100px 120px 130px 160px 1fr 180px;
      padding:0.65rem 1rem; border-top:1px solid var(--border);
      font-size:0.85rem; align-items:center; gap:0.5rem;
      transition:background 0.1s;
    `;
    row.onmouseenter = () => row.style.background = 'rgba(255,255,255,0.025)';
    row.onmouseleave = () => row.style.background = 'transparent';

    row.innerHTML = `
      <div style="color:var(--text-secondary);font-size:0.78rem;">${index}</div>
      <div>
        <span style="padding:0.2rem 0.5rem;background:${severityColor}22;color:${severityColor};border-radius:0.35rem;font-size:0.75rem;font-weight:700;">
          ${p.severity?.toUpperCase() || 'N/A'}
        </span>
      </div>
      <div>
        <span style="color:${statusCfg.color};font-weight:600;font-size:0.82rem;">${statusCfg.label}</span>
      </div>
      <div style="font-size:0.82rem;">${p.district || '…'}</div>
      <div style="font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${reporterName}">${reporterName}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);">
        ${date}
        ${distanceText ? `<span style="margin-left:0.5rem;color:var(--text-secondary);">· 📍${distanceText}</span>` : ''}
      </div>
      <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
        ${!isFixed && (!p.status || p.status === 'active')
          ? `<button class="fixBtn" data-id="${p.id}" data-lat="${p.latitude}" data-lng="${p.longitude}"
              style="padding:0.25rem 0.55rem;font-size:0.78rem;background:#10b981;border:none;border-radius:0.35rem;color:white;font-weight:600;cursor:pointer;">
              ✅ Fix
            </button>`
          : `<span style="font-size:0.75rem;color:#10b981;">✅</span>`
        }
        <button class="viewUserBtn" data-userid="${p.user_id}"
          style="padding:0.25rem 0.55rem;font-size:0.78rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.35rem;cursor:pointer;">
          👤
        </button>
        <button class="viewMapBtn" data-lat="${p.latitude}" data-lng="${p.longitude}"
          style="padding:0.25rem 0.55rem;font-size:0.78rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.35rem;cursor:pointer;"
          title="View on map">🗺️</button>
      </div>
    `;
  }

  // Attach event listeners after HTML is set
  row.querySelectorAll('.fixBtn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      showFixModal(btn.dataset.id, parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng));
    };
  });

  row.querySelectorAll('.viewUserBtn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      activeTab = 'users';
      document.querySelectorAll('.adminTab').forEach(b => {
        b.style.background = b.dataset.tab === 'users' ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
        b.style.color = b.dataset.tab === 'users' ? 'white' : 'var(--text-primary)';
      });
      const main = document.getElementById('adminMain');
      main.innerHTML = '';
      renderUsersTab(main, btn.dataset.userid);
    };
  });

  row.querySelectorAll('.viewMapBtn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      window.open(`https://www.openstreetmap.org/?mlat=${btn.dataset.lat}&mlon=${btn.dataset.lng}&zoom=17`, '_blank');
    };
  });

  return row;
}

// ── Fix Modal ─────────────────────────────────────────────────────────────────

function showFixModal(potholeId, lat, lng) {
  const existing = document.getElementById('fixModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'fixModal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);
    backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:var(--bg-secondary);border:1px solid var(--border);
    border-radius:1rem;padding:2rem;max-width:420px;width:100%;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
  `;
  modal.innerHTML = `
    <h3 style="margin:0 0 0.5rem 0;">✅ Mark as Fixed</h3>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin:0 0 1.25rem 0;">
      This will update the pothole status and move it to the resolved archive.
    </p>
    <label style="display:block;margin-bottom:0.5rem;font-weight:500;font-size:0.9rem;">Resolution Notes (optional)</label>
    <textarea id="fixNotes" placeholder="e.g. Road repaired by KSTP on 20 Feb 2026" style="width:100%;min-height:80px;resize:vertical;margin-bottom:1.25rem;"></textarea>
    <div style="display:flex;gap:0.75rem;">
      <button id="confirmFix" style="flex:1;padding:0.75rem;background:#10b981;border:none;border-radius:0.6rem;color:white;font-weight:700;cursor:pointer;font-size:0.95rem;">
        ✅ Confirm Fixed
      </button>
      <button id="cancelFix" style="padding:0.75rem 1rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.6rem;cursor:pointer;font-weight:600;">
        Cancel
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  modal.querySelector('#cancelFix').onclick = () => overlay.remove();
  modal.querySelector('#confirmFix').onclick = async () => {
    const notes = modal.querySelector('#fixNotes').value.trim();
    await markPotholeFixed(potholeId, lat, lng, notes);
    overlay.remove();
  };
}

async function markPotholeFixed(potholeId, lat, lng, notes = '') {
  try {
    const user = window.getCurrentUser();

    // 1. Get the pothole data to copy
    const pothole = allPotholes.find(p => p.id === potholeId);
    if (!pothole) throw new Error('Pothole not found in local data');

    // 2. Insert into resolved_potholes
    const { error: insertErr } = await supabase
      .from('resolved_potholes')
      .insert({
        original_pothole_id: potholeId,
        user_id: pothole.user_id,
        latitude: pothole.latitude,
        longitude: pothole.longitude,
        severity: pothole.severity,
        image_url: pothole.image_url,
        description: pothole.description,
        reported_at: pothole.created_at,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: notes || null,
      });

    if (insertErr) throw insertErr;

    // 3. Update status in potholes table
    const { error: updateErr } = await supabase
      .from('potholes')
      .update({ status: 'fixed' })
      .eq('id', potholeId);

    if (updateErr) throw updateErr;

    // 4. Update local state
    const idx = allPotholes.findIndex(p => p.id === potholeId);
    if (idx !== -1) allPotholes[idx].status = 'fixed';

    showAlert('Pothole marked as fixed! ✅', 'success');
    renderActiveTab();
  } catch (err) {
    console.error('Fix error:', err);
    showAlert('Error marking as fixed: ' + err.message, 'error');
  }
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function renderUsersTab(container, preloadUserId = null) {
  const title = document.createElement('h2');
  title.textContent = '👤 User Profile Viewer';
  title.style.cssText = 'margin:0 0 1rem 0;';
  container.appendChild(title);

  // Search bar
  const searchRow = document.createElement('div');
  searchRow.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:1.5rem;flex-wrap:wrap;';
  searchRow.innerHTML = `
    <input id="userIdInput" type="text" placeholder="Enter User ID (UUID)…"
      style="flex:1;min-width:280px;" value="${preloadUserId || ''}">
    <button id="searchUserBtn" style="padding:0.6rem 1.25rem;font-weight:700;">🔍 Search</button>
  `;
  container.appendChild(searchRow);

  const profileArea = document.createElement('div');
  profileArea.id = 'userProfileArea';
  container.appendChild(profileArea);

  const doSearch = () => {
    const uid = document.getElementById('userIdInput').value.trim();
    if (uid) loadUserProfile(uid, profileArea);
  };

  searchRow.querySelector('#searchUserBtn').onclick = doSearch;
  searchRow.querySelector('#userIdInput').onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };

  // Show all users list
  renderUsersList(container);

  // Auto-load if preloaded
  if (preloadUserId) loadUserProfile(preloadUserId, profileArea);
}

async function renderUsersList(container) {
  try {
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, contributions, created_at, role')
      .order('created_at', { ascending: false });

    if (!users || users.length === 0) return;

    const tableTitle = document.createElement('h3');
    tableTitle.textContent = 'All Users';
    tableTitle.style.cssText = 'margin:1.5rem 0 0.75rem 0;';
    container.appendChild(tableTitle);

    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:0.875rem;overflow:hidden;';

    const thead = `
      <div style="display:grid;grid-template-columns:1fr 1.5fr 80px 80px 160px 100px;
        padding:0.6rem 1rem;background:var(--bg-tertiary);
        font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;gap:0.5rem;">
        <div>Name</div><div>Email</div><div style="text-align:center;">Reports</div>
        <div style="text-align:center;">Role</div><div>Joined</div><div>Action</div>
      </div>
    `;

    const rows = users.map((u, i) => {
      const userReports = allPotholes.filter(p => p.user_id === u.id).length;
      return `
        <div style="display:grid;grid-template-columns:1fr 1.5fr 80px 80px 160px 100px;
          padding:0.65rem 1rem;border-top:1px solid var(--border);
          font-size:0.85rem;gap:0.5rem;align-items:center;
          background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.full_name || '—'}</div>
          <div style="color:var(--text-secondary);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.email}</div>
          <div style="text-align:center;font-weight:700;color:var(--accent-primary);">${userReports}</div>
          <div style="text-align:center;">
            <span style="padding:0.15rem 0.5rem;border-radius:0.3rem;font-size:0.75rem;font-weight:700;
              background:${u.role === 'admin' ? '#8b5cf622' : 'var(--bg-tertiary)'};
              color:${u.role === 'admin' ? '#8b5cf6' : 'var(--text-secondary)'};">
              ${u.role || 'user'}
            </span>
          </div>
          <div style="color:var(--text-secondary);font-size:0.8rem;">${new Date(u.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
          <div>
            <button onclick="document.getElementById('userIdInput').value='${u.id}';document.getElementById('searchUserBtn').click();"
              style="padding:0.25rem 0.6rem;font-size:0.78rem;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:0.35rem;cursor:pointer;">
              View →
            </button>
          </div>
        </div>
      `;
    }).join('');

    tableWrap.innerHTML = thead + rows;
    container.appendChild(tableWrap);
  } catch (err) {
    console.error('Users list error:', err);
  }
}

async function loadUserProfile(userId, container) {
  container.innerHTML = '<p style="color:var(--text-secondary);">Loading profile…</p>';

  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data: potholes } = await supabase
      .from('potholes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    container.innerHTML = '';

    if (!profile) {
      container.innerHTML = '<p style="color:var(--error);">No user found with that ID.</p>';
      return;
    }

    const card = document.createElement('div');
    card.style.cssText = `
      background:var(--bg-secondary);border:1px solid var(--border);
      border-radius:0.875rem;padding:1.5rem;margin-bottom:1.5rem;
      display:grid;grid-template-columns:auto 1fr auto;gap:1.5rem;align-items:start;
      flex-wrap:wrap;
    `;

    const userPotholes = potholes || [];
    const active = userPotholes.filter(p => !p.status || p.status === 'active').length;
    const fixed = userPotholes.filter(p => p.status === 'fixed').length;
    const highCount = userPotholes.filter(p => p.severity === 'high').length;

    card.innerHTML = `
      <div style="width:64px;height:64px;background:linear-gradient(135deg,var(--accent-primary),#8b5cf6);
        border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">👤</div>
      <div>
        <h3 style="margin:0 0 0.25rem 0;">${profile.full_name || 'Unnamed User'}</h3>
        <div style="color:var(--text-secondary);font-size:0.88rem;">${profile.email}</div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.25rem;">
          User ID: <code style="font-size:0.75rem;">${userId}</code>
        </div>
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.15rem;">
          Joined: ${new Date(profile.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;text-align:center;">
        <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
          <div style="font-size:1.5rem;font-weight:800;color:var(--accent-primary);">${userPotholes.length}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">Total</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
          <div style="font-size:1.5rem;font-weight:800;color:#ef4444;">${active}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">Active</div>
        </div>
        <div style="background:var(--bg-tertiary);border-radius:0.6rem;padding:0.75rem;">
          <div style="font-size:1.5rem;font-weight:800;color:#f59e0b;">${highCount}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">High</div>
        </div>
      </div>
    `;
    container.appendChild(card);

    if (userPotholes.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'This user has not reported any potholes.';
      empty.style.color = 'var(--text-secondary)';
      container.appendChild(empty);
      return;
    }

    const reportsTitle = document.createElement('h3');
    reportsTitle.textContent = `Reports by ${profile.full_name || 'this user'} (${userPotholes.length})`;
    reportsTitle.style.cssText = 'margin:0 0 0.75rem 0;';
    container.appendChild(reportsTitle);

    const reportsGrid = document.createElement('div');
    reportsGrid.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';
    userPotholes.forEach((p, i) => {
      reportsGrid.appendChild(createPotholeRow(p, true, i + 1));
    });
    container.appendChild(reportsGrid);

  } catch (err) {
    console.error('User profile load error:', err);
    container.innerHTML = `<p style="color:var(--error);">Error loading profile: ${err.message}</p>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterByDistrict(potholes, district) {
  if (district === 'All Districts') return potholes;
  return potholes.filter(p =>
    p.district && p.district.toLowerCase().includes(district.toLowerCase())
  );
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getUserLocation() {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}