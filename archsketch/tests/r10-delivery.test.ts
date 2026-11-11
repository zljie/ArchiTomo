import test from 'node:test';import assert from 'node:assert/strict';
import {newDesign,type Design,type Operation} from '../src/design.ts';
import {applyOperations} from '../src/project.ts';
import {siblingOverlaps,withLayout} from '../src/proposalLayout.ts';

const node=(id:string,name:string)=>({id,name,role:'service',level:'technical',technology:'',description:'',sourceIds:[]}) as Design['nodes'][number];
function grouped():{before:Design;ops:Operation[]}{
 const before=newDesign('t');
 const ops:Operation[]=[node('k1','知识服务'),node('k2','知识库'),node('a1','Admin'),node('a2','Admin 库'),node('v1','视频事件')].map(n=>({type:'set_node',node:n}) as Operation);
 ops.push({type:'set_group',group:{id:'g-k',name:'知识区',elementIds:['k1','k2']}} as Operation,{type:'set_group',group:{id:'g-a',name:'Admin 区',elementIds:['a1','a2']}} as Operation,{type:'set_group',group:{id:'g-v',name:'视频区',elementIds:['v1']}} as Operation);
 // 规则网格：同组成员被别组节点隔开，外接矩形互相覆盖（F-05 复现）
 ops.push({type:'set_view',view:{id:'technical',nodeIds:['k1','a1','v1','k2','a2'],positions:{k1:{x:0,y:0},a1:{x:260,y:0},v1:{x:520,y:0},k2:{x:0,y:160},a2:{x:780,y:160}}}});
 return {before,ops};
}
test('STORY-034 AC-01：复现——规则网格下同级分组相互覆盖',()=>{
 const {before,ops}=grouped();assert.ok(siblingOverlaps(applyOperations(before,ops),'technical')>0);
});
test('STORY-034 AC-01：提案在预览前即带分组布局，同级边界不重叠，且不改语义',async()=>{
 const {before,ops}=grouped();const laid=await withLayout(before,ops);const after=applyOperations(before,laid);
 assert.equal(siblingOverlaps(after,'technical'),0);
 const plain=applyOperations(before,ops);const strip=(d:Design)=>({...d,views:d.views.map(v=>({...v,positions:{}}))});
 assert.deepEqual(strip(after),strip(plain),'布局只改坐标');
});
import {createHash} from 'node:crypto';
import {orderDesign} from '../src/design.ts';
import {createProject,executeCommand,head,parseProject} from '../src/project.ts';
import {reviewHtml,viewSvgFiles,buildRelease} from '../src/reviewPackage.ts';
function orderProject(){let p=createProject('p','订单',orderDesign());const d=structuredClone(head(p));d.decisions[0].selectedId='monolith';p=executeCommand(p,{type:'edit_design',design:d});
 p=executeCommand(p,{type:'set_inputs',source:{id:'src-1',name:'需求材料',content:'原始需求全文 ABCXYZ',kind:'text'}});return p;}
test('STORY-034 AC-02：评审版 HTML 含目录、各视图图、真实决策状态、未决事项；原材料与内部 ID 只在附录',()=>{
 const p=orderProject();const html=reviewHtml(p);const d=head(p);
 assert.match(html,/<nav[^>]*>[\s\S]*目录/);for(const v of d.views.filter(v=>v.nodeIds.length))assert.ok(html.includes(`>${v.name}<`),v.name);
 assert.ok((html.match(/<svg/g)||[]).length>=d.views.filter(v=>v.nodeIds.length).length,'每个非空视图一张图');
 assert.match(html,/提议中 · 已选待接受/);assert.doesNotMatch(html,/accepted/);assert.match(html,/未决事项/);
 const at=html.indexOf('id="appendix"');assert.ok(at>0,'有附录');const main=html.slice(0,at);
 assert.ok(!main.includes('ABCXYZ'),'原材料不在正文');assert.ok(html.slice(at).includes('ABCXYZ'));
 const nodeId=d.nodes.find(n=>/[-]/.test(n.id))?.id||d.nodes[0].id;assert.ok(!main.replace(/<svg[\s\S]*?<\/svg>/g,'').includes(p.headRevisionId),'修订 ID 只在附录');void nodeId;
 assert.ok(!html.includes('<script'),'不含脚本');
});
test('STORY-034 AC-03：勾选多视图一次导出同一修订',()=>{
 const p=orderProject();const views=head(p).views.filter(v=>v.nodeIds.length).slice(0,2).map(v=>v.id);const files=viewSvgFiles(p,views);
 assert.equal(files.length,2);assert.ok(files.every(f=>f.path.includes(p.headRevisionId.slice(0,8))&&f.content.startsWith('<svg')));
});
test('STORY-035 AC-01/02：发布基线生成绑定修订的不可变交付包，已发布不可改',()=>{
 let p=orderProject();p=executeCommand(p,{type:'create_baseline',name:'评审基线 B1',revisionId:p.headRevisionId});const b=p.baselines[0];
 const files=buildRelease(p,b.id,'张工','2026-10-19T08:00:00.000Z');const paths=files.map(f=>f.path);
 for(const need of ['model.json','review.html','adr.md','decisions.json','checks.json'])assert.ok(paths.includes(need),need);assert.ok(paths.some(x=>/^views\/.+\.svg$/.test(x)));
 assert.deepEqual(buildRelease(p,b.id,'张工','2026-10-19T08:00:00.000Z'),files,'同输入可复现');
 const decisions=JSON.parse(files.find(f=>f.path==='decisions.json')!.content);assert.equal(decisions[0].state,'selected');
 const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
 const release={id:'rel-1',baselineId:b.id,revisionId:b.revisionId,approvedBy:'张工',publishedAt:'2026-10-19T08:00:00.000Z',files:files.map(f=>({path:f.path,sha256:sha(f.content),bytes:Buffer.byteLength(f.content)}))};
 p=executeCommand(p,{type:'record_release',release});assert.equal(p.releases?.length,1);
 assert.throws(()=>executeCommand(p,{type:'record_release',release:{...release,id:'rel-2'}}),/已发布/);
 assert.throws(()=>executeCommand(p,{type:'record_release',release:{...release,id:'rel-3',revisionId:'other'}}));
 const tampered=structuredClone(p);tampered.releases![0].approvedBy='李工';const next=executeCommand(p,{type:'edit_design',design:head(p)});assert.deepEqual(next.releases,p.releases,'后续命令不改已发布交付包');
 assert.doesNotThrow(()=>parseProject(p));
});
import {mkdtemp,rm,chmod,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from '../server/projects.ts';
test('STORY-035 AC-01/02：服务端发布写入只读文件并记录哈希；文件被改动后拒绝读取；同一基线不能再发布',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archsketch-rel-'));
 try{const s=new ProjectStore(root);let p=await s.create('p','订单','c1',orderDesign());
  p=await s.commit('p',{requestId:'b1',expectedWriteVersion:p.writeVersion,command:{type:'create_baseline',name:'B1',revisionId:p.headRevisionId}});
  p=await s.publish('p','pub-1',p.baselines[0].id,'张工');const rel=p.releases![0];assert.equal(rel.approvedBy,'张工');assert.ok(rel.files.length>=6);
  assert.equal((await s.publish('p','pub-1',p.baselines[0].id,'张工')).releases!.length,1,'重复请求幂等');
  await assert.rejects(s.publish('p','pub-2',p.baselines[0].id,'李工'),/已发布/);
  const f=await s.releaseFile('p',rel.id,'review.html');assert.match(f.content.toString(),/评审版/);
  const file=join(root,'p','releases',rel.id,'decisions.json');assert.equal((await stat(file)).mode&0o222,0,'文件只读');
  await chmod(file,0o600);await writeFile(file,'[]');await assert.rejects(s.releaseFile('p',rel.id,'decisions.json'),/哈希不一致/);
 }finally{await rm(root,{recursive:true,force:true});}
});
