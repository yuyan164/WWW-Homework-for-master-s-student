/* js/ai_chat.js - AI Assistant Chat Widget */

(function () {
    const t = (key, fallback) => window.getTrans ? window.getTrans(key) : (fallback || key);

    const STORAGE_KEY = "aiChatHistory";
    const USER_KEY = "aiChatUserId";

    let chatHistory = [];
    let currentUserId = null;

    async function checkUserAndInitialize() {
        try {
            const resp = await fetch("api/me.php", { credentials: "same-origin" });
            const data = await resp.json();

            if (data.ok && data.user) {
                currentUserId = String(data.user.user_id);

                // If it's a new user login, clear previous history
                const savedUserId = localStorage.getItem(USER_KEY);
                if (savedUserId !== currentUserId) {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.setItem(USER_KEY, currentUserId);
                } else {
                    // Load history
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        try { chatHistory = JSON.parse(saved); } catch (e) { chatHistory = []; }
                    }
                }

                mountWidget();
            } else {
                // Not logged in -> clear history so next user gets a fresh start
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(USER_KEY);
            }
        } catch (e) {
            console.warn("AI Chat init failed:", e);
        }
    }

    function mountWidget() {
        // Inject link tag for CSS if not present
        if (!document.querySelector('link[href*="ai_chat.css"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "css/ai_chat.css?v=" + new Date().getTime(); // cache bust
            document.head.appendChild(link);
        }

        // Build DOM
        const widget = document.createElement("div");
        widget.id = "ai-chat-widget";
        widget.innerHTML = `
      <div id="ai-chat-panel">
        <div id="ai-chat-header">
          <span>${t("ai_assistant", "AI Booking Assistant")} ✨</span>
          <button id="ai-chat-close">✕</button>
        </div>
        <div id="ai-chat-messages"></div>
        <div id="ai-chat-input-area">
          <input type="text" id="ai-chat-input" placeholder="${t("ai_input_ph", "Ask about available rooms or make a booking...")}" autocomplete="off" />
          <button id="ai-chat-send">➤</button>
        </div>
      </div>
      <button id="ai-chat-btn" title="${t("ai_assistant", "AI Booking Assistant")}">💬</button>
    `;
        document.body.appendChild(widget);

        const btn = document.getElementById("ai-chat-btn");
        const panel = document.getElementById("ai-chat-panel");
        const closeBtn = document.getElementById("ai-chat-close");
        const input = document.getElementById("ai-chat-input");
        const sendBtn = document.getElementById("ai-chat-send");
        const msgBox = document.getElementById("ai-chat-messages");

        function renderMessages() {
            msgBox.innerHTML = "";
            if (chatHistory.length === 0) {
                const welcome = document.createElement("div");
                welcome.className = "ai-msg";
                welcome.textContent = t(
                    "ai_welcome",
                    "Hello! I'm your campus booking assistant. You can ask me whether a room is available, or directly tell me the time and place you'd like to book."
                );
                msgBox.appendChild(welcome);
            } else {
                chatHistory.forEach(msg => {
                    const div = document.createElement("div");
                    div.className = msg.role === "user" ? "user-msg" : "ai-msg";
                    div.textContent = msg.content;
                    msgBox.appendChild(div);
                });
            }
            msgBox.scrollTop = msgBox.scrollHeight;
        }

        function toggleChat() {
            panel.classList.toggle("open");
            if (panel.classList.contains("open")) {
                renderMessages();
                input.focus();
            }
        }

        btn.addEventListener("click", toggleChat);
        closeBtn.addEventListener("click", () => panel.classList.remove("open"));

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            // Add user message
            chatHistory.push({ role: "user", content: text });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
            renderMessages();
            input.value = "";
            input.disabled = true;
            sendBtn.disabled = true;

            // Show typing indicator
            const typing = document.createElement("div");
            typing.className = "ai-typing";
            typing.innerHTML = `<span></span><span></span><span></span>`;
            msgBox.appendChild(typing);
            msgBox.scrollTop = msgBox.scrollHeight;

            try {
                const resp = await fetch("api/ai_chat.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: text,
                        history: chatHistory.slice(-6) // Send last few messages for context
                    })
                });

                const data = await resp.json();

                typing.remove();

                const reply = data.reply || t("error_server", "System error. Please try again later.");
                chatHistory.push({ role: "assistant", content: reply });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));

                // If a booking succeeded, we can reload active lists
                if (data.action === "book" && data.success) {
                    if (typeof window.reloadUserBookings === "function") window.reloadUserBookings();
                    if (typeof window.reloadAdminBookings === "function") window.reloadAdminBookings();
                }

            } catch (err) {
                typing.remove();
                console.warn("AI Chat Error:", err);
                chatHistory.push({
                    role: "assistant",
                    content: t("error_server", "Network or system error. Please check your connection.")
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
            }

            renderMessages();
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }

        sendBtn.addEventListener("click", sendMessage);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Listen to lang changes (optional)
        document.addEventListener("langChanged", () => {
            input.placeholder = t("ai_input_ph", "Ask about available rooms or make a booking...");
        });
    }

    // Auto initialize on load
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", checkUserAndInitialize);
    } else {
        checkUserAndInitialize();
    }

})();