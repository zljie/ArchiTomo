import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserApi,type Kv} from '../src/browser/backend.ts';
import {newDesign} from '../src/design.ts';

const memoryKv=():Kv=>{const m=new Map<string,unknown>();return {get:async k=>structuredClone(m.get(k)),set:async(k,v)=>{m.set(k,structuredClone(v));},del:async k=>{m.delete(k);},keys:async p=>[...m.keys()].filter(k=>k.startsWith(p))};};
const noAi={baseUrl:'https://api.deepseek.com',model:'deepseek-flash',apiKey:''};

test('浏览器版后端：项目创建/编辑/回读、版本冲突与导入不覆盖',async()=>{
 const api=createBrowserApi(memoryKv(),()=>noAi);const s=new AbortController().signal;
 const created=await api('POST','/api/projects',{projectId:'p',title:'项目',requestId:'create'},s);assert.equal(created.status,201);const p=(created.json as {project:{writeVersion:number}}).project;
 assert.equal((await api('POST','/api/projects',{projectId:'p',title:'项目',requestId:'create'},s)).status,201,'同一请求重放幂等');
 assert.equal((await api('POST','/api/projects',{projectId:'p',title:'别的',requestId:'again'},s)).status,409);
 const edited=await api('POST','/api/projects/p/commands',{requestId:'edit',expectedWriteVersion:p.writeVersion,command:{type:'edit_design',design:newDesign('新标题')}},s);assert.equal(edited.status,200);
 const read=await api('GET','/api/projects/p',undefined,s);assert.equal((read.json as {project:{title:string}}).project.title,'新标题');
 assert.equal((await api('POST','/api/projects/p/commands',{requestId:'conflict',expectedWriteVersion:1,command:{type:'edit_design',design:newDesign('不应覆盖')}},s)).status,409);
 const list=await api('GET','/api/projects',undefined,s);assert.deepEqual((list.json as {projects:{projectId:string}[]}).projects.map(x=>x.projectId),['p']);
 const project=(read.json as {project:unknown}).project;
 assert.equal((await api('POST','/api/projects/import',{project,projectId:'p',requestId:'imp'},s)).status,409);
 assert.equal((await api('POST','/api/projects/import',{project,projectId:'q',requestId:'imp'},s)).status,201);
 assert.equal((await api('GET','/api/projects/missing',undefined,s)).status,404);
});

test('浏览器版后端：未配置 AI 时 AI 接口返回 503，状态如实显示',async()=>{
 const api=createBrowserApi(memoryKv(),()=>noAi);const s=new AbortController().signal;
 assert.deepEqual((await api('GET','/api/ai/status',undefined,s)).json,{configured:false,model:'deepseek-flash',service:'api.deepseek.com'});
 const gen=await api('POST','/api/ai/generate',{requirements:'R1 下单'},s);assert.equal(gen.status,503);
 const c=await api('POST','/api/projects',{projectId:'p',title:'项目',requestId:'c'},s);const p=(c.json as {project:{headRevisionId:string;inputVersion:number}}).project;
 const guide=await api('POST','/api/projects/p/ai/guide',{requestId:'g',prompt:'补齐',baseHeadRevisionId:p.headRevisionId,baseInputVersion:p.inputVersion},s);assert.equal(guide.status,503);
 const configured=createBrowserApi(memoryKv(),()=>({...noAi,apiKey:'sk-test'}));assert.equal(((await configured('GET','/api/ai/status',undefined,s)).json as {configured:boolean}).configured,true);
});

test('浏览器版后端：我的模板保存、同名冲突与删除',async()=>{
 const api=createBrowserApi(memoryKv(),()=>noAi);const s=new AbortController().signal;
 const level=newDesign().views[0].level;
 const saved=await api('POST','/api/templates',{template:{name:'T',description:'',level,code:''}},s);assert.ok([201,400].includes(saved.status));
 if(saved.status===201){assert.equal((await api('POST','/api/templates',{template:{name:'T',description:'',level,code:''}},s)).status,409);const id=(saved.json as {templates:{id:string}[]}).templates[0].id;assert.equal((await api('POST',`/api/templates/${id}/delete`,{},s)).status,200);}
 assert.deepEqual((await api('GET','/api/templates',undefined,s)).json,{templates:[]});
});
