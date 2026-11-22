// Transient proof only. Completed observations are persisted by the artifact/store boundary.
export function createSequenceProof({start,end,minFrames}) {
  if (!(Number.isFinite(start) && start>=0 && end>start && Number.isInteger(minFrames) && minFrames>1))
    throw new Error('Invalid media observation window');
  let first=null,last=null;
  const reset=()=>{first=last=null;};
  return {reset,push(sample) {
    const {time,now,frames,valid}=sample;
    if (!valid || ![time,now,frames].every(Number.isFinite)) {reset();return false;}
    if (last && (time<=last.time || now<=last.now || frames<=last.frames || time-last.time>0.45 ||
      Math.abs((now-last.now)/1000-(time-last.time))>0.2)) reset();
    if(first && Math.abs((now-first.now)/1000-(time-first.time))>0.2)reset();
    if (time<start) {reset();return false;}
    if (!first) {
      if(time>start+0.12)return false;
      first=sample;
    }
    last=sample;
    return time>=end-0.08 && time<=end+0.3 && time-first.time>=end-start-0.16 &&
      frames-first.frames>=minFrames;
  }};
}

export function mediaVisible(node) {
  if(!node?.isConnected || document.visibilityState!=='visible' || !node.getClientRects().length ||
    !node.closest('.window')?.classList.contains('visible') || !node.closest('.window')?.classList.contains('active'))return false;
  const r=node.getBoundingClientRect(),ratio=node.videoWidth/node.videoHeight;
  const width=Math.min(r.width,r.height*ratio),height=width/ratio;
  const image={left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2};
  image.right=image.left+width;image.bottom=image.top+height;
  if(!width || !height || image.left<0 || image.top<0 || image.right>innerWidth || image.bottom>innerHeight)return false;
  // The passive Assistant can visually cover video even though pointer hit-testing ignores it.
  const balloon=document.querySelector('#assistant-balloon');
  if(balloon?.getClientRects().length) {
    const b=balloon.getBoundingClientRect();
    const covered=Math.max(0,Math.min(image.right,b.right)-Math.max(image.left,b.left))*
      Math.max(0,Math.min(image.bottom,b.bottom)-Math.max(image.top,b.top));
    if(covered>width*height*0.1)return false;
  }
  return true;
}

export function mediaSequencePresented({node,artifactId,source,clipSource},signal) {
  return new Promise(resolve=>{
    if(!node || !source?.observation || !clipSource || source.id!==artifactId || node.dataset.artifactId!==source.clipId || signal.aborted)
      return resolve(false);
    const proof=createSequenceProof(source.observation);
    let callback,animationFrame,previousFrames=-1,finished=false;
    const valid=()=>!signal.aborted && mediaVisible(node) && !node.paused && !node.seeking &&
      !node.error && node.playbackRate===1 && node.readyState>=2 && node.videoWidth>0 &&
      node.dataset.artifactId===source.clipId && node.currentSrc===new URL(clipSource.src,document.baseURI).href &&
      Math.abs(node.duration-clipSource.duration)<0.05;
    const cancelEvents=['pause','seeking','ratechange','emptied','error','abort','ended'];
    const finish=result=>{
      if(finished)return; finished=true;
      if(callback!==undefined)node.cancelVideoFrameCallback?.(callback);
      if(animationFrame!==undefined)cancelAnimationFrame(animationFrame);
      node.removeEventListener('timeupdate',fallback);
      cancelEvents.forEach(name=>node.removeEventListener(name,cancel));
      document.removeEventListener('visibilitychange',cancel); signal.removeEventListener('abort',cancel);
      observer.disconnect(); resolve(result);
    };
    const cancel=()=>finish(false);
    const observer=new MutationObserver(()=>{if(!valid())cancel();});
    const frame=(now,metadata)=>{
      if(!valid())return finish(false);
      if(proof.push({time:metadata.mediaTime,now,frames:metadata.presentedFrames,valid:true}))return finish(true);
      callback=node.requestVideoFrameCallback(frame);
    };
    const fallback=()=>{
      const quality=node.getVideoPlaybackQuality?.();
      if(!valid() || !quality)return finish(false);
      const frames=quality.totalVideoFrames-quality.droppedVideoFrames;
      if(frames!==previousFrames) {
        previousFrames=frames;
        if(proof.push({time:node.currentTime,now:performance.now(),frames,valid:true}))return finish(true);
      }
      animationFrame=requestAnimationFrame(fallback);
    };
    signal.addEventListener('abort',cancel,{once:true});
    cancelEvents.forEach(name=>node.addEventListener(name,cancel,{once:true}));
    document.addEventListener('visibilitychange',cancel,{once:true});
    observer.observe(node.closest('.window'),{attributes:true,attributeFilter:['class','style']});
    if(!valid())return finish(false);
    if(node.requestVideoFrameCallback)callback=node.requestVideoFrameCallback(frame);
    else animationFrame=requestAnimationFrame(fallback);
  });
}
