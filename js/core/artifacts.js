import { inspectionPolicy, INSPECTION_POLICIES } from './rules.js';

const unavailable = () => ({ok:false,message:'Content unavailable.'});
const key = (app,id) => JSON.stringify([app,id]);

// Single presentation boundary. Mail's model remains the authority for thread authorization.
export function createArtifacts({store,records = [],emails,mail,footage = [],policies = {}}) {
  records=records.map(record=>{
    const canonical=store.getRecord(record.id);
    if(!canonical)throw new Error('Record source is absent from the store: '+record.id);
    return canonical;
  });
  const d = store.getDefinitions(), catalog = d.contentCatalog ?? [
    ...store.getCases().map(c=>({id:c.id,kind:'case',caseId:c.id,requiredGrantIds:[]})),
    ...records.map(r=>({id:'record:'+r.id,kind:'artifact',app:'records',artifactId:r.id,artifactType:'document',requiredGrantIds:[]}))
  ];
  const bindings = new Map(catalog.filter(c=>c.kind==='artifact').map(c=>[key(c.app,c.artifactId),c]));
  const sources = new Map(), pending = new Map(), subscribers = new Set();
  const addSource=(app,id,value)=>{const k=key(app,id);if(sources.has(k))throw new Error('Duplicate artifact source: '+id);sources.set(k,value);};
  for (const record of records) addSource('records',record.id,record);
  for (const media of footage) {
    const source=structuredClone(media);
    if(source.observation)Object.freeze(source.observation);
    addSource('footage',source.id,Object.freeze(source));
  }
  for (const thread of emails?.threads ?? []) {
    addSource('mail',thread.id,{type:'thread',threadId:thread.id});
    for (const message of thread.messages) {
      addSource('mail',message.id,{type:'message',threadId:thread.id,messageId:message.id});
      for (const attachment of message.attachments ?? []) addSource('mail',attachment.id,{type:'attachment',threadId:thread.id,messageId:message.id});
    }
  }
  if (d.schemaVersion === 2) {
    for (const c of bindings.values()) {
      if (!c.retired && (!sources.has(key(c.app,c.artifactId)) || (c.app==='mail' && sources.get(key(c.app,c.artifactId)).type!==c.artifactType))) throw new Error('Unknown or incompatible content source: '+c.id);
    }
    for (const e of d.evidence.filter(e=>!e.retired)) for (const a of e.artifacts) {
      const policy = inspectionPolicy(a.inspectionPolicyId);
      if (!INSPECTION_POLICIES[a.app].includes(policy) || typeof policies[policy] !== 'function') throw new Error('Unsupported inspection adapter: '+a.inspectionPolicyId);
    }
    if (emails && (!mail || emails.initialGrants.some(g=>!d.initialGrantIds.includes(g)) || emails.threads.some(t=>t.access.requiredGrants.some(g=>!d.grants.includes(g))))) throw new Error('Mail grants are not declared in progression');
  }
  function canOpen(app,id) {
    const c = bindings.get(key(app,id));
    if (!c || c.retired || !sources.has(key(app,id)) || !store.isArtifactAvailable(app,id)) return false;
    const evidenceId = store.evidenceForArtifact(app,id);
    if (evidenceId && !store.canInspectEvidence(evidenceId)) return false;
    if (app==='mail') {
      const ref=sources.get(key(app,id));
      return Boolean(ref.type==='thread' ? mail?.getThread(id) : mail?.getMessage(ref.messageId));
    }
    return true;
  }
  function cancel(viewer) { const token=pending.get(viewer); if (token) { token.controller.abort(); pending.delete(viewer); } }
  const cancelAll = () => [...pending.keys()].forEach(cancel);
  function begin(viewer,app,id) {
    cancel(viewer);
    if (!canOpen(app,id)) return null;
    const token={viewer,app,id,controller:new AbortController()}; pending.set(viewer,token); return token;
  }
  async function complete(token,presentation) {
    if (!token || token.controller.signal.aborted || pending.get(token.viewer)!==token || !canOpen(token.app,token.id)) return unavailable();
    const evidenceId=store.evidenceForArtifact(token.app,token.id);
    if (!evidenceId) return {ok:true,inspected:false};
    const artifact=d.evidence.find(e=>e.id===evidenceId).artifacts.find(a=>a.app===token.app && a.artifactId===token.id);
    const policy=policies[inspectionPolicy(artifact.inspectionPolicyId)];
    const source=sources.get(key(token.app,token.id));
    const clipSource=source.clipId?sources.get(key('footage',source.clipId)):undefined;
    try {
      if (typeof policy!=='function' || !await policy({...presentation,artifactId:token.id,source,clipSource},token.controller.signal)) return unavailable();
      if (token.controller.signal.aborted || pending.get(token.viewer)!==token || !canOpen(token.app,token.id)) return unavailable();
      const result=store.dispatch({type:'inspectEvidence',evidenceId});
      return {...result,inspected:result.ok};
    } catch { return unavailable(); }
    finally { if(pending.get(token.viewer)===token) pending.delete(token.viewer); }
  }
  let signature=JSON.stringify([store.getAccess(),store.getAvailability()]);
  function changed(reset=false) {
    const next=JSON.stringify([store.getAccess(),store.getAvailability()]);
    if (!reset && signature===next) return;
    signature=next; cancelAll(); mail?.setGrants(store.getAccess());
    for (const fn of subscribers) fn();
  }
  mail?.setGrants(store.getAccess());
  const off=store.subscribe(()=>changed());
  const offReset=store.onEvent(({type})=>{if(type==='hilfer:progress-reset') changed(true);});
  return {
    canOpen,begin,complete,cancel,cancelAll,
    async present(viewer,app,id,presentation) { return complete(begin(viewer,app,id),presentation); },
    get(app,id) {
      if(!canOpen(app,id)) return null;
      const source=sources.get(key(app,id));if(app!=='mail')return source;
      if(source.type==='thread')return mail.getThread(id);
      const message=mail.getMessage(source.messageId);
      return source.type==='attachment' ? message?.attachments?.find(a=>a.id===id) ?? null : message;
    },
    listRecords:()=>records.filter(r=>canOpen('records',r.id)),
    caseVisible:id=>{
      const c=catalog.find(c=>c.kind==='case' && c.caseId===id);
      // Compatibility for the one authored demo teaser, never a general placeholder permission.
      const demoTeaser=id==='CASE-002' && store.getCases().find(c=>c.id===id)?.placeholder===true;
      const available=d.schemaVersion===1 ? store.getState().unlockedCaseIds.includes(id) : store.isContentAvailable(id);
      return Boolean(c && !c.retired && c.requiredGrantIds.every(g=>store.getAccess().includes(g)) && (available || demoTeaser));
    },
    subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},
    dispose(){cancelAll();off();offReset();subscribers.clear();}
  };
}
