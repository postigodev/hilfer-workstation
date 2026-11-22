import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../../data/'+name+'.json',import.meta.url),'utf8'));

// Injected test-only corpus. No file in data/ is changed by these synthetic relationships.
export function applicationFixture() {
  // Keep this synthetic PR #8 integration fixture on its pre-Security catalog.
  const f={records:read('records'),cases:read('cases'),emails:read('emails'),progression:read('history/progression-v3')};
  const d=f.progression;
  f.cases.push({id:'TEST-LOCKED-PLACEHOLDER',title:'Synthetic reserved title',description:'Synthetic private metadata',placeholder:true});
  d.contentCatalog.push({id:'TEST-LOCKED-PLACEHOLDER',kind:'case',caseId:'TEST-LOCKED-PLACEHOLDER',requiredGrantIds:[]});
  d.availabilityPolicies.push({contentId:'TEST-LOCKED-PLACEHOLDER',when:{evidenceInspected:{evidenceId:'HR-014'}}});
  d.grants.push('test.access');
  d.accessPolicies.push({grantId:'test.access',when:{any:[{not:{evidenceInspected:{evidenceId:'TEST-REVOKE'}}},{evidenceInspected:{evidenceId:'TEST-REGRANT'}}]}});
  function binding(app,id,type){d.contentCatalog.push({id:app+':'+id,kind:'artifact',app,artifactId:id,artifactType:type,requiredGrantIds:[]});}
  function evidence(id,artifacts,requiredGrantIds=[]) {
    d.evidence.push({id,sourceGroupId:id,department:'Synthetic Test',tags:[],fields:{},caseIds:[],requiredGrantIds,artifacts});
  }
  for(const [id,name] of [['TEST-REVOKE','Revocation switch'],['TEST-REGRANT','Regrant switch'],['TEST-SEALED','Restricted test record']]) {
    f.records.push({id,type:'test_source',title:name,department:id==='TEST-SEALED'?'Restricted test department':'Test switches',employee:'Synthetic fixture',employeeId:'TEST-ACTOR',date:'1998-10-12T09:00:00',workPeriod:'Synthetic only',fields:{note:name},caseIds:[]});
    binding('records',id,'document');
    if(id!=='TEST-SEALED') evidence(id,[{app:'records',artifactId:id,inspectionPolicyId:'document-presented'}]);
  }
  const template=f.emails.threads[0].messages[0];
  const messages=['A','B'].map((part,index)=>({...structuredClone(template),id:'TEST-MESSAGE-'+part,sentAt:'1998-11-0'+(index+1)+'T12:00:00',body:'Synthetic body '+part,references:[]}));
  messages[0].attachments=[{id:'TEST-ATTACHMENT',label:'Synthetic attachment',body:'Separate attachment body'}];
  f.emails.threads.push({id:'TEST-THREAD',subject:'Restricted synthetic conversation',folderId:'inbox',access:{requiredGrants:['test.access']},messages});
  binding('mail','TEST-THREAD','thread');binding('mail','TEST-MESSAGE-A','message');binding('mail','TEST-MESSAGE-B','message');binding('mail','TEST-ATTACHMENT','attachment');
  evidence('TEST-SHARED',[{app:'records',artifactId:'TEST-SEALED',inspectionPolicyId:'document-presented'},{app:'mail',artifactId:'TEST-MESSAGE-A',inspectionPolicyId:'message-body-presented'}],['test.access']);
  evidence('TEST-MAIL-B',[{app:'mail',artifactId:'TEST-MESSAGE-B',inspectionPolicyId:'message-body-presented'}],['test.access']);
  evidence('TEST-ATTACHMENT-EVIDENCE',[{app:'mail',artifactId:'TEST-ATTACHMENT',inspectionPolicyId:'attachment-presented'}],['test.access']);
  evidence('TEST-VIDEO',[{app:'footage',artifactId:'CAM4-PREVIEW',inspectionPolicyId:'media-frame-presented'}],['test.access']);
  d.effects.push({id:'TEST-ANIMATION',adapter:'animation',signal:'microglitch'},{id:'TEST-AUDIO',adapter:'audio',signal:'glitch-cue'});
  d.rules.push({id:'TEST-PRESENTATION',mode:'once',when:{evidenceInspected:{evidenceId:'TEST-MAIL-B'}},consequences:[{emitEffect:{effectId:'TEST-ANIMATION'}},{emitEffect:{effectId:'TEST-AUDIO'}}]});
  return f;
}
