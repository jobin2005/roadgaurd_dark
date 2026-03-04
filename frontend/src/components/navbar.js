import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';

export function createNavbar(activePage = '') {
  const nav = document.createElement('nav');
  nav.style.cssText = `
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 0 1.5rem;
    display: flex;
    align-items: center;
    height: 52px;
    position: sticky;
    top: 0;
    z-index: 100;
  `;

  // Logo
  const logo = document.createElement('a');
  logo.href = '#';
  logo.style.cssText = `
    display: flex; align-items: center; gap: 0.6rem;
    text-decoration: none; margin-right: 2rem; flex-shrink: 0;
  `;
  logo.innerHTML = `
    <div style="
      width: 28px; height: 28px; border-radius: 7px;
      background: var(--accent); display: flex;
      align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.75rem; color: white;
    ">R</div>
    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">RoadGuard</span>
  `;
  logo.onclick = (e) => { e.preventDefault(); router.navigate('dashboard'); };

  // Separator
  const sep = document.createElement('div');
  sep.style.cssText = 'width: 1px; height: 20px; background: var(--border); margin-right: 1.25rem;';

  // Hamburger
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.style.cssText = `
    display: none; background: none; border: none;
    color: var(--text-primary); cursor: pointer;
    padding: 0.25rem; width: auto; min-height: auto;
    margin-left: auto; align-items: center; justify-content: center;
  `;
  hamburger.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;

  // Links
  const links = document.createElement('div');
  links.className = 'nav-links';
  links.style.cssText = `
    display: flex; align-items: center; gap: 0.15rem; flex: 1;
  `;

  hamburger.onclick = () => {
    const isOpen = links.classList.toggle('nav-open');
    hamburger.innerHTML = isOpen
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  };

  const pages = [
    { name: 'Dashboard', page: 'dashboard' },
    { name: 'Map', page: 'map' },
    { name: 'Report', page: 'upload' },
    { name: 'Route', page: 'route' },
    { name: 'Profile', page: 'profile' }
  ];

  pages.forEach(({ name, page }) => {
    const link = createNavLink(name, () => router.navigate(page), page === activePage);
    links.appendChild(link);
  });

  // Spacer
  const spacer = document.createElement('div');
  spacer.style.cssText = 'flex: 1;';
  links.appendChild(spacer);

  // Admin (async)
  const user = window.getCurrentUser();
  if (user) {
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role === 'admin') {
          const adminLink = createNavLink('Admin', () => router.navigate('admin'), activePage === 'admin');
          adminLink.style.color = activePage === 'admin' ? '#8b5cf6' : '#8b8b96';
          links.insertBefore(adminLink, spacer);
        }
      });
  }

  // Logout
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'Log out';
  logoutBtn.style.cssText = `
    background: transparent; border: 1px solid var(--border);
    color: var(--text-secondary); font-size: 0.8rem; font-weight: 500;
    padding: 0.3rem 0.75rem; border-radius: var(--radius-s);
    cursor: pointer; min-height: auto; transition: all 0.2s ease;
  `;
  logoutBtn.onmouseenter = () => {
    logoutBtn.style.borderColor = 'var(--border-strong)';
    logoutBtn.style.color = 'var(--text-primary)';
  };
  logoutBtn.onmouseleave = () => {
    logoutBtn.style.borderColor = 'var(--border)';
    logoutBtn.style.color = 'var(--text-secondary)';
  };
  logoutBtn.onclick = handleLogout;
  links.appendChild(logoutBtn);

  nav.appendChild(logo);
  nav.appendChild(sep);
  nav.appendChild(hamburger);
  nav.appendChild(links);

  return nav;
}

function createNavLink(text, onClick, isActive = false) {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = text;
  link.style.cssText = `
    font-size: 0.84rem; font-weight: 500;
    color: ${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
    text-decoration: none; padding: 0.4rem 0.65rem;
    border-radius: var(--radius-s);
    transition: all 0.15s ease;
    position: relative;
    ${isActive ? 'background: var(--bg-raised);' : ''}
  `;

  link.onmouseenter = () => {
    if (!isActive) {
      link.style.color = 'var(--text-primary)';
      link.style.background = 'var(--bg-raised)';
    }
  };
  link.onmouseleave = () => {
    if (!isActive) {
      link.style.color = 'var(--text-secondary)';
      link.style.background = 'transparent';
    }
  };

  link.onclick = (e) => { e.preventDefault(); onClick(); };
  return link;
}

async function handleLogout() {
  try {
    await supabase.auth.signOut();
    router.navigate('login', { replace: true });
  } catch (err) {
    console.error('Logout error:', err);
  }
}