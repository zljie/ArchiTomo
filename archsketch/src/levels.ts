/**
 * 用户水平（STORY-028 / ADR-008）：作为引导基准的集中配置。
 * 旧项目没有登记水平时按程序员处理（GOAL-001 r8，2A）；架构师级别 AI 不主动提问（3A）。
 */
export type Level='beginner'|'programmer'|'architect';
export const LEVEL_IDS:Level[]=['beginner','programmer','architect'];
export type LevelSpec={id:Level;name:string;tagline:string;focusOffset:number;skipDomains:string[];proactive:boolean;bundles:boolean;autoConverge:boolean;rules:string};
export const LEVELS:Record<Level,LevelSpec>={
 beginner:{id:'beginner',name:'入门小白',tagline:'带着我选：给我配好的组合，并解释为什么',focusOffset:0,skipDomains:[],proactive:true,bundles:true,autoConverge:true,
  rules:'用户是入门者。用通俗语言提问，避免未解释的术语；每个选项尽量是一个“套餐”：label 写套餐名（如“小团队快速上线”），detail 写适用场景与代价，bundle 列出它包含的 2～5 个具体选择（如["单体应用","云数据库","托管部署"]）。收敛时在 message 中解释为什么这样搭。'},
 programmer:{id:'programmer',name:'程序员',tagline:'基础的不用问：帮我搭架构、补全缺的部分',focusOffset:1,skipDomains:['goals_constraints','system_context','capabilities'],proactive:true,bundles:false,autoConverge:true,
  rules:'用户是程序员。不要问目标、系统边界、业务能力等基础问题，直接问技术取舍（服务划分、通信、数据存储、一致性、部署），选项用准确的技术术语。主动补全缺失的组件、关系与数据存储，用 diagram 给出，作为待审建议。'},
 architect:{id:'architect',name:'架构师',tagline:'副驾驶：按我的意愿画和改，只在有明显矛盾时提醒',focusOffset:0,skipDomains:[],proactive:false,bundles:false,autoConverge:false,
  rules:'用户是架构师，你是副驾驶。默认不提问（question 为 null），严格按用户指令绘制或修改，不擅自扩展范围；只有发现与已确认约束、决策明显矛盾时才提一个问题，并在 question 中加 "conflict": true。补全建议只写在 message 里作为提示，不要自行加入 diagram。'},
};
export const effectiveLevel=(p:{profileLevel?:Level}):Level=>p.profileLevel??'programmer';
export const isLevel=(v:unknown):v is Level=>LEVEL_IDS.includes(v as Level);
/** 观察者口径：架构师只看阻断级与 AI 见解；小白附“建议怎么做”。 */
export const BEGINNER_TIPS:Record<string,string>={new_problem:'建议：点“定位”找到这个元素，按提示补上缺少的关系或信息。',new_gap:'建议：打开“全局”或对应面板，把待完成项逐个补齐。',review:'建议：看看受影响的元素是否还符合目标，必要时调整。'};
