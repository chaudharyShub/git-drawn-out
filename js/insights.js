/*
 * Vercel Web Analytics + Speed Insights, left out on the owner's own browsers.
 * Same behavior as every Shubham Works site (docs/SHUBHAM_WORKS.md, "keep the owner's visits
 * out of analytics"); the portfolio's version is lib/owner-device.ts + VercelInsights.tsx.
 *
 * Opening the site with the secret token after `#` marks this browser as the owner's; adding
 * `.on` to it undoes that. Only the token's SHA-256 is here, so reading this code doesn't reveal
 * it, and the browser stores the token itself (checked on every visit), so a hand-made
 * localStorage value doesn't work either. The part after `#` is never sent to a server.
 * Nothing analytics-related loads until the check is done, and it never loads for the owner.
 */
(() => {
  const OWNER_TOKEN_SHA256 = '00ad41f213985ec4c69bf6fd3eb60c220399829190ca21e5c4001ddfc9dbe05b';
  const TURN_ON_SUFFIX = '.on';
  const STORAGE_KEY = 'gitDrawnOutDevice';
  const SCRIPTS = ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'];

  let loaded = false;
  let pending = null;

  const sha256Hex = async (text) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  };
  const matchesToken = async (token) => token.length > 0 && (await sha256Hex(token)) === OWNER_TOKEN_SHA256;

  const readSaved = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(STORAGE_KEY, v); } catch {} };
  const forget = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

  async function checkDevice() {
    const fromLink = decodeURIComponent(location.hash.slice(1));
    if (fromLink) {
      const turnOn = fromLink.endsWith(TURN_ON_SUFFIX);
      const token = turnOn ? fromLink.slice(0, -TURN_ON_SUFFIX.length) : fromLink;
      if (await matchesToken(token)) {
        // Take the token out of the address bar (and so out of history and anything shared).
        history.replaceState(null, '', location.pathname + location.search);
        if (turnOn) {
          forget();
          alert('Analytics is back on for this browser.');
          return false;
        }
        save(token);
        alert("This browser won't be counted in analytics.");
        return true;
      }
    }
    const saved = readSaved();
    return saved !== null && (await matchesToken(saved));
  }

  // Checks running at the same time share one result, so the link is handled (and confirmed) once.
  function isOwnerDevice() {
    pending ??= checkDevice().finally(() => { pending = null; });
    return pending;
  }

  function loadScripts() {
    if (loaded) return;
    loaded = true;
    for (const src of SCRIPTS) {
      const s = document.createElement('script');
      s.src = src;
      s.defer = true;
      document.head.appendChild(s);
    }
  }

  function check() {
    isOwnerDevice()
      .catch(() => false) // no crypto.subtle, blocked storage, bad URL escape: count the visit as normal
      .then((owner) => {
        if (!owner) loadScripts();
        // Opted out in a tab where the scripts already ran: reload so nothing more is sent from it.
        else if (loaded) location.reload();
      });
  }

  check();
  // The secret link can also be pasted into a tab that already has the site open.
  addEventListener('hashchange', check);
})();
