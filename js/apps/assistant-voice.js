// Dialogue checkpoint adapted from Lyden King's Assistant integration.
export function createAssistantVoice(storage, caseId, {
  audio = typeof Audio === 'function' ? new Audio() : null
} = {}) {
  const key = 'hilfer:assistant-dialogue:v1';
  const completed = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null');
    if (saved?.version === 1 && saved.caseId === caseId && Array.isArray(saved.completedIds)) {
      for (const id of saved.completedIds) if (typeof id === 'string') completed.add(id);
    }
  } catch { /* Unavailable storage still permits narration. */ }

  if (audio) audio.preload = 'none';
  let run = 0;
  let activeId = null;
  let muted = false;
  function stop() {
    run++;
    activeId = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }

  return {
    setMuted(value) { muted=Boolean(value);if(audio)audio.muted=muted;if(muted)stop(); },
    stop,
    cancelCue(id) { if(activeId===id) stop(); },
    reset() {
      stop();
      completed.clear();
      try { storage?.removeItem(key); } catch { /* Session reset still works. */ }
    },
    play(cue, {onError = () => {}, onEnded = () => {}} = {}) {
      if (!audio || !cue || completed.has(cue.id) || activeId !== null) return;
      stop();
      const token = run;
      activeId = cue.id;
      const fail = error => {
        if (token !== run) return;
        stop();
        onError(error);
      };
      audio.onended = () => {
        if (token !== run) return;
        activeId = null;
        completed.add(cue.id);
        try {
          storage?.setItem(key, JSON.stringify({version:1, caseId, completedIds:[...completed]}));
        } catch { /* Session checkpoint still works. */ }
        onEnded();
      };
      audio.onerror = fail;
      audio.src = cue.src;
      // Start within the gesture that opened the balloon.
      try { audio.play()?.catch(fail); } catch (error) { fail(error); }
    }
  };
}
