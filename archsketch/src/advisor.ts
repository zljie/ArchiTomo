import type { Constraint, Decision, Design } from './design.ts';
/**
 * 规则推荐与权重敏感性（STORY-019 / ADR-004）：确定性启发式，只读取结构化约束，不调用 AI、不修改设计。
 * 缺失约束 → 对应维度评分为 null（不计总分）并列入缺口；理由逐条注明约束值与确认状态。
 */
export type Playbook={id:string;title:string;description:string};
export type Recommendation={playbookId:string;title:string;dimensions:{id:string;name:string;weight:number}[];candidates:{id:string;name:string;scores:Record<string,number|null>;reasons:string[];violations:string[]}[];basis:{constraintId:string;name:string;value:string;unit:string;status:string}[];missing:string[]};
export type Sensitivity={leader:string|null;rows:{dimensionId:string;name:string;weight:number;flipAt:number|null;newLeader:string|null}[];note:string};
export const PLAYBOOKS:Playbook[]=[
 {id:'architecture-style',title:'架构风格：单体、模块化单体还是微服务',description:'依据团队规模、部署方式、吞吐与可用性目标'},
 {id:'data-consistency',title:'数据一致性：强一致事务、Saga 补偿还是最终一致',description:'依据合规要求、可用性目标、吞吐与团队规模'},
 {id:'deployment-model',title:'部署形态：公有云托管、私有化还是混合',description:'依据部署要求、合规、成本、团队与弹性需求'},
];
const KIND_LABEL:Record<string,string>={scale:'规模 / 吞吐',availability:'可用性 SLA',cost:'成本',team:'团队规模',compliance:'合规',deployment:'部署方式',evolution:'演进周期'};
const num=(c?:Constraint)=>{if(!c||!c.value.trim())return null;const m=/(-?\d+(?:\.\d+)?)/.exec(c.value.replace(/,/g,''));if(!m)return null;let v=Number(m[1]);if(/万/.test(c.value+c.unit))v*=10000;if(/亿/.test(c.value+c.unit))v*=1e8;return v;};
const label=(c:Constraint)=>`“${c.name} = ${c.value}${c.unit}（${c.status==='confirmed'?'已确认':'待确认'}）”`;
/** 吞吐折算为峰值每秒：按日量时取平均×5 的高峰系数。 */
function peakPerSecond(cs:Constraint[]):{value:number;source:Constraint}|null{
 for(const c of cs.filter(c=>c.kind==='scale')){const v=num(c);if(v===null)continue;const u=(c.unit+c.name).toLowerCase();if(/秒|qps|tps|\/s/.test(u))return {value:v,source:c};if(/日|天|day/.test(u))return {value:v/86400*5,source:c};}
 return null;
}
type Rule={dimension:{id:string;name:string;weight:number};needs:string;score:(cs:Constraint[])=>{scores:Record<string,number>;source:Constraint;note:string}|null};
const band=<T,>(v:number,steps:[number,T][],last:T):T=>{for(const [limit,out] of steps)if(v<=limit)return out;return last;};
const teamOf=(cs:Constraint[])=>{const c=cs.find(c=>c.kind==='team'&&num(c)!==null);return c?{v:num(c)!,c}:null;};
const deployOf=(cs:Constraint[])=>{const c=cs.find(c=>c.kind==='deployment'&&c.value.trim());if(!c)return null;const v=c.value;return {c,kind:/混合/.test(v)?'hybrid':/私有|本地|自建|内网|离线/.test(v)?'private':/云|cloud|托管/i.test(v)?'cloud':'unknown'};};
const slaOf=(cs:Constraint[])=>{const c=cs.find(c=>c.kind==='availability'&&num(c)!==null);return c?{v:num(c)!,c}:null;};
const complianceOf=(cs:Constraint[])=>cs.find(c=>c.kind==='compliance'&&c.value.trim())||null;
const costOf=(cs:Constraint[])=>cs.find(c=>c.kind==='cost'&&c.value.trim())||null;
const PB:Record<string,{candidates:{id:string;name:string}[];rules:Rule[];violations?:(cs:Constraint[])=>Record<string,string[]>}>={
 'architecture-style':{candidates:[{id:'monolith',name:'单体'},{id:'modular-monolith',name:'模块化单体'},{id:'microservices',name:'微服务'}],rules:[
  {dimension:{id:'team',name:'团队与交付效率',weight:30},needs:'team',score:cs=>{const t=teamOf(cs);if(!t)return null;const [a,b,c]=band(t.v,[[8,[5,4,1]],[25,[3,5,3]]],[1,3,5]);return {scores:{monolith:a,'modular-monolith':b,microservices:c},source:t.c,note:t.v<=8?'小团队拆分服务的协作与治理成本高':t.v<=25?'中等团队适合清晰模块边界、单体部署':'大团队需要独立交付单元'};}},
  {dimension:{id:'ops',name:'运维复杂度',weight:25},needs:'deployment',score:cs=>{const d=deployOf(cs);if(!d)return null;const m:Record<string,number[]>={private:[5,5,1],hybrid:[5,4,2],cloud:[4,4,3],unknown:[4,4,3]};const [a,b,c]=m[d.kind];return {scores:{monolith:a,'modular-monolith':b,microservices:c},source:d.c,note:d.kind==='private'?'私有化环境缺少托管服务，分布式运维代价最大':d.kind==='cloud'?'云托管降低但不消除分布式运维成本':'混合部署需要两套运维能力'};}},
  {dimension:{id:'scale',name:'独立扩展能力',weight:25},needs:'scale',score:cs=>{const p=peakPerSecond(cs);if(!p)return null;const [a,b,c]=band(p.value,[[100,[5,5,4]],[2000,[2,4,4]]],[1,3,5]);return {scores:{monolith:a,'modular-monolith':b,microservices:c},source:p.source,note:`折算峰值约 ${Math.round(p.value)} 次/秒`};}},
  {dimension:{id:'isolation',name:'故障隔离与可用性',weight:20},needs:'availability',score:cs=>{const s=slaOf(cs);if(!s)return null;const [a,b,c]=band(-s.v,[[-99.99,[1,3,5]],[-99.95,[2,4,4]],[-99.9,[3,4,3]]],[4,4,3]);return {scores:{monolith:a,'modular-monolith':b,microservices:c},source:s.c,note:s.v>=99.95?'高可用目标需要更强的故障隔离':'该可用性目标可由多实例部署满足'};}},
 ]},
 'data-consistency':{candidates:[{id:'strong-tx',name:'强一致事务'},{id:'saga',name:'Saga 补偿'},{id:'eventual',name:'事件驱动最终一致'}],rules:[
  {dimension:{id:'correctness',name:'数据正确性要求',weight:35},needs:'compliance',score:cs=>{const c=complianceOf(cs);if(!c)return null;return {scores:{'strong-tx':5,saga:4,eventual:2},source:c,note:'存在合规要求，数据即时正确性优先'};}},
  {dimension:{id:'availability',name:'可用性',weight:25},needs:'availability',score:cs=>{const s=slaOf(cs);if(!s)return null;const [a,b,c]=s.v>=99.9?[2,4,5]:[4,4,4];return {scores:{'strong-tx':a,saga:b,eventual:c},source:s.c,note:s.v>=99.9?'跨服务强一致会降低可用性':'可用性目标宽松'};}},
  {dimension:{id:'throughput',name:'吞吐与扩展',weight:20},needs:'scale',score:cs=>{const p=peakPerSecond(cs);if(!p)return null;const [a,b,c]=band(p.value,[[100,[4,4,4]],[2000,[3,4,5]]],[1,3,5]);return {scores:{'strong-tx':a,saga:b,eventual:c},source:p.source,note:`折算峰值约 ${Math.round(p.value)} 次/秒`};}},
  {dimension:{id:'simplicity',name:'实现与排障难度',weight:20},needs:'team',score:cs=>{const t=teamOf(cs);if(!t)return null;const [a,b,c]=band(t.v,[[8,[5,3,3]],[25,[4,4,4]]],[3,4,5]);return {scores:{'strong-tx':a,saga:b,eventual:c},source:t.c,note:t.v<=8?'小团队更难驾驭补偿与幂等':'团队可承担异步一致性的工程成本'};}},
 ]},
 'deployment-model':{candidates:[{id:'cloud',name:'公有云托管'},{id:'private',name:'私有化部署'},{id:'hybrid',name:'混合部署'}],violations:(cs):Record<string,string[]>=>{const d=deployOf(cs);if(!d||d.kind==='unknown')return {};const msg=`与约束${label(d.c)}冲突`;return {cloud:d.kind==='cloud'?[]:[msg],private:d.kind==='private'?[]:[msg],hybrid:d.kind==='hybrid'?[]:[msg]};},rules:[
  {dimension:{id:'compliance',name:'合规与数据驻留',weight:30},needs:'compliance',score:cs=>{const c=complianceOf(cs);if(!c)return null;return {scores:{cloud:2,private:5,hybrid:4},source:c,note:'合规要求倾向数据可控'};}},
  {dimension:{id:'cost',name:'成本',weight:25},needs:'cost',score:cs=>{const c=costOf(cs);if(!c)return null;return {scores:{cloud:4,private:2,hybrid:3},source:c,note:'有成本约束时托管服务通常更省人力'};}},
  {dimension:{id:'ops',name:'运维人力',weight:25},needs:'team',score:cs=>{const t=teamOf(cs);if(!t)return null;const [a,b,c]=band(t.v,[[15,[5,2,2]]],[4,4,3]);return {scores:{cloud:a,private:b,hybrid:c},source:t.c,note:t.v<=15?'团队较小，自运维负担重':'团队可承担部分自运维'};}},
  {dimension:{id:'elasticity',name:'弹性伸缩',weight:20},needs:'scale',score:cs=>{const p=peakPerSecond(cs);if(!p)return null;const [a,b,c]=band(p.value,[[100,[4,4,4]]],[5,2,4]);return {scores:{cloud:a,private:b,hybrid:c},source:p.source,note:`折算峰值约 ${Math.round(p.value)} 次/秒`};}},
 ]},
};
export function recommend(design:Design,playbookId:string):Recommendation{
 const pb=PB[playbookId];const meta=PLAYBOOKS.find(p=>p.id===playbookId);if(!pb||!meta)throw Error('手册不存在');
 const cs=design.constraints||[];const basis=new Map<string,Recommendation['basis'][number]>();const missing:string[]=[];
 const candidates=pb.candidates.map(c=>({...c,scores:{} as Record<string,number|null>,reasons:[] as string[],violations:[] as string[]}));
 for(const rule of pb.rules){const out=rule.score(cs);
  if(!out){missing.push(`缺少约束：${KIND_LABEL[rule.needs]}（影响“${rule.dimension.name}”）`);for(const c of candidates){c.scores[rule.dimension.id]=null;c.reasons.push(`${rule.dimension.name}：缺少${KIND_LABEL[rule.needs]}约束，待补充`);}continue;}
  basis.set(out.source.id,{constraintId:out.source.id,name:out.source.name,value:out.source.value,unit:out.source.unit,status:out.source.status});
  for(const c of candidates){c.scores[rule.dimension.id]=out.scores[c.id];c.reasons.push(`${rule.dimension.name} ${out.scores[c.id]} 分：基于${label(out.source)}，${out.note}`);}
 }
 const v=pb.violations?.(cs)||{};for(const c of candidates)c.violations=v[c.id]||[];
 return {playbookId,title:meta.title,dimensions:pb.rules.map(r=>({...r.dimension})),candidates,basis:[...basis.values()],missing};
}
export function toDecision(r:Recommendation):Decision{
 return {id:'rule-'+r.playbookId+'-'+crypto.randomUUID().slice(0,6),title:r.title.split('：')[0]+'（规则推荐草案）',dimensions:r.dimensions.map(d=>({...d})),
  candidates:r.candidates.map(c=>({id:c.id,name:c.name,benefits:'',costs:'',rationale:c.reasons.join('；'),violations:[...c.violations],scores:{...c.scores}})),
  reason:'规则推荐草案：依据 '+(r.basis.map(b=>b.name+'（'+(b.status==='confirmed'?'已确认':'待确认')+'）').join('、')||'暂无约束')+'；待架构师复核并选择'+(r.missing.length?'。'+r.missing.join('；'):''),tradeoff:'',reconsiderWhen:'依据的约束被修改或确认时',affectedIds:[]};
}
/** 第一名：只在评分齐全、无违规的候选中按加权分取最高；平分时保持原顺序。 */
function leaderAt(d:Decision,weights:number[]):string|null{let best:string|null=null,top=-1;for(const c of d.candidates){if(c.violations.length)continue;const s=d.dimensions.reduce((sum,dim,i)=>sum+weights[i]*(c.scores[dim.id] as number)/5,0);if(s>top+1e-9){top=s;best=c.name;}}return best;}
const scoreOf=(d:Decision,name:string,weights:number[])=>{const c=d.candidates.find(x=>x.name===name)!;return d.dimensions.reduce((sum,dim,i)=>sum+weights[i]*(c.scores[dim.id] as number)/5,0);};
/** 平分不算翻转：新第一名须严格高于原第一名。 */
export function sensitivity(d:Decision):Sensitivity{
 const total=d.dimensions.reduce((s,x)=>s+x.weight,0);
 if(!d.dimensions.length||Math.abs(total-100)>1e-6)return {leader:null,rows:[],note:'权重合计需为100%才能分析敏感性'};
 const usable=d.candidates.filter(c=>!c.violations.length);if(usable.length<2)return {leader:null,rows:[],note:'至少需要两个无违规的候选方案'};
 if(usable.some(c=>d.dimensions.some(dim=>typeof c.scores[dim.id]!=='number')))return {leader:null,rows:[],note:'有候选评分待补充，暂不计算敏感性'};
 const base=d.dimensions.map(x=>x.weight);const leader=leaderAt(d,base);
 const rows=d.dimensions.map((dim,k)=>{const at=(x:number)=>{const rest=100-base[k];return base.map((w,i)=>i===k?x:rest>0?w*(100-x)/rest:(100-x)/(base.length-1));};
  let flip:{x:number;who:string}|null=null;
  for(let step=0.5;step<=100;step+=0.5){for(const x of [base[k]-step,base[k]+step]){if(x<0||x>100)continue;const ws=at(x);const who=leaderAt(d,ws);if(who&&who!==leader&&scoreOf(d,who,ws)>scoreOf(d,leader!,ws)+1e-9){flip={x,who};break;}}if(flip)break;}
  return {dimensionId:dim.id,name:dim.name,weight:base[k],flipAt:flip?Math.round(flip.x*10)/10:null,newLeader:flip?.who??null};});
 return {leader,rows,note:rows.some(r=>r.flipAt!==null)?'权重变化到翻转点时第一名改变，越接近当前权重越敏感':'在 0～100% 的单维度权重变化内第一名不变'};
}
