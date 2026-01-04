(() => {
  "use strict";

  // If you want URLs removed even inside code blocks, set to false.
  const PROTECT_CODE_BLOCKS = false;

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // --- Cleaner logic (for selection copy) ---
  function cleanAll(text) {
    let t = String(text ?? "");
    t = t.replace(/\s*cite[^]+/g, "");
    t = t.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "");
    t = t.replace(/ \[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1");
    t = t.replace(/ \[([^\]]+)\]\[[^\]]+\]/g, "$1");
    t = t.replace(/\s*\(\[[^\]]+\]\[[^\]]+\]\)\s*(?:<-+.*)?/g, "");
    t = t.replace(/\s*\[[^\]]+\]/g, "");
    t = t.replace(/<https?:\/\/[^>]+>/gi, "");
    t = t.replace(/\bhttps?:\/\/\S+/gi, "");
    t = t.replace(/\bwww\.\S+/gi, "");
    t = t.replace(/(^|\s)[A-Z][A-Za-z0-9 .,&/\\-]{2,80}\+\d+\b/g, "$1");
    t = t.replace(/\(\s*\)/g, "");
    t = t.replace(/[ \t]+/g, " ");
    t = t.replace(/ *\n */g, "\n");
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }

  function cleanCopiedText(text) {
    if (!PROTECT_CODE_BLOCKS) return cleanAll(text);
    const parts = String(text ?? "").split(/(```[\s\S]*?```|`[^`\n]+`)/g);
    return parts.map((p, i) => (i % 2 === 1 ? p : cleanAll(p))).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toHtml(text) {
    const esc = escapeHtml(text);
    return `<div style="white-space:pre-wrap;font-family:inherit;">${esc}</div>`;
  }

  // --- Selection copy (Ctrl/Cmd-C) Handler ---
  // This remains in the content script as it's the most direct way to handle this DOM event.
  function closestElement(node) {
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function selectionIsInAssistant(sel) {
    if (!sel || sel.isCollapsed) return false;
    const selector = '[data-message-author-role="assistant"]';
    const a = closestElement(sel.anchorNode)?.closest?.(selector);
    const f = closestElement(sel.focusNode)?.closest?.(selector);
    return Boolean(a || f);
  }

  document.addEventListener(
    "copy",
    (e) => {
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) return;
      if (!selectionIsInAssistant(sel)) return;

      const raw = sel.toString();
      const cleaned = cleanCopiedText(raw);
      if (!cleaned || cleaned === raw) return;

      e.clipboardData.setData("text/plain", cleaned);
      e.clipboardData.setData("text/html", toHtml(cleaned));
      e.preventDefault();
    },
    true
  );

  // --- UI Feedback (Toast) ---
  function showToast(msg, ok = true) {
    try {
      const id = "__chatgpt_copy_cleaner_toast__";
      document.getElementById(id)?.remove();
      const el = document.createElement("div");
      el.id = id;
      el.textContent = msg;
      Object.assign(el.style, {
        position: "fixed",
        zIndex: "999999",
        top: "12px",
        right: "12px",
        padding: "10px 12px",
        borderRadius: "10px",
        font: "12px/1.2 system-ui, -apple-system, Segoe UI, Roboto",
        background: ok ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
        color: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        maxWidth: "280px",
      });
      document.documentElement.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    } catch (_) {}
  }

  // --- Trigger background script injection and listen for confirmation ---
  const HOOK_EVENT = "__chatgpt_copy_cleaner_hooked__";

  // 1. Listen for the confirmation event from the injected script
  window.addEventListener(HOOK_EVENT, (e) => {
    if (e.detail?.ok) {
      console.log("[Copy Cleaner] Main-world script hook confirmed.");
      showToast("Copy Cleaner: hook active", true);
    } else {
      console.error("[Copy Cleaner] Main-world script failed to hook:", e.detail);
      showToast("Copy Cleaner: hook failed (see console)", false);
    }
  });

  // 2. Send a message to the background script to trigger the injection
  browserAPI.runtime.sendMessage({ type: 'inject_script' }, (response) => {
    if (browserAPI.runtime.lastError) {
      console.error("[Copy Cleaner] Injection trigger failed:", browserAPI.runtime.lastError.message);
      showToast("Copy Cleaner: hook failed (runtime error)", false);
    } else if (!response?.success) {
      console.error("[Copy Cleaner] Injection failed in background script:", response?.error);
      showToast("Copy Cleaner: hook blocked (injection failed)", false);
    }
    // If successful, we wait for the HOOK_EVENT to show the success toast.
  });

})();
