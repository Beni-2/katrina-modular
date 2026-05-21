// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// âš  DO NOT DELETE â€" KATRINA WINDOW MANAGER
//
//  Wraps existing panels in draggable floating windows.
//  All existing IDs, functions, CSS classes untouched.
//  Windows can be: dragged, minimized, maximized, closed (hides to dock).
//  Focused window comes to front (z-index raised).
//  Last position/size remembered per session via window._wmState.
//  ESC does NOT affect windows (reserved for IQ mode exit only).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

window._wmState = {};   // { winId: {x,y,w,h,minimized,maximized} }
let _wmTopZ = 7000;

// â"€â"€ Window definitions â€" maps window id â†' panel id + config â"€â"€
const WM_WINDOWS = [
  // Brain stat bars — left column
  { id:'win-brain',    panel:'hud',          title:'⬡ BRAIN · NEURAL STATE',    dock:'dock-brain',
    defaultPos:{left:10,top:10},     defaultSize:{width:250,height:380} },
  // Emotions panel — left column below brain
  { id:'win-emotions', panel:'emotions-hud', title:'⬡ EMOTIONS · LAYER SYSTEM', dock:'dock-emotions',
    defaultPos:{left:10,top:400},    defaultSize:{width:250,height:260} },
  // Region activity — starts minimized, restore from dock
  { id:'win-regions',  panel:'hud-right',    title:'⬡ REGION ACTIVITY',          dock:'dock-regions',
    defaultPos:{left:Math.max(0,window.innerWidth-260),top:10}, defaultSize:{width:240,height:340}, startMinimized:true },
  // Personality panel — starts minimized, restore from dock when needed
  { id:'win-persona',  panel:'panel-column', title:'⬡ PERSONALITY · IDENTITY',  dock:'dock-persona',
    defaultPos:{left:270,top:10},    defaultSize:{width:680,height:Math.min(660,window.innerHeight-80)}, startMinimized:true },
  // CHAT — primary window, always visible, top-centre
  { id:'win-chat',     panel:'dialog-wrap',  title:'⬡ KATRINA INTERFACE · CHAT', dock:'dock-chat',
    defaultPos:{left:270,top:10},    defaultSize:{width:680,height:Math.min(660,window.innerHeight-80)} },
  // Identity / face recognition — starts minimized
  { id:'win-identity', panel:'id-wrap',      title:'⬡ IDENTITY · RECOGNITION',  dock:'dock-identity',
    defaultPos:{left:Math.max(0,window.innerWidth-260),top:10}, defaultSize:{width:245,height:480}, startMinimized:true },
  // Experiential learning — starts minimized
  { id:'win-learn',    panel:'win-learn-panel', title:'⬡ EXPERIENTIAL LEARNING · NEURAL INPUT', dock:'dock-learn',
    defaultPos:{left:270,top:10},    defaultSize:{width:680,height:Math.min(560,window.innerHeight-80)}, startMinimized:true },
  // ⚠ DO NOT DELETE — synoptics window wraps the Three.js brain canvas.
  { id:'win-synoptics', panel:'three-canvas-wrap', title:'🔮 BRAIN SYNOPTICS · NEURAL VISUALIZATION', dock:'dock-synoptics',
    defaultPos:{left:0,top:0}, defaultSize:{width:window.innerWidth,height:window.innerHeight-52} },
];

function wmInit() {
  WM_WINDOWS.forEach(cfg => {
    const panel = document.getElementById(cfg.panel);
    if (!panel) return;

    // Create window frame
    const win = document.createElement('div');
    win.className = 'wm-window';
    win.id = cfg.id;
    win.style.left   = cfg.defaultPos.left  + 'px';
    win.style.top    = cfg.defaultPos.top   + 'px';
    win.style.width  = cfg.defaultSize.width  + 'px';
    win.style.height = cfg.defaultSize.height + 'px';

    // Title bar
    const tbar = document.createElement('div');
    tbar.className = 'wm-titlebar';
    tbar.innerHTML =
      `<div class="wm-title">${cfg.title}</div>` +
      `<div class="wm-controls">` +
        `<button class="wm-btn minimize" onclick="wmMinimize('${cfg.id}')" title="Minimize"></button>` +
        `<button class="wm-btn maximize" onclick="wmMaximize('${cfg.id}')" title="Maximize"></button>` +
        `<button class="wm-btn close"    onclick="wmClose('${cfg.id}')"    title="Close"></button>` +
      `</div>`;

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'wm-content';

    // Move panel INTO window
    panel.parentNode.insertBefore(win, panel);
    content.appendChild(panel);
    win.appendChild(tbar);
    win.appendChild(content);
    document.body.appendChild(win);

    // Strip old fixed positioning from panels so window controls them
    panel.style.position = 'relative';
    panel.style.top      = '';
    panel.style.left     = '';
    panel.style.right    = '';
    panel.style.zIndex   = '';

    // Start minimized if config says so (restore via dock)
    if (cfg.startMinimized) {
      win.classList.add('minimized');
      _wmUpdateDock(cfg.id, false, true);
    } else {
      _wmUpdateDock(cfg.id, true);
    }

    // Focus on click
    win.addEventListener('mousedown', () => wmFocus(cfg.id), true);

    // Drag
    wmMakeDraggable(win, tbar);
  });

  // Special: emotions-hud was positioned by JS â€" neutralise that
  const eHud = document.getElementById('emotions-hud');
  if (eHud) { eHud.style.top = ''; eHud.style.position = 'relative'; }

  // â"€â"€ Synoptics canvas window is registered separately via wmInitSynoptics() â"€â"€
  // âš  DO NOT DELETE â€" the Three.js canvas does not exist at wmInit time because
  // initThree() runs after wmInit. wmInitSynoptics() is called from window.onload
  // after initThree() completes, wraps the canvas then, and creates the window.

  // â"€â"€ Apply setLearnProgress patch here â€" inside wmInit, after all functions defined â"€â"€
  // âš  DO NOT DELETE â€" patches setLearnProgress to mirror progress into the
  // dedicated learn window (wl-progress-text, wl-progress-fill, wl-log).
  // Must run here, not at script-parse time, because setLearnProgress is
  // defined much later in the file and would be undefined at parse time.
  if (typeof setLearnProgress === 'function' && !setLearnProgress._wlPatched) {
    const _origSLP = setLearnProgress;
    setLearnProgress = function(msg, pct) {
      _origSLP(msg, pct);
      const txt  = document.getElementById('wl-progress-text');
      const fill = document.getElementById('wl-progress-fill');
      if (txt) txt.textContent = msg || 'ready â€" waiting for input';
      if (fill) {
        fill.style.width = (pct !== undefined ? Math.min(100, pct) : 0) + '%';
        if (msg && msg.includes('âš ')) {
          fill.style.background = 'linear-gradient(90deg,#ff4444,#ff8844)';
        } else if (pct >= 100 || (msg && (msg.includes('âœ"') || msg.includes('complete')))) {
          fill.style.background = 'linear-gradient(90deg,#44ff88,#00ffc8)';
        } else {
          fill.style.background = 'linear-gradient(90deg,#6644ff,#ff9966,#aa66ff)';
        }
      }
      if (msg && (msg.includes('âœ"') || msg.includes('âš ') || msg.includes('complete') || pct >= 100)) {
        const log = document.getElementById('wl-log');
        if (log) {
          const ph = log.querySelector('span[style*="font-style:italic"]');
          if (ph) log.innerHTML = '';
          const entry = document.createElement('div');
          entry.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.05);padding:3px 0;font-size:8px;';
          const dot = msg.includes('âš ') ? 'ðŸ"´' : 'ðŸŸ¢';
          entry.style.color = msg.includes('âš ') ? '#ff6644' : '#8866ff';
          entry.textContent = dot + ' ' + new Date().toLocaleTimeString() + ' â€" ' + msg;
          log.insertBefore(entry, log.firstChild);
        }
      }
    };
    setLearnProgress._wlPatched = true;
  }

  // Auto-clamp windows to viewport on init
  _wmClampAll();
}

// â"€â"€ Focus â"€â"€
function wmFocus(winId) {
  _wmTopZ++;
  const win = document.getElementById(winId);
  if (win) win.style.zIndex = _wmTopZ;
  document.querySelectorAll('.wm-window').forEach(w => w.classList.remove('focused'));
  if (win) win.classList.add('focused');
  _wmUpdateDock(winId, true);
}

// â"€â"€ Minimize â"€â"€
function wmMinimize(winId) {
  const win = document.getElementById(winId);
  if (!win) return;
  win.classList.add('minimized');
  win.classList.remove('maximized');
  _wmUpdateDock(winId, false, true);
  if (winId === 'win-synoptics') document.body.classList.add('synoptics-hidden');
}

// â"€â"€ Maximize / restore â"€â"€
function wmMaximize(winId) {
  const win = document.getElementById(winId);
  if (!win) return;
  if (win.classList.contains('maximized')) {
    win.classList.remove('maximized');
    const s = window._wmState[winId];
    if (s) { win.style.left=s.x+'px'; win.style.top=s.y+'px'; win.style.width=s.w+'px'; win.style.height=s.h+'px'; }
  } else {
    window._wmState[winId] = {
      x: parseInt(win.style.left)||0, y: parseInt(win.style.top)||0,
      w: win.offsetWidth, h: win.offsetHeight,
    };
    win.classList.add('maximized');
  }
  wmFocus(winId);
}

// â"€â"€ Close (hides to dock) â"€â"€
function wmClose(winId) {
  const win = document.getElementById(winId);
  if (!win) return;
  win.classList.add('minimized');
  win.classList.remove('maximized');
  _wmUpdateDock(winId, false, true);
  if (winId === 'win-synoptics') document.body.classList.add('synoptics-hidden');
}

// â"€â"€ Restore from dock â"€â"€
function wmRestore(winId) {
  const win = document.getElementById(winId);
  if (!win) return;
  win.classList.remove('minimized');
  wmFocus(winId);
  _wmUpdateDock(winId, true, false);
  if (winId === 'win-synoptics') document.body.classList.remove('synoptics-hidden');
}

// â"€â"€ Dock dot state â"€â"€
function _wmUpdateDock(winId, open, minimized) {
  const cfg  = WM_WINDOWS.find(w => w.id === winId);
  if (!cfg) return;
  const icon = document.getElementById(cfg.dock);
  if (!icon) return;
  const dot  = icon.querySelector('.dock-dot');
  if (!dot) return;
  if (open && !minimized) {
    icon.classList.add('active'); icon.classList.remove('minimized');
    dot.style.background = '#ff69b4';
  } else if (minimized) {
    icon.classList.remove('active'); icon.classList.add('minimized');
    dot.style.background = '#ffd700';
  } else {
    icon.classList.remove('active','minimized');
    dot.style.background = 'rgba(255,255,255,0.2)';
  }
}

// â"€â"€ Drag â"€â"€
function wmMakeDraggable(win, handle) {
  let _dx = 0, _dy = 0, _dragging = false;

  handle.addEventListener('mousedown', e => {
    if (e.target.classList.contains('wm-btn')) return;
    e.preventDefault();
    _dragging = true;
    _dx = e.clientX - win.getBoundingClientRect().left;
    _dy = e.clientY - win.getBoundingClientRect().top;
    wmFocus(win.id);
  });

  document.addEventListener('mousemove', e => {
    if (!_dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth  - 80,  e.clientX - _dx));
    const y = Math.max(0, Math.min(window.innerHeight - 80,  e.clientY - _dy));
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
  });

  document.addEventListener('mouseup', () => { _dragging = false; });
}

// â"€â"€ Clamp all windows to viewport â"€â"€
function _wmClampAll() {
  document.querySelectorAll('.wm-window').forEach(win => {
    const rect = win.getBoundingClientRect();
    if (rect.left < 0) win.style.left = '10px';
    if (rect.top  < 0) win.style.top  = '10px';
    const maxL = window.innerWidth  - 80;
    const maxT = window.innerHeight - 80;
    if (parseInt(win.style.left) > maxL) win.style.left = maxL + 'px';
    if (parseInt(win.style.top)  > maxT) win.style.top  = maxT + 'px';
  });
}

// â"€â"€ Init after DOM is ready â"€â"€
// positionEmotionsHUD is called from window.onload â€" wmInit runs after it
// so it can neutralise the position it set.
window.addEventListener('load', () => {
  setTimeout(() => {
    // Make win-learn-panel visible before WM wraps it
    const lp = document.getElementById('win-learn-panel');
    if (lp) lp.style.display = 'block';
    wmInit();
  }, 200);
});

// â"€â"€ Learning window bridge functions â"€â"€
// âš  DO NOT DELETE â€" these route the dedicated learn window's inputs
// to the existing learnFromURL / learnFromFile / learnFromTopic functions
// and mirror progress output into the window's own progress elements.

function _wlSetProgress(msg, pct) {
  // Mirror to existing learn-progress (inside persona panel)
  if (typeof setLearnProgress === 'function') setLearnProgress(msg, pct);
  // Also update dedicated window progress
  const txt  = document.getElementById('wl-progress-text');
  const bar  = document.getElementById('wl-progress-bar-outer');
  const fill = document.getElementById('wl-progress-fill');
  if (txt)  txt.textContent = msg || '';
  if (bar)  bar.style.display = (pct !== undefined) ? 'block' : 'none';
  if (fill && pct !== undefined) fill.style.width = pct + '%';
  // Append to log if it is a completion or error message
  if (msg && (msg.includes('âœ"') || msg.includes('âš ') || msg.includes('complete'))) {
    const log = document.getElementById('wl-log');
    if (log) {
      if (log.querySelector('span[style*="color:#334"]')) log.innerHTML = '';
      const entry = document.createElement('div');
      entry.style.cssText = 'border-bottom:1px solid rgba(255,255,255,0.05);padding:3px 0;';
      entry.textContent = new Date().toLocaleTimeString() + ' â€" ' + msg;
      log.insertBefore(entry, log.firstChild);
    }
  }
}


// â"€â"€ Patch setLearnProgress to update the dedicated learn window â"€â"€
// âš  DO NOT DELETE â€" this patch is applied inside wmInit() which runs after
// all functions are defined. Patching here at script-parse time would fail
// because setLearnProgress is defined further down in the file.
// The actual patch code lives inside wmInit() below.
function _wlLearnURL() {
  const wlInp  = document.getElementById('wl-url-input');
  const origInp= document.getElementById('learn-url-input');
  if (wlInp && origInp) origInp.value = wlInp.value;
  if (wlInp) wlInp.value = '';
  learnFromURL();
}

function _wlLearnTopic() {
  const wlInp  = document.getElementById('wl-topic-input');
  const origInp= document.getElementById('learn-topic-input');
  if (wlInp && origInp) origInp.value = wlInp.value;
  if (wlInp) wlInp.value = '';
  learnFromTopic();
}

// âš  DO NOT DELETE â€" Channel 4 paste-text learning.
async function _wlLearnPasted() {
  const ta = document.getElementById('wl-paste-input');
  if (!ta || !ta.value.trim()) {
    if (typeof setLearnProgress === 'function') setLearnProgress('âš  Paste some text first before pressing Learn.', 0);
    return;
  }
  const text = ta.value.trim();
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 10) {
    if (typeof setLearnProgress === 'function') setLearnProgress('âš  Text too short â€" paste at least a paragraph.', 0);
    return;
  }
  ta.value = '';
  if (typeof setLearnProgress === 'function') setLearnProgress(`Reading pasted text (${wordCount} words)â€¦`, 8);
  try {
    await learnFromTranscript(text, 'pasted-text');
  } catch(e) {
    if (typeof setLearnProgress === 'function') setLearnProgress('âš  Paste learning error: ' + e.message, 0);
  }
}

// â"€â"€ Re-clamp on resize â"€â"€
window.addEventListener('resize', _wmClampAll);

// â"€â"€ World engine toggle â"€â"€
// âš  DO NOT DELETE â€" directly switches the renderer between brain scene
// and world scene. Independent of synoptics window state.
// ðŸŒ dock icon calls this. Click once = world engine. Click again = brain.
// âš  DO NOT DELETE â€" _toggleWorldEngine: opens/closes world engine overlay.
// World engine uses its OWN canvas+renderer. No scene sharing with brain.
function _toggleWorldEngine() {
  const ov = document.getElementById('we-overlay');
  if (!ov) return;
  const visible = ov.style.display === 'flex';
  const icon = document.getElementById('dock-world');
  const dot  = icon ? icon.querySelector('.dock-dot') : null;
  if (!visible) {
    ov.style.display = 'flex';
    if (dot)  dot.style.background = '#44ff88';
    if (icon) icon.classList.add('active');
    if (typeof WE_init === 'function' && !window._weInitDone) {
      window._weInitDone = true; WE_init();
    } else if (window._weRenderer) {
      window._weRenderer.setAnimationLoop(WE_loop);
    }
    setTimeout(() => {
      if (typeof _weSyncChat === 'function')        _weSyncChat();
      if (typeof _wePopulateIdentity === 'function') _wePopulateIdentity();
      if (typeof _weResizeCanvas === 'function')     _weResizeCanvas();
    }, 100);
  } else {
    ov.style.display = 'none';
    if (dot)  dot.style.background = 'rgba(255,255,255,0.2)';
    if (icon) icon.classList.remove('active');
    if (window._weRenderer) window._weRenderer.setAnimationLoop(null);
  }
}

// âš  DO NOT DELETE â€" wmInitSynoptics: wraps the Three.js brain canvas in a
// floating WM window. Called from window.onload AFTER initThree() so the
// canvas exists. Cannot run inside wmInit because canvas is not ready then.
function wmInitSynoptics() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) { console.warn('[WM] three-canvas not found â€" synoptics skipped'); return; }

  // 1. Create wrapper div around the canvas
  const wrap = document.createElement('div');
  wrap.id = 'three-canvas-wrap';
  wrap.style.cssText = 'width:100%;height:100%;overflow:hidden;background:#020208;position:relative;';
  canvas.parentNode.insertBefore(wrap, canvas);
  wrap.appendChild(canvas);
  canvas.style.cssText = 'width:100%;height:100%;display:block;position:absolute;top:0;left:0;';

  // 2. Build the WM window frame
  const cfg = WM_WINDOWS.find(w => w.id === 'win-synoptics');
  if (!cfg) return;

  const win = document.createElement('div');
  win.className = 'wm-window';
  win.id = 'win-synoptics';
  // Start maximised â€" full screen, same as the canvas was before
  win.style.left   = '0px';
  win.style.top    = '0px';
  win.style.width  = window.innerWidth + 'px';
  win.style.height = (window.innerHeight - 52) + 'px';

  const tbar = document.createElement('div');
  tbar.className = 'wm-titlebar';
  tbar.innerHTML =
    `<div class="wm-title">${cfg.title}</div>` +
    `<div class="wm-controls">` +
      `<button class="wm-btn minimize" onclick="wmMinimize('win-synoptics')" title="Minimize â€" frees main screen for world engine"></button>` +
      `<button class="wm-btn maximize" onclick="wmMaximize('win-synoptics')" title="Maximize"></button>` +
      `<button class="wm-btn close"    onclick="wmClose('win-synoptics')"    title="Close â€" frees main screen for world engine"></button>` +
    `</div>`;

  const content = document.createElement('div');
  content.className = 'wm-content';
  content.style.cssText = 'overflow:hidden;padding:0;flex:1;position:relative;';
  content.appendChild(wrap);

  win.appendChild(tbar);
  win.appendChild(content);
  document.body.appendChild(win);

  // Focus on click
  win.addEventListener('mousedown', () => wmFocus('win-synoptics'), true);
  wmMakeDraggable(win, tbar);
  _wmUpdateDock('win-synoptics', true, false);

  // 3. ResizeObserver â€" keeps renderer sharp when window is resized
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (typeof renderer !== 'undefined' && renderer) {
        const w = content.clientWidth  || window.innerWidth;
        const h = content.clientHeight || (window.innerHeight - 52);
        renderer.setSize(w, h, false);
        // Update brain camera
        if (typeof camera !== 'undefined' && camera) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        // World engine has its own resize listener â€" no action needed here
      }
    }).observe(content);
  }

  console.log('[WM] Synoptics window initialised');
  // World engine initialises independently via _toggleWorldEngine â†' WE_init
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END KATRINA WINDOW MANAGER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
