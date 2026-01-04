// background.js

// This script handles the injection of the main-world script using an API
// that is more robust and bypasses Content Security Policy (CSP).

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Listener for messages from the content script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if the message is the one we're expecting
  if (message.type === 'inject_script') {
    // Ensure we have a tab ID to target the script injection
    if (sender.tab?.id) {
      browserAPI.scripting.executeScript({
        target: { tabId: sender.tab.id },
        files: ['page_final.js'],
        world: 'MAIN', // This is the crucial part: injects into the page's own context
      })
      .then(() => {
        console.log("[Copy Cleaner] Injected page_final.js into the main world.");
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error("[Copy Cleaner] Failed to inject script:", err);
        sendResponse({ success: false, error: err.message });
      });
      
      // Return true to indicate that we will send a response asynchronously
      return true;
    } else {
      console.error("[Copy Cleaner] Message received from a context without a tab ID.");
      sendResponse({ success: false, error: "No tab ID" });
    }
  }
});
