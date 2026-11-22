import {escapeHTML as h, displayField, displayValue} from './shared.js';

// A source card is actionable only after the real app has presented its content.
// This module neither discovers evidence nor files anything during render.
export function renderInvestigationCase(definition, store, artifacts, sourceLink) {
  const state=store.getState();
  const d=store.getDefinitions();
  const f=store.getSnapshot().facts;
  const done=state.completedCaseIds.includes(definition.id);
  const unlocked=state.unlockedCaseIds.includes(definition.id);
  const config=definition.investigation;
  const evidence=new Map(d.evidence.map(x=>[x.id,x]));
  const inferences=new Map(d.inferences.map(x=>[x.id,x]));
  const determinations=new Map(d.determinations.map(x=>[x.id,x]));
  const inspected=new Set(f.inspectedEvidenceIds);
  const validSource=id=> {
    const item=evidence.get(id);
    if(!item || !store.canInspectEvidence(id))return '<span class="source-unavailable">Restricted source</span>';
    const artifact=item.artifacts[0];
    const label=artifact?.artifactId ?? id;
    const link=artifact?.app==='records'
      ? sourceLink(label,store.getRecord(label)?.title??label)
      : artifact?.app==='mail'
        ? '<button type="button" data-open="emails">Open Mail</button> · '+h(label)
        : artifact?.app==='footage'
          ? '<button type="button" data-open="footage">Open Footage</button> · '+h(label)
        : h(label);
    return '<span>'+link+(inspected.has(id)?' · inspected':' · not inspected')+'</span>';
  };
  const status=done?'RECONCILED':unlocked?'OPEN':'LOCKED';
  const head='<div class="case-metadata"><div><small>CASE</small><b>'+h(definition.id)+'</b></div>'+
    '<div><small>SUBJECT</small><span>'+h(definition.subjectId||'—')+'</span></div>'+
    '<div><small>STATE</small><span>'+status+'</span></div></div>'+
    '<h1>'+h(definition.title)+'</h1><p>'+h(definition.description||'')+'</p>';
  if(!unlocked)return '<div class="claim-case-view">'+head+'<p>Assignment locked.</p></div>';
  if(done)return '<div class="claim-case-view">'+head+
    '<p>Determination filed. The underlying sources remain available for review.</p>'+
    '<button type="button" data-view-entry="'+h(definition.id)+'">View report entry</button></div>';

  const panels=(config.inferenceIds||[]).map(id=>{
    const i=inferences.get(id);
    if(!i)return '';
    if(f.inferences[id])return '<section class="claim-existing"><b>'+h(id)+'</b><p>Relationship established using inspected sources.</p></section>';
    const choices=i.supportAlternatives.map((alternative,index)=>{
      const ready=alternative.every(key=>inspected.has(key)&&store.canInspectEvidence(key));
      return '<div class="claim-next"><div><b>Evidence route '+(index+1)+'</b><ul>'+
        alternative.map(key=>'<li>'+validSource(key)+'</li>').join('')+'</ul></div>'+
        '<button type="button" data-inference-id="'+h(id)+'" data-inference-alt="'+index+'" '+(ready?'':'disabled')+
        '>Establish relationship</button></div>';
    }).join('');
    const descriptions={'E-I1':'Compare central and local archive availability','F-I1':'Compare the three recovery authorizations','F-I4':'Compare the approved recovery classification','C-I1':'Compare medical and incident criteria','C-I2':'Trace the qualified Communications wording','E-I3':'Optional: reconcile the historical segment association'};
    return '<section class="claim-existing"><div class="pane-label">'+h(descriptions[id]??'Compare inspected sources')+'</div>'+choices+'</section>';
  }).join('');

  const filings=(config.determinationIds||[]).map(id=>{
    const t=determinations.get(id);
    if(!t)return '';
    const sources=t.sourceEvidenceIds.filter(key=>inspected.has(key)&&store.canInspectEvidence(key));
    const requiredInference=Object.keys(t.requires?.inferenceEstablished||{}).length
      ? t.requires.inferenceEstablished.inferenceId : null;
    const canFile=sources.length&&t.provenanceEvidenceIds.every(key=>inspected.has(key)&&store.canInspectEvidence(key))&&
      (!requiredInference||Boolean(f.inferences[requiredInference]));
    const field=t.field==='archiveAvailability'?'Archive availability':displayField(t.field);
    // A determination is a candidate in the rules, not knowledge the player has.
    // Do not serialize a restricted source's value or ID into the DOM until the
    // player has actually inspected an authorized source containing that value.
    const sourceInspected=sources.length>0;
    const value=sourceInspected?displayValue(t.value):'Pending source review';
    const button=sourceInspected
      ? '<button type="button" class="claim-apply" data-file-determination="'+h(id)+
        '" data-source-evidence="'+h(sources[0])+'" '+(canFile?'':'disabled')+'>Update report</button>'
      : '<button type="button" class="claim-apply" disabled>Update report</button>';
    return '<div class="claim-existing"><div><b>'+h(field)+'</b> <span>'+h(value)+'</span></div>'+
      '<small>Authoritative source: '+(sourceInspected?validSource(sources[0]):'not yet inspected')+'</small>'+
      '<div class="claim-choice">'+button+'</div></div>';
  }).join('');
  return '<div class="claim-case-view">'+head+
    '<p class="claim-hint">Inspect actual records or messages, then choose one supported evidence route. The system will not infer a conclusion automatically.</p>'+
    panels+'<div class="pane-label">ADMINISTRATIVE DETERMINATION</div>'+filings+'</div>';
}
