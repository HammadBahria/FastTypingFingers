// Simple Games bootstrap and one playable game: Balloon Pop
(function(){
  const THEME_KEY = 'typefast-settings';
  let currentTheme = 'coast';
  // --- Audio setup (game sounds) ---
  const SND = {
    correct: null,
    wrong: null,
    bg: null,
    clipMs: { correct: 140, wrong: 200 },
    rateMs: { correct: 45, wrong: 110 },
    last: { correct: 0, wrong: 0 },
    polyMax: 4,
    active: new Set(),
    enabled: true
  };
  try {
    SND.correct = new Audio('assets/audio/right word.mp3');
    SND.wrong = new Audio('assets/audio/wrong word.wav');
  SND.bg = new Audio('assets/audio/background.mp3');
    SND.correct.preload = 'auto'; SND.wrong.preload = 'auto'; SND.bg.preload = 'auto';
    SND.correct.volume = 0.5; SND.wrong.volume = 0.6; SND.bg.volume = 0.25;
    SND.bg.loop = true;
  } catch(_) {}

  function playGameAudio(base, vol, type){
    if (!SND.enabled || !base) return;
    try {
      const now = performance.now();
      const minGap = SND.rateMs?.[type] ?? 50;
      if (now - (SND.last?.[type] || 0) < minGap) return;
      if (SND.active.size >= SND.polyMax) return;
      const a = base.cloneNode(true);
      a.volume = Math.max(0, Math.min(1, vol));
      a.currentTime = 0;
      SND.active.add(a);
      a.addEventListener('ended', () => SND.active.delete(a), { once: true });
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(()=>{});
      }
      const clip = Math.max(60, SND.clipMs?.[type] ?? 120);
      let clipped = false;
      const schedule = () => {
        if (clipped) return; clipped = true;
        setTimeout(()=>{ try { a.pause(); } catch(_){} SND.active.delete(a); }, clip);
      };
      a.addEventListener('playing', schedule, { once: true });
      setTimeout(schedule, 400);
      SND.last[type] = now;
    } catch(_) {}
  }

  function playCorrect(){ playGameAudio(SND.correct, 0.5, 'correct'); }
  function playWrong(){ playGameAudio(SND.wrong, 0.6, 'wrong'); }
  async function startBg(){
    try {
      if (!SND.bg) return;
      // Skip the first 2 seconds
      SND.bg.currentTime = Math.min(SND.bg.duration || 999, 2);
      await SND.bg.play();
      // If looping jumps back to 0, force it to 2s
      SND.bg.addEventListener('timeupdate', function onTu(){
        if (SND.bg.currentTime < 1.9) {
          SND.bg.currentTime = 2;
        }
      }, { once: true });
    } catch(_) {}
  }
  function stopBg(){ try { if (SND.bg){ SND.bg.pause(); SND.bg.currentTime = 0; } } catch(_) {} }
  function applySavedTheme() {
    try {
      const settings = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
      const theme = settings.theme || 'coast';
      currentTheme = theme;
      applyTheme(theme);
    } catch {}
  }
  applySavedTheme();

  // Theme selector for games page (local, consistent with main site)
  const themeBtn = document.getElementById('theme-toggle');
  const themeSelector = document.getElementById('theme-selector');
  const themeClose = document.querySelector('.theme-close');
  const themeOptions = document.querySelectorAll('.theme-option');
  function saveTheme(theme){
    try {
      const current = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
      localStorage.setItem(THEME_KEY, JSON.stringify({ ...current, theme }));
    } catch {}
  }
  function applyTheme(theme){
    const body = document.body;
    if (!body) return;
    [...body.classList].forEach(cls => { if (cls.startsWith('theme-')) body.classList.remove(cls); });
    body.classList.add(`theme-${theme}`);
    currentTheme = theme;
  }
  function setActiveThemeOption(theme){
    if (!themeOptions || !themeOptions.length) return;
    themeOptions.forEach(opt => opt.classList.remove('active'));
    const active = Array.from(themeOptions).find(opt => opt.dataset.theme === theme);
    if (active) active.classList.add('active');
  }
  if (themeBtn && themeSelector) {
    themeBtn.addEventListener('click', () => {
      setActiveThemeOption(currentTheme);
      themeSelector.classList.toggle('hidden');
    });
  }
  if (themeClose && themeSelector) {
    themeClose.addEventListener('click', () => themeSelector.classList.add('hidden'));
  }
  if (themeOptions && themeOptions.length) {
    themeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        if (!theme) return;
        applyTheme(theme);
        saveTheme(theme);
        setActiveThemeOption(theme);
        themeSelector?.classList.add('hidden');
      });
    });
    // Initialize active state on load
    setActiveThemeOption(currentTheme);
  }

  // Balloon Pop game logic
  const tile = document.getElementById('game-balloon-pop');
  const spaceTile = document.getElementById('game-space-attack');
  const area = document.getElementById('balloon-area');
  const board = document.getElementById('balloon-board');
  const startBtn = document.getElementById('balloon-start');
  const stopBtn = document.getElementById('balloon-stop');
  const backBtn = document.getElementById('balloon-back');
  const scoreEl = document.getElementById('balloon-score');
  const scoreIntroEl = document.getElementById('balloon-score-intro');
  const livesEl = document.getElementById('balloon-lives');
  const livesInput = document.getElementById('balloon-lives-input');
  const fsBtn = document.getElementById('balloon-fullscreen');
  const livesIncBtn = document.getElementById('lives-inc');
  const livesDecBtn = document.getElementById('lives-dec');
  const toast = document.getElementById('level-up-toast');
  // modal removed per request
  const goScore = document.getElementById('go-score');
  const goLevel = document.getElementById('go-level');
  const cloudLayer = document.getElementById('cloud-layer');
  const introOverlay = document.getElementById('intro-overlay');
  const livesIntroEl = document.getElementById('balloon-lives-intro');
  const bgBalloonsLayer = document.getElementById('bg-balloons');
  const introLivesInc = document.getElementById('intro-lives-inc');
  const introLivesDec = document.getElementById('intro-lives-dec');

  let score = 0;
  let lives = 3;
  let spawnId = null;
  let rafId = null;
  const balloons = new Map(); // id -> {el, x, y, speed, ch}
  let nextId = 1;
  let level = 1;
  let speedMultiplier = 1;
  let playing = false;

  function clampLives(n){ return Math.max(1, Math.min(20, Number.isFinite(+n) ? +n : 3)); }
  function getDesiredLives(){ return livesInput ? (livesInput.value) : 3; }
  function setLives(n){
    lives = clampLives(n);
    if (livesEl) livesEl.textContent = String(lives);
    if (livesIntroEl) livesIntroEl.textContent = String(lives);
    if (livesInput) livesInput.value = String(lives);
  }
  function hideModal(){}
  function showModal(){}
  function showToast(){ if (!toast) return; toast.classList.remove('hidden'); toast.classList.add('show'); setTimeout(()=>{ toast.classList.add('hidden'); toast.classList.remove('show'); }, 900); }
  function resetGame(){
    score = 0; level = 1; speedMultiplier = 1; playing = false;
    // default lives to 3 when showing overlay; user can adjust before start
    setLives(3);
    if (scoreEl) scoreEl.textContent = '0';
    if (scoreIntroEl) scoreIntroEl.textContent = '0';
    // Ensure background layers are attached and clouds are generated
    if (cloudLayer && !cloudLayer.parentElement) board.appendChild(cloudLayer);
    if (typeof setupClouds === 'function') setupClouds();
    if (bgBalloonsLayer && !bgBalloonsLayer.parentElement) board.appendChild(bgBalloonsLayer);
    balloons.clear();
    hideModal();
    if (introOverlay) introOverlay.style.display = 'grid';
    // default label for fresh session
    try { const btn = document.getElementById('balloon-start'); if (btn) btn.textContent = 'Start'; } catch {}
  }

  function chooseChar(){
    // Level-based, small amounts of harder chars
    const lc = 'abcdefghijklmnopqrstuvwxyz';
    const uc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const dg = '0123456789';
    const pc = '.,;:-+=!?';
    const pUpper = level >= 3 ? Math.min(0.05 + (level-3)*0.01, 0.10) : 0; // 5% -> 10%
    const pDigit = level >= 4 ? Math.min(0.03 + (level-4)*0.005, 0.06) : 0; // 3% -> 6%
    const pPunc  = level >= 5 ? Math.min(0.02 + (level-5)*0.005, 0.05) : 0; // 2% -> 5%
    const r = Math.random();
    if (r < pUpper) return uc[Math.floor(Math.random()*uc.length)];
    if (r < pUpper + pDigit) return dg[Math.floor(Math.random()*dg.length)];
    if (r < pUpper + pDigit + pPunc) return pc[Math.floor(Math.random()*pc.length)];
    return lc[Math.floor(Math.random()*lc.length)];
  }

  function spawnBalloon(){
    const ch = chooseChar();
    const el = document.createElement('div');
    el.className = 'balloon';
    const label = document.createElement('div');
    label.className = 'ch';
    label.textContent = ch; // show exact character (case-sensitive when needed)
    el.appendChild(label);
    // Random color for the balloon
    const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#22c55e','#eab308'];
    const base = colors[Math.floor(Math.random()*colors.length)];
    el.style.background = `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45), rgba(255,255,255,0.2) 30%, ${base} 70%)`;

    // Robust board size (fallbacks if layout not settled yet)
    let br = board?.getBoundingClientRect?.() || { width: board?.clientWidth || window.innerWidth, height: board?.clientHeight || window.innerHeight };
    if (!br || !br.width || !br.height) {
      br = { width: board?.clientWidth || window.innerWidth, height: board?.clientHeight || window.innerHeight };
    }
    const x = Math.max(6, Math.random() * Math.max(62, (br.width - 62)));
    const y = Math.max(0, (br.height || 0) - 10); // start at bottom edge inside board
  const speed = (1.2 + Math.random()*1.6) * speedMultiplier; // px per frame
    const id = nextId++;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    board.appendChild(el);
    balloons.set(id, { el, x, y, speed, ch });
  }

  function update(){
    for (const [id, b] of balloons) {
      b.y -= b.speed;
      b.el.style.top = `${b.y}px`;
      // escaped at top
      if (b.y < -100) {
        b.el.remove();
        balloons.delete(id);
        lives = Math.max(0, lives - 1);
        if (livesEl) livesEl.textContent = String(lives);
        if (livesIntroEl) livesIntroEl.textContent = String(lives);
        // life lost sound
        playWrong();
        if (lives <= 0) {
          stopGame();
          // show intro overlay as game-over screen (play again/back/lives adjustable)
          if (introOverlay) introOverlay.style.display = 'grid';
          // default lives back to 3 on game over interface
          setLives(3);
          try { const btn = document.getElementById('balloon-start'); if (btn) btn.textContent = 'Play Again'; } catch {}
          return;
        }
      }
    }
    rafId = requestAnimationFrame(update);
  }

  function startLoop(){
    if (!rafId) rafId = requestAnimationFrame(update);
  }
  function stopLoop(){
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function startGame(){
    if (playing) return;
    playing = true;
    area.classList.remove('hidden');
    if (introOverlay) introOverlay.style.display = 'none';
    if (cloudLayer && !cloudLayer.parentElement) board.appendChild(cloudLayer);
    if (bgBalloonsLayer && !bgBalloonsLayer.parentElement) board.appendChild(bgBalloonsLayer);
    // Spawn immediately so the user sees a balloon right away
    spawnBalloon();
    spawnId = setInterval(()=>{ spawnBalloon(); }, 1100);
    startLoop();
    startBg();
  }

  function stopGame(){
    clearInterval(spawnId); spawnId=null;
  stopLoop();
    playing = false;
    // clear balloons
    for (const [,b] of balloons) b.el.remove();
    balloons.clear();
    stopBg();
    if (introOverlay) introOverlay.style.display = 'grid';
  }

  function popMatching(char){
    // find a balloon with this letter, closest to top
    let bestId = null; let bestY = Infinity;
    for (const [id, b] of balloons) {
      if (b.ch === char) {
        if (b.y < bestY) { bestY = b.y; bestId = id; }
      }
    }
    if (bestId != null) {
      const b = balloons.get(bestId);
      if (!b) return false;
      const cx = (b.el.offsetLeft || 0) + 28;
      const cy = (b.el.offsetTop || 0) + 28;
      b.el.classList.add('popped');
      setTimeout(()=> b.el.remove(), 220);
      balloons.delete(bestId);
  score += 5;
  if (scoreEl) scoreEl.textContent = String(score);
  if (scoreIntroEl) scoreIntroEl.textContent = String(score);
      maybeLevelUp();
      // pop sound
  // correct key sound disabled per request
      if (score > 0 && score % 100 === 0) {
        celebrationExplosion(cx, cy);
      }
      return true;
    }
    return false;
  }

  function maybeLevelUp(){
    const nextLevel = Math.floor(score / 50) + 1; // 50 points per level
    if (nextLevel > level) {
      level = nextLevel;
      speedMultiplier = 1 + (level - 1) * 0.15; // +15% speed per level
      showToast();
      if (spawnId) {
        const newRate = Math.max(350, 1100 * (1 - (level - 1) * 0.05));
        clearInterval(spawnId);
        spawnId = setInterval(()=>{ spawnBalloon(); }, newRate);
      }
    }
  }

  function handleKey(e){
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { if (!playing) { resetGame(); startGame(); } return; }
    if (e.key.length !== 1) return;
    const ch = e.key; // case-sensitive
    const popped = popMatching(ch);
    if (!popped && playing) {
      // minor feedback for wrong key while playing
      playWrong();
    }
  }

  if (tile) {
    tile.addEventListener('click', ()=>{
      // Navigate to dedicated full-screen page
      window.location.href = 'balloon.html';
    });
  }
  if (spaceTile) {
    spaceTile.addEventListener('click', ()=>{
      window.location.href = 'space.html';
    });
  }
  if (startBtn) startBtn.addEventListener('click', ()=>{ if (!playing) { resetGame(); startGame(); } });
  if (backBtn) backBtn.addEventListener('click', ()=>{
    stopGame();
    // On games listing page, hide area; on dedicated page, go back
    if (document.body?.dataset?.page === 'balloon-full') {
      window.location.href = 'games.html';
    } else {
      area.classList.add('hidden');
      board.innerHTML = 'Click Start to begin.';
    }
  });

  if (fsBtn) {
    fsBtn.addEventListener('click', async ()=>{
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement) {
          await el.requestFullscreen();
          fsBtn.textContent = 'Exit Fullscreen';
        } else {
          await document.exitFullscreen();
          fsBtn.textContent = 'Fullscreen';
        }
      } catch {}
    });
  }

  if (livesInput) {
    livesInput.addEventListener('change', ()=> setLives(livesInput.value));
  }
  if (introLivesInc) introLivesInc.addEventListener('click', ()=> setLives(lives + 1));
  if (introLivesDec) introLivesDec.addEventListener('click', ()=> setLives(lives - 1));
  if (livesIncBtn) livesIncBtn.addEventListener('click', ()=> setLives(lives + 1));
  if (livesDecBtn) livesDecBtn.addEventListener('click', ()=> setLives(lives - 1));

  // modal actions removed

  // initialize state
  resetGame();
  // global key handler so Enter can start game anytime, letters pop when playing
  window.addEventListener('keydown', handleKey);

  // Stop background on unload/visibility change
  window.addEventListener('beforeunload', stopBg);
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) stopBg(); else if (playing) startBg(); });

  // Do not auto-start when on the dedicated full-screen page; show intro overlay
  if (document.body && document.body.dataset && document.body.dataset.page === 'balloon-full') {
    // allow layout to settle before measuring/spawning
    setTimeout(() => { resetGame(); }, 50);
    setupClouds();
  }

  function setupClouds(){
    if (!cloudLayer) return;
    cloudLayer.innerHTML = '';
    const make = (delay, top, scale, dur)=>{
      const c = document.createElement('div');
      c.className = 'cloud';
      c.style.top = `${top}%`;
      c.style.setProperty('--scale', `${scale}`);
      c.style.animationDuration = `${dur}s`;
      // negative animationDelay to pre-fill sky across the whole animation path
      c.style.animationDelay = `${-delay}s`;
      // SVG cloud path (closed shape to ensure back joins baseline cleanly)
      c.innerHTML = `
        <svg viewBox="0 0 220 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path d="M40,84
                   C28,84 20,76 20,66
                   C20,56 28,48 38,48
                   C42,36 56,30 70,32
                   C78,24 94,22 108,26
                   C118,22 136,24 146,32
                   C158,30 170,36 178,46
                   C196,44 208,56 208,70
                   C206,82 192,94 172,98
                   C144,104 116,104 92,102
                   C72,100 56,96 44,92
                   C42,90 40,88 40,84 Z"/>
        </svg>`;
      cloudLayer.appendChild(c);
    };
    // Clouds spread more naturally across the sky; negative delays scatter them initially
    for (let i=0;i<8;i++){
      const delay = Math.random()*70; // higher range spreads more initial positions
      const top = 10 + Math.random()*70; // 10%..80%
      const scale = 0.85 + Math.random()*0.4; // 0.85..1.25
      const dur = 55 + Math.random()*20; // 55..75s
      make(delay, top, scale, dur);
    }
  }

  function celebrationExplosion(cx, cy){
    try {
      const layerId = 'explosion-layer';
      let layer = document.getElementById(layerId);
      if (!layer) {
        layer = document.createElement('div');
        layer.id = layerId;
        board.appendChild(layer);
      }
      const rect = board.getBoundingClientRect();
      const x0 = cx != null ? cx : rect.width / 2;
      const y0 = cy != null ? cy : rect.height / 2;
      const colors = ['#ffd166','#06d6a0','#118ab2','#ef476f','#ffe66d'];
      for (let i=0;i<38;i++){
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random()*Math.PI*2;
        const dist = 90 + Math.random()*140;
        const dx = Math.cos(angle)*dist;
        const dy = Math.sin(angle)*dist;
        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);
        p.style.setProperty('--pcolor', colors[i%colors.length]);
        p.style.left = `${x0}px`; p.style.top = `${y0}px`;
        layer.appendChild(p);
        setTimeout(()=> p.remove(), 950);
      }
    } catch {}
  }

})();
