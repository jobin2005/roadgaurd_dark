import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';
import { showAlert } from '../components/alert.js';

export function renderLoginPage(container) {
  container.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
    ">
      <div style="
        width: 100%;
        max-width: 400px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 1rem;
        padding: 2rem;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.3);
      ">
        <h1 style="text-align: center; margin-bottom: 0.5rem; font-size: 2.5rem;">RoadGaurd</h1>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 2rem;">Pothole Detection & Reporting</p>

        <form id="loginForm">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
            <input type="email" id="email" required placeholder="your@email.com" style="width: 100%;">
          </div>

          <div style="margin-bottom: 2rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Password</label>
            <input type="password" id="password" required placeholder="••••••••" style="width: 100%;">
          </div>

          <button type="submit" style="width: 100%; padding: 0.75rem; font-size: 1rem; font-weight: 600;">
            Sign In
          </button>
        </form>

        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary);">
          Don't have an account?
          <a href="#" id="signupLink" style="color: var(--accent-primary); cursor: pointer; text-decoration: underline;">
            Sign up
          </a>
        </p>
      </div>
    </div>
  `;

  const form = container.querySelector('#loginForm');
  const signupLink = container.querySelector('#signupLink');

  form.addEventListener('submit', handleLogin);
  signupLink.addEventListener('click', (e) => {
    e.preventDefault();
    router.navigate('signup');
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    router.navigate('dashboard');
  } catch (err) {
    showAlert(err.message || 'Login failed', 'error');
  }
}
