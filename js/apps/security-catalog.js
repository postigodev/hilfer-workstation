export function validateSecurityCatalog(media) {
  if(!Array.isArray(media))throw new Error('Invalid Security catalog');
  const ids=new Set();
  for(const item of media) {
    if(!item || typeof item.id!=='string' || ids.has(item.id))throw new Error('Duplicate or missing media ID');
    ids.add(item.id);
    if(item.observation) {
      const clip=media.find(x=>x.id===item.clipId && !x.observation);
      const {start,end,minFrames}=item.observation;
      if(!clip || !['transport','injury'].includes(item.kind) || !Number.isFinite(start) || start<0 ||
        !(end>start && end<=clip.duration) || !Number.isInteger(minFrames) || minFrames<2)
        throw new Error('Invalid Security observation');
    } else if(typeof item.title!=='string' || !/^assets\/footage\/[\w-]+\.mp4$/.test(item.src))
      throw new Error('Invalid Security source');
  }
  return media;
}
