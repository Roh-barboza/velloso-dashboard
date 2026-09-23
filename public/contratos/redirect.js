(() => {
  const FORM_URL = 'https://forms.gle/XYKmKUTtBC9mhWev7';
  const REDIRECT_DELAY_MS = 3500;
  const isLocalVisualPreview =
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).has('preview');

  if (!isLocalVisualPreview) {
    window.setTimeout(() => window.location.replace(FORM_URL), REDIRECT_DELAY_MS);
  }
})();
