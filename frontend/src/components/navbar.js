import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';

export function createNavbar() {
  const nav = document.createElement('nav');
  nav.style.cssText = `
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
  `;

  const logo = document.createElement('div');
  logo.style.cssText = `
    font-size: 1.5rem;
    font-weight: 700;
    cursor: pointer;
  `;
  logo.textContent = 'RoadGuard';
  logo.onclick = () => router.navigate('dashboard');

  const links = document.createElement('div');
  links.style.cssText = `
    display: flex;
    gap: 1rem;
    align-items: center;
  `;

  const mapBtn = createNavButton('Map', () => router.navigate('map'));
  const uploadBtn = createNavButton('Upload', () => router.navigate('upload'));
  const routeBtn = createNavButton('Route', () => router.navigate('route'));
  const profileBtn = createNavButton('Profile', () => router.navigate('profile'));
  const logoutBtn = createNavButton('Logout', handleLogout);

  logoutBtn.style.background = 'var(--error)';

  links.appendChild(mapBtn);
  links.appendChild(uploadBtn);
  links.appendChild(routeBtn);
  links.appendChild(profileBtn);

  const user = window.getCurrentUser();
  if (user) {
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role === 'admin') {
          const adminBtn = createNavButton('🛡️ Admin', () => router.navigate('admin'));
          adminBtn.style.background = 'rgba(139, 92, 246, 0.2)';
          adminBtn.style.borderColor = '#8b5cf6';
          adminBtn.style.color = '#8b5cf6';
          links.insertBefore(adminBtn, logoutBtn);
        }
      });
  }

  links.appendChild(logoutBtn);

  nav.appendChild(logo);
  nav.appendChild(links);

  return nav;
}

function createNavButton(text, onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn-small btn-secondary';
  btn.textContent = text;
  btn.onclick = onClick;
  btn.style.cssText += 'background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-primary);';
  return btn;
}

async function handleLogout() {
  try {
    await supabase.auth.signOut();
    router.navigate('login');
  } catch (err) {
    console.error('Logout error:', err);
  }
}