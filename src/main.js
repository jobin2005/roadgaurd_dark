import { supabase } from './services/supabaseClient.js';
import { router } from './router.js';
import '../style.css';

let currentUser = null;

async function initializeApp() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (user) {
    ensureUserProfile(user);
    router.navigate('dashboard');
  } else {
    router.navigate('login');
  }

  let initialized = false;

  supabase.auth.onAuthStateChange((event, session) => {
    if (!initialized) {
      initialized = true;
      return;
    }

    if (session?.user) {
      currentUser = session.user;
      ensureUserProfile(session.user);
      router.navigate('dashboard');
    } else {
      currentUser = null;
      router.navigate('login');
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
