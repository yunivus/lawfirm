// Client Case Messaging Logic
import { requireRole } from "../guard.js";
import { getCases, getCaseById, sendCaseMessage, listenCaseMessages } from "../firestore.js";
import { initNotificationBell } from "../notifications.js";
import { formatDateTime, escapeHtml, showToast } from "../ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireRole(["client"]);
  if (!profile) return;

  initNotificationBell(profile.id);

  const channelsList = document.getElementById("case-channels-list");
  const channelTitle = document.getElementById("active-channel-title");
  const channelLawyer = document.getElementById("active-channel-lawyer");
  const messagesContainer = document.getElementById("messages-container");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-text");

  const urlParams = new URLSearchParams(window.location.search);
  let activeCaseId = urlParams.get("caseId");
  let unsubscribeMessages = null;

  try {
    const cases = await getCases({ clientId: profile.id });
    if (!cases || cases.length === 0) {
      channelsList.innerHTML = `<div class="text-muted text-sm text-center py-4">No cases filed yet.</div>`;
      return;
    }

    renderChannels(cases);

    if (activeCaseId && cases.some(c => c.id === activeCaseId)) {
      selectCase(activeCaseId, cases);
    } else if (cases.length > 0) {
      selectCase(cases[0].id, cases);
    }
  } catch (err) {
    console.error("Messages load error:", err);
  }

  function renderChannels(cases) {
    channelsList.innerHTML = cases.map(c => `
      <div class="chat-conversation-item ${c.id === activeCaseId ? 'active' : ''}" data-id="${c.id}">
        <div style="font-weight:600; font-size:13px; color:var(--navy);">${escapeHtml(c.caseTitle)}</div>
        <div class="text-xs text-muted mt-1">#LC-${c.id.slice(0, 5).toUpperCase()} · ${escapeHtml(c.lawyerName || 'Pending Counsel')}</div>
      </div>
    `).join("");

    channelsList.querySelectorAll(".chat-conversation-item").forEach(item => {
      item.addEventListener("click", () => {
        selectCase(item.dataset.id, cases);
      });
    });
  }

  async function selectCase(caseId, cases) {
    activeCaseId = caseId;
    renderChannels(cases);

    const targetCase = cases.find(c => c.id === caseId);
    if (!targetCase) return;

    channelTitle.textContent = targetCase.caseTitle;
    channelLawyer.textContent = `Assigned Attorney: ${targetCase.lawyerName || 'Pending Assignment'}`;
    messageForm.style.display = "flex";

    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    messagesContainer.innerHTML = `<div class="text-center text-muted py-4 text-sm">Connecting to secure case channel...</div>`;

    unsubscribeMessages = listenCaseMessages(caseId, (messages) => {
      if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
          <div class="empty-state" style="padding:20px 0;">
            <div class="empty-state-title">No messages yet</div>
            <div class="empty-state-desc">Send a message to your attorney below. All communications are strictly privileged.</div>
          </div>
        `;
        return;
      }

      messagesContainer.innerHTML = messages.map(m => {
        const isMe = m.senderId === profile.id;
        return `
          <div class="msg-bubble ${isMe ? 'sent' : 'received'}">
            <div style="font-size:11px; opacity:0.8; margin-bottom:3px; font-weight:600;">
              ${escapeHtml(m.senderName)} ${m.senderRole === 'lawyer' ? '⚖ (Counsel)' : ''}
            </div>
            <div>${escapeHtml(m.message)}</div>
            <div style="font-size:10px; opacity:0.7; text-align:right; margin-top:4px;">
              ${formatDateTime(m.createdAt)}
            </div>
          </div>
        `;
      }).join("");

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !activeCaseId) return;

    messageInput.value = "";
    try {
      await sendCaseMessage(activeCaseId, {
        senderId: profile.id,
        senderName: profile.displayName || profile.email,
        senderRole: "client",
        message: text
      });
    } catch (err) {
      showToast("Failed to send message: " + err.message, "error");
    }
  });
});
