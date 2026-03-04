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
    z-index: 1000;
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

  // Desktop links container
  const links = document.createElement('div');
  links.className = 'nav-links';
  links.style.cssText = `
    display: flex; align-items: center; gap: 0.15rem; flex: 1;
  `;

  const pages = [
    { name: 'Dashboard', page: 'dashboard' },
    { name: 'Map', page: 'map' },
    { name: 'Report', page: 'upload' },
    { name: 'Route', page: 'route' },
    { name: 'Profile', page: 'profile' }
  ];

  pages.forEach(({ name, page }) => {
    const link = createNavLink(name, () => {
      closeMobileMenu();
      router.navigate(page);
    }, page === activePage);
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
          const adminLink = createNavLink('Admin', () => {
            closeMobileMenu();
            router.navigate('admin');
          }, activePage === 'admin');
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

  // ── Mobile menu overlay (z-index: 2000) ──────────────────────────────────
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.style.cssText = `
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    z-index: 1999;
  `;

  const mobileMenu = document.createElement('div');
  mobileMenu.className = 'nav-mobile-menu';
  mobileMenu.style.cssText = `
    display: none;
    position: fixed;
    top: 52px; left: 0; right: 0;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 0.75rem;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 2000;
    box-shadow: var(--shadow-xl);
    max-height: calc(100vh - 52px);
    overflow-y: auto;
  `;

  // Clone nav items into mobile menu
  pages.forEach(({ name, page }) => {
    const link = createMobileNavLink(name, () => {
      closeMobileMenu();
      router.navigate(page);
    }, page === activePage);
    mobileMenu.appendChild(link);
  });

  // Admin mobile (async)
  if (user) {
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role === 'admin') {
          const adminLink = createMobileNavLink('Admin', () => {
            closeMobileMenu();
            router.navigate('admin');
          }, activePage === 'admin');
          mobileMenu.insertBefore(adminLink, mobileMenu.lastChild);
        }
      });
  }

  // Mobile logout
  const mobileLogoutBtn = document.createElement('button');
  mobileLogoutBtn.textContent = 'Log out';
  mobileLogoutBtn.style.cssText = `
    width: 100%; text-align: left; padding: 0.65rem 0.75rem;
    background: transparent; border: 1px solid var(--border);
    color: var(--text-secondary); font-size: 0.875rem; font-weight: 500;
    border-radius: var(--radius-s); cursor: pointer; min-height: auto;
    margin-top: 0.25rem;
  `;
  mobileLogoutBtn.onclick = handleLogout;
  mobileMenu.appendChild(mobileLogoutBtn);

  backdrop.onclick = closeMobileMenu;

  function closeMobileMenu() {
    mobileMenu.style.display = 'none';
    backdrop.style.display = 'none';
    document.body.style.overflow = '';
    hamburger.innerHTML = iconHamburger;
  }

  // Hamburger button
  const hamburger = document.createElement('button');
  hamburger.className = 'nav-hamburger';
  hamburger.style.cssText = `
    display: none; background: none; border: none;
    color: var(--text-primary); cursor: pointer;
    padding: 0.25rem; width: auto; min-height: auto;
    margin-left: auto; align-items: center; justify-content: center;
  `;

  const iconHamburger = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  const iconClose = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  hamburger.innerHTML = iconHamburger;

  hamburger.onclick = () => {
    const isOpen = mobileMenu.style.display === 'flex';
    if (isOpen) {
      closeMobileMenu();
    } else {
      mobileMenu.style.display = 'flex';
      backdrop.style.display = 'block';
      document.body.style.overflow = 'hidden';
      hamburger.innerHTML = iconClose;
    }
  };

  nav.appendChild(logo);
  nav.appendChild(sep);
  nav.appendChild(hamburger);
  nav.appendChild(links);

  // Append overlay elements to body after nav is mounted
  requestAnimationFrame(() => {
    document.body.appendChild(backdrop);
    document.body.appendChild(mobileMenu);
  });

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

function createMobileNavLink(text, onClick, isActive = false) {
  const link = document.createElement('a');
  link.href = '#';
  link.textContent = text;
  link.style.cssText = `
    display: block; width: 100%;
    font-size: 0.94rem; font-weight: ${isActive ? '600' : '500'};
    color: ${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};
    text-decoration: none; padding: 0.65rem 0.75rem;
    border-radius: var(--radius-s);
    transition: all 0.15s ease;
    ${isActive ? 'background: var(--bg-raised);' : ''}
  `;

  link.onmouseenter = () => {
    link.style.background = 'var(--bg-raised)';
    link.style.color = 'var(--text-primary)';
  };
  link.onmouseleave = () => {
    link.style.background = isActive ? 'var(--bg-raised)' : 'transparent';
    link.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
  };

  link.onclick = (e) => { e.preventDefault(); onClick(); };
  return link;
}

async function handleLogout() {
  try {
    await supabase.auth.signOut();
    // Clean up mobile overlays on logout
    document.querySelectorAll('.nav-backdrop, .nav-mobile-menu').forEach(el => el.remove());
    document.body.style.overflow = '';
    router.navigate('login', { replace: true });
  } catch (err) {
    console.error('Logout error:', err);
  }
}