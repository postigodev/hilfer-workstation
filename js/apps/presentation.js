import {drainEffects} from '../core/effects.js';

// Fixed adapters reuse existing authored presentation. No effect can supply an arbitrary URL or script.
export function mountPresentation(store,{assistant}) {
  const active=new Set(),cleanup=new Set(),dialogues=new Set();let scheduled=false,disposed=false,animationTimer;
  const stop=()=>{
    for(const c of active)c.abort();for(const fn of [...cleanup])fn();
    for(const signal of dialogues)assistant.cancelSignal(signal);dialogues.clear();
    clearTimeout(animationTimer);document.documentElement.classList.remove('engine-microglitch');
  };
  const handlers={
    dialogue:effect=>{
      const fresh=!assistant.hasDelivered(effect.signal),accepted=assistant.deliverSignal(effect.signal);
      if(accepted && fresh)dialogues.add(effect.signal);return accepted;
    },
    audio:async(effect,{signal})=>{
      if(effect.signal!=='glitch-cue' || signal.aborted) return false;
      const audio=new Audio('assets/sounds/glitch.mp3');audio.volume=0.2;let timer;
      const end=()=>{clearTimeout(timer);audio.pause();audio.currentTime=0;cleanup.delete(end);signal.removeEventListener('abort',end);};
      cleanup.add(end);signal.addEventListener('abort',end,{once:true});
      try {await audio.play();if(signal.aborted){end();return false;}timer=setTimeout(end,1500);return true;}
      catch {end();return false;}
    },
    animation:effect=>{
      if(effect.signal!=='microglitch') return false;
      document.documentElement.classList.add('engine-microglitch');clearTimeout(animationTimer);
      animationTimer=setTimeout(()=>document.documentElement.classList.remove('engine-microglitch'),650);return true;
    }
  };
  const schedule=()=>{
    if(scheduled || disposed) return; scheduled=true;
    void Promise.resolve().then(async()=>{
      scheduled=false;if(disposed) return;
      const controller=new AbortController();active.add(controller);
      try {await drainEffects(store,handlers,{signal:controller.signal});}
      finally {active.delete(controller);}
    });
  };
  const off=store.subscribe(schedule);
  const offEvents=store.onEngineEvent(({type})=>{
    if(['hilfer:progress-reset','hilfer:access-changed','hilfer:availability-changed'].includes(type)) {
      stop();
    }
  });
  schedule();return ()=>{disposed=true;stop();off();offEvents();};
}
