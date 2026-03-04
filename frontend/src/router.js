import { renderLoginPage } from './pages/login.js';
import { renderSignupPage } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderMapPage } from './pages/map.js';
import { renderUploadPage } from './pages/upload.js';
import { renderRoutePage } from './pages/route.js';
import { renderProfilePage } from './pages/profile.js';
import { renderJourneyPage } from './pages/journey.js';
import { renderAdminPage } from './pages/admin.js';

let app = null;
let currentPage = null;

// Pages that don't require authentication
const PUBLIC_PAGES = ['login', 'signup'];

// Route config maps path segments to page names
const ROUTES = {
  '/': 'login',
  '/login': 'login',
  '/signup': 'signup',
  '/dashboard': 'dashboard',
  '/map': 'map',
  '/upload': 'upload',
  '/route': 'route',
  '/profile': 'profile',
  '/journey': 'journey',
  '/admin': 'admin'
};

const PAGE_RENDERERS = {
  login: renderLoginPage,
  signup: renderSignupPage,
  dashboard: renderDashboard,
  map: renderMapPage,
  upload: renderUploadPage,
  route: renderRoutePage,
  profile: renderProfilePage,
  journey: renderJourneyPage,
  admin: renderAdminPage
};

function getPageFromPath(pathname) {
  return ROUTES[pathname] || null;
}

function getPathFromPage(page) {
  for (const [path, p] of Object.entries(ROUTES)) {
    if (p === page && path !== '/') return path;
  }
  return '/' + page;
}

export const router = {
  /**
   * Navigate to a page. Uses pushState by default.
   * @param {string} page - page name (e.g. 'dashboard')
   * @param {object} options - { replace: bool, params: {} }
   */
  navigate(page, options = {}) {
    if (!app) {
      app = document.getElementById('app');
    }

    const isAuthenticated = !!window.getCurrentUser();

    // Auth guard: redirect unauthenticated users away from protected pages
    if (!PUBLIC_PAGES.includes(page) && !isAuthenticated) {
      this.navigate('login', { replace: true });
      return;
    }

    // Auth guard: redirect authenticated users away from login/signup
    if (PUBLIC_PAGES.includes(page) && isAuthenticated) {
      this.navigate('dashboard', { replace: true });
      return;
    }

    const path = getPathFromPage(page);
    const renderer = PAGE_RENDERERS[page];

    if (!renderer) {
      this.navigate('login', { replace: true });
      return;
    }

    // Don't re-render if already on this page (unless forced)
    if (currentPage === page && !options.force) return;

    // Update browser history
    if (options.replace) {
      history.replaceState({ page }, '', path);
    } else {
      history.pushState({ page }, '', path);
    }

    currentPage = page;
    app.innerHTML = '';
    renderer(app);
  },

  /**
   * Initialize routing from current URL (called on app load)
   */
  initRoute() {
    const page = getPageFromPath(window.location.pathname);
    const isAuthenticated = !!window.getCurrentUser();

    if (page && !PUBLIC_PAGES.includes(page) && isAuthenticated) {
      this.navigate(page, { replace: true, force: true });
    } else if (page && PUBLIC_PAGES.includes(page) && !isAuthenticated) {
      this.navigate(page, { replace: true, force: true });
    } else if (isAuthenticated) {
      this.navigate('dashboard', { replace: true, force: true });
    } else {
      this.navigate('login', { replace: true, force: true });
    }
  },

  getCurrentPage() {
    return currentPage;
  }
};

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  const page = event.state?.page || getPageFromPath(window.location.pathname);
  if (page) {
    const isAuthenticated = !!window.getCurrentUser();

    // Prevent going back to login when authenticated
    if (PUBLIC_PAGES.includes(page) && isAuthenticated) {
      router.navigate('dashboard', { replace: true, force: true });
      return;
    }

    // Prevent going to protected pages when not authenticated
    if (!PUBLIC_PAGES.includes(page) && !isAuthenticated) {
      router.navigate('login', { replace: true, force: true });
      return;
    }

    if (!app) app = document.getElementById('app');
    currentPage = page;
    app.innerHTML = '';
    const renderer = PAGE_RENDERERS[page];
    if (renderer) renderer(app);
  }
});
