// Notifications Management Module
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { db, FIRESTORE_COLLECTIONS } from "./firebase-config.js";
import { getNotificationsForUser, markNotificationAsRead } from "./firestore.js";
import { formatDateTime, escapeHtml } from "./ui.js";

export async function initNotificationBell(userId) {
  const bell = document.querySelector(".notification-bell");
  if (!bell) return;

  try {
    const list = await getNotificationsForUser(userId);
    const unread = list.filter(n => !n.read).length;

    let badge = bell.querySelector(".badge");
    if (unread > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        bell.appendChild(badge);
      }
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.style.display = "flex";
    } else if (badge) {
      badge.style.display = "none";
    }
  } catch (err) {
    console.warn("Notification load error:", err);
  }
}

export async function renderNotificationList(container, userId) {
  if (!container) return;
  
  try {
    const items = await getNotificationsForUser(userId);
    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-title">No notifications yet</div>
          <div class="empty-state-desc">You're all caught up. When case statuses update or messages arrive, they'll appear here.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(n => `
      <div class="panel mb-2 ${n.read ? '' : 'border-l-4'}" style="padding:14px 18px; border-left: ${n.read ? '1px solid var(--line)' : '3px solid var(--gold)'}; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:600; color:var(--navy); font-size:14px;">${escapeHtml(n.title)}</div>
          <div style="font-size:13px; color:var(--ink-light); margin-top:3px;">${escapeHtml(n.message)}</div>
          <div style="font-size:11px; color:var(--muted); margin-top:4px;">${formatDateTime(n.createdAt)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          ${n.link ? `<a href="${n.link}" class="btn btn-outline btn-sm">View</a>` : ""}
          ${!n.read ? `<button class="btn btn-sm btn-outline mark-read-btn" data-id="${n.id}">Mark read</button>` : ""}
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".mark-read-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        await markNotificationAsRead(btn.dataset.id);
        btn.remove();
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="form-error">Could not load notifications: ${err.message}</div>`;
  }
}
