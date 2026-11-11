import { DOMAINS, DOMAIN_NAMES, type Design } from './design.ts';
import type { Project, Question } from './project.ts';
import { LEVELS, effectiveLevel } from './levels.ts';
type Seed = { title:string; why:string; multi?:boolean; options:[string,string][] };
/** 内置引导题：静态问题库，不是 AI 生成；AI 未配置时仍可逐步澄清，作答作为后续讨论上下文。 */
const SEEDS: Record<typeof DOMAINS[number], Seed> = {
 goals_constraints:{title:'这套架构首先要支撑的业务目标是什么？',why:'目标决定后续所有取舍的优先级。',options:[['新产品从零上线','速度优先，接受一定技术债'],['现有系统改造','兼容存量、平滑迁移'],['规模化增长','容量与成本可控'],['合规与安全加固','审计、隔离与数据保护优先']]},
 system_context:{title:'系统主要和谁交互？',why:'先划清边界，再拆内部结构。',multi:true,options:[['终端用户（Web/App）','面向外部用户的入口'],['内部运营人员','后台管理与运营工具'],['第三方系统','支付、消息、身份等外部服务'],['其他内部系统','共享数据或调用的兄弟系统']]},
 capabilities:{title:'核心业务能力大致有几块？',why:'能力划分影响服务和团队边界。',options:[['1～2 个核心能力','单体或模块化单体即可'],['3～6 个能力','按能力分模块，预留拆分'],['超过 6 个能力','需要明确的领域边界'],['还不确定','先列出能力清单再决定']]},
 functional_structure:{title:'功能模块希望按什么方式组织？',why:'组织方式决定模块之间的依赖方向。',options:[['按业务领域','领域内高内聚'],['按用户旅程','围绕关键流程编排'],['按技术分层','表现层/业务层/数据层'],['沿用现有结构','先保持现状，逐步调整']]},
 technical_structure:{title:'技术架构的起点形态？',why:'部署单元的数量决定运维与协作成本。',options:[['单体应用','最简单的部署与调试'],['模块化单体','单进程内清晰边界'],['少量服务','按变化频率拆 2～5 个服务'],['微服务','独立部署、独立扩缩']]},
 key_scenarios:{title:'最需要先设计清楚的关键场景是哪类？',why:'关键场景用于检验结构是否站得住。',multi:true,options:[['核心交易/写入流程','一致性与失败处理'],['高频查询','缓存与读写分离'],['批量/异步任务','队列与重试'],['跨系统集成','超时、幂等与补偿']]},
 data:{title:'数据存储的主要形态？',why:'数据模型最难后改，需尽早确定所有者。',options:[['单一关系型数据库','强一致、事务简单'],['关系型 + 缓存','读多写少场景'],['多种存储按需组合','文档/搜索/时序等'],['以外部系统数据为主','本系统只做编排']]},
 deployment:{title:'运行与部署环境是什么？',why:'环境约束会直接排除部分方案。',options:[['公有云托管','使用云厂商托管服务'],['私有化/本地机房','需要离线与自运维'],['混合部署','云上与本地并存'],['本机/桌面','单机运行，无服务端']]},
 quality:{title:'最重要的质量属性是哪一项？',why:'质量目标是方案评分的主要维度。',options:[['可用性','故障时仍可服务'],['性能','延迟与吞吐'],['安全','访问控制与数据保护'],['可演进性','需求变化时改得动']]},
 decisions_evolution:{title:'架构决策希望如何演进？',why:'明确重评条件，避免一次定死。',options:[['先简单后拆分','达到阈值再演进'],['一次到位','前期投入换长期稳定'],['分阶段路线图','每阶段有明确里程碑'],['保持可替换','关键依赖留出抽象层']]},
};
export function builtinQuestion(domain:typeof DOMAINS[number]):Question{
 const seed=SEEDS[domain];return {id:'builtin-'+domain.replace(/_/g,'-'),source:'builtin',domain,title:seed.title,why:seed.why,options:seed.options.map(([label,detail],i)=>({id:'o'+(i+1),label,detail})),multi:!!seed.multi,status:'open',answer:null,history:[],proposalId:null,createdAt:new Date().toISOString()};
}
/** 当前唯一一张卡片：最新的未答 AI 问题；否则按十域顺序取第一个待澄清且未处理过的内置题。 */
export function currentQuestion(project:Project,design:Design):Question|null{
 const open=[...project.questions].reverse().find(q=>q.status==='open');if(open)return open;
 if(!LEVELS[effectiveLevel(project)].proactive)return null;/* F-06：架构师模式不主动出内置题 */
 for(const domain of DOMAINS){if(design.coverage.find(c=>c.domain===domain)?.state!=='needs_clarification')continue;if(domain==='goals_constraints'&&design.nodes.some(n=>n.level==='goal'))continue;/* 已有目标不再作为默认必答题 */const q=builtinQuestion(domain);if(!project.questions.some(x=>x.id===q.id))return q;}
 return null;
}
export const domainName=(domain:string)=>DOMAIN_NAMES[(DOMAINS as readonly string[]).indexOf(domain)]||domain;
