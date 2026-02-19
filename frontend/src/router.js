import { renderLoginPage } from './pages/login.js';
import { renderSignupPage } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderMapPage } from './pages/map.js';
import { renderUploadPage } from './pages/upload.js';
import { renderRoutePage } from './pages/route.js';
import { renderProfilePage } from './pages/profile.js';
import { renderJourneyPage } from './pages/journey.js';

let app = null;

export const router = {
  navigate(page, params = {}) {
    if (!app) {
      app = document.getElementById('app');
    }

    app.innerHTML = '';

    switch (page) {
      case 'login':
        renderLoginPage(app);
        break;
      case 'signup':
        renderSignupPage(app);
        break;
      case 'dashboard':
        renderDashboard(app);
        break;
      case 'map':
        renderMapPage(app);
        break;
      case 'upload':
        renderUploadPage(app);
        break;
      case 'route':
        renderRoutePage(app);
        break;
      case 'profile':
        renderProfilePage(app);
        break;
      case 'journey':
        renderJourneyPage(app);
        break;
      default:
        renderLoginPage(app);
    }
  }
};
