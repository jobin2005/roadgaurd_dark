import { supabase } from './services/supabaseClient.js';
import { router } from './router.js';
import '../style.css';

let currentUser = null;

async function initializeApp() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (user) {
    ensureUserProfile(user);
  }

  // Initialize route from URL, with auth context
  router.initRoute();

  let initialized = false;

  supabase.auth.onAuthStateChange((event, session) => {
    if (!initialized) {
      initialized = true;
      return;
    }

    if (session?.user) {
      currentUser = session.user;
      ensureUserProfile(session.user);
      router.navigate('dashboard', { replace: true });
    } else {
      currentUser = null;
      router.navigate('login', { replace: true });
    }
  });
}

async function ensureUserProfile(user) {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) {
      await supabase.from('user_profiles').insert({
        id: user.id,
        email: user.email,
        full_name: '',
        contributions: 0
      });
    }
  } catch (err) {
    console.error('Error ensuring user profile:', err);
  }
}

window.getCurrentUser = () => currentUser;

initializeApp();
