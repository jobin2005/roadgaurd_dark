import { renderLoginPage } from './pages/login.js';
import { renderSignupPage } from './pages/signup.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderMapPage } from './pages/map.js';
import { renderUploadPage } from './pages/upload.js';
import { renderRoutePage } from './pages/route.js';
import { renderProfilePage } from './pages/profile.js';

const app = document.getElementById('app');

export const router = {
  navigate(page, params = {}) {
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
      default:
        renderLoginPage(app);
    }
  }
};
