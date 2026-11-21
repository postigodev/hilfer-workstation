// Policies inspect actual rendered nodes; DOM announcements alone never credit evidence.
const visible = node => Boolean(node?.isConnected && node.getClientRects().length &&
  (!node.closest('.window') || node.closest('.window').classList.contains('visible')));
export const presentationPolicies = {
  'document-presented': ({node,artifactId},signal) => !signal.aborted && visible(node) && node.dataset.artifactId===artifactId && node.matches('.record-document'),
  'message-body-presented': ({node,artifactId},signal) => !signal.aborted && visible(node?.querySelector('.mail-body')) && node.dataset.messageId===artifactId && node.open,
  'attachment-presented': ({node,artifactId},signal) => {
    const content=node?.querySelector('[data-attachment-content]');
    return !signal.aborted && visible(node) && node.dataset.attachmentId===artifactId &&
      node.dataset.attachmentState==='ready' && visible(content) && Boolean(content.textContent?.trim());
  },
  'media-frame-presented': ({node,artifactId},signal) => new Promise(resolve=>{
    if (!node || node.dataset.artifactId!==artifactId || signal.aborted) return resolve(false);
    let frame;
    const finish = result => { if(frame!==undefined) node.cancelVideoFrameCallback?.(frame); node.removeEventListener('timeupdate',check); signal.removeEventListener('abort',abort); resolve(result); };
    const abort = () => finish(false);
    const check = () => {
      if(signal.aborted) return finish(false);
      if(visible(node) && !node.paused && node.readyState>=2 && node.videoWidth>0 && node.currentTime>0) finish(true);
      else if(node.requestVideoFrameCallback) frame=node.requestVideoFrameCallback(check);
    };
    signal.addEventListener('abort',abort,{once:true});
    if(node.requestVideoFrameCallback) frame=node.requestVideoFrameCallback(check);
    else node.addEventListener('timeupdate',check);
  })
};

export function watchViewer(node,onClose,onOpen = () => {}) {
  let wasVisible=node.classList.contains('visible');
  const observer = new MutationObserver(()=>{
    const shown=node.classList.contains('visible');
    if(!shown) onClose();else if(!wasVisible) onOpen();wasVisible=shown;
  });
  observer.observe(node,{attributes:true,attributeFilter:['class']});
  return ()=>observer.disconnect();
}

export function mountFootage(root,artifacts,{artifactId='CAM4-PREVIEW'} = {}) {
  const video=root.querySelector('video'); video.dataset.artifactId=artifactId;
  const viewer='footage';
  const stop=()=>{artifacts.cancel(viewer);video.pause();};
  const refresh=()=>{
    if(!artifacts.canOpen('footage',artifactId)){stop();window.closeWindow?.(root.id.slice(0,-7));root.classList.remove('visible','active');}
  };
  watchViewer(root,()=>{stop();});
  new MutationObserver(()=>{if(root.classList.contains('visible')) refresh();}).observe(root,{attributes:true,attributeFilter:['class']});
  video.addEventListener('play',()=>{
    if(!artifacts.canOpen('footage',artifactId) || !root.classList.contains('visible')) return stop();
    void artifacts.present(viewer,'footage',artifactId,{node:video});
  });
  video.addEventListener('emptied',()=>artifacts.cancel(viewer));
  video.addEventListener('error',stop);
  window.addEventListener('pagehide',stop); artifacts.subscribe(()=>{stop();refresh();});
  refresh(); return {stop,reset(){stop();video.currentTime=0;}};
}
