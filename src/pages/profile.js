import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';

export function renderProfilePage(container) {
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
    padding: 2rem 1rem;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  `;

  const header = document.createElement('h1');
  header.textContent = 'My Profile';
  header.style.marginBottom = '2rem';

  const mainContainer = document.createElement('div');
  mainContainer.id = 'profileContainer';
  mainContainer.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  `;

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

    const { data: contributions } = await supabase
      .from('potholes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

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
  profileCard.style.cssText = 'padding: 2rem;';

  profileCard.innerHTML = `
    <div style="text-align: center; margin-bottom: 2rem;">
      <div style="
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, var(--accent-primary), #8b5cf6);
        border-radius: 50%;
        margin: 0 auto 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 3rem;
      ">👤</div>
    </div>

    <form id="profileForm">
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Full Name</label>
        <input type="text" id="fullName" value="${profile?.full_name || ''}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
        <input type="email" value="${user.email}" disabled style="width: 100%; background: var(--bg-tertiary); cursor: not-allowed;">
      </div>

      <div style="margin-bottom: 2rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Account Created</label>
        <p style="margin: 0; color: var(--text-secondary);">
          ${new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      <button type="submit" style="width: 100%; padding: 0.75rem; font-weight: 600;">
        Save Changes
      </button>
    </form>
  `;

  const profileForm = profileCard.querySelector('#profileForm');
  profileForm.addEventListener('submit', (e) => handleProfileUpdate(e, user.id));

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
    statsCard.style.cssText = 'padding: 2rem;';

    const statsTitle = document.createElement('h2');
    statsTitle.textContent = 'Your Contributions';
    statsTitle.style.marginTop = '0';

    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    `;

    const totalStat = createStatBox('Total Reports', potholes?.length || 0, 'var(--accent-primary)');
    const highSeverity = createStatBox(
      'High Severity',
      potholes?.filter(p => p.severity === 'high').length || 0,
      'var(--error)'
    );

    statsGrid.appendChild(totalStat);
    statsGrid.appendChild(highSeverity);

    statsCard.appendChild(statsTitle);
    statsCard.appendChild(statsGrid);

    const reportsTitle = document.createElement('h3');
    reportsTitle.textContent = 'Recent Reports';
    reportsTitle.style.marginTop = '1.5rem';

    statsCard.appendChild(reportsTitle);

    if (!potholes || potholes.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No reports yet. Start by uploading pothole images!';
      emptyMsg.style.color = 'var(--text-secondary)';
      statsCard.appendChild(emptyMsg);
    } else {
      potholes.slice(0, 5).forEach((pothole, index) => {
        const reportItem = document.createElement('div');
        reportItem.style.cssText = `
          padding: 1rem;
          background: var(--bg-tertiary);
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;

        const severity = pothole.severity.charAt(0).toUpperCase() + pothole.severity.slice(1);
        const date = new Date(pothole.created_at).toLocaleDateString();

        const severityColor = pothole.severity === 'high' ? 'var(--error)' :
                             pothole.severity === 'medium' ? 'var(--warning)' : 'var(--success)';

        reportItem.innerHTML = `
          <div>
            <p style="margin: 0 0 0.25rem 0; font-weight: 500;">Report ${index + 1}</p>
            <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">${date}</p>
          </div>
          <span style="
            padding: 0.35rem 0.75rem;
            background: ${severityColor}30;
            color: ${severityColor};
            border-radius: 0.35rem;
            font-size: 0.85rem;
            font-weight: 600;
          ">${severity}</span>
        `;

        statsCard.appendChild(reportItem);
      });

      if (potholes.length > 5) {
        const showMore = document.createElement('p');
        showMore.textContent = `...and ${potholes.length - 5} more`;
        showMore.style.cssText = 'color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;';
        statsCard.appendChild(showMore);
      }
    }

    container.appendChild(statsCard);

  } catch (err) {
    console.error('Error loading contributions:', err);
  }
}

function createStatBox(label, value, color) {
  const box = document.createElement('div');
  box.style.cssText = `
    background: ${color}15;
    border: 1px solid ${color}40;
    border-radius: 0.75rem;
    padding: 1.5rem;
    text-align: center;
  `;

  const num = document.createElement('div');
  num.style.cssText = `
    font-size: 2.5rem;
    font-weight: 700;
    color: ${color};
    margin-bottom: 0.5rem;
  `;
  num.textContent = value;

  const lbl = document.createElement('p');
  lbl.textContent = label;
  lbl.style.cssText = 'margin: 0; color: var(--text-secondary); font-size: 0.9rem;';

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
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    showAlert('Profile updated successfully!', 'success');
  } catch (err) {
    showAlert('Error updating profile', 'error');
    console.error(err);
  }
}
