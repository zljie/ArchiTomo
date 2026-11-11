import { newDesign, validateDesign, VIEW_SPECS, type Design, type DesignView } from './design.ts';
/** ADF 五层（STORY-020 / ADR-005）：层是推导顺序与抽象深度；视图按层标注。L2 职责复用 应用 → 能力 的 realizes 关系。 */
export type LayerId='L0'|'L1'|'L2'|'L3'|'L4';
export const LAYERS:{id:LayerId;name:string;question:string}[]=[
 {id:'L0',name:'目标与上下文',question:'为什么做？什么叫成功？边界与约束是什么？'},
 {id:'L1',name:'业务架构',question:'需要哪些业务能力、流程、角色与业务对象？'},
 {id:'L2',name:'应用架构',question:'哪些系统承担这些能力？自建、采购还是复用？'},
 {id:'L3',name:'技术架构',question:'软件怎样组织、集成与运行？'},
 {id:'L4',name:'组件架构',question:'关键模块内部怎样协作？接口与约束是什么？'},
];
const LEVEL_LAYER:Record<string,LayerId>={goal:'L0',constraint:'L0',quality:'L0',context:'L0',capability:'L1',function:'L1',step:'L1',entity:'L1',application:'L2',technical:'L3',runtime:'L3',component:'L4'};
export const layerOfLevel=(level:string):LayerId=>LEVEL_LAYER[level]||'L3';
export function layerOfView(v:Pick<DesignView,'id'|'level'>):LayerId{return layerOfLevel(v.level);}
export const layerApplicable=(d:Design,l:LayerId)=>d.layers?.find(x=>x.id===l)?.applicable!==false;
/** 职责矩阵：每项业务能力由哪些应用承担（应用 → 能力 的 realizes）。 */
const owns=(r:{type:string;source:string;target:string},capId:string,appId?:string)=>(r.type==='realizes'&&r.target===capId&&(!appId||r.source===appId))||(r.type==='realizedBy'&&r.source===capId&&(!appId||r.target===appId));
/** 职责：兼容旧的“应用 realizes 能力”与 ADDM 的“能力 realizedBy 应用”（ADR-006）。 */
export function responsibility(d:Design):{capability:{id:string;name:string};owners:string[]}[]{
 const apps=new Set(d.nodes.filter(n=>n.level==='application').map(n=>n.id));
 return d.nodes.filter(n=>n.level==='capability').map(c=>({capability:{id:c.id,name:c.name},owners:[...new Set(d.relationships.filter(r=>owns(r,c.id)).map(r=>r.type==='realizes'?r.source:r.target).filter(id=>apps.has(id)))]}));
}
export function setOwner(d:Design,capId:string,appId:string,on:boolean):Design{
 const next=structuredClone(d);const has=next.relationships.some(r=>owns(r,capId,appId));
 if(on&&!has)next.relationships.push({id:'own-'+crypto.randomUUID().slice(0,8),source:capId,target:appId,type:'realizedBy',label:'由应用实现'});
 if(!on)next.relationships=next.relationships.filter(r=>!owns(r,capId,appId));
 return validateDesign(next);
}
/** 制造企业采购管理平台（含 SAP 集成）演示设计：系统与数值均为演示数据，约束一律待确认。 */
export function procurementDesign():Design{
 const d=newDesign('采购管理平台（示例，演示数据）');const add=(id:string,name:string,level:string,role:string,description:string,extra:Partial<Design['nodes'][number]>={})=>d.nodes.push({id,name,level,role,technology:'',description,sourceIds:[],...extra});
 const rel=(id:string,source:string,target:string,type:string,label:string,extra:Record<string,string>={})=>d.relationships.push({id,source,target,type,label,...extra});
 add('g-01','采购审批效率提升','goal','goal','审批周期缩短，审批可追溯');add('q-01','审批性能与可靠性','quality','quality','月末高峰审批不积压');
 add('buyer','采购员','context','person','提交采购申请');add('approver','审批人','context','person','多级审批');add('ctx-platform','采购管理平台','context','system','本次建设的系统');add('ctx-sap','SAP ERP','context','external','财务与采购订单主系统');add('ctx-supplier','供应商','context','external','报价与履约');
 rel('c1','buyer','ctx-platform','depends_on','提交申请');rel('c2','approver','ctx-platform','depends_on','审批');rel('c3','ctx-platform','ctx-sap','depends_on','同步订单');rel('c4','ctx-supplier','ctx-platform','depends_on','报价');
 add('cap-supplier','供应商管理','capability','capability','准入、评级与报价');add('cap-request','采购申请','capability','capability','需求提交与预算校验');add('cap-approval','采购审批','capability','capability','多组织多级审批');add('cap-fulfil','订单履约','capability','capability','采购订单与收货');
 rel('g1','cap-approval','g-01','derives_from','服务目标');
 add('step-submit','提交申请','step','step','采购员提交',{order:1,relatedIds:['ctx-platform']});add('step-approve','多级审批','step','step','按组织与金额路由',{order:2,relatedIds:['ctx-platform']});add('step-po','生成采购订单','step','step','审批通过后生成',{order:3,relatedIds:['ctx-platform']});add('step-sync','同步 SAP','step','step','订单写入 SAP',{order:4,relatedIds:['ctx-platform']});
 rel('s1','step-submit','step-approve','next','下一步');rel('s2','step-approve','step-po','next','通过');rel('s3','step-po','step-sync','next','下一步');rel('s4','step-approve','step-submit','branch','驳回');
 add('ent-request','采购申请单','entity','entity','申请明细与预算');add('ent-approval','审批记录','entity','entity','审批节点与意见');add('ent-po','采购订单','entity','entity','以 SAP 为准');rel('e1','ent-request','ent-approval','data_relation','1 : N');rel('e2','ent-request','ent-po','data_relation','1 : 1');
 add('app-platform','采购管理平台','application','business_app','申请、审批发起与查询',{sourcing:'build'});add('app-workflow','工作流平台','application','platform','企业已有流程引擎',{sourcing:'reuse'});add('app-sap','SAP ERP','application','external','财务、采购订单与收货',{sourcing:'buy'});add('app-srm','供应商门户','application','business_app','供应商自助报价',{sourcing:'buy'});
 rel('own-1','app-platform','cap-request','realizes','承担');rel('own-2','app-workflow','cap-approval','realizes','承担');rel('own-3','app-sap','cap-fulfil','realizes','承担');rel('own-4','app-srm','cap-supplier','realizes','承担');
 rel('a1','app-platform','app-workflow','depends_on','发起审批');rel('a2','app-platform','app-sap','depends_on','同步订单');rel('a3','app-srm','app-platform','depends_on','报价');
 add('tech-web','采购平台 Web','technical','application','申请与审批界面');add('tech-api','采购服务','technical','service','申请、预算与订单编排',{parentId:'app-platform'});add('tech-flow','审批工作流服务','technical','service','审批流程定义与执行',{parentId:'app-workflow'});add('tech-adapter','SAP 集成适配','technical','service','RFC/IDoc 适配与重试',{parentId:'app-platform'});add('tech-mq','消息队列','technical','queue','订单事件');add('tech-db','采购库','technical','database','申请与审批数据');
 rel('t1','tech-web','tech-api','depends_on','HTTPS');rel('t2','tech-api','tech-flow','depends_on','发起审批');rel('t3','tech-api','tech-db','depends_on','读写');rel('t4','tech-api','tech-mq','depends_on','订单事件',{line:'dashed'});rel('t5','tech-mq','tech-adapter','depends_on','同步 SAP',{line:'dashed'});
 add('comp-rule','审批规则组件','component','component','按组织、金额与品类计算审批链',{parentId:'tech-flow'});add('comp-router','审批路由组件','component','component','把审批任务分配给审批人',{parentId:'tech-flow'});rel('k1','comp-router','comp-rule','depends_on','查询规则');
 add('run-k8s','私有云 K8s 集群','runtime','cluster','私有化部署环境',{relatedIds:['tech-api','tech-flow']});rel('d1','run-k8s','tech-api','deploys','承载');
 d.decisions=[{id:'dec-workflow',title:'审批工作流方案',dimensions:[{id:'fit',name:'多组织审批适配',weight:40},{id:'effort',name:'交付成本',weight:35},{id:'ops',name:'运维与升级',weight:25}],candidates:[{id:'reuse',name:'复用企业工作流平台',benefits:'已有平台与运维',costs:'定制受限',rationale:'待评估多组织规则表达力',violations:[],scores:{fit:null,effort:null,ops:null}},{id:'build',name:'自研审批引擎',benefits:'完全可控',costs:'开发与维护成本高',rationale:'团队规模待确认',violations:[],scores:{fit:null,effort:null,ops:null}},{id:'sap',name:'SAP 内置审批',benefits:'与订单一体',costs:'灵活性差、许可成本',rationale:'待确认许可',violations:[],scores:{fit:null,effort:null,ops:null}}],reason:'',tradeoff:'',reconsiderWhen:'审批规则复杂度或组织变化',affectedIds:['tech-flow','app-workflow'],layer:'L3'}];
 const demo='演示数据，待确认';
 d.constraints=[{id:'c-org',kind:'compliance',name:'多组织分级审批与审计留痕',value:'必须',unit:'',status:'unconfirmed',note:demo,objectIds:['cap-approval'],decisionIds:['dec-workflow']},{id:'c-sap',kind:'other',name:'SAP 继续作为订单与财务主系统',value:'是',unit:'',status:'unconfirmed',note:demo,objectIds:['app-sap'],decisionIds:[]},{id:'c-deploy',kind:'deployment',name:'部署要求',value:'私有化部署',unit:'',status:'unconfirmed',note:demo,objectIds:[],decisionIds:['dec-workflow']},{id:'c-team',kind:'team',name:'研发团队',value:'8',unit:'人',status:'unconfirmed',note:demo,objectIds:[],decisionIds:['dec-workflow']},{id:'c-sla',kind:'availability',name:'审批服务可用性',value:'99.9',unit:'%',status:'unconfirmed',note:demo,objectIds:['tech-flow'],decisionIds:[]},{id:'c-volume',kind:'scale',name:'月末峰值审批单量',value:'',unit:'单/小时',status:'unconfirmed',note:demo+'；数值未知',objectIds:['tech-flow'],decisionIds:['dec-workflow']}];
 d.scenarios=[{id:'s-peak',attribute:'performance',source:'审批人',stimulus:'月末集中提交审批',environment:'多组织并发',response:'审批任务及时分派，不积压',measure:'',verification:'压测（计划）',objectIds:['tech-flow'],decisionIds:['dec-workflow'],evidenceIds:[]}];
 d.points=[{id:'p-flow',kind:'tradeoff',text:'复用工作流平台：交付快，但多组织规则可能需要定制',scenarioIds:['s-peak'],objectIds:['app-workflow'],decisionIds:['dec-workflow']}];
 d.layers=[{id:'L0',applicable:true,reason:'',question:'如何在多组织审批下缩短采购审批周期，并保证可追溯？'},{id:'L1',applicable:true,reason:'',question:'采购业务需要哪些能力，审批流程如何分级？'},{id:'L2',applicable:true,reason:'',question:'各项采购能力由 SAP、工作流平台还是新建平台承担？'},{id:'L3',applicable:true,reason:'',question:'审批工作流采用复用平台、自研还是 SAP 内置？'}];
 d.views=VIEW_SPECS.map(v=>{const ids=d.nodes.filter(n=>n.level===v.level).map(n=>n.id);return {...v,nodeIds:ids,positions:Object.fromEntries(ids.map((id,i)=>[id,{x:(i%4)*300,y:Math.floor(i/4)*180}]))};});
 return validateDesign(d);
}
