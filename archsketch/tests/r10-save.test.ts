import test from 'node:test';import assert from 'node:assert/strict';
import {createSaveQueue} from '../src/saveQueue.ts';
import {createProject,executeCommand} from '../src/project.ts';
import {newDesign,string} from '../src/design.ts';

test('BUG-004：一次保存被拒（400）后，等待队列空闲不再抛出，后续修正可直接提交',async()=>{
 const q=createSaveQueue();const bad=q.run(async()=>{const e=Object.assign(new Error('文字无效或过长'),{status:400});throw e;});await assert.rejects(bad);
 await assert.doesNotReject(q.idle(),'flush 等待的队列不应继续 rejected');
 assert.equal(await q.run(async()=>'ok'),'ok');
});
test('BUG-004：长度校验错误指出字段与上限',()=>{
 assert.throws(()=>string('x'.repeat(4001),4000,false,'补充说明'),/补充说明.*上限 4000 字.*当前 4001 字/);
 const d=newDesign('t');const p=createProject('p','t',d);
 const q=p.questions[0];if(q)assert.throws(()=>executeCommand(p,{type:'answer_question',questionId:q.id,optionIds:[],note:'x'.repeat(4001)}),/上限 4000 字/);
});
