import {mountGlitchSystem} from './altynai.js';
// Presentation adapter for accepted engine effects. No gameplay commands or UI controls.
export function mountContrastEffects(store) {
  const root=document.documentElement,jobs=new Map();let audio;
  const upstream=mountGlitchSystem(store,{root:document.querySelector('#desktop')});
  let previousDepth=-1;
  const cancel=id=>{const job=jobs.get(id);if(job){clearTimeout(job.timer);job.cleanup();jobs.delete(id);}};
  const stop=()=>{for(const id of [...jobs.keys()])cancel(id);audio?.pause();upstream.cancelAll();};
  const clock=document.querySelector('#clock');
  function apply() {
    const depth=Object.keys(store.getSnapshot().facts.inferences).length;
    root.dataset.contrastDepth=String(Math.min(2,depth));
    const level=Math.min(4,depth);
    if(level!==previousDepth){previousDepth=level;root.dataset.aiState=String(level);window.dispatchEvent(new CustomEvent('hilfer:ai-state-changed',{detail:{state:level}}));}
    const face=document.querySelector('.ai-avatar');
    if(depth&&face)face.src='assets/arwa/final/assistant-'+(depth>2?'obstructive':'uneasy')+'.webp';
  }
  const actions={
    'clock-rewind':()=>{const before=clock.textContent,earlier=new Date(Date.now()-4*60000);clock.dataset.contrastTime=earlier.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true});clock.textContent=clock.dataset.contrastTime;clock.classList.add('clock-anomaly');return()=>{delete clock.dataset.contrastTime;clock.textContent=before;clock.classList.remove('clock-anomaly');};},
    'index-noise':()=>{root.classList.add('index-noise');const label=document.querySelector('#record-count');if(label)label.textContent='Index checksum mismatch — source files intact';return()=>{root.classList.remove('index-noise');if(label)label.textContent=document.querySelectorAll('#record-files .record-file').length+' documents';};},
    'signal-noise':()=>{root.classList.add('contrast-static');if(navigator.userActivation?.hasBeenActive&&!document.hidden){audio?.pause();audio=new Audio('assets/sounds/glitch.mp3');audio.volume=.1;audio.playbackRate=.85;audio.play().catch(()=>{});}return()=>{root.classList.remove('contrast-static');audio?.pause();};},
    'cursor-echo':()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return()=>{};const echo=document.createElement('span');echo.className='contrast-cursor';echo.setAttribute('aria-hidden','true');echo.textContent='↖';document.body.append(echo);const move=e=>{echo.style.left=e.clientX+14+'px';echo.style.top=e.clientY+12+'px';};document.addEventListener('pointermove',move);return()=>{document.removeEventListener('pointermove',move);echo.remove();};}
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
  window.addEventListener('pagehide',stop);store.subscribe(apply);
  store.onEvent(({type})=>{if(type==='hilfer:progress-reset'){stop();apply();}});apply();
  return {stop,play(id){if(!actions[id])return false;cancel(id);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      if(id==='clock-rewind')upstream.triggerGlitch('desktop_distortion',{once:false});
      if(id==='signal-noise'){
        const reader=[...document.querySelectorAll('.mail-message-window.visible')].find(n=>n.querySelector('.mail-body'));
        if(reader)upstream.triggerGlitch('email_multiplication',{once:false,payload:{sourceWindow:reader,count:3}});
      }
    }
    const cleanup=actions[id]();jobs.set(id,{cleanup,timer:setTimeout(()=>cancel(id),id==='index-noise'?6000:id==='signal-noise'?900:id==='clock-rewind'?4500:3000)});return true;}};
}
