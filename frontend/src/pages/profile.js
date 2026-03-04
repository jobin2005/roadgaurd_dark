import { createNavbar } from "../components/navbar.js";
import { supabase } from "../services/supabaseClient.js";
import { showAlert } from "../components/alert.js";

export function renderProfilePage(container) {
  const app = document.createElement("div");
  app.style.cssText = "display:flex;flex-direction:column;min-height:100vh;background:var(--bg-base);";
  app.appendChild(createNavbar('profile'));

  container.innerHTML = `
    <style>
      .profile-layout-container {
        flex: 1; padding: 2rem 1.5rem; max-width: 960px; margin: 0 auto; width: 100%;
      }
      .profile-grid {
        display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem;
      }
      .stats-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;
      }
      .modal-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;
      }
      @media (max-width: 850px) {
        .profile-grid { grid-template-columns: 1fr; }
        .profile-layout-container { padding: 1.5rem 1rem; }
      }
      @media (max-width: 550px) {
        .stats-grid { grid-template-columns: 1fr; }
        .modal-grid { grid-template-columns: 1fr; }
        .glass-modal { padding: 1.5rem !important; }
      }
    </style>
  `;

  const content = document.createElement("div");
  content.className = "profile-layout-container";

  const header = document.createElement("div");
  header.style.cssText = "margin-bottom:2rem;";
  header.innerHTML = `
    <h1 style="margin-bottom:0.35rem;font-size:1.5rem;">Profile</h1>
    <p style="color:var(--text-secondary);font-size:0.9rem;margin:0;">Your account and contributions</p>
  `;

  const grid = document.createElement("div");
  grid.id = "profileContainer";
  grid.className = "profile-grid";

  content.appendChild(header);
  content.appendChild(grid);
  app.appendChild(content);
  container.appendChild(app);
  loadProfile();
}

async function loadProfile() {
  try {
    const user = window.getCurrentUser();
    if (!user) return;
    const { data: profile, error } = await supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    displayProfile(user, profile);
    displayContributions(user);
  } catch (err) {
    showAlert("Error loading profile", "error");
  }
}

function displayProfile(user, profile) {
  const container = document.getElementById("profileContainer");
  const card = document.createElement("div");
  card.style.cssText = `
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius-l); padding: 1.5rem; height: fit-content;
  `;

  const initial = (profile?.full_name?.[0] || user.email?.[0] || 'U').toUpperCase();
  card.innerHTML = `
    <div style="text-align:center;margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border);">
      <div style="
        width:64px;height:64px;border-radius:50%;margin:0 auto 0.75rem;
        background:var(--bg-overlay);display:flex;align-items:center;justify-content:center;
        font-size:1.5rem;font-weight:800;color:var(--text-primary);
        border: 2px solid var(--border-strong);
      ">${initial}</div>
      <div style="font-weight:600;font-size:1rem;">${profile?.full_name || 'Unnamed'}</div>
      <div style="color:var(--text-tertiary);font-size:0.8rem;margin-top:0.15rem;">${user.email}</div>
      <div style="color:var(--text-tertiary);font-size:0.75rem;margin-top:0.5rem;">
        Joined ${new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
    <form id="profileForm">
      <div style="margin-bottom:1rem;">
        <label style="display:block;margin-bottom:0.4rem;font-size:0.8rem;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.03em;">Full Name</label>
        <input type="text" id="fullName" value="${profile?.full_name || ""}">
      </div>
      <button type="submit" style="width:100%;font-size:0.85rem;">Save Changes</button>
    </form>
  `;

  card.querySelector("#profileForm").addEventListener("submit", (e) => handleProfileUpdate(e, user.id));
  container.appendChild(card);
}

async function displayContributions(user) {
  try {
    const { data: potholes, error } = await supabase
      .from("potholes").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const container = document.getElementById("profileContainer");
    const panel = document.createElement("div");

    // Stats
    const active = potholes?.filter(p => !p.status || p.status === 'active').length || 0;
    const highCount = potholes?.filter(p => p.severity === 'high').length || 0;

    const statsGrid = document.createElement("div");
    statsGrid.className = "stats-grid";
    [
      ['Total', potholes?.length || 0, 'var(--accent)'],
      ['Active', active, 'var(--warning)'],
      ['High', highCount, 'var(--error)']
    ].forEach(([label, val, color]) => {
      const box = document.createElement("div");
      box.style.cssText = `
        background:var(--bg-surface);border:1px solid var(--border);
        border-left:2px solid ${color};
        border-radius:var(--radius-l);padding:1rem;text-align:center;
      `;
      box.innerHTML = `
        <div style="font-size:1.5rem;font-weight:800;color:${color};letter-spacing:-0.02em;">${val}</div>
        <div style="font-size:0.75rem;color:var(--text-tertiary);margin-top:0.2rem;">${label}</div>
      `;
      statsGrid.appendChild(box);
    });
    panel.appendChild(statsGrid);

    // Reports list
    const listHeader = document.createElement("h3");
    listHeader.style.cssText = "margin-bottom:0.75rem;font-size:0.9rem;";
    listHeader.textContent = "Reports";
    panel.appendChild(listHeader);

    if (!potholes || potholes.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No reports yet.";
      empty.style.cssText = "color:var(--text-tertiary);font-size:0.85rem;";
      panel.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.style.cssText = `
        display:flex;flex-direction:column;gap:0.5rem;
        max-height:500px;overflow-y:auto;
      `;
      potholes.forEach((p, i) => {
        const item = document.createElement("div");
        item.style.cssText = `
          background:var(--bg-surface);border:1px solid var(--border);
          border-radius:var(--radius-m);padding:0.75rem 1rem;
          display:flex;align-items:center;justify-content:space-between;
          cursor:pointer;transition:background 0.15s ease;
        `;
        item.onmouseenter = () => item.style.background = 'var(--bg-raised)';
        item.onmouseleave = () => item.style.background = 'var(--bg-surface)';

        const sevColor = p.severity === 'high' ? '#ef4444' : p.severity === 'medium' ? '#f59e0b' : '#22c55e';
        const statusCfg = p.status === 'removed' ? { l: 'Removed', c: '#94a3b8' }
          : p.status === 'pending' ? { l: 'Pending', c: '#eab308' }
            : { l: 'Active', c: '#22c55e' };
        const date = new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

        item.innerHTML = `
          <div>
            <div style="font-size:0.85rem;font-weight:600;">#${i + 1}</div>
            <div style="font-size:0.75rem;color:var(--text-tertiary);">${date}</div>
          </div>
          <div style="display:flex;gap:0.4rem;">
            <span style="font-size:0.72rem;font-weight:700;padding:0.15rem 0.45rem;border-radius:4px;background:${sevColor}18;color:${sevColor};">
              ${p.severity?.toUpperCase() || 'N/A'}
            </span>
            <span style="font-size:0.72rem;font-weight:700;padding:0.15rem 0.45rem;border-radius:4px;background:${statusCfg.c}18;color:${statusCfg.c};">
              ${statusCfg.l}
            </span>
          </div>
        `;
        item.onclick = () => showReportModal(p, i);
        list.appendChild(item);
      });
      panel.appendChild(list);
    }

    container.appendChild(panel);
  } catch (err) {
    console.error("Error loading contributions:", err);
  }
}

function showReportModal(pothole, index) {
  const existing = document.getElementById("reportModal");
  if (existing) existing.remove();

  const sevColor = pothole.severity === 'high' ? '#ef4444' : pothole.severity === 'medium' ? '#f59e0b' : '#22c55e';
  const statusCfg = pothole.status === 'removed' ? { l: 'Removed', c: '#94a3b8' } : { l: 'Active', c: '#22c55e' };
  const date = new Date(pothole.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const overlay = document.createElement("div");
  overlay.id = "reportModal";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;padding:1rem;
  `;

  const modal = document.createElement("div");
  modal.className = 'glass-modal';
  modal.style.cssText = `
    border-radius:var(--radius-xl);padding:2rem;max-width:440px;width:100%;
    max-height:90vh;overflow-y:auto;position:relative;
    box-shadow:var(--shadow-xl);
  `;

  modal.innerHTML = `
    <button id="closeModal" style="
      position:absolute;top:1rem;right:1rem;
      background:var(--bg-raised);border:1px solid var(--border);
      color:var(--text-primary);width:28px;height:28px;padding:0;
      border-radius:50%;cursor:pointer;font-size:0.85rem;min-height:auto;
    ">×</button>
    <h2 style="margin:0 0 1.25rem;font-size:1.1rem;">Report #${index + 1}</h2>
    ${pothole.image_url ? `<img src="${pothole.image_url}" style="width:100%;border-radius:var(--radius-m);margin-bottom:1.25rem;max-height:200px;object-fit:cover;">` : ''}
    <div class="modal-grid">
      <div style="background:var(--bg-raised);border-radius:var(--radius-m);padding:0.75rem;">
        <div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:0.15rem;">Status</div>
        <div style="font-weight:700;color:${statusCfg.c};font-size:0.9rem;">${statusCfg.l}</div>
      </div>
      <div style="background:var(--bg-raised);border-radius:var(--radius-m);padding:0.75rem;">
        <div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:0.15rem;">Severity</div>
        <div style="font-weight:700;color:${sevColor};font-size:0.9rem;">${pothole.severity?.toUpperCase() || 'N/A'}</div>
      </div>
      <div style="background:var(--bg-raised);border-radius:var(--radius-m);padding:0.75rem;">
        <div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:0.15rem;">Location</div>
        <div style="font-weight:600;font-size:0.82rem;">${pothole.latitude?.toFixed(5)}, ${pothole.longitude?.toFixed(5)}</div>
      </div>
      <div style="background:var(--bg-raised);border-radius:var(--radius-m);padding:0.75rem;">
        <div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:0.15rem;">Reported</div>
        <div style="font-weight:600;font-size:0.82rem;">${date}</div>
      </div>
    </div>
    ${pothole.description ? `<div style="background:var(--bg-raised);border-radius:var(--radius-m);padding:0.75rem;"><div style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:0.15rem;">Notes</div><div style="font-size:0.85rem;">${pothole.description}</div></div>` : ''}
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  modal.querySelector("#closeModal").onclick = () => overlay.remove();
}

async function handleProfileUpdate(e, userId) {
  e.preventDefault();
  try {
    const { error } = await supabase.from("user_profiles")
      .update({ full_name: document.getElementById("fullName").value, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw error;
    showAlert("Profile updated!", "success");
  } catch (err) {
    showAlert("Error updating profile", "error");
  }
}
