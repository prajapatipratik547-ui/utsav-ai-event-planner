// Applies the saved or system colour theme before first paint (no flash).
// Loaded as an external file so the Content-Security-Policy can forbid inline scripts.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('utsav:theme');
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
