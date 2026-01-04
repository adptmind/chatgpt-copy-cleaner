(() => {
  "use strict";

  const HOOK_EVENT = "__chatgpt_copy_cleaner_hooked__";
  const STATE_UPDATE_EVENT = "__chatgpt_copy_cleaner_state_update__";
  let isExtensionEnabled = true;

  // Listen for state updates from the content script
  window.addEventListener(STATE_UPDATE_EVENT, (e) => {
    if (typeof e.detail?.enabled === 'boolean') {
      isExtensionEnabled = e.detail.enabled;
    }
  });

  const escapeHtml = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const toHtml = (text) => {
    const esc = escapeHtml(text);
    return `<div style="white-space:pre-wrap;font-family:inherit;">${esc}</div>`;
  };

  // Remove ALL links + citations + reference definitions.
  function cleanAll(text) {
    let t = String(text ?? "");

    // ChatGPT special cite markers (sometimes appear in copied output)
    t = t.replace(/\s*cite[^]+/g, "");

    // Reference definitions: [1]: https://... OR [Label]: https://...
    t = t.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "");

    // Inline markdown links: [label](url) -> label
    t = t.replace(/\<span[^\>]*\>([^\<]*?)\<\/span\>/gi, "$1");
    t = t.replace(/\<a[^\>]*href=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>([^\<]*?)\<\/a\>/gi, "$3");
    t = t.replace(/\<img[^\>]*alt=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>/gi, "$2");
    t = t.replace(/\<img[^\>]*src=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>/gi, "$2");
    t = t.replace(/\<[^>]+>([^\<]*?)\<\/[^>]+>/gi, "$1");
    t = t.replace(/\<[^>]+\>/gi, "");
    t = t.replace(/\\[^\\\]+\\]\((?:https?:\/\/|www\.)[^)]+\)/gi, "$1");

    // Reference-style markdown links: [label][anything] -> label
    t = t.replace(/\<span[^\>]*\>([^\<]*?)\<\/span\>/gi, "$1");
    t = t.replace(/\<a[^\>]*href=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>([^\<]*?)\<\/a\>/gi, "$3");
    t = t.replace(/\<img[^\>]*alt=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>/gi, "$2");
    t = t.replace(/\<img[^\>]*src=\s*(["\']?)([^"\'\s>]+)\1[^>]*\>/gi, "$2");
    t = t.replace(/\<[^>]+>([^\<]*?)\<\/[^>]+>/gi, "$1");
    t = t.replace(/\<[^>]+\>/gi, "");
    t = t.replace(/\\[^\\\]+\]\[[^\]]+\]/g, "$1");

    // Parenthesized reference: ([Title][1]) plus arrow notes
    t = t.replace(/\s*\(\[[^\]]+\]\[[^\].]+\]\)\s*(?:<\-+.*)?/g, "");

    // Bare bracket markers leftover: [1], [Source]
    t = t.replace(/\s*\[[^\]]+\]/g, "");

    // Autolinks: <https://...>
    t = t.replace(/<https?:\/\/[^>]+>/gi, "");

    // Raw URLs
    t = t.replace(/\bhttps?:\/\/\S+/gi, "");
    t = t.replace(/\bwww\.\S+/gi, "");

    // “Source badge” crumbs like: "MDN Web Docs+1"
    t = t.replace(/(^|\s)[A-Z][A-Za-z0-9 .,&/\\-]{2,80}\+\d+\b/g, "$1");

    // Empty parens from removals
    t = t.replace(/\(\s*\)/g, "");

    // Normalize whitespace
    t = t.replace(/[ \t]+/g, " ");
    t = t.replace(/ *\n */g, "\n");
    t = t.replace(/\n{3,}/g, "\n\n");

    return t.trim();
  }

  async function patchClipboard() {
    const clipboard = navigator.clipboard;
    if (!clipboard) return { ok: false, reason: "no navigator.clipboard" };

    // Patch writeText
    if (typeof clipboard.writeText === "function") {
      const origWriteText = clipboard.writeText.bind(clipboard);
      clipboard.writeText = async (text) => {
        if (!isExtensionEnabled) {
          return await origWriteText(text);
        }
        try {
          return await origWriteText(cleanAll(text));
        } catch (e) {
          console.error("[Copy Cleaner] Initial patch error:", e);
          // Re-throw the original error to get a cleaner stack trace.
          throw e;
        }
      };
    }

    // Patch write (rich clipboard) — this is the big one for “Copy” buttons
    if (typeof clipboard.write === "function" && typeof ClipboardItem !== "undefined") {
      const origWrite = clipboard.write.bind(clipboard);
      clipboard.write = async (items) => {
        if (!isExtensionEnabled) {
          return await origWrite(items);
        }
        try {
          if (!Array.isArray(items)) return await origWrite(items);

          const cleanedItems = await Promise.all(items.map(async (it) => {
            // Only handle ClipboardItem-like objects with .types and .getType
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
                out[type] = new Blob([cleanAll(txt)], { type });
              } else if (type === "text/html") {
                // Convert to HTML from cleaned plain text (drop all links)
                const txt = await blob.text();
                out[type] = new Blob([toHtml(cleanAll(txt))], { type });
              } else {
                // Preserve other types (images, etc.)
                out[type] = blob;
              }
            }

            return new ClipboardItem(out);
          }));

          return await origWrite(cleanedItems);
        } catch (e) {
          console.error("[Copy Cleaner] Initial patch error:", e);
          // Re-throw the original error to get a cleaner stack trace.
          throw e;
        }
      };
    }

    return { ok: true };
  }

  patchClipboard().then((res) => {
    try {
      window.dispatchEvent(new CustomEvent(HOOK_EVENT, { detail: res }));
    } catch (_) {
      // ignore
    }
  });
})();