/* Git, Drawn Out: light/dark theme.
   Loaded in <head> before the CSS so a saved choice applies before the first paint (no flash).
   No saved choice = follow the system setting. tokens.css holds both palettes and switches on
   :root[data-theme]. Any button with [data-theme-toggle] flips between the two. Choosing the
   theme your system already uses clears the saved choice, so the site follows the system again. */
(() => {
  const KEY = 'gitDrawnOutTheme';
  const root = document.documentElement;
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };

  const saved = read();
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  const current = () => root.dataset.theme || (sys.matches ? 'dark' : 'light');
  const label = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    for (const b of document.querySelectorAll('[data-theme-toggle]')){
      b.setAttribute('aria-label', `Switch to ${next} theme`);
      b.title = `Switch to ${next} theme`;
    }
  };
  const flip = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (next === (sys.matches ? 'dark' : 'light')){ delete root.dataset.theme; write(null); }
    else { root.dataset.theme = next; write(next); }
    label();
  };

  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-theme-toggle]')) flip(); });
  sys.addEventListener('change', label);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', label) : label();
})();
