import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoundedRunner,narrativeStage} from '../js/effects/director.js';

test('visual jobs cancel the old instance before mounting its replacement',()=>{
  const timers=new Map(),events=[];let token=0;
  const runner=createBoundedRunner({schedule:fn=>{timers.set(++token,fn);return token;},cancel:id=>timers.delete(id)});
  runner.run('echo',20,()=>{events.push('first');return()=>events.push('first removed');});
  runner.run('echo',20,()=>{events.push('second');return()=>events.push('second removed');});
  assert.deepEqual(events,['first','first removed','second']);assert.equal(timers.size,1);
  [...timers.values()][0]();assert.equal(runner.size(),0);assert.equal(events.at(-1),'second removed');
});
test('reset/escape cleanup removes every pending timer and resource exactly once',()=>{
  const timers=new Map();let token=0,cleaned=0;
  const runner=createBoundedRunner({schedule:fn=>{timers.set(++token,fn);return token;},cancel:id=>timers.delete(id)});
  for(const id of ['clock','audio','cursor'])runner.run(id,100,()=>()=>cleaned++);
  runner.stopAll();runner.stopAll();assert.equal(cleaned,3);assert.equal(timers.size,0);assert.equal(runner.size(),0);
});
test('visual stages derive from filed facts, never document counts or camera timing assumptions',()=>{
  const f={story:{stage:'investigating'},determinations:{},milestones:{},inspectedEvidenceIds:['CAM-R03']};
  const s={facts:f};assert.equal(narrativeStage(s),0);
  f.determinations.j={caseId:'CASE-001'};assert.equal(narrativeStage(s),1);
  f.determinations.e={caseId:'CASE-ARCHIVE'};assert.equal(narrativeStage(s),2);
  f.milestones['CAM-R03:transport-reviewed']={};assert.equal(narrativeStage(s),3);
  f.determinations.f={caseId:'CASE-REC03-PURPOSE'};assert.equal(narrativeStage(s),4);
  f.determinations.g={caseId:'CASE-LINEAGE'};assert.equal(narrativeStage(s),5);
  f.story.stage='attempted';assert.equal(narrativeStage(s),6);
  for(const stage of ['sent','reviewed','ended']){f.story.stage=stage;assert.equal(narrativeStage(s),0);}
});
