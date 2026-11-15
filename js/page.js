/* Git, Drawn Out: page-level extras. Conflict demo, glossary tooltips, sticky section nav, printing.
   The commit graph, playground and command list live in main.js. */
(() => {
const $ = id => document.getElementById(id);
const esc = t => t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

/* ---------- resolve a merge conflict ---------- */
{
  const file = mid => `const menu = [\n  "Home",\n${mid}  "About",\n];\n`;
  const OURS = '  "Pricing",\n', THEIRS = '  "Search",\n';
  const CONFLICT = file(`<<<<<<< HEAD\n${OURS}=======\n${THEIRS}>>>>>>> search\n`);
  const MARK = /^(<{7}|={7}|>{7})/m;
  const txt = $('cfText'), out = $('cfStatus'), btns = $('cfBtns');
  let phase = 'conflict', staged = null, msg = '';

  const status = () => {
    if (phase === 'conflict'){
      let o = '<span class="d">$ git status</span>\nOn branch main\nYou have unmerged paths.\n  (fix conflicts and run "git commit")\n  (use "git merge --abort" to abort the merge)\n\nUnmerged paths:\n        <span class="r">both modified:   app.js</span>';
      if (!MARK.test(txt.value)) o += '<span class="d">\n\n(The file looks resolved. Git doesn\'t know until you git add it.)</span>';
      return o;
    }
    let o = '<span class="d">$ git status</span>\nOn branch main\nAll conflicts fixed but you are still merging.\n  (use "git commit" to conclude merge)\n\nChanges to be committed:\n        <span class="g">modified:   app.js</span>';
    if (txt.value !== staged) o += '\n\nChanges not staged for commit:\n        <span class="r">modified:   app.js</span>';
    if (MARK.test(staged)) o += '<span class="r">\n\nCareful: the staged app.js still contains conflict markers. Git doesn\'t check, so committing now would commit them as code.</span>';
    return o;
  };
  function draw(){
    const live = phase === 'conflict' || phase === 'staged';
    txt.readOnly = !live;
    for (const b of btns.querySelectorAll('button')){
      const a = b.dataset.a;
      b.disabled = a === 'restart' ? false : !live || (a === 'add' && phase === 'staged' && txt.value === staged);
    }
    out.innerHTML = (msg ? msg + '\n\n' : '') + (live ? status() : '');
    out.innerHTML = out.innerHTML.trimEnd();
  }
  btns.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    msg = '';
    switch (b.dataset.a){
      case 'ours': txt.value = file(OURS); break;
      case 'theirs': txt.value = file(THEIRS); break;
      case 'both': txt.value = file(OURS + THEIRS); break;
      case 'add': staged = txt.value; phase = 'staged'; msg = '<span class="d">$ git add app.js</span>'; break;
      case 'commit':
        if (phase === 'conflict'){
          msg = '<span class="d">$ git commit</span>\n<span class="r">error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use \'git add/rm &lt;file&gt;\'</span>';
          break;
        }
        txt.value = staged; phase = 'done';
        msg = '<span class="d">$ git commit</span>\n[main 7c1d2e9] Merge branch \'search\'\n\n<span class="d">$ git log --oneline --graph</span>\n*   7c1d2e9 (HEAD -&gt; main) Merge branch \'search\'\n|\\\n| * 4b5c6d7 (search) add Search to menu\n* | 9e8f7a6 add Pricing to menu\n|/\n* 1a2b3c4 init';
        msg += MARK.test(staged)
          ? '<span class="r">\n\nYou committed the conflict markers. The code is broken now: fix the file and make another commit (the broken one stays in history).</span>'
          : '<span class="g">\n\nMerged. The merge commit has two parents, main\'s and search\'s.</span>';
        break;
      case 'abort':
        txt.value = file(OURS); phase = 'aborted';
        msg = '<span class="d">$ git merge --abort</span>\n<span class="g">Back to exactly how main was before git merge. Nothing from search came in, and you can try again any time.</span>';
        break;
      case 'restart': txt.value = CONFLICT; phase = 'conflict'; staged = null; break;
    }
    draw();
  });
  txt.addEventListener('input', () => { msg = ''; draw(); });
  txt.value = CONFLICT; draw();
}

/* ---------- glossary tooltips ---------- */
{
  const tip = document.createElement('div');
  tip.className = 'gl-tip'; tip.id = 'glTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let on = null;
  const hide = () => { if (on) on.removeAttribute('aria-describedby'); on = null; tip.hidden = true; };
  const showFor = a => {
    const dt = $('g-' + a.dataset.g), dd = dt && dt.nextElementSibling;
    if (!dd) return;
    on = a; a.setAttribute('aria-describedby', 'glTip');
    tip.innerHTML = `<b>${esc(dt.textContent)}</b>${dd.innerHTML}`;
    tip.hidden = false;
    const r = a.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    tip.style.top = (r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
  };
  document.addEventListener('mouseover', e => { const a = e.target.closest && e.target.closest('a.gl'); if (a && a !== on) showFor(a); else if (!a && on) hide(); });
  document.addEventListener('focusin', e => { const a = e.target.closest && e.target.closest('a.gl'); a ? showFor(a) : hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  addEventListener('scroll', hide, {passive:true});
}

/* ---------- sticky nav: appears once the hero is gone, highlights the current section ---------- */
{
  const nav = $('topnav'), hero = document.querySelector('.hero');
  const links = [...nav.querySelectorAll('a[href^="#"]:not(.tn-home)')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href')));
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => nav.classList.toggle('show', !e.isIntersecting)).observe(hero);
  const box = nav.firstElementChild;
  let raf = 0, last = -2;
  const update = () => {
    raf = 0;
    let i = -1;
    secs.forEach((s, j) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.35) i = j; });
    if (i === last) return;
    last = i;
    links.forEach((a, j) => a.toggleAttribute('aria-current', j === i));
    const l = links[i];   // keep the current link visible when the nav scrolls sideways on phones
    if (l && (l.offsetLeft < box.scrollLeft || l.offsetLeft + l.offsetWidth > box.scrollLeft + box.clientWidth)) box.scrollLeft = l.offsetLeft - 16;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, {passive:true});
  update();
}

/* ---------- printing: open the recovery answers; the cheat-sheet button prints only the reference parts ---------- */
{
  let opened = [];
  addEventListener('beforeprint', () => { opened = [...document.querySelectorAll('details:not([open])')]; opened.forEach(d => { d.open = true; }); });
  addEventListener('afterprint', () => { opened.forEach(d => { d.open = false; }); opened = []; document.body.classList.remove('print-cheat'); });
  $('printCheat').addEventListener('click', () => { document.body.classList.add('print-cheat'); print(); });
}
})();
