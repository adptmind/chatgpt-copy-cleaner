(() => {
  "use strict";

  const HOOK_EVENT = "__chatgpt_copy_cleaner_hooked__";
  const HOST_MATCH = /^(?:https?:\/\/)?(?:chatgpt\.com|chat\.openai\.com)\//;

  // If you want URLs removed even inside code blocks, set to false.
  const PROTECT_CODE_BLOCKS = false;

  const log = (...args) => console.log("%c[ChatGPT Copy Cleaner]", "color:#10b981;font-weight:bold", ...args);

  // --- Cleaner (same as page script) ---
  function cleanAll(text) {
    let t = String(text ?? "");

    t = t.replace(/\s*cite[^]+\uE282\uAC81/g, "");
    t = t.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "");
    t = t.replace(/\b\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1");
    t = t.replace(/\b\[([^\]]+)\]\[[^\]]+\]/g, "$1");
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

  // --- Selection copy (Ctrl/Cmd-C) ---
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

  // --- Message-level Copy button (fix) ---
  // The reliable fix is patching clipboard APIs in the PAGE world.
  // Two strategies:
  //  - Firefox: patch via wrappedJSObject + exportFunction (bypasses CSP).
  //  - Chromium: inject page_final.js (may be blocked by CSP; if so, add background scripting API).

  function showToast(msg, ok = true) {
    try {
      const id = "__chatgpt_copy_cleaner_toast__";
      document.getElementById(id)?.remove();

      const el = document.createElement("div");
      el.id = id;
      el.textContent = msg;
      el.style.position = "fixed";
      el.style.zIndex = "999999";
      el.style.top = "12px";
      el.style.right = "12px";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "10px";
      el.style.font = "12px/1.2 system-ui, -apple-system, Segoe UI, Roboto";
      el.style.background = ok ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)";
      el.style.color = "white";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
      el.style.maxWidth = "280px";
      document.documentElement.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    } catch (_) {}
  }

  function hookViaFirefoxWrappedJSObject() {
    try {
      if (!window.wrappedJSObject) return false;
      if (typeof exportFunction !== "function") return false;

      const w = window.wrappedJSObject;
      const clipboard = w.navigator?.clipboard;
      if (!clipboard) return false;

      // Patch writeText
      if (typeof clipboard.writeText === "function") {
        const orig = clipboard.writeText;
        const fn = async (text) => {
          try {
            return await orig.call(clipboard, cleanAll(text));
          } catch (e) {
            return await orig.call(clipboard, text);
          }
        };
        clipboard.writeText = exportFunction(fn, w);
      }

      // Patch write (rich)
      if (typeof clipboard.write === "function" && typeof w.ClipboardItem !== "undefined") {
        const origW = clipboard.write;
        const fnW = async (items) => {
          try {
            if (!Array.isArray(items)) return await origW.call(clipboard, items);

            const cleanedItems = await Promise.all(items.map(async (it) => {
              if (!it || !it.types || typeof it.getType !== "function") return it;

              const out = {};
              for (const type of it.types) {
                const blob = await it.getType(type);
                if (!blob || typeof blob.text !== "function") {
                  out[type] = blob;
                  continue;
                }

                if (type === "text/plain") {
                  const txt = await blob.text();
                  out[type] = new w.Blob([cleanAll(txt)], { type });
                } else if (type === "text/html") {
                  const txt = await blob.text();
                  out[type] = new w.Blob([toHtml(cleanAll(txt))], { type });
                } else {
                  out[type] = blob;
                }
              }

              return new w.ClipboardItem(out);
            }));

            return await origW.call(clipboard, cleanedItems);
          } catch (e) {
            return await origW.call(clipboard, items);
          }
        };
        clipboard.write = exportFunction(fnW, w);
      }

      // Notify content script
      window.dispatchEvent(new CustomEvent(HOOK_EVENT, { detail: { ok: true, via: "firefox_wrappedJSObject" } }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function hookViaInjectedPageScript() {
    try {
      const script = document.createElement("script");
      script.src = (typeof chrome !== "undefined" ? chrome.runtime : browser.runtime).getURL("page_final.js");
      script.type = "text/javascript";
      script.onload = () => script.remove();
      script.onerror = () => {
        window.dispatchEvent(new CustomEvent(HOOK_EVENT, { detail: { ok: false, reason: "script_injection_blocked" } }));
      };
      (document.documentElement || document.head).appendChild(script);
      return true;
    } catch (e) {
      return false;
    }
  }

  let hookConfirmed = false;
  window.addEventListener(HOOK_EVENT, (e) => {
    hookConfirmed = Boolean(e?.detail?.ok);
    if (hookConfirmed) {
      log("clipboard hook active via", e.detail.via || "page_final");
      showToast("Copy Cleaner: hook active", true);
    } else {
      log("clipboard hook failed", e.detail);
      showToast("Copy Cleaner: hook blocked (see notes)", false);
    }
  });

  // Kick off hook attempt
  const isFirefoxHooked = hookViaFirefoxWrappedJSObject();
  if (!isFirefoxHooked) {
    hookViaInjectedPageScript();
  }

  // If hook fails (CSP), we can still rely on selection-copy cleaning.
  // For Chromium robust copy-button support, you will need a background service worker using chrome.scripting
  // with world: 'MAIN'. (Notes in the message below.)
})();