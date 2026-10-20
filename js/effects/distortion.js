export function mountDistortion(store) {
  let timer;
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
    }
    if (type === 'hilfer:progress-reset') {
      clearTimeout(timer); document.documentElement.classList.remove('microglitch');
    }
  });
}
