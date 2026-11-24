// Adapted from april-hpxd/HILFER at fe5c681a3478c3513d308213f20834de02de33e5.
// Only cosmetic desktop/mail/dead-pixel effects; source content and approvals are unchanged.
// Reusable scripted-glitch system. Visual narrative events only — never mutates game/case
// state, evidence, resolutions or Mail content. See docs/INTEGRATION.md "Glitch system".
//
// Glitch 1 (`desktop_distortion`) is the one-time, desktop-wide distortion on first-case
// completion; it also advances the shared AI-state/wallpaper (js/effects/ai-state.js) partway
// through its sequence so the portrait + wallpaper swap lands mid-glitch, not before/after it.
// Mail echoes/errors remain transient visual layers; the unapproved footage interruption
// adds a separate simulated cursor and temporary, unsent draft window.
export const GLITCH_SAVE_KEY = 'hilfer:glitches:v1';

function loadGlitchSave(storage) {
  try {
    const raw = storage?.getItem(GLITCH_SAVE_KEY);
    if (!raw) return { version: 1, triggered: [] };
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.triggered)) throw new Error('Incompatible');
    return { version: 1, triggered: saved.triggered.filter(id => typeof id === 'string') };
  } catch { return { version: 1, triggered: [] }; }
}
function saveGlitchSave(storage, data) {
  try { storage?.setItem(GLITCH_SAVE_KEY, JSON.stringify(data)); } catch { /* UI-only state; session play continues. */ }
}

function playOnce(audio, { volume = 0.25, duration } = {}) {
  if (!audio) return () => {};
  audio.pause(); audio.currentTime = 0; audio.volume = volume;
  let timer;
  try { audio.play()?.catch(error => console.warn('Could not play glitch cue.', error)); }
  catch (error) { console.warn('Could not play glitch cue.', error); }
  if (duration) timer = setTimeout(() => { audio.pause(); audio.currentTime = 0; }, duration);
  return () => { clearTimeout(timer); audio.pause(); audio.currentTime = 0; };
}

// `root` is the element new glitch windows are appended to (#desktop).
export function mountGlitchSystem(store, { storage, root, sounds = {} } = {}) {
  let data = loadGlitchSave(storage);
  const activeCleanups = new Map();
  let deadPixelField = null;

  function updateDeadPixels(level) {
    const count = Math.max(0, Math.min(4, Number(level) || 0));
    if (deadPixelField) deadPixelField.remove();
    deadPixelField = null;
    if (!root || count === 0) return;
    deadPixelField = document.createElement('div');
    deadPixelField.className = 'dead-pixel-field';
    deadPixelField.setAttribute('aria-hidden', 'true');
    const pixelCount = count * 9;
    for (let index = 0; index < pixelCount; index += 1) {
      const pixel = document.createElement('span');
      const x = (index * 47 + count * 31) % 97;
      const y = (index * 73 + count * 19) % 96;
      const size = 1 + ((index + count) % 3);
      pixel.style.left = x + '%';
      pixel.style.top = y + '%';
      pixel.style.width = size + 'px';
      pixel.style.height = size + 'px';
      const isBlack = index % 4 === 0;
      const colors = ['#ff3158', '#18ee79', '#397dff'];
      const color = isBlack ? '#050505' : colors[index % colors.length];
      pixel.dataset.deadPixel = isBlack ? 'black' : 'rgb';
      pixel.style.backgroundColor = color;
      pixel.style.color = color;
      deadPixelField.appendChild(pixel);
    }
    root.appendChild(deadPixelField);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hilfer:ai-state-changed', event => {
      updateDeadPixels(event.detail?.state ?? 0);
    });
  }
  updateDeadPixels(typeof document !== 'undefined' ? document.documentElement?.dataset?.aiState ?? 0 : 0);

  function persist() { saveGlitchSave(storage, data); }
  function hasTriggered(id) { return data.triggered.includes(id); }
  function markTriggered(id) { if (!hasTriggered(id)) { data.triggered.push(id); persist(); } }

  // `cancel` runs BEFORE a trigger function touches any shared DOM/state, never after: calling
  // it after the new instance has already set things up would replay the previous invocation's
  // cleanup on top of fresh state. Each trigger function calls `cancel(id)` first, does its
  // setup, then `register(id, cleanup)` — never a combined "run" helper.
  function cancel(id) { activeCleanups.get(id)?.(); activeCleanups.delete(id); }
  function register(id, cleanup) { activeCleanups.set(id, cleanup); }

  // --- Glitch 1: one-time desktop-wide distortion on first case completion ---------------
  // Stage timing matches the desktopGlitchShift/Overlay/Jitter keyframes in css/hilfer.css
  // (~3.4s total). Stage 4 (AI portrait + wallpaper swap) fires at the ~50% mark, where the
  // CSS sequence briefly settles ("quiet beat") before escalating again — so the asset swap
  // itself is not masked by heavy distortion, while the glitch continues around it.
  function triggerDesktopDistortion({ onMidpoint } = {}) {
    if (!root) return false;
    cancel('desktop-distortion');
    const desktop = root.id === 'desktop' ? root : root.closest('#desktop');
    if (!desktop) return false;
    const overlay = document.createElement('div');
    overlay.className = 'desktop-glitch-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    desktop.appendChild(overlay);
    desktop.classList.add('desktop-glitch-active');
    const timers = [];
    timers.push(setTimeout(() => { try { onMidpoint?.(); } catch (error) { console.warn('AI-state swap failed.', error); } }, 1700));
    function cleanup() {
      desktop.classList.remove('desktop-glitch-active');
      overlay.remove();
    }
    timers.push(setTimeout(cleanup, 3500));
    register('desktop-distortion', () => { timers.forEach(clearTimeout); cleanup(); });
    return true;
  }

  // --- Glitch 2: email window multiplication ---------------------------------------------
  // Spawns short-lived visual echoes only; no real window IDs are registered with the
  // shell's window manager, so focus/taskbar/z-index/persistence are all untouched.
  function triggerEmailMultiplication({ sourceWindow, count = 9 } = {}) {
    if (!root || !sourceWindow) return false;
    cancel('email-multiplication');
    const stopSound = playOnce(sounds.staticHum, { volume: 0.22, duration: 2600 });
    const echoes = [];
    const baseRect = { width: sourceWindow.offsetWidth || 420, height: sourceWindow.offsetHeight || 320 };
    const baseLeft = parseFloat(sourceWindow.style.left) || 120;
    const baseTop = parseFloat(sourceWindow.style.top) || 90;
    const content = sourceWindow.querySelector('.mail-message-content')?.innerHTML ?? '';
    const title = (sourceWindow.querySelector('.window-title')?.textContent ?? 'Message').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
    const timers = [];
    let spawned = 0;
    function spawnOne(index) {
      const echo = document.createElement('section');
      echo.className = 'window visible mail-message-window glitch-window-echo';
      echo.setAttribute('aria-hidden', 'true');
      echo.inert = true;
      echo.style.pointerEvents='none';
      const offset = 26 * (index + 1);
      Object.assign(echo.style, {
        width: baseRect.width + 'px', height: baseRect.height + 'px',
        left: (baseLeft + offset) + 'px', top: (baseTop + offset) + 'px',
        zIndex: 99990 + index
      });
      echo.innerHTML = `<div class="window-header"><span class="window-title">${title}</span></div><div class="window-content mail-message-content">${content}</div>`;
      root.appendChild(echo);
      echoes.push(echo);
      requestAnimationFrame(() => echo.classList.add('glitch-window-echo-in'));
    }
    const spawnInterval = setInterval(() => {
      if (spawned >= count) { clearInterval(spawnInterval); return; }
      spawnOne(spawned); spawned += 1;
    }, 110);
    timers.push(spawnInterval);
    const cleanupTimer = setTimeout(() => {
      clearInterval(spawnInterval);
      echoes.forEach((echo, index) => {
        const closeAt = index * 60;
        timers.push(setTimeout(() => echo.remove(), closeAt));
      });
    }, 3400);
    timers.push(cleanupTimer);
    const finalTimer = setTimeout(() => { echoes.forEach(echo => echo.remove()); stopSound(); }, 5000);
    timers.push(finalTimer);
    register('email-multiplication', () => { timers.forEach(clearTimeout); clearInterval(spawnInterval); echoes.forEach(echo => echo.remove()); stopSound(); });
    return true;
  }

  const definitions = {
    desktop_distortion: triggerDesktopDistortion,
    email_multiplication: triggerEmailMultiplication,
  };

  // `key` distinguishes repeatable instances of the same glitch (e.g. one per email id);
  // defaults to `id` for a fire-once-ever glitch.
  function triggerGlitch(id, { key = id, payload, once = true } = {}) {
    const handler = definitions[id];
    if (!handler) { console.warn(`Unknown glitch "${id}".`); return false; }
    if (once && hasTriggered(key)) return false;
    if (handler(payload) === false) return false;
    if (once) markTriggered(key);
    return true;
  }

  function resetGlitches() {
    for (const cleanup of activeCleanups.values()) cleanup();
    activeCleanups.clear();
    if (deadPixelField) deadPixelField.remove();
    deadPixelField = null;
    data = { version: 1, triggered: [] };
    persist();
  }

  store.onEvent(({ type }) => {
    if (type === 'hilfer:progress-reset') resetGlitches();
  });

  // A navigation/reload can interrupt a scripted sequence before its normal final timer.
  // Clear transient layers and stop the owned audio immediately; persistent milestones have
  // already been saved independently and will render normally after the next boot.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      for (const cleanup of activeCleanups.values()) cleanup();
      activeCleanups.clear();
    }, { once: true });
  }

  return { triggerGlitch, hasTriggered, resetGlitches, cancelAll() { for (const fn of activeCleanups.values()) fn(); activeCleanups.clear(); } };
}

