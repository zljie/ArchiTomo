import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../server/projects.ts';
import { newDesign } from '../src/design.ts';

test('磁盘项目重开/幂等/冲突/跨实例串行保持持久化版本',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archsketch-store-'));
 try{const a=new ProjectStore(root),b=new ProjectStore(root);const p=await a.create('p','测试','create-1');
 assert.equal((await b.read('p')).projectId,'p');
 const request={requestId:'edit-1',expectedWriteVersion:1,command:{type:'edit_design' as const,design:newDesign('新标题')}};
 const saved=await a.commit('p',request);assert.equal(saved.writeVersion,2);
 assert.equal((await b.commit('p',request)).writeVersion,2);
 await assert.rejects(()=>b.commit('p',{...request,command:{...request.command,design:newDesign('另一个')}}),/重复|冲突/);
 await assert.rejects(()=>a.commit('p',{...request,requestId:'edit-2'}),/冲突/);
 const attempts=await Promise.allSettled([a.commit('p',{...request,requestId:'a',expectedWriteVersion:2}),b.commit('p',{...request,requestId:'b',expectedWriteVersion:2})]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await a.read('p')).writeVersion,3);
 assert.equal(p.writeVersion,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('写入备份失败不改变原项目，路径越界及符号链接被拒绝',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archsketch-fault-'));const outside=await mkdtemp(join(tmpdir(),'archsketch-outside-'));
 try{const store=new ProjectStore(root);await store.create('safe','设计','create');
 assert.equal((await store.list()).length,1);
 const path=join(root,'safe','project.json');const before=await readFile(path,'utf8');
 await mkdir(join(root,'safe','project.previous.json'));
 await assert.rejects(()=>store.commit('safe',{requestId:'write',expectedWriteVersion:1,command:{type:'edit_design',design:newDesign('不能写入')}}));
 assert.equal(await readFile(path,'utf8'),before);
 await assert.rejects(()=>store.read('../outside'));
 await symlink(outside,join(root,'escape'));
 await assert.rejects(()=>store.create('escape','外部','x'));
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
