/**
 * ChatGPT Copy Cleaner - Popup Script
 *
 * Handles the extension popup UI for configuring settings.
 * Settings are synced via browser storage and apply immediately.
 *
 * @license MIT
 */

(() => {
  "use strict";

  // ==========================================================================
  // Browser API Compatibility
  // ==========================================================================

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;
  const storage = browserAPI.storage.sync || browserAPI.storage.local;

  // ==========================================================================
  // Default Settings
  // ==========================================================================

  const DEFAULTS = {
    enabled: true,
    mode: "aggressive",
    protectCodeBlocks: true,
    showNotifications: true,
    theme: "light",
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================

  const elements = {
    themeToggle: document.getElementById("themeToggle"),
    enabledToggle: document.getElementById("enabledToggle"),
    statusText: document.getElementById("statusText"),
    modeRadios: document.querySelectorAll('input[name="mode"]'),
    protectCodeToggle: document.getElementById("protectCodeToggle"),
    notificationsToggle: document.getElementById("notificationsToggle"),
  };

  // ==========================================================================
  // Theme Management
  // ==========================================================================

  /**
   * Apply theme to the document
   * @param {string} theme - "light" or "dark"
   */
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    storage.set({ theme });
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "light" ? "dark" : "light");
  }

  // ==========================================================================
  // Settings Management
  // ==========================================================================

  /**
   * Update all UI elements to reflect current settings
   * @param {object} settings
   */
  function updateUI(settings) {
    // Theme
    document.documentElement.setAttribute("data-theme", settings.theme || "light");

    // Enabled toggle
    elements.enabledToggle.checked = settings.enabled;
    elements.statusText.textContent = settings.enabled ? "Active" : "Disabled";
    elements.statusText.classList.toggle("disabled", !settings.enabled);

    // Mode radios
    elements.modeRadios.forEach((radio) => {
      radio.checked = radio.value === settings.mode;
    });

    // Options
    elements.protectCodeToggle.checked = settings.protectCodeBlocks;
    elements.notificationsToggle.checked = settings.showNotifications;
  }

  /**
   * Save a single setting to storage
   * @param {string} key
   * @param {*} value
   */
  function saveSetting(key, value) {
    storage.set({ [key]: value });
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================

  function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener("click", toggleTheme);

    // Enabled toggle
    elements.enabledToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      saveSetting("enabled", enabled);
      elements.statusText.textContent = enabled ? "Active" : "Disabled";
      elements.statusText.classList.toggle("disabled", !enabled);
    });

    // Mode radios
    elements.modeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          saveSetting("mode", e.target.value);
        }
      });
    });

    // Protect code blocks toggle
    elements.protectCodeToggle.addEventListener("change", (e) => {
      saveSetting("protectCodeBlocks", e.target.checked);
    });

    // Notifications toggle
    elements.notificationsToggle.addEventListener("change", (e) => {
      saveSetting("showNotifications", e.target.checked);
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  function init() {
    // Load settings and update UI
    const loadPromise = storage.get(DEFAULTS);
    if (loadPromise?.then) {
      loadPromise.then(updateUI);
    } else {
      storage.get(DEFAULTS, updateUI);
    }

    setupEventListeners();
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
