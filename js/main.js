(() => {
/* ---------- model helpers ---------- */
const S = () => ({ c:{}, refs:{}, head:{b:'main'}, gh:null, n:0 });
const H = s => ('b' in s.head) ? s.refs[s.head.b] : s.head.c;
const occ = (s,l,col) => Object.values(s.c).some(c => c.lane===l && c.col===col);
function mk(s,id,msg,o={}){
  const p = o.p || (H(s) ? [H(s)] : []);
  const col = p.length ? Math.max(...p.map(x => s.c[x].col)) + 1 : 0;
  let lane;
  if (o.lane !== undefined) lane = o.lane;
  else { const base = p.length ? s.c[p[0]].lane : 0; lane = base;
    for (const d of [0,1,-1,2]) if (!occ(s,base+d,col)) { lane = base+d; break; } }
  s.c[id] = { id, msg, lane, col, p, remote: !!o.remote };
  if (!o.noMove){ if ('b' in s.head) s.refs[s.head.b] = id; else s.head.c = id; }
  return id;
}
const br = (s,n,at) => { s.refs[n] = at ?? H(s); };
const sw = (s,n) => { s.head = {b:n}; };
const det = (s,id) => { s.head = {c:id}; };
const mv = (s,n,id) => { s.refs[n] = id; };
const del = (s,n) => { delete s.refs[n]; };
function reach(s){
  const seen = new Set(), st = [...Object.values(s.refs)]; const h = H(s); if (h) st.push(h);
  while (st.length){ const id = st.pop(); if (!id || seen.has(id) || !s.c[id]) continue; seen.add(id); st.push(...s.c[id].p); }
  return seen;
}
function pillRows(s){
  const by = {}; const add = (id,row) => { if (!id || !s.c[id]) return; (by[id] = by[id] || []).push(row); };
  if (!('b' in s.head)) add(s.head.c, [{k:'HEAD', t:'HEAD (detached)', cls:'detached'}]);
  const kind = n => n.startsWith('origin/') ? 'remote' : n === 'stash' ? 'stash' : 'branch';
  const rank = n => n === s.head.b ? 0 : ({branch:1, remote:2, stash:3})[kind(n)];
  for (const n of Object.keys(s.refs).sort((a,b) => rank(a)-rank(b) || a.localeCompare(b))){
    const row = [];
    if (s.head.b === n) row.push({k:'HEAD', t:'HEAD →', cls:'head'});
    row.push({k:'r:'+n, t: n === 'stash' ? 'stash@{0}' : n, cls: kind(n)});
    add(s.refs[n], row);
  }
  if (s.gh) add(s.gh, [{k:'GH', t:'GitHub: main', cls:'gh'}]);
  return by;
}

/* ---------- scenarios ---------- */
const SCN = [
 { id:'basics', name:'Commits & branches', steps:[
  { cmd:'git init', note:`<p>An empty repository. HEAD already points at <code>main</code>, but main points at nothing yet (an "unborn" branch).</p><p>The new <code>.git</code> folder is the repository. Your files are just a working copy.</p>` },
  { cmd:'git commit -m "first"', op:s=>mk(s,'A','first'), note:`<p>Git saves a snapshot of every tracked file as commit <b>A</b>. A has no parent; it's the root.</p><p>The <code>main</code> branch now exists and points at A. HEAD points at main.</p>` },
  { cmd:'git commit -m "header"', op:s=>mk(s,'B','header'), note:`<p><b>B</b> stores the ID of its parent, A. The arrow points <i>backwards</i>: a child knows its parent, a parent never knows its children.</p><p>Only the branch HEAD is attached to moves forward.</p>` },
  { cmd:'git commit -m "footer"', op:s=>mk(s,'C','footer'), note:`<p>Same again. History is a chain you can only walk backwards: C → B → A.</p>` },
  { cmd:'git branch feature', op:s=>br(s,'feature'), note:`<p>A new sticky note on the same commit. Nothing is copied. On disk it's a tiny file, <code>.git/refs/heads/feature</code>, containing C's hash.</p><p>HEAD didn't move, so you're still on main.</p>` },
  { cmd:'git switch feature', op:s=>sw(s,'feature'), note:`<p>Only HEAD moved. Your files don't change because both branches point at the same commit.</p><p>Older equivalent: <code>git checkout feature</code>.</p>` },
  { cmd:'git commit -m "search box"', op:s=>mk(s,'D','search box',{lane:-1}), note:`<p>HEAD is attached to <code>feature</code>, so feature moves to <b>D</b>. main stays on C.</p>` },
  { cmd:'git commit -m "search API"', op:s=>mk(s,'E','search API'), note:`<p>feature is now two commits ahead of main.</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main'), note:`<p>HEAD moves back to main, and Git rewrites your files to match C's snapshot. D and E's changes disappear from disk.</p><p>They aren't lost. They're stored in commits D and E, which feature still points to.</p>` },
  { cmd:'git commit -m "fix typo"', op:s=>mk(s,'F','fix typo',{lane:0}), note:`<p>Now history has forked. Both branches share A, B and C, then go separate ways. This is what <b>diverged</b> means, and it's where merge and rebase come in.</p>` },
 ]},
 { id:'merge', name:'Merge', setup:s=>{mk(s,'A','init');mk(s,'B','readme');}, steps:[
  { cmd:'git log --oneline --graph', note:`<p>Starting point: main has two commits and HEAD is on main.</p>` },
  { cmd:'git switch -c login', op:s=>{br(s,'login');sw(s,'login');}, note:`<p><code>-c</code> creates the branch and switches to it in one step.</p>` },
  { cmd:'git commit -m "login form"', op:s=>mk(s,'C','login form'), note:`<p>login moves to C. main is still on B.</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main'), note:`<p>Back on main to bring the login work in.</p>` },
  { cmd:'git merge login', op:s=>mv(s,'main','C'), out:['Updating b2c..c3d','Fast-forward'], note:`<p><b>Fast-forward.</b> main is an ancestor of login, so there's nothing to combine. Git slides main forward to C. No new commit is created.</p>` },
  { cmd:'git switch -c search', op:s=>{br(s,'search');sw(s,'search');} },
  { cmd:'git commit -m "search box"', op:s=>mk(s,'D','search box',{lane:-1}), note:`<p>Work on search…</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main') },
  { cmd:'git commit -m "fix typo"', op:s=>mk(s,'E','fix typo',{lane:0}), note:`<p>…while main also gets a new commit. The branches have diverged, so a fast-forward is no longer possible.</p>` },
  { cmd:'git merge search', op:s=>mk(s,'M','merge search',{p:['E','D'],lane:0}), out:["Merge made by the 'ort' strategy."], note:`<p>Git finds the <b>merge base</b> (C, the last commit both share), combines the changes C→E and C→D, and records the result as <b>M</b>, a commit with <i>two parents</i>.</p><p>If both sides changed the same lines, Git stops and asks you to resolve a conflict first.</p>` },
  { cmd:'git branch -d search', op:s=>del(s,'search'), note:`<p>Deleting a branch deletes only the sticky note. D stays in history because M points to it.</p>` },
 ]},
 { id:'rebase', name:'Rebase', setup:s=>{mk(s,'A','init');mk(s,'B','readme');br(s,'feature');sw(s,'feature');mk(s,'C','search box',{lane:-1});mk(s,'D','search API');sw(s,'main');mk(s,'E','fix typo',{lane:0});sw(s,'feature');}, steps:[
  { cmd:'git log --oneline --graph --all', note:`<p>feature and main have diverged at B. You're on feature. Instead of a merge commit, you want feature to look as if it started from E.</p>` },
  { cmd:'git rebase main', op:s=>{mk(s,'C′','search box',{p:['E'],lane:0});mk(s,'D′','search API',{lane:0});}, out:['Successfully rebased and updated refs/heads/feature.'], note:`<p>Git replays the changes from C and D one at a time on top of E.</p><p>A commit's parent is part of its identity, so the replayed commits are <b>new commits</b>, C′ and D′, with new hashes. The originals are now unreachable (faded). The reflog still has them for a while.</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main') },
  { cmd:'git merge feature', op:s=>mv(s,'main','D′'), out:['Fast-forward'], note:`<p>A fast-forward, so history is one straight line with no merge commit.</p><p><b>Golden rule:</b> only rebase commits nobody else has. If you rebase commits you already pushed, teammates still have the old C and D.</p>` },
 ]},
 { id:'reset', name:'Reset & reflog', setup:s=>{mk(s,'A','init');mk(s,'B','header');mk(s,'C','footer');mk(s,'D','typo');}, steps:[
  { cmd:'git log --oneline', areas:['clean','clean','D'], note:`<p>Four commits and nothing uncommitted. Watch the three boxes under the graph too. Reset's flag decides which of them get touched.</p>` },
  { cmd:'git reset --soft HEAD~1', op:s=>mv(s,'main','C'), areas:["has D's changes","D's changes, staged",'C'], note:`<p><code>HEAD~1</code> means "one parent back". <code>--soft</code> moves only the branch.</p><p>D's changes stay staged, as if you had just run <code>git add</code>. Use it for "undo my last commit but keep the work ready to recommit".</p>` },
  { cmd:'git reset HEAD~1', op:s=>mv(s,'main','B'), areas:['has C + D changes','matches B','B'], note:`<p>No flag means <code>--mixed</code>. It moves the branch and resets the staging area, but leaves your files alone. The changes from C and D are still in your files, just unstaged.</p>` },
  { cmd:'git reset --hard HEAD~1', op:s=>mv(s,'main','A'), areas:['matches A','matches A','A'], note:`<p><code>--hard</code> moves the branch and overwrites staging <i>and your files</i> to match A. Uncommitted edits would be gone for good.</p><p>B, C and D look lost. They aren't.</p>` },
  { cmd:'git reflog', areas:['matches A','matches A','A'], out:['a1f0e2c HEAD@{0}: reset: moving to HEAD~1','b7d91aa HEAD@{1}: reset: moving to HEAD~1','c3e4f5d HEAD@{2}: reset: moving to HEAD~1','d9a8b7c HEAD@{3}: commit: typo'], note:`<p>The reflog is a local diary of every commit HEAD has pointed at. <code>HEAD@{3}</code> is commit D, from before the resets.</p>` },
  { cmd:'git reset --hard d9a8b7c', op:s=>mv(s,'main','D'), areas:['clean','clean','D'], note:`<p>Point main back at D and everything is reachable again. Anything you <i>committed</i> can almost always be recovered this way.</p>` },
 ]},
 { id:'detached', name:'Detached HEAD', setup:s=>{mk(s,'A','init');mk(s,'B','header');mk(s,'C','footer');}, steps:[
  { cmd:'git log --oneline', note:`<p>Three commits on main.</p>` },
  { cmd:'git switch --detach B', op:s=>det(s,'B'), out:["HEAD is now at b2c header"], note:`<p>HEAD now points straight at a commit instead of a branch. That's <b>detached HEAD</b>. Your files match B, which is handy for looking at old code.</p><p>Older form: <code>git checkout B</code>.</p>` },
  { cmd:'git commit -m "experiment"', op:s=>mk(s,'X','experiment'), note:`<p>Committing works, but there's no branch to move. Only HEAD knows where X is.</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main'), out:['Warning: you are leaving 1 commit behind,','not connected to any of your branches:','  9f8e7d experiment'], note:`<p>HEAD goes back to main. Nothing points at X now, so it's unreachable. Git warns you and prints X's hash.</p>` },
  { cmd:'git branch rescue 9f8e7d', op:s=>br(s,'rescue','X'), note:`<p>Give X a branch and it's safe. This is the standard fix for "I lost commits in detached HEAD": find the hash in <code>git reflog</code>, then make a branch there.</p>` },
 ]},
 { id:'pick', name:'Cherry-pick & revert', setup:s=>{mk(s,'A','init');mk(s,'B','readme');br(s,'experiment');sw(s,'experiment');mk(s,'C','try cache',{lane:-1});mk(s,'D','fix login');sw(s,'main');mk(s,'E','release',{lane:0});}, steps:[
  { cmd:'git log --oneline --graph --all', note:`<p>You want only the login fix (D) on main, not the cache experiment (C).</p>` },
  { cmd:'git cherry-pick D', op:s=>mk(s,'D′','fix login',{lane:0}), note:`<p>Git copies the changes D introduced into a new commit <b>D′</b> on top of main. D stays where it was. Same change, different parent, so a different hash.</p>` },
  { cmd:'git revert E', op:s=>mk(s,'R','revert E'), note:`<p>Revert doesn't delete E. It adds a new commit that does the opposite of E.</p><p>History only grows, so this is the safe way to undo something that's already pushed.</p>` },
 ]},
 { id:'stash', name:'Stash', setup:s=>{mk(s,'A','init');mk(s,'B','header');mk(s,'C','footer');}, steps:[
  { cmd:'# editing app.js…', areas:['app.js edited','empty','C'], note:`<p>You're halfway through a change when an urgent bug report comes in. You don't want to commit half-finished work.</p>` },
  { cmd:'git stash', op:s=>{mk(s,'W','WIP',{p:['C'],lane:1,noMove:true});mv(s,'stash','W');}, areas:['clean','empty','C'], out:['Saved working directory and index state WIP on main'], note:`<p>Stash saves your uncommitted changes as a special commit hanging off C, labelled <code>stash@{0}</code>, then cleans your working folder. Your branch doesn't move.</p>` },
  { cmd:'git commit -am "hotfix"', op:s=>mk(s,'D','hotfix',{lane:0}), areas:['clean','empty','D'], note:`<p>Fix the bug and commit. main moves to D as usual.</p>` },
  { cmd:'git stash pop', op:s=>del(s,'stash'), areas:['app.js edits are back','empty','D'], note:`<p>Git re-applies the stashed changes onto your files and drops the stash entry, so the stash commit becomes unreachable.</p><p><code>git stash list</code> shows saved entries. <code>git stash apply</code> re-applies but keeps the entry.</p>` },
 ]},
 { id:'remote', name:'Fetch, pull, push', setup:s=>{mk(s,'A','init');mk(s,'B','readme');mv(s,'origin/main','B');s.gh='B';}, steps:[
  { cmd:'git clone <url>', note:`<p>Cloning copies every commit. You get <code>main</code> plus <code>origin/main</code>, your repo's <i>memory</i> of where the server's main was.</p><p>The dashed tag shows where GitHub's main really is right now. Normally you can't see that.</p>` },
  { cmd:'# a teammate pushes C', op:s=>{mk(s,'C','their fix',{p:['B'],lane:-1,remote:true,noMove:true});s.gh='C';}, note:`<p>A teammate pushes <b>C</b>. It exists only on GitHub. Your repo has no idea, and origin/main still says B.</p>` },
  { cmd:'git commit -m "my feature"', op:s=>mk(s,'D','my feature',{lane:0}), note:`<p>Meanwhile you commit <b>D</b> locally.</p>` },
  { cmd:'git push', out:['! [rejected]  main -> main (fetch first)'], err:true, note:`<p><b>Rejected.</b> GitHub's main is at C, and your main doesn't contain C. Accepting your push would throw C away, so Git refuses. You need to pick up C first.</p>` },
  { cmd:'git fetch', op:s=>{s.c.C.remote=false;mv(s,'origin/main','C');}, out:['   b2c..c3d  main -> origin/main'], note:`<p><code>fetch</code> downloads new commits and moves <code>origin/main</code>. It never touches your branches or files, so it's always safe to run.</p>` },
  { cmd:'git rebase origin/main', op:s=>mk(s,'D′','my feature',{p:['C'],lane:0}), note:`<p>Replay D on top of C. <code>git pull --rebase</code> does this step and the previous one together. Plain <code>git pull</code> does fetch + merge, which creates a merge commit instead.</p>` },
  { cmd:'git push', op:s=>{s.gh='D′';mv(s,'origin/main','D′');}, out:['   c3d..d4e  main -> main'], note:`<p>GitHub's main can now fast-forward from C to D′. origin/main updates too, because you just talked to the server.</p>` },
 ]},
];
function buildStates(sc){
  let s = S(); sc.setup && sc.setup(s);
  return sc.steps.map(st => { s = JSON.parse(JSON.stringify(s)); st.op && st.op(s); return s; });
}

/* ---------- graph renderer ---------- */
const NS = 'http://www.w3.org/2000/svg';
const R = 17, COL = 110, ROW = 110, PADX = 64, RH = 24;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function E(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const pw = t => Math.round(t.length * 7.1 + 14);
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
let mid = 0;

class Graph {
  constructor(svg){
    this.svg = svg; this.mid = 'arr' + (mid++);
    const defs = E('defs', {}, svg);
    const m = E('marker', {id:this.mid, viewBox:'0 0 8 8', refX:'7', refY:'4', markerWidth:'7', markerHeight:'7', orient:'auto'}, defs);
    E('path', {d:'M0 0 L8 4 L0 8 z', class:'arrowhead'}, m);
    this.gE = E('g', {}, svg); this.gN = E('g', {}, svg); this.gL = E('g', {}, svg);
    this.unborn = E('text', {class:'unborn', x:PADX - R, y:0}, svg);
    this.ents = new Map(); this.raf = 0;
  }
  layout(states){
    let minL = 0, maxL = 0, maxC = 0, top = 1, bot = 0;
    for (const s of states) for (const c of Object.values(s.c)){ minL = Math.min(minL, c.lane); maxL = Math.max(maxL, c.lane); maxC = Math.max(maxC, c.col); }
    for (const s of states){ const rows = pillRows(s);
      for (const id in rows){ const c = s.c[id]; if (c.lane === minL && c.lane <= 0) top = Math.max(top, rows[id].length); if (c.lane === maxL && c.lane > 0) bot = Math.max(bot, rows[id].length); } }
    this.minL = minL;
    this.padT = R + 18 + top*RH;
    const padB = maxL > 0 ? R + 18 + Math.max(bot,0)*RH + 6 : R + 36;
    const W = PADX*2 + maxC*COL + 50, Ht = this.padT + (maxL-minL)*ROW + padB;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${Ht}`);
    this.svg.style.width = W + 'px'; this.svg.style.height = Ht + 'px';
    for (const e of this.ents.values()) e.el.remove();
    this.ents.clear();
    this.unborn.setAttribute('y', this.padT);
  }
  P(c){ return { x: PADX + c.col*COL, y: this.padT + (c.lane - this.minL)*ROW }; }
  render(s, instant){
    const rs = reach(s), seen = new Set();
    // nodes
    for (const c of Object.values(s.c)){
      const k = 'n:'+c.id; seen.add(k);
      const p = this.P(c), o = c.remote ? .55 : rs.has(c.id) ? 1 : .32;
      let e = this.ents.get(k);
      if (!e){
        const g = E('g', {class:'g-node'}, this.gN);
        E('circle', {r:R}, g); const t = E('text', {class:'id'}, g); t.textContent = c.id;
        const m = E('text', {class:'msg', y: c.lane > 0 ? -(R+10) : R+18}, g); m.textContent = c.msg;
        const ti = E('title', {}, g); ti.textContent = `commit ${c.id}: ${c.msg}`;
        const par = c.p.length && this.ents.get('n:'+c.p[0]);
        const st = par ? {...par.cur, o:0} : {...p, o:0};
        e = {type:'n', el:g, cur:st}; this.ents.set(k, e);
      }
      e.el.classList.toggle('unreach', !c.remote && !rs.has(c.id));
      e.el.classList.toggle('remote', c.remote);
      e.to = {...p, o}; e.dead = false;
    }
    // edges
    for (const c of Object.values(s.c)) for (const pid of c.p){
      const k = 'e:'+c.id+'>'+pid; seen.add(k);
      let e = this.ents.get(k);
      if (!e){ const path = E('path', {class:'g-edge', 'marker-end':`url(#${this.mid})`}, this.gE); e = {type:'e', el:path, a:'n:'+c.id, b:'n:'+pid, cur:{o:0}}; this.ents.set(k, e); }
      e.el.classList.toggle('remote', c.remote);
      e.to = {o: Math.min(this.ents.get('n:'+c.id).to.o, this.ents.get('n:'+pid).to.o)}; e.dead = false;
    }
    // pills
    const rows = pillRows(s);
    for (const id in rows){
      const c = s.c[id], p = this.P(c), below = c.lane > 0;
      rows[id].forEach((row, i) => {
        const tw = row.reduce((a,x) => a + pw(x.t), 0) + (row.length-1)*4;
        let x = p.x - tw/2; const y = below ? p.y + R + 16 + i*RH : p.y - R - 16 - i*RH;
        for (const it of row){
          const k = 'p:'+it.k; seen.add(k); const w = pw(it.t);
          let e = this.ents.get(k);
          if (!e){ const g = E('g', {class:'pill'}, this.gL); E('rect', {x:0, y:-10, height:20, rx:5}, g); E('text', {y:0}, g);
            e = {type:'p', el:g, cur:{x, y: y + (below ? 8 : -8), o:0}}; this.ents.set(k, e); }
          e.el.setAttribute('class', 'pill ' + it.cls);
          e.el.querySelector('rect').setAttribute('width', w);
          const t = e.el.querySelector('text'); t.setAttribute('x', w/2); t.textContent = it.t;
          e.to = {x, y, o:1}; e.dead = false; x += w + 4;
        }
      });
    }
    // removals
    for (const [k,e] of this.ents) if (!seen.has(k)){ e.to = {...e.cur, o:0}; e.dead = true; }
    // unborn
    const unb = ('b' in s.head) && !s.refs[s.head.b];
    this.unborn.textContent = unb ? `HEAD → ${s.head.b}  (no commits yet)` : '';
    this.animate(instant || reduce);
  }
  apply(){
    for (const e of this.ents.values()){
      if (e.type === 'e'){
        const a = this.ents.get(e.a), b = this.ents.get(e.b); if (!a || !b) continue;
        const x1 = a.cur.x - R, y1 = a.cur.y, x2 = b.cur.x + R + 2, y2 = b.cur.y;
        const mx = (x1+x2)/2;
        e.el.setAttribute('d', Math.abs(y1-y2) < .5 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
        e.el.style.opacity = e.cur.o;
      } else {
        e.el.setAttribute('transform', `translate(${e.cur.x.toFixed(1)} ${e.cur.y.toFixed(1)})`);
        e.el.style.opacity = e.cur.o;
      }
    }
  }
  animate(instant){
    cancelAnimationFrame(this.raf);
    const from = new Map(); for (const [k,e] of this.ents) from.set(k, {...e.cur});
    const finish = () => { for (const [k,e] of this.ents){ e.cur = {...e.to}; if (e.dead){ e.el.remove(); this.ents.delete(k); } } this.apply(); };
    if (instant){ finish(); return; }
    const t0 = performance.now(), D = 620;
    const tick = now => {
      const t = Math.min(1, (now - t0)/D), k = ease(t);
      for (const [key,e] of this.ents){ const f = from.get(key);
        for (const p in e.to) e.cur[p] = f[p] + (e.to[p] - f[p]) * k; }
      this.apply();
      if (t < 1) this.raf = requestAnimationFrame(tick); else finish();
    };
    this.raf = requestAnimationFrame(tick);
  }
}

/* ---------- hero loop ---------- */
const HERO = { setup:s=>{mk(s,'A','init');mk(s,'B','header');mk(s,'C','footer');}, steps:[
  {cmd:'git log --oneline --graph'},
  {cmd:'git switch -c feature', op:s=>{br(s,'feature');sw(s,'feature');}},
  {cmd:'git commit -m "search"', op:s=>mk(s,'D','search',{lane:-1})},
  {cmd:'git commit -m "results"', op:s=>mk(s,'E','results')},
  {cmd:'git switch main', op:s=>sw(s,'main')},
  {cmd:'git commit -m "typo"', op:s=>mk(s,'F','typo',{lane:0})},
  {cmd:'git merge feature', op:s=>mk(s,'M','merge',{p:['F','E'],lane:0})},
]};
const heroG = new Graph(document.getElementById('heroSvg'));
const heroStates = buildStates(HERO); heroG.layout(heroStates);
let hi = 0; const heroCmd = document.getElementById('heroCmd');
const heroShow = inst => { heroG.render(heroStates[hi], inst); heroCmd.innerHTML = '<b>$</b> ' + esc(HERO.steps[hi].cmd); };
function esc(t){ return t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]); }
heroShow(true);
if (!reduce) setInterval(() => { if (document.hidden) return; hi = (hi + 1) % heroStates.length; heroShow(false); }, 1900);

/* ---------- playground ---------- */
const g = new Graph(document.getElementById('graphSvg'));
const tabs = document.getElementById('tabs'), term = document.getElementById('term'), note = document.getElementById('note');
const prevB = document.getElementById('prev'), nextB = document.getElementById('next'), autoB = document.getElementById('auto'), count = document.getElementById('count');
const areasEl = document.getElementById('areas'), aEls = [0,1,2].map(i => document.getElementById('a'+i));
let cur = null, states = [], idx = 0, timer = null;
SCN.forEach((sc, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role','tab'); b.id = 'tab-'+sc.id; b.textContent = sc.name;
  b.addEventListener('click', () => load(i)); tabs.appendChild(b);
});
function load(i){
  stopAuto(); cur = SCN[i]; states = buildStates(cur); g.layout(states); idx = 0;
  [...tabs.children].forEach((b,j) => b.setAttribute('aria-selected', j === i));
  show(true);
}
function show(instant){
  const st = cur.steps[idx];
  g.render(states[idx], instant);
  term.innerHTML = cur.steps.slice(0, idx+1).map((x,j) => {
    const line = `<div class="ln${j===idx?' cur':''}"><span class="p">$</span> ${esc(x.cmd)}</div>`;
    const out = x.out ? `<div class="out${x.err?' err':''}">${x.out.map(esc).join('\n')}</div>` : '';
    return line + out;
  }).join('');
  term.scrollTop = term.scrollHeight;
  note.innerHTML = st.note || '<p style="color:var(--muted)">Watch which label moves.</p>';
  if (st.areas){
    areasEl.hidden = false;
    st.areas.forEach((t,j) => { const changed = aEls[j].textContent !== t; aEls[j].textContent = t;
      if (changed && !instant){ const p = aEls[j].parentElement; p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); } });
  } else areasEl.hidden = true;
  prevB.disabled = idx === 0; nextB.disabled = idx === cur.steps.length - 1;
  count.textContent = `${idx+1} / ${cur.steps.length}`;
}
const go = d => { const n = idx + d; if (n < 0 || n >= cur.steps.length) return false; idx = n; show(false); return true; };
prevB.addEventListener('click', () => { stopAuto(); go(-1); });
nextB.addEventListener('click', () => { stopAuto(); go(1); });
function stopAuto(){ clearInterval(timer); timer = null; autoB.textContent = 'Play'; }
autoB.addEventListener('click', () => {
  if (timer) return stopAuto();
  if (idx === cur.steps.length - 1){ idx = 0; show(false); }
  autoB.textContent = 'Pause';
  timer = setInterval(() => { if (!go(1)) stopAuto(); }, 2600);
});
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const r = document.getElementById('play').getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  if (e.key === 'ArrowRight'){ stopAuto(); go(1); } else if (e.key === 'ArrowLeft'){ stopAuto(); go(-1); }
});
load(0);

/* ---------- three areas ---------- */
const A = { wd:1, idx:1, repo:1, commits:['c1'] };
const fWd = document.getElementById('fWd'), fIdx = document.getElementById('fIdx'), fRepo = document.getElementById('fRepo');
const [bEdit,bAdd,bCommit,bUnstage,bRestore,bReset] = ['bEdit','bAdd','bCommit','bUnstage','bRestore','bReset'].map(i => document.getElementById(i));
function arrive(el){ if (reduce) return; el.classList.remove('arrive'); void el.offsetWidth; el.classList.add('arrive'); }
function drawAreas(){
  fWd.querySelector('.ver').textContent = 'v'+A.wd; fIdx.querySelector('.ver').textContent = 'v'+A.idx; fRepo.querySelector('.ver').textContent = 'v'+A.repo;
  fWd.classList.toggle('diff', A.wd !== A.idx); fIdx.classList.toggle('diff', A.idx !== A.repo);
  document.getElementById('hist').textContent = 'commits: ' + [...A.commits].reverse().join(' ← ') + '  (HEAD = ' + A.commits[A.commits.length-1] + ')';
  bAdd.disabled = A.wd === A.idx; bCommit.disabled = A.idx === A.repo; bUnstage.disabled = A.idx === A.repo; bRestore.disabled = A.wd === A.idx;
  let o = '<span class="d">$ git status</span>\nOn branch main\n';
  if (A.idx !== A.repo) o += 'Changes to be committed:\n        <span class="g">modified:   app.js</span>\n';
  if (A.wd !== A.idx) o += 'Changes not staged for commit:\n        <span class="r">modified:   app.js</span>\n';
  if (A.wd === A.idx && A.idx === A.repo) o += 'nothing to commit, working tree clean\n';
  if (A.idx !== A.repo && A.wd !== A.idx) o += '<span class="d">\n(app.js is in both lists: you staged v' + A.idx + ', then kept editing to v' + A.wd + '.)</span>';
  document.getElementById('statusOut').innerHTML = o.trimEnd();
}
bEdit.onclick = () => { A.wd = Math.max(A.wd, A.idx, A.repo) + 1; arrive(fWd); drawAreas(); };
bAdd.onclick = () => { A.idx = A.wd; arrive(fIdx); drawAreas(); };
bCommit.onclick = () => { A.repo = A.idx; A.commits.push('c' + (A.commits.length+1)); arrive(fRepo); drawAreas(); };
bUnstage.onclick = () => { A.idx = A.repo; arrive(fIdx); drawAreas(); };
bRestore.onclick = () => { A.wd = A.idx; arrive(fWd); drawAreas(); };
bReset.onclick = () => { Object.assign(A, {wd:1, idx:1, repo:1, commits:['c1']}); drawAreas(); };
drawAreas();

/* ---------- hash demo ---------- */
const hIn = document.getElementById('hashIn'), hNl = document.getElementById('hashNl'), hOut = document.getElementById('hashOut');
async function rehash(){
  const text = hIn.value + (hNl.checked ? '\n' : '');
  try {
    const enc = new TextEncoder(), body = enc.encode(text), head = enc.encode(`blob ${body.length}\0`);
    const all = new Uint8Array(head.length + body.length); all.set(head); all.set(body, head.length);
    const d = await crypto.subtle.digest('SHA-1', all);
    const hex = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2,'0')).join('');
    hOut.innerHTML = `blob ${body.length}\\0 + contents\n→ <span class="h">${hex}</span>`.replace('\n','<br>');
  } catch { hOut.textContent = 'This browser blocked the hashing API, so the hash cannot be shown here.'; }
}
hIn.addEventListener('input', rehash); hNl.addEventListener('change', rehash); rehash();

/* ---------- commands ---------- */
const EFF = { read:'Only looks', stage:'Changes staging', commit:'Adds commits', pointer:'Moves a pointer', rewrite:'Replaces commits', files:'Changes your files', remote:'Talks to a server' };
const CMDS = [
 ['Look around', [
  ['git status', "What's changed, what's staged, which branch you're on.", ['read']],
  ['git log --oneline --graph --all', 'Draws the commit graph for every branch. Worth an alias: git config --global alias.lg "log --oneline --graph --all".', ['read']],
  ['git diff', "Changes in your files that aren't staged yet.", ['read']],
  ['git diff --staged', 'Exactly what the next commit will contain.', ['read']],
  ['git show <commit>', "One commit's message and changes.", ['read']],
  ['git blame <file>', 'Who last changed each line, and in which commit.', ['read']],
  ['git branch -vv', 'Your branches, their latest commit, and which remote branch each one tracks.', ['read']],
  ['git reflog', 'Everywhere HEAD has been. Your safety net for undoing mistakes.', ['read']],
 ]],
 ['Save work', [
  ['git add -p', 'Stage changes piece by piece, so each commit holds one idea.', ['stage']],
  ['git commit -m "message"', 'Snapshot the staging area as a new commit and move your branch to it.', ['commit','pointer']],
  ['git commit --amend', 'Replace the last commit, e.g. to fix its message or add a forgotten file.', ['rewrite']],
  ['git stash  /  git stash pop', 'Shelve uncommitted changes, then bring them back later.', ['files']],
  ['git stash list', "See what's on the shelf.", ['read']],
 ]],
 ['Branch & combine', [
  ['git switch -c <name>', 'Create a branch at the current commit and move HEAD to it.', ['pointer']],
  ['git switch <name>', 'Move HEAD to another branch. Your files update to match.', ['pointer','files']],
  ['git branch -d <name>', 'Delete a branch label. Refuses if its commits are unmerged; -D forces it.', ['pointer']],
  ['git merge <branch>', 'Bring another branch in: a fast-forward or a two-parent merge commit.', ['commit','pointer']],
  ['git rebase <branch>', 'Replay your commits on top of another branch for a straight history.', ['rewrite']],
  ['git rebase -i HEAD~3', 'Squash, reorder or reword your last 3 commits before sharing them.', ['rewrite']],
  ['git cherry-pick <commit>', 'Copy one commit onto your current branch.', ['commit']],
  ['git tag -a v1.0 -m "release"', "A permanent label for a release. Tags don't move.", ['pointer']],
 ]],
 ['Undo & fix', [
  ['git restore <file>', 'Throw away uncommitted edits in a file. This cannot be undone.', ['files']],
  ['git restore --staged <file>', 'Unstage a file but keep your edits.', ['stage']],
  ['git reset --soft HEAD~1', 'Undo the last commit and keep its changes staged.', ['pointer']],
  ['git reset HEAD~1', 'Undo the last commit and keep its changes unstaged.', ['pointer','stage']],
  ['git reset --hard <commit>', 'Move the branch and overwrite your files. Uncommitted work is lost.', ['pointer','files']],
  ['git revert <commit>', 'Add a new commit that undoes an old one. Safe on shared branches.', ['commit']],
  ['git clean -n  then  git clean -fd', 'Preview, then delete untracked files and folders.', ['files']],
 ]],
 ['Work with remotes', [
  ['git clone <url>', 'Copy a whole repository, every commit included.', ['remote']],
  ['git fetch', 'Download new commits and update origin/*. Never touches your work.', ['remote']],
  ['git pull --rebase', 'Fetch, then replay your local commits on top of what arrived.', ['remote','rewrite']],
  ['git push -u origin <branch>', 'First push of a new branch. -u remembers the pairing for later pushes and pulls.', ['remote']],
  ['git push --force-with-lease', 'Overwrite the remote branch after a rebase, but only if nobody pushed in the meantime.', ['remote','rewrite']],
  ['git remote -v', 'Which servers this repository knows about.', ['read']],
 ]],
 ['Good to know they exist', [
  ['git bisect start / good / bad', 'Binary-search history to find the commit that broke something.', ['read']],
  ['git log -S "someText"', 'Find the commits that added or removed a piece of text.', ['read']],
  ['git log --author="name" --since="2 weeks"', 'Filter history by person or date.', ['read']],
  ['git worktree add ../hotfix main', 'A second working folder on another branch, sharing the same repository.', ['files']],
  ['git shortlog -sn', 'Commit counts per author.', ['read']],
 ]],
];
const filt = new Set();
const fEl = document.getElementById('filters'), gEl = document.getElementById('cmdGroups');
for (const k in EFF){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed','false');
  b.innerHTML = `<i class="sw e-${k}"></i>${EFF[k]}`;
  b.onclick = () => { filt.has(k) ? filt.delete(k) : filt.add(k); b.setAttribute('aria-pressed', filt.has(k)); drawCmds(); };
  fEl.appendChild(b);
}
function drawCmds(){
  gEl.innerHTML = '';
  for (const [name, rows] of CMDS){
    const vis = rows.filter(r => !filt.size || r[2].some(e => filt.has(e)));
    if (!vis.length) continue;
    const d = document.createElement('div'); d.className = 'cmd-group';
    d.innerHTML = `<h3>${name}</h3>` + vis.map(([c,w,e]) => `<div class="cmd-row"><code>${esc(c)}</code><div class="what">${esc(w)}</div><div class="effs">${e.map(x => `<span class="eff e-${x}">${EFF[x]}</span>`).join('')}</div></div>`).join('');
    gEl.appendChild(d);
  }
}
drawCmds();
})();
