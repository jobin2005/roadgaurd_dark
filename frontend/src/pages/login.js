import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';
import { showAlert } from '../components/alert.js';

export function renderLoginPage(container) {
  container.innerHTML = `
    <div style="
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--bg-base);
    ">
      <!-- Left: Brand Panel -->
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 4rem;
        position: relative;
        overflow: hidden;
        background: var(--bg-subtle);
        border-right: 1px solid var(--border);
      ">
        <!-- Subtle gradient mesh -->
        <div style="
          position: absolute; inset: 0; opacity: 0.4;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(232, 93, 4, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 80%, rgba(34, 197, 94, 0.03) 0%, transparent 40%);
          pointer-events: none;
        "></div>

        <div style="position: relative; z-index: 1; max-width: 420px;">
          <div style="
            display: flex; align-items: center; gap: 0.75rem;
            margin-bottom: 3rem;
          ">
            <div style="
              width: 36px; height: 36px; border-radius: 8px;
              background: var(--accent); display: flex;
              align-items: center; justify-content: center;
              font-weight: 800; font-size: 0.9rem; color: white;
            ">R</div>
            <span style="font-weight: 700; font-size: 1.1rem; color: var(--text-primary);">RoadGuard</span>
          </div>

          <h1 style="
            font-size: 2.5rem; font-weight: 800;
            line-height: 1.15; letter-spacing: -0.03em;
            margin-bottom: 1.25rem;
            color: var(--text-primary);
          ">
            Safer roads,<br>one report at a time.
          </h1>

          <p style="
            font-size: 1.05rem; line-height: 1.7;
            color: var(--text-secondary);
            max-width: 380px;
          ">
            AI-powered pothole detection and smart navigation for drivers and city planners.
          </p>

          <!-- Stats row -->
          <div style="
            display: flex; gap: 2.5rem; margin-top: 3rem;
            padding-top: 2rem; border-top: 1px solid var(--border);
          ">
            <div>
              <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">2.4k+</div>
              <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.15rem;">Reports filed</div>
            </div>
            <div>
              <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">94%</div>
              <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.15rem;">Detection accuracy</div>
            </div>
            <div>
              <div style="font-size: 1.75rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">500+</div>
              <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.15rem;">Active users</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Login Form -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3rem;
      ">
        <div style="width: 100%; max-width: 360px;">
          <div style="margin-bottom: 2.5rem;">
            <h2 style="
              font-size: 1.5rem; font-weight: 700;
              letter-spacing: -0.02em; margin-bottom: 0.5rem;
            ">Welcome back</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
              Sign in to your account to continue
            </p>
          </div>

          <form id="loginForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <label style="
                display: block; margin-bottom: 0.4rem;
                font-size: 0.8rem; font-weight: 600;
                color: var(--text-secondary); letter-spacing: 0.03em;
                text-transform: uppercase;
              ">Email</label>
              <input type="email" id="email" required placeholder="you@example.com">
            </div>

            <div>
              <label style="
                display: block; margin-bottom: 0.4rem;
                font-size: 0.8rem; font-weight: 600;
                color: var(--text-secondary); letter-spacing: 0.03em;
                text-transform: uppercase;
              ">Password</label>
              <input type="password" id="password" required placeholder="••••••••">
            </div>

            <button type="submit" style="
              width: 100%; padding: 0.7rem; margin-top: 0.5rem;
              font-size: 0.9rem; font-weight: 600;
              border-radius: var(--radius-m);
            ">Sign In</button>
          </form>

          <p style="
            text-align: center; margin-top: 2rem;
            color: var(--text-tertiary); font-size: 0.85rem;
          ">
            Don't have an account?
            <a href="#" id="signupLink" style="
              color: var(--accent); font-weight: 600;
              margin-left: 0.25rem;
            ">Create one</a>
          </p>
        </div>
      </div>
    </div>

    <style>
      @media (max-width: 768px) {
        #app > div > div:first-child > div:first-child {
          grid-template-columns: 1fr !important;
        }
        #app > div > div:first-child > div:first-child > div:first-child {
          display: none !important;
        }
      }
    </style>
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
