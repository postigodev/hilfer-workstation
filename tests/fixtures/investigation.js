// Architecture validation only. None of these artifacts or relationships is story canon.
export function investigation() {
  const cases = [{id:'TEST-CASE',initiallyUnlocked:true}];
  const evidence = [
    ['TEST-CAMERA','Security',{injury:'SEVERE'},'footage','camera'],
    ['TEST-HR','HR',{authorization:'AUTHORIZED'},'mail','staffing'],
    ['TEST-MAINTENANCE','Maintenance',{warnings:'PRIOR'},'records','warnings'],
    ['TEST-RECOVERY','Operations',{purpose:'DIAGNOSTIC'},'records','purpose']
  ].map(([id,department,fields,app,tag]) => ({id,department,fields,tags:['incident',tag],sourceGroupId:id,
    caseIds:['TEST-CASE'],requiredGrantIds:[],artifacts:[{app,artifactId:id + '-ARTIFACT',inspectionPolicyId:app === 'footage' ? 'clip-reviewed' : 'content-open'}]}));
  const inspected = evidenceId => ({evidenceInspected:{evidenceId}});
  const definition = {
    schemaVersion:1,contentVersion:1,evidence,
    inferences:[
      {id:'TEST-PRESENCE',supportAlternatives:[['TEST-CAMERA','TEST-HR']],requires:{all:[inspected('TEST-CAMERA'),inspected('TEST-HR')]}},
      {id:'TEST-PURPOSE',supportAlternatives:[['TEST-MAINTENANCE','TEST-RECOVERY']],requires:inspected('TEST-RECOVERY')}
    ],
    determinations:[
      {id:'TEST-AUTHORIZATION',caseId:'TEST-CASE',claimId:'staffing',field:'authorization',value:'AUTHORIZED',sourceEvidenceIds:['TEST-HR'],provenanceEvidenceIds:['TEST-HR']},
      {id:'TEST-OPERATION',caseId:'TEST-CASE',claimId:'purpose',field:'purpose',value:'DIAGNOSTIC',sourceEvidenceIds:['TEST-RECOVERY'],provenanceEvidenceIds:['TEST-RECOVERY']}
    ],
    milestoneIds:['TEST-CROSS-DEPARTMENT','TEST-UNDERSTOOD','TEST-FILED'], grants:['test.archive'],initialGrantIds:[],initialCaseIds:['TEST-CASE'],
    caseCompletionPolicies:[{caseId:'TEST-CASE',when:{all:[{determinationFiled:{determinationId:'TEST-AUTHORIZATION'}},{determinationFiled:{determinationId:'TEST-OPERATION'}}]}}],
    accessPolicies:[{grantId:'test.archive',when:{milestoneReached:{milestoneId:'TEST-CROSS-DEPARTMENT'}}}],
    availabilityPolicies:[{contentId:'TEST-ARCHIVE',when:{hasAccess:{grantId:'test.archive'}}}],
    presentationPolicies:[{id:'TEST-DISTORTION',when:{milestoneReached:{milestoneId:'TEST-FILED'}},distortionLevel:1}],
    effects:[{id:'TEST-CUE',adapter:'animation',signal:'test.cue'}],
    rules:[
      {id:'TEST-COUNT',mode:'once',when:{evidenceCount:{filter:{tagsAll:['incident']},distinctBy:'department',atLeast:3}},consequences:[{reachMilestone:{milestoneId:'TEST-CROSS-DEPARTMENT'}}]},
      {id:'TEST-INFERENCE',mode:'once',when:{all:[{inferenceEstablished:{inferenceId:'TEST-PRESENCE'}},{inferenceEstablished:{inferenceId:'TEST-PURPOSE'}}]},consequences:[{reachMilestone:{milestoneId:'TEST-UNDERSTOOD'}}]},
      {id:'TEST-FILING',mode:'once',when:{determinationFiled:{determinationId:'TEST-AUTHORIZATION'}},consequences:[{reachMilestone:{milestoneId:'TEST-FILED'}},{emitEffect:{effectId:'TEST-CUE'}}]}
    ]
  };
  return {cases,records:[],progression:definition};
}

export function memory() {
  const data = new Map();
  return {data,getItem:key => data.get(key) ?? null,setItem:(key,value) => data.set(key,value),removeItem:key => data.delete(key)};
}
