// static/theme-switcher.js
document.addEventListener("DOMContentLoaded", function() {
  const htmlEl = document.documentElement;
  const themeSelector = document.getElementById("theme-selector");

  // Valid themes — must match CSS blocks exactly
  const THEMES = ["mocha", "latte", "frappe", "macchiato", "vanilla"];

  // Load saved theme or default to mocha
  let saved = null;
  try {
    saved = localStorage.getItem("ctp-theme");
  } catch (e) {
    // localStorage might be blocked, ignore
    saved = null;
  }
  if (!saved || !THEMES.includes(saved)) {
    saved = "mocha";
  }

  // Apply to html attribute
  htmlEl.setAttribute("data-ctp-theme", saved);

  // Set selector value if present
  if (themeSelector) themeSelector.value = saved;

  // Listen for changes
  if (themeSelector) {
    themeSelector.addEventListener("change", function(e) {
      const chosen = e.target.value;
      if (!THEMES.includes(chosen)) return;
      htmlEl.setAttribute("data-ctp-theme", chosen);
      try {
        localStorage.setItem("ctp-theme", chosen);
      } catch (err) {
        // ignore storage errors
      }
    });
  }
});
