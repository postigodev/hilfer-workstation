// Bounded HILFER ending: no arbitrary scripts or generic workflow.
export const STORY_STAGES=['investigating','attempted','sent','reviewed','ended'];
export const STORY_FLAGS=['guyAcknowledged','occupancyAcknowledged'];
const commands=['acknowledgeGuy','acknowledgeOccupancy','saveDisclosureDraft','attemptDisclosure','sendDisclosure','reviewSentCopy','acknowledgeMedicalNotice'];
export const isStoryCommand=type=>commands.includes(type);
export const initialStory=()=>({guyAcknowledged:false,occupancyAcknowledged:false,disclosureDraft:'',stage:'investigating'});
const check=(truth,message)=>{if(!truth)throw Error(message);};
function shape(value,keys) {check(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k)),'Invalid story shape');}
export function validateStoryDefinition(s,evidence,cases) {
  shape(s,['requiredCaseIds','reviewCaseId','guyEvidenceIds','occupancyEvidenceIds','gatewayEvidenceId','sentEvidenceId','defaultDraft']);
  for(const key of ['guyEvidenceIds','occupancyEvidenceIds'])check(Array.isArray(s[key]) && s[key].length>=2 && new Set(s[key]).size===s[key].length && s[key].every(id=>evidence.has(id)),'Unknown story source');
  check(Array.isArray(s.requiredCaseIds) && s.requiredCaseIds.length>0 && new Set(s.requiredCaseIds).size===s.requiredCaseIds.length && s.requiredCaseIds.every(id=>cases.has(id)) && cases.has(s.reviewCaseId),'Unknown story case');
  check(evidence.has(s.gatewayEvidenceId) && evidence.has(s.sentEvidenceId) && typeof s.defaultDraft==='string' && s.defaultDraft.length<=8000,'Invalid story correspondence');
}
export function validateStorySnapshot(s,d,f,completed) {
  shape(s,['guyAcknowledged','occupancyAcknowledged','disclosureDraft','stage']);
  check(STORY_FLAGS.every(k=>typeof s[k]==='boolean') && typeof s.disclosureDraft==='string' && s.disclosureDraft.length<=8000 && STORY_STAGES.includes(s.stage),'Invalid saved story');
  for(const [flag,key] of [['guyAcknowledged','guyEvidenceIds'],['occupancyAcknowledged','occupancyEvidenceIds']])
    if(s[flag])check(completed.includes(d.reviewCaseId) && d[key].every(id=>f.inspectedEvidenceIds.includes(id)),'Story review lacks inspected provenance');
  if(s.stage!=='investigating')check(s.guyAcknowledged && s.occupancyAcknowledged && s.disclosureDraft.trim() && d.requiredCaseIds.every(id=>completed.includes(id)) && f.inspectedEvidenceIds.includes(d.gatewayEvidenceId),'Premature disclosure state');
  if(['reviewed','ended'].includes(s.stage))check(f.inspectedEvidenceIds.includes(d.sentEvidenceId),'Sent copy was not inspected');
}
export function transitionStory(snapshot,c,d,{completed,canInspect}) {
  if(!d || !snapshot.facts.story)return {ok:false,changed:false,message:'No story assignment is active.'};
  const s=snapshot.facts.story,seen=snapshot.facts.inspectedEvidenceIds;
  const success=()=>({ok:true,changed:false,message:'Review recorded.'});
  const inspected=ids=>ids.every(id=>seen.includes(id)&&canInspect(id));
  try {
    shape(c,c.type==='saveDisclosureDraft'?['type','text']:['type']);
    if(c.type==='acknowledgeGuy' || c.type==='acknowledgeOccupancy') {
      const guy=c.type==='acknowledgeGuy',flag=guy?'guyAcknowledged':'occupancyAcknowledged';
      if(s[flag])return success();
      check(completed.includes(d.reviewCaseId) && inspected(d[guy?'guyEvidenceIds':'occupancyEvidenceIds']),'Inspect the original sources before acknowledging this review.');
      s[flag]=true;return success();
    }
    if(c.type==='saveDisclosureDraft') {
      check(['investigating','attempted'].includes(s.stage) && typeof c.text==='string' && c.text.length<=8000,'Draft is unavailable or too long.');
      check(s.stage!=='attempted' || c.text.trim(),'An active submission must retain its draft.');
      s.disclosureDraft=c.text;return success();
    }
    if(c.type==='attemptDisclosure') {
      if(s.stage==='attempted')return success();
      check(s.stage==='investigating' && s.guyAcknowledged && s.occupancyAcknowledged && s.disclosureDraft.trim() && d.requiredCaseIds.every(id=>completed.includes(id)) && inspected([d.gatewayEvidenceId]),'Complete the report, source reviews and gateway-policy inspection first.');
      s.stage='attempted';return success();
    }
    const next={sendDisclosure:['attempted','sent'],reviewSentCopy:['sent','reviewed'],acknowledgeMedicalNotice:['reviewed','ended']}[c.type];
    check(next,'Unknown story command.');if(s.stage===next[1])return success();
    check(s.stage===next[0],'This correspondence step is not available.');
    if(c.type==='reviewSentCopy')check(inspected([d.sentEvidenceId]),'Open the authorized Sent message body before comparing it.');
    s.stage=next[1];return success();
  } catch(error) {return {ok:false,changed:false,message:error.message};}
}
