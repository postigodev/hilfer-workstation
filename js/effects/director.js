// Presentation only. This director never submits a gameplay command.
export const DIRECTOR_RECEIPTS='hilfer:presentation:v1';
export function narrativeStage(snapshot) {
  const f=snapshot.facts;
  if(['sent','reviewed','ended'].includes(f.story?.stage))return 0;
  if(f.story?.stage==='attempted')return 6;
  if(Object.values(f.determinations).some(d=>d.caseId==='CASE-LINEAGE'))return 5;
  if(Object.values(f.determinations).some(d=>d.caseId==='CASE-REC03-PURPOSE'))return 4;
  if(f.milestones['CAM-R03:transport-reviewed'])return 3;
  if(Object.values(f.determinations).some(d=>d.caseId==='CASE-ARCHIVE'))return 2;
  if(Object.values(f.determinations).some(d=>d.caseId==='CASE-001'))return 1;
  return 0;
}

export function createBoundedRunner({schedule=setTimeout,cancel=clearTimeout}={}) {
  const active=new Map();
  function stop(id){const job=active.get(id);if(!job)return;active.delete(id);cancel(job.timer);job.cleanup();}
  return {run(id,duration,start){stop(id);const cleanup=start()||(()=>{});active.set(id,{cleanup,timer:schedule(()=>stop(id),duration)});},
    stop,stopAll(){for(const id of [...active.keys()])stop(id);},size:()=>active.size};
}

export function mountDirector(store,{assistant,storage,registry}) {
  if(!store.getDefinitions().story)return;
  const html=document.documentElement,runner=createBoundedRunner(),seen=new Set();
  try{for(const id of JSON.parse(storage?.getItem(DIRECTOR_RECEIPTS)||'[]'))seen.add(id);}catch{/* In-memory receipts remain valid. */}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const tray=document.createElement('div');tray.className='presentation-controls';
  tray.innerHTML='<button type="button" data-effects-mute>Mute audio</button><button type="button" data-effects-stop>Clear visual effects</button>';
  document.body.append(tray);
  let muted=false;try{muted=storage?.getItem('hilfer:muted')==='true';}catch{}
  let audio;
  const mute=()=>{assistant.setMuted(muted);for(const node of document.querySelectorAll('audio,video'))node.muted=muted;if(muted)audio?.pause();tray.querySelector('[data-effects-mute]').textContent=muted?'Unmute audio':'Mute audio';};
  const mediaObserver=new MutationObserver(mute);mediaObserver.observe(document.querySelector('#footage-window'),{childList:true,subtree:true});
  mute();
  tray.querySelector('[data-effects-mute]').onclick=()=>{muted=!muted;try{storage?.setItem('hilfer:muted',String(muted));}catch{}mute();};
  tray.querySelector('[data-effects-stop]').onclick=()=>{runner.stopAll();for(const node of document.querySelectorAll('.story-obstructions .story-warning'))node.remove();};
  const clock=document.querySelector('#clock');
  const clockTime=()=>['12:10 PM','12:35 PM','2:00 PM','2:20 PM','3:00 PM','3:40 PM','3:44 PM'][narrativeStage(store.getSnapshot())];
  function apply(){
    const s=store.getSnapshot(),stage=narrativeStage(s);html.dataset.narrativeStage=String(stage);
    clock.dataset.fictionalTime=['sent','reviewed','ended'].includes(s.facts.story.stage)?'4:15 PM':clockTime();clock.textContent=clock.dataset.fictionalTime;
    assistant.setPresentationStage(stage);
  }
  const actions={
    'clock-rewind':()=>{clock.dataset.fictionalTime='1:56 PM';clock.textContent='1:56 PM';clock.classList.add('clock-anomaly');return()=>{clock.classList.remove('clock-anomaly');apply();};},
    'index-recovery':()=>{
      const notice=document.createElement('button');notice.type='button';notice.className='index-recovery';notice.textContent='Rebuild local index';
      const count=document.querySelector('#record-count');count.textContent='Index checksum mismatch — source files intact';
      document.querySelector('#records-app .application-actions').append(notice);html.classList.add('index-mask');
      notice.onclick=()=>runner.stop('index-recovery');return()=>{notice.remove();html.classList.remove('index-mask');const n=document.querySelectorAll('#record-files .record-file').length;count.textContent=n+' documents';};
    },
    'cursor-echo':()=>{if(reduced.matches)return;const echo=document.createElement('span');echo.className='cursor-echo';echo.textContent='↖';echo.setAttribute('aria-hidden','true');document.body.append(echo);
      const move=e=>{echo.style.left=(e.clientX+16)+'px';echo.style.top=(e.clientY+12)+'px';};document.addEventListener('pointermove',move);
      return()=>{document.removeEventListener('pointermove',move);echo.remove();};},
    'transport-static':()=>{if(!reduced.matches)html.classList.add('transport-static');
      // One quiet, bounded existing cue, after playback proof; never voices over voices.
      if(!muted&&!document.hidden&&navigator.userActivation?.hasBeenActive){audio?.pause();audio=new Audio('assets/sounds/glitch.mp3');audio.volume=.08;audio.playbackRate=.82;audio.play().catch(()=>{});}
      return()=>{html.classList.remove('transport-static');audio?.pause();audio=null;};}
  };
  function trigger(id){const d=registry.find(d=>d.id===id);if(!d||seen.has(id))return;
    seen.add(id);try{storage?.setItem(DIRECTOR_RECEIPTS,JSON.stringify([...seen]));}catch{}
    runner.run(id,d.durationMs,actions[id]);
  }
  let before=store.getSnapshot();apply();
  const signal=(name)=>assistant.deliverSignal(name);
  const off=store.subscribe(()=>{
    const next=store.getSnapshot(),oldStage=narrativeStage(before),stage=narrativeStage(next);
    apply();
    if(stage>oldStage){
      if(stage===2){trigger('clock-rewind');trigger('index-recovery');signal('security.archive-restored');}
      if(stage===3){trigger('transport-static');signal('security.transport-reviewed');}
      if(stage===4){trigger('cursor-echo');signal('recovery.purpose-filed');}
      if(stage===5)signal('classification.filed');
    }
    const a=before.facts.story,b=next.facts.story;
    if(!a.guyAcknowledged&&b.guyAcknowledged)signal('guy.comparison');
    if(!a.occupancyAcknowledged&&b.occupancyAcknowledged)signal('occupancy.continued');
    if(a.stage!==b.stage){signal('disclosure.'+b.stage);if(['sent','reviewed','ended'].includes(b.stage))runner.stopAll();}
    before=next;
  });
  const escape=e=>{if(e.key==='Escape')runner.stopAll();};document.addEventListener('keydown',escape);
  const offEvents=store.onEvent(({type})=>{if(type==='hilfer:progress-reset'){runner.stopAll();seen.clear();try{storage?.removeItem(DIRECTOR_RECEIPTS);}catch{}before=store.getSnapshot();apply();}});
  const stop=()=>{runner.stopAll();audio?.pause();};window.addEventListener('pagehide',stop);
  // A localhost-only rehearsal harness triggers cosmetics, never progression.
  if(['localhost','127.0.0.1'].includes(location.hostname))window.hilferEffects=Object.freeze({preview:id=>{if(actions[id])runner.run(id,registry.find(x=>x.id===id).durationMs,actions[id]);},clear:stop});
  return()=>{stop();off();offEvents();mediaObserver.disconnect();tray.remove();document.removeEventListener('keydown',escape);window.removeEventListener('pagehide',stop);};
}
