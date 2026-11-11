import type { Operation } from './design.ts';
import type { Profile } from './profile.ts';
/** AI 变更筛选与结果说明（STORY-032 / F-02 / F-04）：每项丢弃都给出可读原因；零有效操作与成功态区分。 */
export type Screened={kept:Operation[];dropped:{index:number;reason:string}[]};
export const AI_OPS=['set_node','remove_node','set_relation','set_coverage','set_decision','set_risk','set_evidence'];
const ALIASES=['type','op','action','kind','operation'];
/** 真实模型常省略 type：只有一个载荷字段时按字段推断（推断结果仍经完整模型校验与人工预览）。 */
const PAYLOAD:Record<string,string>={node:'set_node',relation:'set_relation',coverage:'set_coverage',decision:'set_decision',risk:'set_risk',evidence:'set_evidence'};
/** 分级容忍（LRN-003）：变更类型写在 op/action 等常见别名字段里时规范化为 type；其余丢弃并说明原因。 */
export function screenOperations(raw:unknown[]):Screened{
 const kept:Operation[]=[];const dropped:Screened['dropped']=[];
 raw.forEach((op,index)=>{const n=index+1;
  if(!op||typeof op!=='object'||Array.isArray(op)){dropped.push({index,reason:`第 ${n} 项不是变更对象`});return;}
  const rec=op as Record<string,unknown>;const key=ALIASES.find(k=>typeof rec[k]==='string'&&String(rec[k]).trim());
  let type=key?String(rec[key]).trim():'';
  if(!key){const payload=Object.keys(PAYLOAD).filter(k=>rec[k]&&typeof rec[k]==='object');if(payload.length!==1){dropped.push({index,reason:`第 ${n} 项缺少变更类型（type 字段），无法判断要做什么`});return;}type=PAYLOAD[payload[0]];}if(!AI_OPS.includes(type)){dropped.push({index,reason:`第 ${n} 项类型 ${type.slice(0,40)} 不支持（可用：${AI_OPS.join('、')}）`});return;}
  const copy={...rec};for(const k of ALIASES)if(k!=='type')delete copy[k];kept.push({...copy,type} as Operation);});
 return {kept,dropped};
}
export type Outcome={kept:number;dropped:string[]};
/** applicable：有待审提案；none：AI 想改但没有一项可用（显示“未生成可应用变更”）；empty：纯对话回复。 */
export function outcomeStatus(o:Outcome|undefined,hasProposal:boolean):'applicable'|'none'|'empty'{return hasProposal?'applicable':o&&o.dropped.length?'none':'empty';}
/** 给模型的关系规则：类型、含义与允许的端点组合，以及节点层级对应的元素类型。 */
export function relationGuide(p:Profile):string[]{
 return p.relationTypes.map(r=>`${r.id}（${r.label}）：${r.allowedPairs?r.allowedPairs.map(([a,b])=>`${a} → ${b}`).join(' | '):`${r.sourceTypes.join('/')} → ${r.targetTypes.join('/')}`}`);
}
export function repairPrompt(original:string,reason:string):string{
 return `请修复上一次建议：它未通过模型校验，原因是「${reason.slice(0,400)}」。\n只修正不合法的部分（换成 relationRules 允许的关系类型或端点，或去掉该项），其余内容保持不变；不要扩大范围。原请求：\n${original.slice(0,6000)}`;
}
