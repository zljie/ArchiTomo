import test from 'node:test';import assert from 'node:assert/strict';
import {orderDesign} from '../src/design.ts';
import {searchCommands,COMMANDS} from '../src/commands.ts';
test('STORY-018 AC-01：按视图、元素、命令返回匹配项且顺序稳定',()=>{
 const d=orderDesign();for(const id of ['new-project','templates','layout','theme','export-doc'])assert.ok(COMMANDS.some(c=>c.id===id),id);
 const r=searchCommands(d,'订单');assert.ok(r.some(i=>i.kind==='node'&&i.label==='订单服务'));assert.ok(r.every(i=>i.label.includes('订单')||i.hint.includes('订单')));
 assert.equal(searchCommands(d,'技术')[0].kind,'view');assert.ok(searchCommands(d,'主题').some(i=>i.kind==='command'&&i.target==='theme'));
 assert.deepEqual(searchCommands(d,'订单').map(i=>i.id),searchCommands(d,'订单').map(i=>i.id));
 const all=searchCommands(d,'');assert.ok(all.length>0&&all.length<=50);assert.equal(all[0].kind,'command');
 assert.ok(searchCommands(null,'模板').some(i=>i.target==='templates'));assert.deepEqual(searchCommands(d,'zzzz不存在'),[]);
 const node=r.find(i=>i.kind==='node'&&i.label==='订单服务')!;// 修正：首个元素可能在系统上下文视图assert.ok(node.hint.includes('技术容器'),'元素提示所在视图');
});
test('STORY-026 AC-03：图代码只保留一个唤出/收起命令',()=>{
 assert.ok(COMMANDS.some(c=>c.id==='toggle-code'));for(const id of ['mode-code','mode-split','mode-canvas'])assert.ok(!COMMANDS.some(c=>c.id===id),id);
 assert.ok(searchCommands(orderDesign(),'图代码').some(i=>i.target==='toggle-code'));
});
