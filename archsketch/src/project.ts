import { changedObjects, impact } from './reasoning.ts';
import { traceDownstream } from './profile.ts';
import { isLevel, type Level } from './levels.ts';
import { parseGuideRound, type GuideRound } from './guideRound.ts';
import { ONBOARDING_STATUSES, type Onboarding, type BizCandidate } from './onboarding.ts';
import { newDesign, validateDesign, record, string, array, identifier, keys, DOMAINS, type Design, type DesignView, type Operation, type Constraint } from './design.ts';
export type Source = {id:string;name:string;content:string;kind:'text'|'markdown'|'json'};
export type Message = {id:string;role:'user'|'assistant';content:string;sourceIds:string[];outcome?:{kept:number;dropped:string[]}};
export type ChangeSetMeta = {rationale:string;impact:string[];tradeoffs:string[];validation:string[]};
export type Proposal = {id:string;requestId:string;baseHeadRevisionId:string;baseInputVersion:number;status:'pending'|'stale'|'accepted'|'rejected'|'reverted';summary:string;operations:Operation[];rationale?:string;impact?:string[];tradeoffs?:string[];validation?:string[];approval?:{approvedAt:string;revisionId:string}};
export type Revision = {id:string;parentId:string|null;origin:'manual'|'ai'|'restore';proposalId:string|null;restoredFromId:string|null;createdAt:string;snapshot:Design};
export type GuideOption = {id:string;label:string;detail:string;bundle?:string[]};
export type GuideAnswer = {optionIds:string[];note:string;answeredAt:string};
export type Question = {id:string;source:'ai'|'builtin';domain:string;title:string;why:string;options:GuideOption[];multi:boolean;status:'open'|'answered'|'skipped';answer:GuideAnswer|null;history:GuideAnswer[];proposalId:string|null;createdAt:string;round?:number};
export type Receipt = {requestId:string;hash:string;writeVersion:number;headRevisionId:string;inputVersion:number};
export type Project = {format:'archsketch-project';formatVersion:1;projectId:string;title:string;writeVersion:number;inputVersion:number;headRevisionId:string;sources:Source[];conversation:Message[];revisions:Revision[];proposals:Proposal[];baselines:{id:string;name:string;revisionId:string}[];receipts:Receipt[];questions:Question[];onboarding?:Onboarding;guideRound?:GuideRound;profileLevel?:Level;releases?:Release[];reviewIssues?:ReviewIssue[]};
/** 评审问题（STORY-037 / W3）：确定性检查、AI 点评或人工登记；状态与验证计划随项目保存，解决不等于验证通过。 */
export type ReviewIssue = {id:string;source:'rule'|'ai'|'manual';title:string;severity:'blocking'|'major'|'minor'|'info';objectIds:string[];basis:string;fix:string;owner:string;status:'open'|'in_progress'|'resolved'|'wontfix';verificationPlan:string;createdAt:string;updatedAt?:string};
/** 不可变交付包清单（STORY-035）：文件由服务端只写一次，项目只记录逐文件哈希。 */
export type Release = {id:string;baselineId:string;revisionId:string;approvedBy:string;publishedAt:string;files:{path:string;sha256:string;bytes:number}[]};
export type Command = {type:'edit_design';design:Design}|{type:'set_inputs';source:Source;message?:Message}|{type:'accept_proposal';proposalId:string}|{type:'reject_proposal';proposalId:string}|{type:'create_baseline';name:string;revisionId:string}|{type:'restore_revision';revisionId:string}|{type:'answer_question';questionId:string;optionIds:string[];note:string;skip?:boolean;question?:Question}|{type:'onboard_goal';statement:string;metrics:string[];constraints:{kind:string;name:string;value:string;unit:string}[]}|{type:'set_business_candidates';candidates:BizCandidate[]}|{type:'apply_business';selectedIds:string[]}|{type:'set_onboarding_status';status:Onboarding['status']}|{type:'set_profile_level';level:Level}|{type:'undo_proposal';proposalId:string}|{type:'record_release';release:Release}|{type:'set_review_issue';issue:ReviewIssue};
export class ProjectError extends Error { status:number;code:string; constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;} }
export const head = (p:Project) => p.revisions.find(r=>r.id===p.headRevisionId)!.snapshot;
export function createProject(projectId:string,title:string,design:Design=newDesign(title)):Project { const id=crypto.randomUUID();return {format:'archsketch-project',formatVersion:1,projectId,title:design.title,writeVersion:1,inputVersion:0,headRevisionId:id,sources:[],conversation:[],revisions:[{id,parentId:null,origin:'manual',proposalId:null,restoredFromId:null,createdAt:new Date().toISOString(),snapshot:design}],proposals:[],baselines:[],receipts:[],questions:[]}; }
function parseAnswer(value:unknown,q:{options:GuideOption[];multi:boolean}):GuideAnswer{const a=record(value);keys(a,['optionIds','note','answeredAt']);const ids=array(a.optionIds,20).map(identifier);string(a.note,4000,false,'补充说明');string(a.answeredAt,100,true);if(new Set(ids).size!==ids.length||ids.some(id=>!q.options.some(o=>o.id===id))||(!q.multi&&ids.length>1))throw Error('回答选项无效');if(!ids.length&&!String(a.note).trim())throw Error('回答需要选项或补充说明');return a as unknown as GuideAnswer;}
/** 引导问题卡片（STORY-006）：一次一题、选项、回答及修改历史随项目保存。 */
export function parseQuestion(value:unknown):Question{
 const q=record(value);keys(q,['id','source','domain','title','why','options','multi','status','answer','history','proposalId','createdAt','round']);if(q.round!==undefined&&(!Number.isSafeInteger(q.round)||Number(q.round)<1))throw Error('问题轮次无效');identifier(q.id);
 if(!['ai','builtin'].includes(String(q.source)))throw Error('问题来源无效');if(!(DOMAINS as readonly string[]).includes(String(q.domain)))throw Error('问题域无效');string(q.title,300,true);string(q.why,2000);string(q.createdAt,100,true);
 const options=array(q.options,8).map(record);if(options.length<2)throw Error('问题至少需要两个选项');const oids=new Set<string>();for(const o of options){keys(o,['id','label','detail','bundle']);if(o.bundle!==undefined)array(o.bundle,8).forEach(x=>string(x,60,true));const id=identifier(o.id);if(oids.has(id))throw Error('选项ID重复');oids.add(id);string(o.label,120,true);string(o.detail,500);}
 if(typeof q.multi!=='boolean')throw Error('问题多选标记无效');if(!['open','answered','skipped'].includes(String(q.status)))throw Error('问题状态无效');if(q.proposalId!==null)identifier(q.proposalId);
 const shape={options:options as unknown as GuideOption[],multi:q.multi};if(q.answer!==null)parseAnswer(q.answer,shape);if((q.status==='answered')!==(q.answer!==null))throw Error('问题状态与回答不一致');for(const h of array(q.history,200))parseAnswer(h,shape);
 return q as unknown as Question;
}
export function answerText(q:Question,a:GuideAnswer):string{const labels=a.optionIds.map(id=>q.options.find(o=>o.id===id)?.label).filter(Boolean);return `引导问题：${q.title}\n选择：${labels.join('、')||'（未选择预设选项）'}${a.note.trim()?`\n补充：${a.note.trim()}`:''}`;}
/** 初始化向导状态（STORY-025）。 */
export function parseOnboarding(value:unknown):Onboarding{
 const o=record(value);keys(o,['status','goalId','candidates','selectedIds']);if(!ONBOARDING_STATUSES.includes(o.status as Onboarding['status']))throw Error('初始化状态无效');if(o.goalId!==undefined)identifier(o.goalId);
 const ids=new Set<string>();for(const v of array(o.candidates,60)){const c=record(v);keys(c,['id','kind','name','description','steps','rationale']);const id=identifier(c.id);if(ids.has(id))throw Error('候选ID重复');ids.add(id);if(!['capability','process','concept'].includes(String(c.kind)))throw Error('候选类型无效');string(c.name,80,true);string(c.description,500);string(c.rationale,500);if(c.steps!==undefined)array(c.steps,8).forEach(s=>string(s,80,true));}
 for(const id of array(o.selectedIds,60))if(!ids.has(identifier(id)))throw Error('勾选的候选不存在');
 return o as unknown as Onboarding;
}
const CONSTRAINT_KINDS=['scale','availability','cost','team','compliance','deployment','evolution','other'];
const place=(d:Design,viewId:string,nodeId:string)=>{const v=d.views.find(x=>x.id===viewId)!;v.nodeIds.push(nodeId);const i=v.nodeIds.length-1;v.positions[nodeId]=viewId==='scenario'?{x:i*260,y:0}:{x:(i%3)*300,y:Math.floor(i/3)*180};};
function invalid(message:string):never{throw new ProjectError(400,'INVALID_INPUT',message);}
export function parseProject(value:unknown):Project {
 try{
 const p=record(value);keys(p,['format','formatVersion','projectId','title','writeVersion','inputVersion','headRevisionId','sources','conversation','revisions','proposals','baselines','receipts','questions','onboarding','guideRound','profileLevel','releases','reviewIssues']);
 if(p.format!=='archsketch-project'||p.formatVersion!==1)throw Error('项目格式或版本不支持');identifier(p.projectId);string(p.title,120,true);
 for(const k of ['writeVersion','inputVersion'])if(!Number.isSafeInteger(p[k])||Number(p[k])<(k==='writeVersion'?1:0))throw Error('版本无效');
 const sources=array(p.sources,1000).map(record);const sourceIds=new Set(sources.map(s=>identifier(s.id)));if(sourceIds.size!==sources.length)throw Error('材料ID重复');for(const s of sources){string(s.name,200);string(s.content,100000);if(!['text','markdown','json'].includes(String(s.kind)))throw Error('材料类型无效');}
 const messages=array(p.conversation,5000).map(record);const mids=new Set<string>();for(const m of messages){const id=identifier(m.id);if(mids.has(id))throw Error('消息ID重复');mids.add(id);if(!['user','assistant'].includes(String(m.role)))throw Error('消息角色无效');string(m.content,100000);if(m.outcome!==undefined){const o=record(m.outcome);keys(o,['kept','dropped']);if(!Number.isInteger(o.kept)||Number(o.kept)<0)throw Error('AI 结果计数无效');for(const r of array(o.dropped,200))string(r,400);}for(const ref of array(m.sourceIds,100))if(!sourceIds.has(identifier(ref)))throw Error('消息来源不存在');}
 const revisions=array(p.revisions,5000).map(record);if(!revisions.length)throw Error('缺少设计修订');const ids=new Set(revisions.map(r=>identifier(r.id)));if(ids.size!==revisions.length||!ids.has(identifier(p.headRevisionId)))throw Error('当前修订不存在或ID重复');const seen=new Set<string>();
 for(const r of revisions){if(r.parentId!==null&&!seen.has(identifier(r.parentId)))throw Error('修订父级不存在或历史成环');seen.add(String(r.id));if(!['manual','ai','restore'].includes(String(r.origin)))throw Error('修订来源无效');if(r.restoredFromId!==null&&!ids.has(identifier(r.restoredFromId)))throw Error('回退版本不存在');string(r.createdAt,100,true);validateDesign(r.snapshot);for(const n of (r.snapshot as Design).nodes)if(n.sourceIds.some(id=>!sourceIds.has(id)))throw Error('节点材料来源不存在');}
 const props=array(p.proposals,2000).map(record);const propIds=new Set<string>();for(const prop of props){const id=identifier(prop.id);if(propIds.has(id))throw Error('建议ID重复');propIds.add(id);identifier(prop.requestId);if(!ids.has(identifier(prop.baseHeadRevisionId)))throw Error('建议来源修订不存在');if(!Number.isSafeInteger(prop.baseInputVersion)||Number(prop.baseInputVersion)<0)throw Error('建议输入版本无效');if(!['pending','stale','accepted','rejected','reverted'].includes(String(prop.status)))throw Error('建议状态无效');string(prop.summary,20000);array(prop.operations,1000);if(prop.rationale!==undefined)string(prop.rationale,2000);for(const k of ['impact','tradeoffs','validation'])if(prop[k]!==undefined)array(prop[k],8).forEach(x=>string(x,200));if(prop.approval!==undefined){const a=record(prop.approval);string(a.approvedAt,100,true);if(!ids.has(identifier(a.revisionId)))throw Error('批准记录的修订不存在');}}
 const names=new Set<string>();for(const val of array(p.baselines,1000)){const b=record(val);identifier(b.id);string(b.name,100,true);if(names.has(String(b.name))||!ids.has(identifier(b.revisionId)))throw Error('基线名称重复或引用无效');names.add(String(b.name));}
 for(const val of array(p.receipts,10000)){const r=record(val);identifier(r.requestId);string(r.hash,100);if(!Number.isSafeInteger(r.writeVersion)||!ids.has(identifier(r.headRevisionId)))throw Error('保存回执无效');}
 for(const r of revisions)for(const e of (r.snapshot as Design).evidence){const old=revisions.find(r=>r.id===e.revisionId);if(!old||e.objectIds.some(id=>!(old.snapshot as Design).nodes.some(n=>n.id===id)))throw Error('证据历史引用无效');}
 const qids=new Set<string>();for(const val of array(p.questions??[],2000)){const q=parseQuestion(val);if(qids.has(q.id))throw Error('问题ID重复');qids.add(q.id);if(q.proposalId!==null&&!propIds.has(q.proposalId))throw Error('问题关联建议不存在');}
 if(p.onboarding!==undefined)parseOnboarding(p.onboarding);if(p.guideRound!==undefined)parseGuideRound(p.guideRound);if(p.profileLevel!==undefined&&!isLevel(p.profileLevel))throw Error('用户水平无效');if(p.reviewIssues!==undefined){const seenIss=new Set<string>();for(const i of array(p.reviewIssues,500).map(parseIssue)){if(seenIss.has(i.id))throw Error('评审问题ID重复');seenIss.add(i.id);}}if(p.releases!==undefined){const bl=array(p.baselines,1000).map(record);const seenRel=new Set<string>();for(const rel of array(p.releases,200).map(parseRelease)){const b=bl.find(x=>x.id===rel.baselineId);if(!b||b.revisionId!==rel.revisionId||seenRel.has(rel.id))throw Error('交付包清单无效');seenRel.add(rel.id);}}
 const out=structuredClone(p) as unknown as Project;out.questions??=[];return out;
 }catch(error){if(error instanceof ProjectError)throw error;return invalid(error instanceof Error?error.message:'项目无效');}
}
function parseIssue(v:unknown):ReviewIssue{
 const r=record(v);keys(r,['id','source','title','severity','objectIds','basis','fix','owner','status','verificationPlan','createdAt','updatedAt']);
 if(!['rule','ai','manual'].includes(String(r.source)))throw Error('评审问题来源无效');if(!['blocking','major','minor','info'].includes(String(r.severity)))throw Error('评审问题严重度无效');if(!['open','in_progress','resolved','wontfix'].includes(String(r.status)))throw Error('评审问题状态无效');
 const createdAt=string(r.createdAt,40,true);if(Number.isNaN(Date.parse(createdAt)))throw Error('评审问题时间无效');if(r.updatedAt!==undefined&&Number.isNaN(Date.parse(string(r.updatedAt,40))))throw Error('评审问题时间无效');
 return {id:identifier(r.id),source:r.source as ReviewIssue['source'],title:string(r.title,200,true,'问题标题'),severity:r.severity as ReviewIssue['severity'],objectIds:array(r.objectIds,50).map(identifier),basis:string(r.basis,2000,false,'依据'),fix:string(r.fix,2000,false,'建议修复'),owner:string(r.owner,80,false,'负责人'),status:r.status as ReviewIssue['status'],verificationPlan:string(r.verificationPlan,2000,false,'验证计划'),createdAt,...(r.updatedAt!==undefined?{updatedAt:String(r.updatedAt)}:{})};
}
function parseRelease(v:unknown):Release{
 const r=record(v);keys(r,['id','baselineId','revisionId','approvedBy','publishedAt','files']);const files=array(r.files,300).map(record).map(f=>{keys(f,['path','sha256','bytes']);const path=string(f.path,200,true);if(!/^[\w.\-\/]+$/.test(path)||path.includes('..')||path.startsWith('/'))throw Error('交付文件路径无效');const sha=string(f.sha256,64,true);if(!/^[0-9a-f]{64}$/.test(sha))throw Error('交付文件哈希无效');if(!Number.isInteger(f.bytes)||Number(f.bytes)<0)throw Error('交付文件大小无效');return {path,sha256:sha,bytes:Number(f.bytes)};});
 if(!files.length)throw Error('交付包没有文件');const publishedAt=string(r.publishedAt,40,true);if(Number.isNaN(Date.parse(publishedAt)))throw Error('发布时间无效');
 return {id:identifier(r.id),baselineId:identifier(r.baselineId),revisionId:identifier(r.revisionId),approvedBy:string(r.approvedBy,80,true,'批准人').trim(),publishedAt,files};
}
export function executeCommand(project:Project,command:Command):Project {
 const p=structuredClone(project);p.questions??=[];const c=record(command);const type=string(c.type,100,true);
 const revise=(snapshot:Design,origin:Revision['origin'],proposalId:string|null=null,restoredFromId:string|null=null)=>{snapshot=structuredClone(snapshot);const previous=head(p);if(origin!=='restore')for(const dec of previous.decisions){const next=snapshot.decisions.find(d=>d.id===dec.id);if(JSON.stringify(dec)!==JSON.stringify(next)){const rows=impact(snapshot,[...dec.affectedIds,...(next?.affectedIds||[])]);const risk={id:'review-'+dec.id,text:'决策变更待复核：'+dec.title+'；变更前修订 '+p.headRevisionId+'；按依赖、实现、来源、约束、包含及职责关联追踪，完整路径见影响分析。',objectIds:rows.map(r=>r.id)};snapshot.risks=snapshot.risks.filter(r=>r.id!==risk.id);snapshot.risks.push(risk);}}if(origin!=='restore'){guardDecisions(previous,snapshot);recheck(previous,snapshot);traceGoals(previous,snapshot);}for(const e of snapshot.evidence){const base=p.revisions.find(r=>r.id===e.revisionId);if(base&&['pass','fail'].includes(e.result)&&e.objectIds.some(id=>changedObjects(base.snapshot,snapshot).includes(id)))e.result='stale';}const id=crypto.randomUUID();p.revisions.push({id,parentId:p.headRevisionId,origin,proposalId,restoredFromId,createdAt:new Date().toISOString(),snapshot:validateDesign(snapshot)});p.headRevisionId=id;p.title=snapshot.title;};
 if(type==='edit_design'){revise(validateDesign(c.design),'manual');}
 else if(type==='set_inputs'){
  const source=record(c.source);identifier(source.id);if(p.sources.some(s=>s.id===source.id))invalid('材料ID已存在');p.sources.push(source as unknown as Source);p.inputVersion++;
  if(c.message){p.conversation.push(c.message as unknown as Message);}
 }else if(type==='create_baseline'){
  const name=string(c.name,100,true);if(!p.revisions.some(r=>r.id===c.revisionId)||p.baselines.some(b=>b.name===name))invalid('基线名称重复或修订不存在');p.baselines.push({id:crypto.randomUUID(),name,revisionId:String(c.revisionId)});
 }else if(type==='restore_revision'){
  const r=p.revisions.find(r=>r.id===c.revisionId);if(!r)invalid('回退修订不存在');revise(r.snapshot,'restore',null,r.id);
 }else if(type==='accept_proposal'||type==='reject_proposal'){
  const prop=p.proposals.find(x=>x.id===c.proposalId);if(!prop||!['pending','stale'].includes(prop.status))invalid('建议不存在或已经处理');
  if(type==='reject_proposal')prop.status='rejected';else{
   if(prop.baseHeadRevisionId!==p.headRevisionId||prop.baseInputVersion!==p.inputVersion)throw new ProjectError(409,'STALE_PROPOSAL','建议已过期，请根据当前设计重新生成');
   const before=new Set(head(p).nodes.map(n=>n.id));const next=applyOperations(head(p),prop.operations);for(const n of next.nodes)if(!before.has(n.id)&&!n.status)n.status='ai';revise(next,'ai',prop.id);prop.status='accepted';prop.approval={approvedAt:new Date().toISOString(),revisionId:p.headRevisionId};
  }
 }else if(type==='answer_question'){
  try{const id=identifier(c.questionId);let q=p.questions.find(x=>x.id===id);
  if(!q){if(c.question===undefined)invalid('引导问题不存在');const inserted=parseQuestion(c.question);if(inserted.id!==id||inserted.source!=='builtin'||inserted.status!=='open'||inserted.answer!==null||inserted.history.length)invalid('只能补录未作答的内置引导问题');p.questions.push(inserted);q=inserted;}
  if(c.skip===true){if(q.status!=='open')invalid('只能跳过未作答的问题');q.status='skipped';}
  else{const answer=parseAnswer({optionIds:c.optionIds,note:c.note??'',answeredAt:new Date().toISOString()},q);if(q.answer)q.history.push(q.answer);q.answer=answer;q.status='answered';p.conversation.push({id:crypto.randomUUID(),role:'user',content:answerText(q,answer),sourceIds:[]});}
  }catch(e){if(e instanceof ProjectError)throw e;invalid(e instanceof Error?e.message:'回答无效');}
 }else if(type==='onboard_goal'){
  const statement=typeof c.statement==='string'?c.statement.trim():'';if(!statement)invalid('请输入设计目标');if(statement.length>80)invalid('目标请控制在 80 字以内');
  const metrics=array(c.metrics??[],10).map(m=>string(m,200).trim()).filter(Boolean);const d=structuredClone(head(p));const id=crypto.randomUUID();
  d.nodes.push({id,name:statement,level:'goal',role:'goal',technology:'',description:metrics.length?'衡量：'+metrics.join('；'):'',sourceIds:[]});place(d,'goals',id);
  d.constraints=[...(d.constraints||[]),...array(c.constraints??[],20).map(record).filter(x=>String(x.name??'').trim()).map(x=>{const value=string(x.value??'',200).trim();return {id:crypto.randomUUID(),kind:(CONSTRAINT_KINDS.includes(String(x.kind))?x.kind:'other') as Constraint['kind'],name:string(x.name,100).trim(),value,unit:string(x.unit??'',40),status:(value?'confirmed':'unconfirmed') as Constraint['status'],note:'初始化向导录入',objectIds:[],decisionIds:[]};})];
  const layers=d.layers?structuredClone(d.layers):[];const l0=layers.find(l=>l.id==='L0');if(l0)l0.question=statement;else layers.unshift({id:'L0',applicable:true,reason:'',question:statement});d.layers=layers;
  revise(d,'manual');p.onboarding={status:'business',goalId:id,candidates:[],selectedIds:[]};
 }else if(type==='set_business_candidates'){
  if(!p.onboarding||p.onboarding.status!=='business')invalid('当前不在业务拓扑步骤');p.onboarding.candidates=array(c.candidates,60) as BizCandidate[];p.onboarding.selectedIds=[];parseOnboarding(p.onboarding);
 }else if(type==='apply_business'){
  const o=p.onboarding;if(!o||o.status!=='business')invalid('当前不在业务拓扑步骤');const ids=array(c.selectedIds,60).map(String);
  if(ids.some(id=>!o!.candidates.some(x=>x.id===id)))invalid('勾选的候选不存在');const chosen=o!.candidates.filter(x=>ids.includes(x.id));if(!chosen.some(x=>x.kind==='capability'))invalid('请至少勾选一项业务能力');
  const d=structuredClone(head(p));const rel=(source:string,target:string,type:string,label='')=>d.relationships.push({id:crypto.randomUUID(),source,target,type,label});
  for(const x of chosen){
   if(x.kind==='capability'){const id=crypto.randomUUID();d.nodes.push({id,name:x.name,level:'capability',role:'capability',technology:'',description:x.description,sourceIds:[]});place(d,'capabilities',id);if(o!.goalId&&d.nodes.some(n=>n.id===o!.goalId))rel(o!.goalId,id,'motivates');}
   else if(x.kind==='concept'){const id=crypto.randomUUID();d.nodes.push({id,name:x.name,level:'entity',role:'entity',technology:'',description:x.description,sourceIds:[]});place(d,'data',id);}
   else{let prev='';(x.steps||[]).forEach((s,i)=>{const id=crypto.randomUUID();d.nodes.push({id,name:s,level:'step',role:'step',technology:'',description:i===0?'流程：'+x.name:'',sourceIds:[],order:i+1});place(d,'scenario',id);if(prev)rel(prev,id,'next');prev=id;});}
  }
  revise(d,'ai');o!.selectedIds=ids;o!.status='technical';
 }else if(type==='undo_proposal'){
  const prop=p.proposals.find(x=>x.id===c.proposalId);if(!prop||prop.status!=='accepted'||!prop.approval)invalid('只能撤销已应用的建议');
  if(prop!.approval!.revisionId!==p.headRevisionId)throw new ProjectError(409,'UNDO_CONFLICT','应用后已有新的修改，不能直接撤销；请在历史中回退到应用前的修订');
  const applied=p.revisions.find(r=>r.id===p.headRevisionId)!;const parent=p.revisions.find(r=>r.id===applied.parentId);if(!parent)invalid('找不到应用前的修订');revise(parent!.snapshot,'restore',null,parent!.id);prop!.status='reverted';
 }else if(type==='set_profile_level'){
  if(!isLevel(c.level))invalid('用户水平无效');p.profileLevel=c.level;
 }else if(type==='set_onboarding_status'){
  if(!ONBOARDING_STATUSES.includes(c.status as Onboarding['status']))invalid('初始化状态无效');p.onboarding={...(p.onboarding||{candidates:[],selectedIds:[]}),status:c.status as Onboarding['status']};
 }else if(type==='record_release'){
  const rel=parseRelease(c.release);const b=p.baselines.find(x=>x.id===rel.baselineId);if(!b||b.revisionId!==rel.revisionId)invalid('交付包必须绑定已命名基线的修订');
  p.releases??=[];if(p.releases.some(x=>x.baselineId===rel.baselineId))invalid('该基线已发布交付包，已发布内容不可修改');if(p.releases.some(x=>x.id===rel.id))invalid('交付包ID重复');p.releases.push(rel);
 }else if(type==='set_review_issue'){
  const issue=parseIssue(c.issue);p.reviewIssues??=[];const at=p.reviewIssues.findIndex(x=>x.id===issue.id);if(at<0){if(p.reviewIssues.length>=500)invalid('评审问题过多');p.reviewIssues.push(issue);}else p.reviewIssues[at]={...issue,createdAt:p.reviewIssues[at].createdAt,updatedAt:new Date().toISOString()};
 }else invalid('未知项目命令');
 if(JSON.stringify(project.releases??[])!==JSON.stringify((p.releases??[]).slice(0,(project.releases??[]).length)))invalid('已发布的交付包不可修改');
 p.writeVersion++;
 for(const prop of p.proposals)if(prop.status==='pending'&&(prop.baseHeadRevisionId!==p.headRevisionId||prop.baseInputVersion!==p.inputVersion))prop.status='stale';
 return parseProject(p);
}
/** 去掉既无成员也无子分组的分组（逐层向上）。 */
export function pruneGroups(groups:Design['boundaries']):Design['boundaries']{let out=groups;for(;;){const keep=out.filter(b=>b.elementIds.length||out.some(c=>c.parentId===b.id));if(keep.length===out.length)return out;out=keep;}}
/** 已接受/已取代的决策不可原地修改（ADR-006）：只允许因删除元素收缩影响对象，以及已接受 → 已取代。 */
function guardDecisions(previous:Design,next:Design){
 const core=(x:Design['decisions'][number])=>JSON.stringify({...x,affectedIds:undefined,status:undefined,supersededBy:undefined});
 for(const old of previous.decisions){if(old.status!=='accepted'&&old.status!=='superseded')continue;const now=next.decisions.find(x=>x.id===old.id);
  const label=old.status==='accepted'?'已接受':'已取代';if(!now)invalid(`${label}的决策“${old.title}”不能删除`);
  if(core(old)!==core(now!)||now!.affectedIds.some(id=>!old.affectedIds.includes(id)))invalid(`${label}的决策“${old.title}”不能直接修改，请先取代`);
  if(old.status==='superseded'&&(now!.status!=='superseded'||now!.supersededBy!==old.supersededBy))invalid(`已取代的决策“${old.title}”不能直接修改`);
  if(old.status==='accepted'&&now!.status!=='accepted'&&now!.status!=='superseded')invalid(`已接受的决策“${old.title}”不能退回提议，请先取代`);}
}
/** 目标或业务能力的名称/描述变化 → 下游复核提示（不改写对象）。 */
function traceGoals(previous:Design,next:Design){
 for(const old of previous.nodes){if(!['goal','capability'].includes(old.level))continue;const now=next.nodes.find(n=>n.id===old.id);if(!now||(now.name===old.name&&now.description===old.description))continue;
  const ids=new Set(next.nodes.map(n=>n.id));const all=traceDownstream(next,old.id);const down=all.filter(id=>ids.has(id));const decs=all.filter(id=>next.decisions.some(x=>x.id===id)).length;if(!down.length)continue;const id='trace-'+old.id;
  next.risks=next.risks.filter(r=>r.id!==id);next.risks.push({id,text:`${old.level==='goal'?'目标':'业务能力'}“${old.name}”已变化：下游 ${down.length} 个元素${decs?`、${decs} 个决策`:''}待复核`,objectIds:down});}
}
/** 约束、质量场景或分析点变化 → 关联决策“待重查”（ADR-003）；只追加风险，不改写决策。 */
function recheck(previous:Design,snapshot:Design){
 const reasons=new Map<string,string[]>();
 for(const area of ['constraints','scenarios','points'] as const){const before=new Map((previous[area]||[]).map(x=>[x.id,x]));const after=new Map((snapshot[area]||[]).map(x=>[x.id,x]));
  for(const id of new Set([...before.keys(),...after.keys()])){const a=before.get(id),b=after.get(id);if(JSON.stringify(a)===JSON.stringify(b))continue;
   const label=(x:typeof a)=>!x?'':'name' in x?x.name:'stimulus' in x?(x.stimulus||x.attribute):x.text;
   for(const dec of new Set([...(a?.decisionIds||[]),...(b?.decisionIds||[])])){const list=reasons.get(dec)||[];list.push(label(b||a));reasons.set(dec,list);}}}
 for(const [decId,names] of reasons){const dec=snapshot.decisions.find(d=>d.id===decId);if(!dec)continue;const id='recheck-'+decId;
  snapshot.risks=snapshot.risks.filter(r=>r.id!==id);snapshot.risks.push({id,text:'约束或质量场景变化，决策待重查：'+dec.title+'（'+[...new Set(names)].join('、')+'）',objectIds:impact(snapshot,dec.affectedIds).map(r=>r.id)});}
}
export function applyOperations(design:Design,operations:Operation[]):Design {
 const d=structuredClone(design);array(operations,1000);
 for(const val of structuredClone(operations)){const op=record(val);
  if(op.type==='set_node'){
   const n=record(op.node) as unknown as Design['nodes'][number];const at=d.nodes.findIndex(x=>x.id===n.id);if(at<0)d.nodes.push(n);else d.nodes[at]=n;
   for(const v of d.views){if(v.level===n.level&&!v.nodeIds.includes(n.id)){v.nodeIds.push(n.id);v.positions[n.id]={x:((v.nodeIds.length-1)%3)*300,y:Math.floor((v.nodeIds.length-1)/3)*180};}else if(v.level!==n.level&&v.nodeIds.includes(n.id)){v.nodeIds=v.nodeIds.filter(id=>id!==n.id);delete v.positions[n.id];}}
  }else if(op.type==='remove_node'){
   const id=identifier(op.id);d.nodes=d.nodes.filter(n=>n.id!==id).map(n=>({...n,...(n.parentId===id?{parentId:undefined}:{}),...(n.relatedIds?{relatedIds:n.relatedIds.filter(x=>x!==id)}:{})}));d.relationships=d.relationships.filter(r=>r.source!==id&&r.target!==id);for(const v of d.views){v.nodeIds=v.nodeIds.filter(x=>x!==id);delete v.positions[id];}for(const c of d.coverage)c.objectIds=c.objectIds.filter(x=>x!==id);for(const dec of d.decisions)dec.affectedIds=dec.affectedIds.filter(x=>x!==id);for(const r of d.risks)r.objectIds=r.objectIds.filter(x=>x!==id);for(const c of d.constraints||[])c.objectIds=c.objectIds.filter(x=>x!==id);for(const q of d.scenarios||[])q.objectIds=q.objectIds.filter(x=>x!==id);for(const pt of d.points||[])pt.objectIds=pt.objectIds.filter(x=>x!==id);d.boundaries=pruneGroups(d.boundaries.map(b=>({...b,elementIds:b.elementIds.filter(x=>x!==id)})));
  }else if(op.type==='set_relation'){
   const r=record(op.relation) as unknown as Design['relationships'][number];const at=d.relationships.findIndex(x=>x.id===r.id);if(at<0)d.relationships.push(r);else d.relationships[at]=r;
  }else if(op.type==='set_coverage'){
   const c=record(op.coverage) as unknown as Design['coverage'][number];const at=d.coverage.findIndex(x=>x.domain===c.domain);if(at<0)invalid('问题域不存在');d.coverage[at]=c;
  }else if(op.type==='set_decision'){
   const dec=record(op.decision) as unknown as Design['decisions'][number];const old=d.decisions.find(x=>x.id===dec.id);delete dec.selectedId;if(old?.selectedId&&dec.candidates.some(c=>c.id===old.selectedId))dec.selectedId=old.selectedId;const at=d.decisions.findIndex(x=>x.id===dec.id);if(at<0)d.decisions.push(dec);else d.decisions[at]=dec;
  }else if(op.type==='set_risk'){
   const r=record(op.risk) as unknown as Design['risks'][number];const at=d.risks.findIndex(x=>x.id===r.id);if(at<0)d.risks.push(r);else d.risks[at]=r;
  }else if(op.type==='set_evidence'){
   const e=record(op.evidence) as unknown as Design['evidence'][number];e.result='planned';const at=d.evidence.findIndex(x=>x.id===e.id);if(at<0)d.evidence.push(e);else d.evidence[at]=e;
  }else if(op.type==='remove_relation'){
   const id=identifier(op.id);d.relationships=d.relationships.filter(r=>r.id!==id);
  }else if(op.type==='set_group'){
   const g=record(op.group) as unknown as Design['boundaries'][number];const at=d.boundaries.findIndex(x=>x.id===g.id);for(const other of d.boundaries)if(other.id!==g.id)other.elementIds=other.elementIds.filter(x=>!g.elementIds.includes(x));if(at<0)d.boundaries.push(g);else d.boundaries[at]=g;
  }else if(op.type==='remove_group'){
   const id=identifier(op.id);const gone=d.boundaries.find(b=>b.id===id);d.boundaries=d.boundaries.filter(b=>b.id!==id).map(b=>b.parentId===id?(({parentId,...rest})=>gone?.parentId?{...rest,parentId:gone.parentId}:rest)(b):b);
  }else if(op.type==='set_view'){
   const view=record(op.view);const v=d.views.find(x=>x.id===view.id);if(!v)invalid('视图不存在');if(view.nodeIds!==undefined)v.nodeIds=array(view.nodeIds,500).map(identifier);v.positions={...v.positions,...record(view.positions) as Record<string,{x:number;y:number}>};for(const id of Object.keys(v.positions))if(!v.nodeIds.includes(id))delete v.positions[id];if(view.direction===undefined)delete v.direction;else v.direction=view.direction as DesignView['direction'];
  }else invalid('不支持的AI变更类型');
 }
 return validateDesign(d);
}
export function designDiff(before:Design,after:Design):{area:string;id:string;before:unknown;after:unknown}[]{
 const changes:{area:string;id:string;before:unknown;after:unknown}[]=[];
 for(const area of ['nodes','relationships','coverage','decisions','assumptions','risks','evidence','constraints','scenarios','points'] as const){const key=(x:unknown)=>{const r=record(x);return String(r.id||r.domain);};const old=new Map((before[area]||[]).map(x=>[key(x),x]));const current=new Map((after[area]||[]).map(x=>[key(x),x]));for(const id of new Set([...old.keys(),...current.keys()]))if(JSON.stringify(old.get(id))!==JSON.stringify(current.get(id)))changes.push({area,id,before:old.get(id)??null,after:current.get(id)??null});}
 return changes;
}
/** 把 before 变为 after 的增量操作（节点、关系、分组、视图）；用于把图代码草图变成待审建议。 */
export function operationsBetween(before:Design,after:Design):Operation[]{
 const ops:Operation[]=[];const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);let work=before;
 const step=(batch:Operation[])=>{if(batch.length){ops.push(...batch);work=applyOperations(work,batch);}};
 step(work.nodes.filter(n=>!after.nodes.some(x=>x.id===n.id)).map(n=>({type:'remove_node' as const,id:n.id})));
 step(after.nodes.filter(n=>!same(n,work.nodes.find(x=>x.id===n.id))).map(n=>({type:'set_node' as const,node:structuredClone(n)})));
 step(work.relationships.filter(r=>!after.relationships.some(x=>x.id===r.id)).map(r=>({type:'remove_relation' as const,id:r.id})));
 step(after.relationships.filter(r=>!same(r,work.relationships.find(x=>x.id===r.id))).map(r=>({type:'set_relation' as const,relation:structuredClone(r)})));
 step(work.boundaries.filter(g=>!after.boundaries.some(x=>x.id===g.id)).map(g=>({type:'remove_group' as const,id:g.id})));
 step(after.boundaries.filter(g=>!same(g,work.boundaries.find(x=>x.id===g.id))).map(g=>({type:'set_group' as const,group:structuredClone(g)})));
 step(after.views.filter(v=>{const w=work.views.find(x=>x.id===v.id);return w&&!same([v.nodeIds,v.positions,v.direction],[w.nodeIds,w.positions,w.direction]);}).map(v=>({type:'set_view' as const,view:{id:v.id,nodeIds:[...v.nodeIds],positions:structuredClone(v.positions),...(v.direction?{direction:v.direction}:{})}})));
 return ops;
}
