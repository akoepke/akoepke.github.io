// Dark mode toggle functionality
(function() {
  'use strict';

  // Initialize theme on page load
  function initTheme() {
    // Check for saved theme preference or default to OS preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(theme, false); // Don't save on init to preserve user choice

    // Listen for OS theme changes (only if user hasn't set a preference)
    if (!savedTheme) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme, false);
      });
    }
  }

  // Set theme
  function setTheme(theme, save = true) {
    document.documentElement.setAttribute('data-theme', theme);
    // Clear any inline background set by the anti-flash script in <head>
    document.documentElement.style.backgroundColor = '';

    if (save) {
      localStorage.setItem('theme', theme);
    }

    // Update button aria-label
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggle.setAttribute('aria-label', label);
    }
  }

  // Toggle theme
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme, true);
  }

  // Initialize on DOM content loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  // Add toggle event listener when DOM is ready
  function attachToggleListener() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToggleListener);
  } else {
    attachToggleListener();
  }

  // Expose for manual control if needed
  window.themeToggle = {
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    getTheme: () => document.documentElement.getAttribute('data-theme') || 'light'
  };
})();
