import test from 'node:test';import assert from 'node:assert/strict';
import {highlight} from '../src/highlight.ts';
const join=(lines:ReturnType<typeof highlight>)=>lines.map(l=>l.map(t=>t.text).join('')).join('\n');
const kinds=(line:ReturnType<typeof highlight>[number])=>line.filter(t=>t.text.trim()).map(t=>t.kind+':'+t.text.trim());

test('STORY-010 AC-01：分词拼接等于原文，关键语法有类型',()=>{
 const code='// 注释\ndirection down\nAPI 网关 [type: gateway, tech: "Kong 3"] {\n  订单服务 [type: service]\n}\n网关 > 订单服务, 库存: 路由\n队列 --> 通知 [type: depends_on]';
 const lines=highlight(code);assert.equal(join(lines),code);
 assert.deepEqual(kinds(lines[0]),['comment:// 注释']);
 assert.deepEqual(kinds(lines[1]),['keyword:direction','value:down']);
 assert.deepEqual(kinds(lines[2]),['name:API 网关','punct:[','key:type','punct::','value:gateway','punct:,','key:tech','punct::','value:"Kong 3"','punct:]','punct:{']);
 assert.deepEqual(kinds(lines[5]),['name:网关','op:>','name:订单服务','punct:,','name:库存','punct::','text:路由']);
 assert.ok(kinds(lines[6]).includes('op:-->'));
});
test('STORY-010：引号或括号未闭合、非法行不抛错且不丢字符',()=>{
 for(const code of ['名称 [type: "未闭合','A > ','[[[ ]]','  }','"引号 名" > B: x:y','a -- b -->']){assert.doesNotThrow(()=>highlight(code));assert.equal(join(highlight(code)),code);}
});
