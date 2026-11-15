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
/* Ref names: tags are stored as "tag:v1.0" so they can't clash with a branch of the same name. */
const refKind = n => n.startsWith('origin/') ? 'remote' : n === 'stash' ? 'stash' : n.startsWith('tag:') ? 'tag' : 'branch';
const refLabel = n => n === 'stash' ? 'stash@{0}' : n.startsWith('tag:') ? n.slice(4) : n;
const refOrder = s => Object.keys(s.refs).sort((a,b) => {
  const rank = n => n === s.head.b ? 0 : ({branch:1, tag:2, remote:3, stash:4})[refKind(n)];
  return rank(a) - rank(b) || a.localeCompare(b);
});
/* Every commit reachable from one tip, following all parents. */
function reachFrom(s, tip){
  const seen = new Set(), st = tip ? [tip] : [];
  while (st.length){ const id = st.pop(); if (seen.has(id) || !s.c[id]) continue; seen.add(id); st.push(...s.c[id].p); }
  return seen;
}
/* Shortest way to name `id` starting from `tip`, e.g. "~2", "^2", "^2~1"; null if unreachable. */
function relName(s, tip, id){
  if (!tip || !s.c[tip]) return null;
  const q = [[tip, []]], seen = new Set([tip]);
  while (q.length){
    const [c, path] = q.shift();
    if (c === id){
      let out = '', run = 0;
      for (const i of path){ if (i === 0) run++; else { if (run){ out += '~' + run; run = 0; } out += '^' + (i+1); } }
      return run ? out + '~' + run : out;
    }
    s.c[c].p.forEach((p, i) => { if (!seen.has(p) && s.c[p]){ seen.add(p); q.push([p, [...path, i]]); } });
  }
  return null;
}
function pillRows(s){
  const by = {}; const add = (id,row) => { if (!id || !s.c[id]) return; (by[id] = by[id] || []).push(row); };
  if (!('b' in s.head)) add(s.head.c, [{k:'HEAD', t:'HEAD (detached)', cls:'detached'}]);
  for (const n of refOrder(s)){
    const row = [];
    if (s.head.b === n) row.push({k:'HEAD', t:'HEAD →', cls:'head'});
    row.push({k:'r:'+n, t: refLabel(n), cls: refKind(n)});
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
 { id:'amend', name:'Amend & squash', setup:s=>{mk(s,'A','init');mk(s,'B','header');}, steps:[
  { cmd:'git log --oneline', note:`<p>Two commits on main. Make a third, then fix it.</p>` },
  { cmd:'git commit -m "add login"', op:s=>mk(s,'C','add login'), note:`<p>Commit <b>C</b>. Then you notice a typo in the message, or a file you forgot to add.</p>` },
  { cmd:'git commit --amend -m "add login page"', op:s=>mk(s,'C′','add login page',{p:['B'],lane:-1}), note:`<p>Amend doesn't edit C. It makes a <b>new commit C′</b> with the same parent (B), whatever is staged now and the new message, then moves main to it. C becomes unreachable.</p><p>Run <code>git add forgotten.js</code> first and the file goes into C′ too. Only amend commits you haven't pushed.</p>` },
  { cmd:'git commit -m "wip"', op:s=>mk(s,'D','wip'), note:`<p>A couple of messy work-in-progress commits follow…</p>` },
  { cmd:'git commit -m "wip again"', op:s=>mk(s,'E','wip again'), note:`<p>Before sharing, you'd like these three to be one clean commit.</p>` },
  { cmd:'git rebase -i HEAD~3', op:s=>mk(s,'S','login page',{p:['B'],lane:1}), out:['pick   a1b2c3 add login page','squash d4e5f6 wip','squash 7a8b9c wip again'], note:`<p><code>HEAD~3</code> is B, so the three commits after it open in your editor. Changing <code>pick</code> to <code>squash</code> melds a commit into the one above it.</p><p>Git builds one new commit <b>S</b> on top of B with all three changes and moves main to it. C′, D and E become unreachable. Same rule as amend: only squash commits nobody else has.</p>` },
 ]},
 { id:'reset', name:'Reset & reflog', setup:s=>{mk(s,'A','init');mk(s,'B','header');mk(s,'C','footer');mk(s,'D','typo');}, steps:[
  { cmd:'git log --oneline', areas:['clean','clean','D'], note:`<p>Four commits and nothing uncommitted. Watch the three boxes under the graph too. Reset's flag decides which of them get touched.</p>` },
  { cmd:'git reset --soft HEAD~1', op:s=>mv(s,'main','C'), areas:["has D's changes","D's changes, staged",'C'], note:`<p><code>HEAD~1</code> means "one parent back". <code>--soft</code> moves only the branch.</p><p>D's changes stay staged, as if you had just run <code>git add</code>. Use it for "undo my last commit but keep the work ready to recommit".</p>` },
  { cmd:'git reset HEAD~1', op:s=>mv(s,'main','B'), areas:['has C + D changes','matches B','B'], note:`<p>No flag means <code>--mixed</code>. It moves the branch and resets the staging area, but leaves your files alone. The changes from C and D are still in your files, just unstaged.</p>` },
  { cmd:'git reset --hard HEAD~1', op:s=>mv(s,'main','A'), areas:['matches A','matches A','A'], note:`<p><code>--hard</code> moves the branch and overwrites staging <i>and your files</i> to match A. Uncommitted edits would be gone for good.</p><p>B, C and D look lost. They aren't.</p>` },
  { cmd:'git reflog', areas:['matches A','matches A','A'], out:['a1f0e2c HEAD@{0}: reset: moving to HEAD~1','b7d91aa HEAD@{1}: reset: moving to HEAD~1','c3e4f5d HEAD@{2}: reset: moving to HEAD~1','d9a8b7c HEAD@{3}: commit: typo'], note:`<p>The reflog is a local diary of every commit HEAD has pointed at. <code>HEAD@{3}</code> is commit D, from before the resets.</p>` },
  { cmd:'git reset --hard d9a8b7c', op:s=>mv(s,'main','D'), areas:['clean','clean','D'], note:`<p>Point main back at D and everything is reachable again. Anything you <i>committed</i> can almost always be recovered this way.</p>` },
 ]},
 { id:'wrong', name:'Wrong branch', setup:s=>{mk(s,'A','init');mk(s,'B','header');}, steps:[
  { cmd:'git log --oneline', note:`<p>You meant to start a feature branch first, but forgot. You're still on main.</p>` },
  { cmd:'git commit -m "login page"', op:s=>mk(s,'C','login page'), note:`<p>Oops: <b>C</b> landed on main. As long as you haven't pushed it, this takes three commands to fix.</p>` },
  { cmd:'git branch feature', op:s=>br(s,'feature'), note:`<p>First put a branch on C so it's safe. feature and main both point at C now.</p>` },
  { cmd:'git reset --hard HEAD~1', op:s=>mv(s,'main','B'), note:`<p>Move main back one commit. C isn't lost, because feature still points at it.</p><p><code>--hard</code> also resets your files, so commit or stash any uncommitted work first. <code>git reset --keep HEAD~1</code> keeps uncommitted changes and refuses if it would have to overwrite them.</p>` },
  { cmd:'git switch feature', op:s=>sw(s,'feature'), note:`<p>Carry on where you were. Already pushed C to main? Then use <code>git revert</code> on main instead, so you don't rewrite shared history.</p>` },
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
 { id:'tags', name:'Tags', setup:s=>{mk(s,'A','init');mk(s,'B','release prep');}, steps:[
  { cmd:'git log --oneline', note:`<p>B is the code you're about to release.</p>` },
  { cmd:'git tag -a v1.0 -m "first release"', op:s=>br(s,'tag:v1.0'), note:`<p>A tag is a ref like a branch, stored in <code>refs/tags/v1.0</code>. <code>-a</code> makes an <i>annotated</i> tag, which also records who tagged it, when, and a message. Without <code>-a</code> you get a lightweight tag: just the name.</p>` },
  { cmd:'git commit -m "new feature"', op:s=>mk(s,'C','new feature'), note:`<p>main moves on. The tag doesn't: tags never move when you commit. That's the point of them. v1.0 means exactly this commit, for good.</p>` },
  { cmd:'git commit -m "fix"', op:s=>mk(s,'D','fix') },
  { cmd:'git switch --detach v1.0', op:s=>det(s,'B'), out:['HEAD is now at b2c release prep'], note:`<p>You can check out a tag to look at the release, but a tag can't move to new commits, so HEAD detaches. To fix an old release, make a branch from it: <code>git switch -c hotfix v1.0</code>.</p>` },
  { cmd:'git switch main', op:s=>sw(s,'main') },
  { cmd:'git push origin v1.0', out:[' * [new tag]  v1.0 -> v1.0'], note:`<p>Plain <code>git push</code> doesn't send tags. Push one by name, or all of them with <code>git push --tags</code>. <code>--follow-tags</code> sends only annotated tags on the commits you're pushing.</p>` },
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
 { id:'force', name:'Force push', setup:s=>{mk(s,'A','init');mk(s,'B','readme');mv(s,'origin/main','B');s.gh='B';}, steps:[
  { cmd:'git log --oneline --all', note:`<p>You and a teammate both push to main. GitHub's main (the dashed tag) is at B.</p>` },
  { cmd:'# a teammate pushes C', op:s=>{mk(s,'C','their fix',{p:['B'],lane:-1,remote:true,noMove:true});s.gh='C';}, note:`<p>Their commit <b>C</b> is on GitHub. You haven't fetched, so your repo doesn't have it.</p>` },
  { cmd:'git commit -m "my fix"', op:s=>mk(s,'D','my fix',{lane:0}) },
  { cmd:'git push', out:['! [rejected]  main -> main (fetch first)'], err:true, note:`<p>Rejected, because your main doesn't contain C. The tempting "fix" is to force it.</p>` },
  { cmd:'git push --force', op:s=>{s.gh='D';mv(s,'origin/main','D');s.c.C.remote=false;}, out:[' + b2c...d4e  main -> main (forced update)'], note:`<p><code>--force</code> tells GitHub to point main at D, whatever is there now. C isn't in D's history, so nothing on GitHub points at it any more (faded).</p><p>Your teammate's work just disappeared from the server, and you never even saw it.</p>` },
  { cmd:'# rewind and try again safely', op:s=>{s.gh='C';mv(s,'origin/main','B');s.c.C.remote=true;}, note:`<p>Back to just before the force push. This time, use the safer flag.</p>` },
  { cmd:'git push --force-with-lease', out:['! [rejected]  main -> main (stale info)'], err:true, note:`<p><code>--force-with-lease</code> overwrites only if GitHub's main is still where <i>your</i> origin/main says it is (B). It isn't, it's at C, so Git refuses and nothing is lost.</p>` },
  { cmd:'git fetch', op:s=>{s.c.C.remote=false;mv(s,'origin/main','C');}, out:['   b2c..c3d  main -> origin/main'], note:`<p>Now you can see C. Careful: after a fetch the lease <i>would</i> pass, because origin/main matches again. Look at what arrived before forcing anything. Usually you don't need to.</p>` },
  { cmd:'git rebase origin/main', op:s=>mk(s,'D′','my fix',{p:['C'],lane:0}), note:`<p>Put your commit on top of theirs.</p>` },
  { cmd:'git push', op:s=>{s.gh='D′';mv(s,'origin/main','D′');}, out:['   c3d..d4e  main -> main'], note:`<p>A plain push works, no force needed. Force-push only branches that are yours alone (like your own feature branch after a rebase), and prefer <code>--force-with-lease</code> when you do.</p>` },
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
  constructor(svg, onPick){
    this.svg = svg; this.mid = 'arr' + (mid++); this.onPick = onPick;
    if (onPick){
      const pick = t => { const n = t.closest && t.closest('.g-node'); onPick(n ? n.dataset.id : null); };
      svg.addEventListener('click', e => pick(e.target));
      svg.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.g-node')){ e.preventDefault(); pick(e.target); } });
    }
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
        const g = E('g', {class:'g-node', 'data-id':c.id}, this.gN);
        if (this.onPick){ g.setAttribute('tabindex','0'); g.setAttribute('role','button'); g.setAttribute('aria-label', `commit ${c.id}: ${c.msg}. Show its names`); }
        E('circle', {r:R}, g); const t = E('text', {class:'id'}, g); t.textContent = c.id;
        const m = E('text', {class:'msg', y: c.lane > 0 ? -(R+10) : R+18}, g); m.textContent = c.msg;
        const ti = E('title', {}, g); ti.textContent = `commit ${c.id}: ${c.msg}`;
        const par = c.p.length && this.ents.get('n:'+c.p[0]);
        const st = par ? {...par.cur, o:0} : {...p, o:0};
        e = {type:'n', id:c.id, el:g, cur:st}; this.ents.set(k, e);
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
  /* Selected commit and a highlighted set (for A..B ranges). */
  mark(sel, set){
    for (const e of this.ents.values()) if (e.type === 'n'){
      e.el.classList.toggle('sel', e.id === sel && !e.dead);
      e.el.classList.toggle('inrange', !!set && set.has(e.id) && !e.dead);
    }
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

/* ---------- small helpers ---------- */
async function copyText(t){
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; }
    catch { return false; }
  }
}
function flashBtn(b, t){
  if (!b.dataset.label) b.dataset.label = b.textContent;
  b.textContent = t; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = b.dataset.label; }, 1400);
}

/* ---------- playground ---------- */
const tabs = document.getElementById('tabs'), term = document.getElementById('term'), note = document.getElementById('note');
const prevB = document.getElementById('prev'), nextB = document.getElementById('next'), autoB = document.getElementById('auto'), count = document.getElementById('count');
const predB = document.getElementById('predict'), linkB = document.getElementById('copyLink');
const areasEl = document.getElementById('areas'), aEls = [0,1,2].map(i => document.getElementById('a'+i));
const namesEl = document.getElementById('names'), rgA = document.getElementById('rgA'), rgB = document.getElementById('rgB'), rgOut = document.getElementById('rgOut');
let cur = null, states = [], idx = 0, timer = null, sel = null;
let predict = false, quiz = null, score = {r:0, t:0};
const g = new Graph(document.getElementById('graphSvg'), id => { sel = id && id !== sel ? id : null; drawNames(); });

SCN.forEach((sc, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role','tab'); b.id = 'tab-'+sc.id; b.textContent = sc.name;
  b.addEventListener('click', () => { load(i); syncHash(); }); tabs.appendChild(b);
});
function load(i){
  stopAuto(); cur = SCN[i]; states = buildStates(cur); g.layout(states); idx = 0;
  sel = null; quiz = null; score = {r:0, t:0}; rgA.value = ''; rgB.value = '';
  [...tabs.children].forEach((b,j) => b.setAttribute('aria-selected', j === i));
  show(true);
}
function show(instant, pre = ''){
  const st = cur.steps[idx];
  g.render(states[idx], instant);
  let t = cur.steps.slice(0, idx+1).map((x,j) => {
    const line = `<div class="ln${j===idx && !quiz ? ' cur' : ''}"><span class="p">$</span> ${esc(x.cmd)}</div>`;
    const out = x.out ? `<div class="out${x.err?' err':''}">${x.out.map(esc).join('\n')}</div>` : '';
    return line + out;
  }).join('');
  if (quiz) t += `<div class="ln cur pend"><span class="p">$</span> ${esc(cur.steps[idx+1].cmd)} <span class="ask">◂ what will this change?</span></div>`;
  term.innerHTML = t;
  term.scrollTop = term.scrollHeight;
  note.innerHTML = quiz ? quizHtml() : pre + (st.note || '<p style="color:var(--muted)">Watch which label moves.</p>');
  if (st.areas){
    areasEl.hidden = false;
    st.areas.forEach((t,j) => { const changed = aEls[j].textContent !== t; aEls[j].textContent = t;
      if (changed && !instant){ const p = aEls[j].parentElement; p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); } });
  } else areasEl.hidden = true;
  prevB.disabled = idx === 0 && !quiz; nextB.disabled = idx === cur.steps.length - 1;
  nextB.textContent = quiz ? 'Check →' : 'Next →';
  autoB.disabled = predict;
  count.textContent = `${idx+1} / ${cur.steps.length}`;
  drawNames();
}
function back(){
  if (quiz){ quiz = null; show(true); return true; }
  if (idx === 0) return false;
  idx--; show(false); return true;
}
function forward(){
  if (idx >= cur.steps.length - 1) return false;
  if (!predict){ idx++; show(false); return true; }
  if (!quiz){ quiz = { opts: quizOpts(states[idx]) }; show(true); return true; }
  const ticked = new Set([...note.querySelectorAll('input:checked')].map(x => x.value));
  const res = checkQuiz(states[idx], states[idx+1], quiz.opts, ticked);
  quiz = null; idx++; show(false, res); return true;
}
prevB.addEventListener('click', () => { stopAuto(); back(); syncHash(); });
nextB.addEventListener('click', () => { stopAuto(); forward(); syncHash(); });
function stopAuto(){ clearInterval(timer); timer = null; autoB.textContent = 'Play'; }
autoB.addEventListener('click', () => {
  if (timer) return stopAuto();
  if (idx === cur.steps.length - 1){ idx = 0; show(false); }
  autoB.textContent = 'Pause';
  timer = setInterval(() => { if (!forward()) stopAuto(); syncHash(); }, 2600);
});
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (/TEXTAREA|SELECT/.test(tg.tagName) || (tg.tagName === 'INPUT' && tg.type !== 'checkbox') || tg.isContentEditable) return;
  const r = document.getElementById('play').getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  if (e.key === 'ArrowRight'){ stopAuto(); forward(); syncHash(); } else if (e.key === 'ArrowLeft'){ stopAuto(); back(); syncHash(); }
});

/* Predict mode: before each step, tick what you think will change, then compare. */
predB.addEventListener('click', () => {
  predict = !predict; predB.setAttribute('aria-pressed', predict);
  stopAuto(); quiz = null; score = {r:0, t:0}; show(true);
});
function quizOpts(a){
  const o = [['HEAD', 'HEAD']];
  for (const n of refOrder(a)) o.push(['r:'+n, refLabel(n)]);
  if (a.gh) o.push(['GH', "GitHub's main"]);
  o.push(['newref', 'a new label appears'], ['newc', 'a new commit appears']);
  return o;
}
function changes(a, b){
  const t = new Set();
  if (JSON.stringify(a.head) !== JSON.stringify(b.head)) t.add('HEAD');
  for (const n in a.refs) if (a.refs[n] !== b.refs[n]) t.add('r:'+n);
  if (Object.keys(b.refs).some(n => !(n in a.refs))) t.add('newref');
  if (Object.keys(b.c).some(id => !(id in a.c))) t.add('newc');
  if (a.gh !== b.gh) t.add('GH');
  return t;
}
function quizHtml(){
  return `<p class="qhead">What will <code>${esc(cur.steps[idx+1].cmd)}</code> change? Tick everything that moves, appears or disappears, then press <b>Check</b>. Leave all boxes empty if you think nothing changes.</p>
  <div class="qopts">${quiz.opts.map(([k,l]) => `<label><input type="checkbox" value="${esc(k)}"> ${esc(l)}</label>`).join('')}</div>`;
}
function checkQuiz(a, b, opts, ticked){
  const truth = changes(a, b); let ok = true;
  const rows = opts.map(([k, label]) => {
    const t = truth.has(k), u = ticked.has(k);
    if (t !== u) ok = false;
    if (!t && !u) return '';
    const fresh = k.startsWith('new');   // "a new label appears" reads as an event, the rest as pointers
    const said = t && u ? (fresh ? 'yes, as you said' : 'changed, as you said') : t ? (fresh ? 'yes (you missed this)' : 'changed (you missed it)') : (fresh ? 'no, not this time' : "didn't change");
    return `<li class="${t && u ? 'ok' : 'bad'}"><b>${esc(label)}</b>: ${said}</li>`;
  }).join('');
  score.t++; if (ok) score.r++;
  let hint = '';
  if (ticked.has('HEAD') && !truth.has('HEAD') && 'b' in a.head && truth.has('r:'+a.head.b))
    hint = `<p class="hint">HEAD still points at <code>${esc(a.head.b)}</code>. The branch moved and HEAD came along, but HEAD itself didn't change.</p>`;
  return `<div class="verdict ${ok ? 'ok' : 'bad'}"><p><b>${ok ? '✓ Spot on.' : '✗ Not quite.'}</b> <span class="score">${score.r} of ${score.t} right so far</span></p>${rows ? `<ul>${rows}</ul>` : '<p>Nothing moved.</p>'}${hint}</div>`;
}

/* Names: click a commit to see every way to refer to it; pick two refs to see A..B. */
const tipOf = (s, n) => n === 'HEAD' ? H(s) : s.refs[n];
const tipLabel = n => n === 'HEAD' ? 'HEAD' : refLabel(n);
rgA.addEventListener('change', drawNames); rgB.addEventListener('change', drawNames);
function drawNames(){
  const s = states[idx];
  if (sel && !s.c[sel]) sel = null;
  const tips = ['HEAD', ...refOrder(s)];
  for (const el of [rgA, rgB]){
    const v = el.value;
    el.innerHTML = `<option value="">${el === rgA ? '(nothing)' : 'choose…'}</option>` + tips.map(n => `<option value="${esc(n)}">${esc(tipLabel(n))}</option>`).join('');
    el.value = tips.includes(v) ? v : '';
  }
  let set = null;
  if (rgB.value){
    const inA = rgA.value ? reachFrom(s, tipOf(s, rgA.value)) : new Set();
    set = new Set([...reachFrom(s, tipOf(s, rgB.value))].filter(x => !inA.has(x)));
    const ids = [...set].sort((x,y) => s.c[y].col - s.c[x].col);
    rgOut.innerHTML = ids.length ? `→ ${ids.length} commit${ids.length > 1 ? 's' : ''}: <b>${esc(ids.join(', '))}</b>`
      : `→ nothing: every commit on ${esc(tipLabel(rgB.value))} is already on ${esc(tipLabel(rgA.value))}`;
  } else rgOut.textContent = '';
  g.mark(sel, set);
  if (!sel){ namesEl.innerHTML = '<span class="dim">Click a commit to see every name that reaches it.</span>'; return; }
  const c = s.c[sel];
  if (c.remote){ namesEl.innerHTML = `<b>${esc(sel)}</b> is only on GitHub so far. Your repo can't name it until you fetch.`; return; }
  const names = [];
  for (const n of tips){ const r = relName(s, tipOf(s, n), sel); if (r !== null) names.push(tipLabel(n) + r); }
  namesEl.innerHTML = names.length
    ? `<b>${esc(sel)}</b> can be called ${names.map(x => `<code>${esc(x)}</code>`).join(' ')} <span class="dim">or by its hash.</span>`
    : `<b>${esc(sel)}</b> is unreachable: no branch, tag or HEAD leads to it. Only its hash finds it now, for example from <code>git reflog</code>.`;
}

/* Shareable links: #play=<scenario>/<step>, e.g. #play=rebase/2 */
const syncHash = () => { try { history.replaceState(null, '', '#play=' + cur.id + '/' + (idx+1)); } catch {} };
function fromHash(){
  const m = /^#play=([\w-]+)(?:\/(\d+))?$/.exec(location.hash);
  if (!m) return false;
  const i = SCN.findIndex(x => x.id === m[1]); if (i < 0) return false;
  load(i); idx = Math.min(Math.max((+m[2] || 1) - 1, 0), cur.steps.length - 1); show(true);
  document.getElementById('playground').scrollIntoView({block:'start'});
  return true;
}
addEventListener('hashchange', fromHash);
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#play="]');
  if (!a) return;
  e.preventDefault();
  try { history.replaceState(null, '', a.getAttribute('href')); } catch {}
  fromHash();
});
linkB.addEventListener('click', async () => { syncHash(); flashBtn(linkB, await copyText(location.href) ? 'Copied' : 'Copy failed'); });
if (!fromHash()) load(0);

/* ---------- merge vs rebase, side by side ---------- */
const CMP = {
  setup:s=>{mk(s,'A','init');mk(s,'B','readme');br(s,'feature');sw(s,'feature');mk(s,'C','search box',{lane:-1});mk(s,'D','search API');sw(s,'main');mk(s,'E','fix typo',{lane:0});sw(s,'feature');},
  steps:[
    { l:{cmd:'git log --oneline --graph --all'}, r:{cmd:'git log --oneline --graph --all'},
      note:`<p>Same start on both sides: feature (C, D) and main (E) have diverged at B, and you're on feature.</p>` },
    { l:{cmd:'git switch main', op:s=>sw(s,'main')}, r:{cmd:'git rebase main', op:s=>{mk(s,'C′','search box',{p:['E'],lane:0});mk(s,'D′','search API',{lane:0});}},
      note:`<p>Merge is done from main. Rebase starts on feature and replays C and D on top of E as <b>new</b> commits C′ and D′.</p>` },
    { l:{cmd:'git merge feature', op:s=>mk(s,'M','merge feature',{p:['E','D'],lane:0})}, r:{cmd:'git switch main && git merge feature', op:s=>{sw(s,'main');mv(s,'main','D′');}},
      note:`<p><b>Merge</b> keeps history exactly as it happened and adds M, a commit with two parents. Nothing is rewritten, so it's always safe on shared branches.</p><p><b>Rebase</b> gives one straight line and main just fast-forwards, but C and D were replaced, so only rebase commits nobody else has. Either way, the files end up the same.</p>` },
  ]};
{
  const cg = [new Graph(document.getElementById('cmpL')), new Graph(document.getElementById('cmpR'))];
  const cs = ['l','r'].map(side => buildStates({setup:CMP.setup, steps:CMP.steps.map(x => x[side])}));
  cg.forEach((gr, i) => gr.layout(cs[i]));
  const terms = [document.getElementById('cmpLt'), document.getElementById('cmpRt')];
  const cNote = document.getElementById('cmpNote'), cPrev = document.getElementById('cmpPrev'), cNext = document.getElementById('cmpNext'), cCount = document.getElementById('cmpCount');
  let ci = 0;
  const cmpShow = inst => {
    cg.forEach((gr, i) => gr.render(cs[i][ci], inst));
    ['l','r'].forEach((side, i) => { terms[i].innerHTML = CMP.steps.slice(0, ci+1).map((x, j) => `<div class="ln${j === ci ? ' cur' : ''}"><span class="p">$</span> ${esc(x[side].cmd)}</div>`).join(''); });
    cNote.innerHTML = CMP.steps[ci].note;
    cPrev.disabled = ci === 0; cNext.disabled = ci === CMP.steps.length - 1;
    cCount.textContent = `${ci+1} / ${CMP.steps.length}`;
  };
  cPrev.addEventListener('click', () => { if (ci > 0){ ci--; cmpShow(false); } });
  cNext.addEventListener('click', () => { if (ci < CMP.steps.length - 1){ ci++; cmpShow(false); } });
  cmpShow(true);
}

/* ---------- three areas (two files) ---------- */
const FILES = ['app.js', 'style.css'];
const fresh = () => ({ f: FILES.map(() => ({wd:1, idx:1, repo:1})), commits:['c1'] });
let A = fresh();
const areaBtns = document.getElementById('areaBtns');
function arrive(el){ if (reduce || !el) return; el.classList.remove('arrive'); void el.offsetWidth; el.classList.add('arrive'); }
const fileEl = (zone, i) => document.querySelector(`#${zone} .file[data-i="${i}"]`);
{
  for (const zone of ['zWd','zIdx','zRepo']){
    const box = document.querySelector(`#${zone} .files`);
    box.innerHTML = FILES.map((n, i) => `<div class="file" data-i="${i}"><span>${n}</span><span class="ver"></span></div>`).join('');
  }
  areaBtns.innerHTML = FILES.map((n, i) => `<div class="btnrow"><span class="lbl">${n}</span>
    <button type="button" class="edit" data-a="edit" data-i="${i}">✎ edit</button>
    <button type="button" data-a="add" data-i="${i}">git add ${n}</button>
    <button type="button" data-a="unstage" data-i="${i}">git restore --staged ${n}</button>
    <button type="button" data-a="restore" data-i="${i}">git restore ${n}</button></div>`).join('') +
    `<div class="btnrow"><span class="lbl">both</span><button type="button" data-a="addall">git add .</button><button type="button" data-a="commit">git commit</button><button type="button" data-a="reset">start over</button></div>`;
}
function drawAreas(){
  A.f.forEach((f, i) => {
    const w = fileEl('zWd', i), x = fileEl('zIdx', i), r = fileEl('zRepo', i);
    w.querySelector('.ver').textContent = 'v'+f.wd; x.querySelector('.ver').textContent = 'v'+f.idx; r.querySelector('.ver').textContent = 'v'+f.repo;
    w.classList.toggle('diff', f.wd !== f.idx); x.classList.toggle('diff', f.idx !== f.repo);
  });
  document.getElementById('hist').textContent = 'commits: ' + [...A.commits].reverse().join(' ← ') + '  (HEAD = ' + A.commits[A.commits.length-1] + ')';
  const staged = A.f.map((f, i) => f.idx !== f.repo ? FILES[i] : null).filter(Boolean);
  const unstaged = A.f.map((f, i) => f.wd !== f.idx ? FILES[i] : null).filter(Boolean);
  for (const b of areaBtns.querySelectorAll('button')){
    const f = A.f[b.dataset.i], a = b.dataset.a;
    b.disabled = a === 'add' || a === 'restore' ? f.wd === f.idx : a === 'unstage' ? f.idx === f.repo
      : a === 'addall' ? !unstaged.length : a === 'commit' ? !staged.length : false;
  }
  let o = '<span class="d">$ git status</span>\nOn branch main\n';
  if (staged.length) o += 'Changes to be committed:\n' + staged.map(n => `        <span class="g">modified:   ${n}</span>\n`).join('');
  if (unstaged.length) o += 'Changes not staged for commit:\n' + unstaged.map(n => `        <span class="r">modified:   ${n}</span>\n`).join('');
  if (!staged.length && !unstaged.length) o += 'nothing to commit, working tree clean\n';
  const both = staged.filter(n => unstaged.includes(n));
  if (both.length) o += `<span class="d">\n(${both.join(' and ')} ${both.length > 1 ? 'are' : 'is'} in both lists: you staged one version, then kept editing.)</span>`;
  else if (staged.length && unstaged.length) o += `<span class="d">\n(git commit now would include ${staged.join(', ')} only.)</span>`;
  document.getElementById('statusOut').innerHTML = o.trimEnd();
}
areaBtns.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const i = +b.dataset.i, f = A.f[i];
  switch (b.dataset.a){
    case 'edit': f.wd = Math.max(f.wd, f.idx, f.repo) + 1; arrive(fileEl('zWd', i)); break;
    case 'add': f.idx = f.wd; arrive(fileEl('zIdx', i)); break;
    case 'unstage': f.idx = f.repo; arrive(fileEl('zIdx', i)); break;
    case 'restore': f.wd = f.idx; arrive(fileEl('zWd', i)); break;
    case 'addall': A.f.forEach((x, j) => { if (x.wd !== x.idx){ x.idx = x.wd; arrive(fileEl('zIdx', j)); } }); break;
    case 'commit': A.f.forEach((x, j) => { if (x.idx !== x.repo){ x.repo = x.idx; arrive(fileEl('zRepo', j)); } }); A.commits.push('c' + (A.commits.length+1)); break;
    case 'reset': A = fresh(); break;
  }
  drawAreas();
});
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
  ['git restore <file>', 'Throw away unstaged edits in a file: it goes back to the staged version. Staged changes survive. This cannot be undone.', ['files']],
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
const fEl = document.getElementById('filters'), gEl = document.getElementById('cmdGroups'), qEl = document.getElementById('cmdSearch');
for (const k in EFF){
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed','false');
  b.innerHTML = `<i class="sw e-${k}"></i>${EFF[k]}`;
  b.onclick = () => { filt.has(k) ? filt.delete(k) : filt.add(k); b.setAttribute('aria-pressed', filt.has(k)); drawCmds(); };
  fEl.appendChild(b);
}
qEl.addEventListener('input', drawCmds);
function drawCmds(){
  const q = qEl.value.trim().toLowerCase();
  gEl.innerHTML = '';
  for (const [name, rows] of CMDS){
    const vis = rows.filter(r => (!filt.size || r[2].some(e => filt.has(e))) && (!q || (r[0] + ' ' + r[1]).toLowerCase().includes(q)));
    if (!vis.length) continue;
    const d = document.createElement('div'); d.className = 'cmd-group';
    d.innerHTML = `<h3>${name}</h3>` + vis.map(([c,w,e]) => `<div class="cmd-row"><div class="cmd-line"><code>${esc(c)}</code><button type="button" class="copy" data-c="${esc(c).replace(/"/g,'&quot;')}" aria-label="Copy ${esc(c).replace(/"/g,'&quot;')}">Copy</button></div><div class="what">${esc(w)}</div><div class="effs">${e.map(x => `<span class="eff e-${x}">${EFF[x]}</span>`).join('')}</div></div>`).join('');
    gEl.appendChild(d);
  }
  if (!gEl.children.length) gEl.innerHTML = '<p class="none">No commands match. Try fewer words, or clear the filters.</p>';
}
document.addEventListener('click', async e => {
  const b = e.target.closest && e.target.closest('button.copy'); if (!b) return;
  flashBtn(b, await copyText(b.dataset.c) ? 'Copied' : 'Failed');
});
drawCmds();
})();
