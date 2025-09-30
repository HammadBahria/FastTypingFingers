// Space Attack typing game
(function(){
  const canvas = document.getElementById('space-canvas');
  const ctx = canvas?.getContext('2d');
  const overlay = document.getElementById('space-overlay');
  const startBtn = document.getElementById('space-start');
  const backBtn = document.getElementById('space-back');
  const livesEl = document.getElementById('space-lives');
  const scoreEl = document.getElementById('space-score');
  const livesIntroEl = document.getElementById('space-lives-intro');
  const livesInc = document.getElementById('space-lives-inc');
  const livesDec = document.getElementById('space-lives-dec');

  const tile = document.getElementById('game-space-attack');
  if (tile) tile.addEventListener('click', ()=> window.location.href = 'space.html');

  const playerImg = new Image(); playerImg.src = 'assets/images/player-ship.svg';
  const enemyImg = new Image(); enemyImg.src = 'assets/images/enemy-ship.svg';

  let running = false;
  let raf = 0;
  let score = 0;
  let lives = 3;
  const enemies = []; // {id,x,y,word,idx,speed}
  const lasers = [];  // {x,y,vy,targetId}
  let nextEnemyId = 1;
  let activeTargetId = null;
  const words = ['cat','ship','moon','light','code','fast','type','spell','alpha','zoo','wind','rain','storm','nova','flame'];
  // Time/difficulty state
  let lastTs = 0;          // last frame timestamp
  let startTs = 0;         // game start timestamp
  let spawnAcc = 0;        // accumulator for spawns (spawns per second)
  const BASE_SPAWN_RATE = 0.5; // enemies per second at level 1
  const SPAWN_GROWTH = 0.18;   // per-level spawn growth
  const BASE_SPEED_MIN = 35;   // px/sec
  const BASE_SPEED_MAX = 60;   // px/sec (initially slow as requested)
  const SPEED_GROWTH = 0.12;   // +12% per level

  // Allow lives to drop to 0 in-game so the session can end. Intro UI will clamp via handlers.
  function setLives(n){
    lives = Math.max(0, Math.min(10, +n||3));
    if (livesEl) livesEl.textContent = String(lives);
    if (livesIntroEl) livesIntroEl.textContent = String(Math.max(1, lives)); // show at least 1 in intro
  }
  function addScore(n){ score += n; if (scoreEl) scoreEl.textContent = String(score); }

  function reset(){
    score = 0; if (scoreEl) scoreEl.textContent='0';
    setLives(3);
    enemies.length = 0; lasers.length = 0; cancelAnimationFrame(raf); raf = 0;
    running = false; activeTargetId = null; if (overlay) overlay.style.display='grid';
    // reset timing state
    lastTs = 0; startTs = 0; spawnAcc = 0;
  }

  function start(){
    if (!ctx) return;
    running = true; activeTargetId = null; if (overlay) overlay.style.display='none';
    enemies.length = 0; lasers.length = 0; score = 0; if (scoreEl) scoreEl.textContent='0';
    // init timing
    lastTs = 0; startTs = 0; spawnAcc = 0;
    raf = requestAnimationFrame(loop);
  }

  function currentLevel(ts){
    if (!startTs) return 1;
    const elapsed = Math.max(0, (ts - startTs) / 1000);
    return 1 + Math.floor(elapsed / 20); // level up every 20s
  }

  function spawnEnemy(ts){
    const w = canvas.width, h = canvas.height;
    const x = 80 + Math.random()*(w-160);
    const y = -40;
    const lvl = currentLevel(ts);
    const growth = 1 + (lvl-1) * SPEED_GROWTH;
    const speed = (BASE_SPEED_MIN + Math.random()*(BASE_SPEED_MAX-BASE_SPEED_MIN)) * growth; // px/sec
    const word = words[Math.floor(Math.random()*words.length)];
    enemies.push({id: nextEnemyId++, x,y,word,idx:0,speed});
  }

  function fire(target){
    const w = canvas.width, h = canvas.height;
    const x = target ? target.x : w/2;
    lasers.push({x, y: h-80, vy: 640, targetId: target?.id ?? null}); // vy: px/sec
  }

  function draw(){
    const w = canvas.width, h = canvas.height;
    // space background
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#050a14'; ctx.fillRect(0,0,w,h);
    // stars
    ctx.fillStyle = '#93c5fd';
    for (let i=0;i<80;i++){ const sx=(i*97%w); const sy=(i*53%h); ctx.fillRect((sx+Date.now()/50)%w, sy, 1, 1); }
    // player
    const px=w/2-28, py=h-100; ctx.drawImage(playerImg, px, py, 56, 56);
    // enemies
    ctx.textAlign='center'; ctx.textBaseline='middle';
    enemies.forEach(e=>{
      ctx.drawImage(enemyImg, e.x-28, e.y-28, 56,56);
      // word label with typed part colored
      const typed = e.word.slice(0, e.idx), rest=e.word.slice(e.idx);
      ctx.font='bold 18px Inter, system-ui, sans-serif';
      ctx.fillStyle='#22c55e'; ctx.fillText(typed, e.x-ctx.measureText(rest).width/2, e.y+36);
      ctx.fillStyle='#e2e8f0'; ctx.fillText(rest, e.x+ctx.measureText(typed).width/2, e.y+36);
    });
    // lasers
    ctx.strokeStyle='#38bdf8'; ctx.lineWidth=3; ctx.beginPath();
    lasers.forEach(l=>{ ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y-16); });
    ctx.stroke();
  }

  function update(dt, ts){
    // Initialize time anchors
    if (!startTs) startTs = ts;
    // Time-based spawn rate
    const lvl = currentLevel(ts);
    const spawnRate = BASE_SPAWN_RATE * (1 + (lvl-1) * SPAWN_GROWTH); // spawns/sec
    spawnAcc += spawnRate * dt;
    while (spawnAcc >= 1) { spawnEnemy(ts); spawnAcc -= 1; }

    // Move
    enemies.forEach(e=> e.y += e.speed * dt);
    lasers.forEach(l=> l.y -= l.vy * dt);
    // collisions
    for (let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if (e.y>canvas.height-90){ // reached base
        if (e.id === activeTargetId) activeTargetId = null;
        enemies.splice(i,1); setLives(lives-1); if (lives<=0){ reset(); return; }
        continue;
      }
      for (let j=lasers.length-1;j>=0;j--){
        const l=lasers[j];
        if (Math.abs(l.x-e.x)<24 && Math.abs(l.y-e.y)<28){
          // Only allow removal if the enemy is already fully typed; otherwise hit is cosmetic
          // Also, only collide if laser is aimed at this enemy (if targeted)
          const aimed = (l.targetId==null) || (l.targetId===e.id);
          if (aimed && e.idx >= e.word.length){
            lasers.splice(j,1); enemies.splice(i,1); addScore(10);
            if (e.id === activeTargetId) activeTargetId = null;
            break;
          } else {
            lasers.splice(j,1);
          }
        }
      }
    }
    // cleanup offscreen lasers
    for (let j=lasers.length-1;j>=0;j--){ if (lasers[j].y<-20) lasers.splice(j,1); }
  }

  function loop(ts){
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000); // clamp dt to 50ms to avoid big jumps
    lastTs = ts;
    update(dt, ts);
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function handleKey(e){
    if (!running){ if (e.key==='Enter'){ start(); } return; }
    if (e.key.length!==1) return;
    const ch=e.key.toLowerCase();
    // If we have an active target, enforce finishing it first
    if (activeTargetId!=null){
      const idx = enemies.findIndex(en=> en.id===activeTargetId);
      if (idx<0) { activeTargetId=null; return; }
      const en = enemies[idx];
      const expected = en.word[en.idx]?.toLowerCase();
      if (expected && expected===ch){
        en.idx++;
        fire(en);
        if (en.idx>=en.word.length){
          // Destroy on full word
          enemies.splice(idx,1); addScore(20); activeTargetId=null;
        }
      }
      return; // ignore keys that don't match the active target
    }
    // Acquire a new target: pick the closest (largest y) with matching next letter
    let best=-1, bestY=-Infinity;
    for (let i=0;i<enemies.length;i++){
      const e2=enemies[i];
      if (e2.word[e2.idx]?.toLowerCase()===ch && e2.y>bestY){ best=i; bestY=e2.y; }
    }
    if (best>=0){
      const en = enemies[best];
      activeTargetId = en.id;
      en.idx++;
      fire(en);
      if (en.idx>=en.word.length){
        enemies.splice(best,1); addScore(20); activeTargetId=null;
      }
    }
  }

  // HUD controls
  if (livesInc) livesInc.addEventListener('click', ()=>{
    // In intro overlay, clamp 1..10 for starting lives
    const inIntro = overlay && overlay.style.display !== 'none';
    const next = lives + 1;
    setLives(inIntro ? Math.max(1, Math.min(10, next)) : next);
  });
  if (livesDec) livesDec.addEventListener('click', ()=>{
    const inIntro = overlay && overlay.style.display !== 'none';
    const next = lives - 1;
    setLives(inIntro ? Math.max(1, Math.min(10, next)) : next);
  });
  if (startBtn) startBtn.addEventListener('click', ()=> start());
  if (backBtn) backBtn.addEventListener('click', ()=>{ window.location.href='games.html'; });
  window.addEventListener('keydown', handleKey);

  // init
  setLives(3);
  if (overlay) overlay.style.display='grid';
})();
