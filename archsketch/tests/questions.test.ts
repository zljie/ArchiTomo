import test from 'node:test';import assert from 'node:assert/strict';
import {createProject,executeCommand,parseProject,head} from '../src/project.ts';
import {builtinQuestion,currentQuestion} from '../src/guidance.ts';
import {normalizeQuestion} from '../server/guide.ts';

test('STORY-006 AC-01/02：一次一张内置卡片，作答落盘可往返，修改保留历史',()=>{
 let p=createProject('p','引导');const q=currentQuestion(p,head(p))!;assert.ok(q,'新项目应有第一张卡片');assert.equal(q.domain,'goals_constraints');assert.equal(q.source,'builtin');assert.ok(q.options.length>=2);
 p=executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['o2'],note:'',question:q});
 assert.equal(p.questions![0].status,'answered');assert.deepEqual(p.questions![0].answer!.optionIds,['o2']);assert.match(p.conversation.at(-1)!.content,new RegExp(q.options[1].label));
 assert.equal(currentQuestion(p,head(p))!.domain,'system_context');assert.equal(p.inputVersion,0);
 p=executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['o3'],note:'一年内翻倍'});assert.equal(p.questions![0].history.length,1);assert.deepEqual(p.questions![0].answer!.optionIds,['o3']);assert.equal(p.questions![0].answer!.note,'一年内翻倍');
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).questions,p.questions);
});
test('STORY-006 AC-02/03：跳过后可再答；多选；非法选项与伪造来源被拒绝',()=>{
 let p=createProject('p','引导');const q=builtinQuestion('goals_constraints')!;const before=JSON.stringify(p);
 assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['o1','o2'],note:'',question:q}),/选项/);
 assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['zz'],note:'',question:q}),/选项/);
 assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:[],note:' ',question:q}),/选项|说明/);
 assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:'x',optionIds:['o1'],note:'',question:{...q,id:'x',source:'ai'}}),/内置/);
 assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:'missing',optionIds:['o1'],note:''}),/不存在/);assert.equal(JSON.stringify(p),before);
 p=executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:[],note:'',skip:true,question:q});assert.equal(p.questions![0].status,'skipped');assert.notEqual(currentQuestion(p,head(p))!.id,q.id);
 p=executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:['o1'],note:''});assert.equal(p.questions![0].status,'answered');
 const multi=builtinQuestion('system_context')!;assert.equal(multi.multi,true);p=executeCommand(p,{type:'answer_question',questionId:multi.id,optionIds:['o1','o3'],note:'',question:multi});assert.equal(p.questions![1].answer!.optionIds.length,2);
});
test('STORY-006：旧项目文件没有questions字段仍可读取并继续写入',()=>{const p=createProject('p','旧');const raw=JSON.parse(JSON.stringify(p));delete raw.questions;assert.deepEqual(parseProject(raw).questions,[]);assert.deepEqual(executeCommand(raw,{type:'create_baseline',name:'a',revisionId:p.headRevisionId}).questions,[]);});
test('STORY-006 AC-04：AI问题规范化为卡片，格式不足拒绝',()=>{
 const q=normalizeQuestion({domain:'data',title:'主数据放哪里？',why:'影响一致性',options:[{label:'关系库',detail:''},{label:'文档库'}]})!;
 assert.ok(q,'应返回卡片');assert.equal(q.source,'ai');assert.match(q.id,/^ai-/);assert.deepEqual(q.options.map(o=>o.id),['o1','o2']);assert.equal(q.status,'open');assert.equal(q.multi,false);
 assert.equal(normalizeQuestion({domain:'??',title:'t',options:[{label:'a'},{label:'b'}]})!.domain,'goals_constraints');
 assert.equal(normalizeQuestion(null),null);assert.throws(()=>normalizeQuestion({title:'t',options:[{label:'a'}]}));
});
