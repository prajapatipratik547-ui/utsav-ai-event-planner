// Re-applies a theme the visitor explicitly chose. The OS preference needs no
// script: styles.css handles it with a prefers-color-scheme media query.
// Loaded as an external file so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var theme = localStorage.getItem('utsav:theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {
    /* storage unavailable: fall back to the OS preference */
  }
})();
