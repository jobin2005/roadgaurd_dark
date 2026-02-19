import { supabase } from '../services/supabaseClient.js';
import { router } from '../router.js';
import { showAlert } from '../components/alert.js';

export function renderSignupPage(container) {
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
        <h1 style="text-align: center; margin-bottom: 0.5rem; font-size: 2.5rem;">RoadGuard</h1>
        <p style="text-align: center; color: var(--text-secondary); margin-bottom: 2rem;">Join the Community</p>

        <form id="signupForm">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Full Name</label>
            <input type="text" id="fullName" required placeholder="John Doe" style="width: 100%;">
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
            <input type="email" id="email" required placeholder="your@email.com" style="width: 100%;">
          </div>

          <div style="margin-bottom: 2rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Password</label>
            <input type="password" id="password" required placeholder="••••••••" style="width: 100%;">
          </div>

          <button type="submit" style="width: 100%; padding: 0.75rem; font-size: 1rem; font-weight: 600;">
            Create Account
          </button>
        </form>

        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary);">
          Already have an account?
          <a href="#" id="loginLink" style="color: var(--accent-primary); cursor: pointer; text-decoration: underline;">
            Sign in
          </a>
        </p>
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
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

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
