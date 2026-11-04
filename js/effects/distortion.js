export function mountDistortion(store) {
  let timer;
  let soundTimer;
  const audio = document.querySelector('#glitch-sound');
  if (audio) audio.volume = 0.2;
  function stopSound() {
    clearTimeout(soundTimer);
    if (audio) { audio.pause(); audio.currentTime = 0; }
  }
  function playSound() {
    if (!audio) return;
    stopSound();
    try { audio.play()?.catch(() => {}); } catch { /* A blocked cue cannot interrupt reconciliation. */ }
    soundTimer = setTimeout(stopSound, 1500);
  }
  window.addEventListener('pagehide', stopSound);
  function update(state) {
    document.documentElement.dataset.distortion = String(state.distortionLevel);
    document.querySelector('#integrity').textContent = state.distortionLevel ? 'Interface integrity: minor variance' : 'Interface integrity: nominal';
  }
  update(store.getState());
  store.subscribe(update);
  store.onEvent(({ type }) => {
    if (type === 'hilfer:case-reconciled') {
      document.documentElement.classList.add('microglitch');
      clearTimeout(timer);
      timer = setTimeout(() => document.documentElement.classList.remove('microglitch'), 650);
      playSound();
    }
    if (type === 'hilfer:progress-reset') {
      clearTimeout(timer); document.documentElement.classList.remove('microglitch');
      stopSound();
    }
  });
}
