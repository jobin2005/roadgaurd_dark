import { createNavbar } from '../components/navbar.js';
import { router } from '../router.js';
import { supabase } from '../services/supabaseClient.js';

export function renderDashboard(container) {
  const app = document.createElement('div');
  app.style.cssText = 'display:flex;flex-direction:column;min-height:100vh;background:var(--bg-base);';
  app.appendChild(createNavbar('dashboard'));

  // Responsive styles for dashboard
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .dash-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .dash-grid  { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    @media (max-width: 640px) {
      .dash-stats { grid-template-columns: 1fr; }
      .dash-grid  { grid-template-columns: 1fr; }
    }
    @media (min-width: 641px) and (max-width: 900px) {
      .dash-stats { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(styleEl);

  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1; padding: 2rem 1.5rem;
    max-width: 960px; margin: 0 auto; width: 100%;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 2rem;';
  header.innerHTML = `
    <h1 style="margin-bottom: 0.35rem;">Dashboard</h1>
    <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
      Report potholes, navigate safely, and help improve road conditions.
    </p>
  `;

  // Quick stats
  const statsRow = document.createElement('div');
  statsRow.className = 'dash-stats';
  statsRow.id = 'dashboardStats';
  statsRow.innerHTML = `
    ${createStatCard('Reports Filed', '—', 'var(--accent)')}
    ${createStatCard('Active Issues', '—', 'var(--warning)')}
    ${createStatCard('Roads Improved', '—', 'var(--success)')}
  `;

  // Feature grid
  const grid = document.createElement('div');
  grid.className = 'dash-grid';

  // SVG icon definitions (stroke-based, 20px, 1.5 stroke)
  const SVG_ICONS = {
    map: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    camera: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    compass: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" opacity="0.15" stroke="currentColor"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  };

  const features = [
    {
      title: 'View Map',
      desc: 'Browse reported potholes on an interactive map',
      page: 'map',
      icon: SVG_ICONS.map
    },
    {
      title: 'Report Pothole',
      desc: 'Capture a photo and submit a geotagged report',
      page: 'upload',
      icon: SVG_ICONS.camera
    },
    {
      title: 'Plan Route',
      desc: 'Find the safest path with pothole-aware navigation',
      page: 'route',
      icon: SVG_ICONS.compass
    },
    {
      title: 'My Profile',
      desc: 'View your contributions and account details',
      page: 'profile',
      icon: SVG_ICONS.user
    }
  ];

  features.forEach(({ title, desc, page, icon }, idx) => {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-l);
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex; flex-direction: column; gap: 0.75rem;
      animation: slideUp 0.3s ease ${idx * 0.05}s both;
      box-shadow: none;
    `;

    card.onmouseenter = () => {
      card.style.borderColor = 'var(--border-strong)';
      card.style.background = 'var(--bg-raised)';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = 'var(--shadow-md)';
    };
    card.onmouseleave = () => {
      card.style.borderColor = 'var(--border)';
      card.style.background = 'var(--bg-surface)';
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
    };

    card.innerHTML = `
      <div style="color: var(--text-tertiary);">${icon}</div>
      <div>
        <h3 style="margin-bottom: 0.25rem; font-size: 0.95rem;">${title}</h3>
        <p style="color: var(--text-secondary); font-size: 0.82rem; margin: 0; line-height: 1.5;">${desc}</p>
      </div>
      <div style="
        margin-top: auto; padding-top: 0.75rem;
        border-top: 1px solid var(--border);
        font-size: 0.8rem; color: var(--text-tertiary);
        display: flex; align-items: center; gap: 0.35rem;
      ">
        Open <span style="font-size: 0.7rem;">→</span>
      </div>
    `;

    card.onclick = () => router.navigate(page);
    grid.appendChild(card);
  });

  content.appendChild(header);
  content.appendChild(statsRow);
  content.appendChild(grid);
  app.appendChild(content);
  container.appendChild(app);

  // Load real stats
  loadDashboardStats();
}

function createStatCard(label, value, color) {
  return `
    <div style="
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-left: 2px solid ${color};
      border-radius: var(--radius-l);
      padding: 1.25rem;
    ">
      <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
        ${label}
      </div>
      <div style="font-size: 1.75rem; font-weight: 800; color: ${color}; letter-spacing: -0.02em;">
        ${value}
      </div>
    </div>
  `;
}

async function loadDashboardStats() {
  try {
    const user = window.getCurrentUser();
    if (!user) return;

    const { data: potholes } = await supabase
      .from('potholes')
      .select('status, user_id')
      .eq('user_id', user.id);

    if (potholes) {
      const total = potholes.length;
      const active = potholes.filter(p => !p.status || p.status === 'active').length;
      const fixed = potholes.filter(p => p.status === 'fixed' || p.status === 'removed').length;

      const statsEl = document.getElementById('dashboardStats');
      if (statsEl) {
        statsEl.innerHTML = `
          ${createStatCard('Reports Filed', total, 'var(--accent)')}
          ${createStatCard('Active Issues', active, 'var(--warning)')}
          ${createStatCard('Roads Improved', fixed, 'var(--success)')}
        `;
      }
    }
  } catch (err) {
    console.error('Stats load error:', err);
  }
}
