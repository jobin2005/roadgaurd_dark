import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';
import { showAlert } from '../components/alert.js';

export function renderSignupPage(container) {
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
            Join the movement<br>for better roads.
          </h1>

          <p style="
            font-size: 1.05rem; line-height: 1.7;
            color: var(--text-secondary);
            max-width: 380px;
          ">
            Create an account to start reporting potholes, contribute to road safety data, and get smarter navigation.
          </p>

          <div style="
            display: flex; flex-direction: column; gap: 1rem;
            margin-top: 3rem; padding-top: 2rem;
            border-top: 1px solid var(--border);
          ">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0;"></div>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">AI-powered pothole detection from photos</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0;"></div>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">Smart route planning that avoids hazards</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0;"></div>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">Real-time community-driven road data</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Signup Form -->
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
            ">Create your account</h2>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
              Get started in under a minute
            </p>
          </div>

          <form id="signupForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <label style="
                display: block; margin-bottom: 0.4rem;
                font-size: 0.8rem; font-weight: 600;
                color: var(--text-secondary); letter-spacing: 0.03em;
                text-transform: uppercase;
              ">Full Name</label>
              <input type="text" id="fullName" required placeholder="Jane Doe">
            </div>

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
            ">Create Account</button>
          </form>

          <p style="
            text-align: center; margin-top: 2rem;
            color: var(--text-tertiary); font-size: 0.85rem;
          ">
            Already have an account?
            <a href="#" id="loginLink" style="
              color: var(--accent); font-weight: 600;
              margin-left: 0.25rem;
            ">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#signupForm');
  const loginLink = container.querySelector('#loginLink');

  form.addEventListener('submit', handleSignup);
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    router.navigate('login');
  });
}

async function handleSignup(e) {
  e.preventDefault();
  const fullName = document.getElementById('fullName').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  console.log(supabaseKey);

  try {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('user_profiles').update({ full_name: fullName }).eq('id', user.id);
    }

    showAlert('Account created successfully!', 'success');
    setTimeout(() => router.navigate('login'), 1500);
  } catch (err) {
    showAlert(err.message || 'Signup failed', 'error');
  }
}
