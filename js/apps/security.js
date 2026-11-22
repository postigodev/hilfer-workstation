import {watchViewer} from './inspection.js';
import {mediaVisible} from './media-observation.js';

// One physical player; logical observations remain separate catalogued artifacts.
export function mountSecurity(root,artifacts,media) {
  const video=root.querySelector('video'),toolbar=root.querySelector('.app-toolbar');
  const status=root.querySelector('.status-bar-field');
  const source=video.querySelector('source');
  let selected='CAM4-PREVIEW',generation=0;
  const clip=()=>media.find(x=>x.id===selected);
  const cancel=()=>{generation++;artifacts.cancel('security-preview');artifacts.cancel('security-transport');artifacts.cancel('security-injury');};
  const stop=()=>{cancel();video.pause();};
  function arm() {
    cancel();
    if(!artifacts.canOpen('footage',selected) || !root.classList.contains('active') ||
      !root.classList.contains('visible') || document.visibilityState!=='visible')return stop();
    const current=generation;
    if(selected==='CAM4-PREVIEW')void artifacts.present('security-preview','footage',selected,{node:video});
    else if(!mediaVisible(video)) {stop();status.textContent='Keep the recording fully visible, closing overlapping windows before playback.';return;}
    for(const observation of media.filter(x=>x.clipId===selected)) {
      void artifacts.present('security-'+observation.kind,'footage',observation.id,{node:video}).then(result=>{
        if(current!==generation)return;
        if(!result.ok) {stop();status.textContent='Sequence not recorded. Resume a fully visible recording at normal speed.';return;}
        status.textContent='Visible sequence recorded. Catalog association remains unverified.';
      });
    }
  }
  function select(id) {
    if(!artifacts.canOpen('footage',id) || !media.some(x=>x.id===id && !x.observation))return;
    if(id===selected) {stop();if(video.readyState)video.currentTime=0;status.textContent=clip().note;return;}
    stop();selected=id;const item=clip();video.dataset.artifactId=id;
    video.setAttribute('aria-label',item.title);video.removeAttribute('src');
    video.removeAttribute('poster');if(item.poster)video.poster=item.poster;
    source.src=item.src;video.load();status.textContent=item.note;
  }
  function refresh() {
    if(!artifacts.canOpen('footage',selected))select('CAM4-PREVIEW');
    toolbar.replaceChildren();
    for(const item of media.filter(x=>!x.observation && artifacts.canOpen('footage',x.id))) {
      const button=document.createElement('button');button.type='button';button.textContent=item.title;
      button.dataset.securityClip=item.id;button.setAttribute('aria-pressed',String(item.id===selected));
      button.addEventListener('click',()=>{select(item.id);refresh();});toolbar.append(button);
    }
  }
  video.dataset.artifactId=selected;
  video.addEventListener('play',arm);
  video.addEventListener('pause',cancel);
  video.addEventListener('seeking',cancel);
  video.addEventListener('seeked',()=>{if(!video.paused)arm();});
  video.addEventListener('ratechange',()=>{stop();status.textContent='Resume at normal speed to review a sequence.';});
  video.addEventListener('error',()=>{stop();status.textContent='Recording could not be loaded. No observation recorded.';});
  source.addEventListener('error',()=>{stop();status.textContent='Recording could not be loaded. No observation recorded.';});
  video.addEventListener('emptied',cancel);
  watchViewer(root,stop);
  new MutationObserver(()=>{if(!root.classList.contains('active'))stop();}).observe(root,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stop();});
  window.addEventListener('pagehide',stop);
  artifacts.subscribe(()=>{stop();refresh();});
  refresh();
  return {stop,reset(){stop();select('CAM4-PREVIEW');refresh();}};
}
