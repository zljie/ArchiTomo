import type { Project } from './project.ts';
import { LEVELS, effectiveLevel } from './levels.ts';
/**
 * 引导轮次（BUG-003 / johnson 2026-10-16）：每轮先发散后收敛。
 * 发散：围绕本轮焦点，按框架维度各问一个问题，不重复；收敛：答满 5 或 10 题（或用户要求）后不再提问，
 * AI 总结本轮选择并给出完整草图（待审建议）。收敛后的下一次请求开启新一轮。
 */
export type GuideRound={index:number;size:5|10;converged:boolean};
export type RoundState={index:number;size:5|10;answered:number;phase:'diverge'|'converge';focus:string;dimensions:string[];asked:{domain:string;title:string;answer:string}[]};
export const ROUND_SIZES=[5,10] as const;
const FOCUS=['目标与业务：目标、范围、参与者、关键业务场景与业务能力','应用架构：系统划分、职责边界、应用间集成','技术架构：技术选型、数据存储、通信方式、部署形态','质量与风险：质量场景、容错与一致性、安全、演进'];
export const DIMENSIONS=['目标与范围','参与者与关键场景','能力与边界','数据与一致性','集成与通信','质量属性','部署与运维','风险与演进'];
export function parseGuideRound(v:unknown):GuideRound{const r=v as GuideRound;if(!r||typeof r!=='object'||!Number.isSafeInteger(r.index)||r.index<1||!ROUND_SIZES.includes(r.size)||typeof r.converged!=='boolean')throw Error('引导轮次无效');return {index:r.index,size:r.size,converged:r.converged};}
/** 计算本次请求所处的轮次；旧项目中没有轮次标记的 AI 问题计入第 1 轮。 */
export function roundState(p:Project,size?:number,converge=false):RoundState{
 const g=p.guideRound??{index:1,size:5,converged:false};const s=(ROUND_SIZES as readonly number[]).includes(size??0)?size as 5|10:g.size;
 const index=g.converged?g.index+1:g.index;const level=LEVELS[effectiveLevel(p)];
 const qs=(p.questions||[]).filter(q=>q.source==='ai'&&(q.round??1)===index&&q.status!=='open');
 return {index,size:s,answered:qs.length,phase:converge||(level.autoConverge&&qs.length>=s)?'converge':'diverge',focus:FOCUS[(index-1+level.focusOffset)%FOCUS.length],dimensions:DIMENSIONS,
  asked:qs.map(q=>({domain:q.domain,title:q.title,answer:q.status==='skipped'?'已跳过':[...q.answer!.optionIds.map(id=>q.options.find(o=>o.id===id)?.label),q.answer!.note].filter(Boolean).join('、')}))};
}
