import { createNavbar } from '../components/navbar.js';
import { router } from '../router.js';
import { supabase } from '../services/supabaseClient.js';

export function renderDashboard(container) {
  const app = document.createElement('div');
  app.style.cssText = `
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  `;

  app.appendChild(createNavbar());

  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    padding: 3rem 1rem;
    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  `;

  const innerContainer = document.createElement('div');
  innerContainer.style.cssText = `
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    margin-bottom: 3rem;
    text-align: center;
  `;

  const title = document.createElement('h1');
  title.textContent = 'Welcome to RoadGuard';
  title.style.fontSize = '3rem';
  title.style.marginBottom = '0.5rem';

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Help us keep roads safe by reporting potholes';
  subtitle.style.color = 'var(--text-secondary)';
  subtitle.style.fontSize = '1.1rem';

  header.appendChild(title);
  header.appendChild(subtitle);

  const gridContainer = document.createElement('div');
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
  `;

  const options = [
    {
      title: '📍 View Map',
      description: 'See potholes on your local map and access current location',
      action: () => router.navigate('map'),
      color: '#3b82f6'
    },
    {
      title: '📷 Upload Image',
      description: 'Report a pothole by uploading an image for verification',
      action: () => router.navigate('upload'),
      color: '#10b981'
    },
    {
      title: '🛣️ Plan Route',
      description: 'Select start and destination to see potholes in between',
      action: () => router.navigate('route'),
      color: '#f59e0b'
    },
    {
      title: '👤 My Profile',
      description: 'View your profile, stats, and edit your information',
      action: () => router.navigate('profile'),
      color: '#8b5cf6'
    }
  ];

  options.forEach(option => {
    const card = createOptionCard(option);
    gridContainer.appendChild(card);
  });

  innerContainer.appendChild(header);
  innerContainer.appendChild(gridContainer);
  content.appendChild(innerContainer);

  app.appendChild(content);
  container.appendChild(app);

  loadPotholeAlert();
}

function createOptionCard(option) {
  const card = document.createElement('div');
  card.style.cssText = `
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 4px solid ${option.color};
  `;

  card.onmouseenter = () => {
    card.style.transform = 'translateY(-5px)';
    card.style.borderColor = option.color;
    card.style.boxShadow = `0 8px 24px ${option.color}40`;
  };

  card.onmouseleave = () => {
    card.style.transform = 'translateY(0)';
    card.style.borderColor = 'var(--border)';
    card.style.boxShadow = 'none';
  };

  const title = document.createElement('h2');
  title.textContent = option.title;
  title.style.cssText = `
    font-size: 1.5rem;
    margin: 0;
    color: var(--text-primary);
  `;

  const description = document.createElement('p');
  description.textContent = option.description;
  description.style.cssText = `
    color: var(--text-secondary);
    margin: 0;
    flex: 1;
  `;

  const button = document.createElement('button');
  button.textContent = 'Go';
  button.style.cssText = `
    align-self: flex-start;
    background-color: ${option.color};
    border: none;
    color: white;
    padding: 0.5rem 1.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  `;

  button.onclick = option.action;

  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(button);

  return card;
}

async function loadPotholeAlert() {
  try {
    const user = window.getCurrentUser();
    if (!user) return;

    const { data: potholes } = await supabase
      .from('potholes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (potholes && potholes.length > 0) {
      const latestPothole = potholes[0];
      const userLocation = await getUserLocation();

      if (userLocation) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          latestPothole.latitude,
          latestPothole.longitude
        );

        const timeToReach = Math.ceil((distance / 50) * 60);
        //showPotholeAlert(timeToReach, distance);
      }
    }
  } catch (err) {
    console.error('Error loading pothole alert:', err);
  }
}

async function getUserLocation() {
  return new Promise((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null)
      );
    } else {
      resolve(null);
    }
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function showPotholeAlert(timeToReach, distance) {
  const alert = document.createElement('div');
  alert.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--bg-secondary);
    border: 2px solid var(--warning);
    border-radius: 1rem;
    padding: 1.5rem;
    max-width: 350px;
    box-shadow: 0 10px 40px rgba(245, 158, 11, 0.3);
    z-index: 100;
    animation: slideUp 0.4s ease-out;
  `;

  alert.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 1rem;">
      <div style="font-size: 2rem;">⚠️</div>
      <div style="flex: 1;">
        <h3 style="margin: 0 0 0.5rem 0; color: var(--warning);">Pothole Nearby!</h3>
        <p style="margin: 0 0 0.5rem 0; color: var(--text-secondary);">
          Distance: <strong>${distance.toFixed(2)} km</strong>
        </p>
        <p style="margin: 0; color: var(--text-secondary);">
          Approx. <strong>${timeToReach} mins</strong> to reach at 50 km/h
        </p>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: auto;
      ">×</button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        transform: translateY(400px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(alert);

  setTimeout(() => alert.remove(), 8000);
}
