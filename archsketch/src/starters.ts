import type { Design } from './design.ts';
import { parseCode, toCode, nodeToken } from './dsl.ts';
/** 参考架构模板（STORY-009）：以图代码定义的静态资产，不是 AI 结果；应用到技术容器视图后作为人工修订保存。 */
export type Starter={id:string;name:string;description:string;code:string;category?:string;tags?:string[]};

export const STARTERS:Starter[]=[
 {id:'web-three-tier',category:'Web 与业务系统',tags:['CDN','负载均衡','缓存'],name:'Web 三层架构',description:'CDN + 负载均衡 + 应用集群 + 缓存与主库，适合大多数业务系统起步。',code:`direction right
用户浏览器 [type: client]
CDN [type: cdn]
私有网络 [color: blue] {
  负载均衡 [type: load_balancer]
  Web 应用 [type: application, tech: Node.js]
  数据层 {
    Redis 缓存 [type: cache, tech: Redis]
    主数据库 [type: database, tech: PostgreSQL]
  }
}
用户浏览器 > CDN: HTTPS
CDN > 负载均衡: 回源
负载均衡 > Web 应用
Web 应用 > Redis 缓存: 读缓存
Web 应用 > 主数据库: 读写`},
 {id:'microservices-queue',category:'微服务',tags:['网关','Kafka','领域拆分'],name:'微服务 + 消息队列',description:'API 网关统一接入，服务按领域拆分，通过消息队列异步解耦，各服务独立数据。',code:`direction right
移动/Web 客户端 [type: client]
API 网关 [type: gateway, tech: Kong]
服务集群 [color: purple] {
  订单服务 [type: service]
  库存服务 [type: service]
  通知服务 [type: service]
}
消息队列 [type: queue, tech: Kafka]
订单库 [type: database]
库存库 [type: database]
支付平台 [type: external]
移动/Web 客户端 > API 网关: HTTPS
API 网关 > 订单服务, 库存服务: 路由
订单服务 > 消息队列: 订单事件
消息队列 --> 库存服务, 通知服务: 订阅
订单服务 > 订单库
库存服务 > 库存库
订单服务 > 支付平台: 发起支付`},
 {id:'event-pipeline',category:'数据与事件',tags:['流处理','数据湖','ClickHouse'],name:'事件 / 数据管道',description:'采集→消息队列→流处理→存储与分析，适合日志、埋点与实时指标。',code:`direction right
数据源 [type: client, label: 业务系统与设备]
采集网关 [type: gateway]
事件总线 [type: queue, tech: Kafka]
处理层 [color: teal] {
  流处理 [type: service, tech: Flink]
  批处理 [type: service, tech: Spark]
}
数据湖 [type: storage, tech: S3 兼容存储]
分析库 [type: database, tech: ClickHouse]
看板 [type: application]
数据源 > 采集网关: 上报
采集网关 > 事件总线
事件总线 > 流处理, 批处理: 消费
流处理 > 分析库: 实时指标
批处理 > 数据湖: 归档
批处理 > 分析库: 离线汇总
看板 > 分析库: 查询`},

 {id:'saas-multitenant',category:'Web 与业务系统',tags:['多租户','计费','OIDC'],name:'SaaS 多租户',description:'网关识别租户，认证与租户配置独立，业务数据按租户隔离，含计费。',code:`direction right
租户用户 [type: client]
管理后台 [type: application]
API 网关 [type: gateway]
认证与租户 [type: service, tech: OIDC]
业务服务 [type: service]
计费服务 [type: service]
缓存 [type: cache, tech: Redis]
共享数据 [color: blue] {
  租户配置库 [type: database]
  业务数据库 [type: database, tech: 按租户隔离]
}
租户用户 > API 网关: HTTPS
管理后台 > API 网关
API 网关 > 认证与租户: 识别租户
API 网关 > 业务服务, 计费服务
认证与租户 > 租户配置库
业务服务 > 业务数据库
业务服务 > 缓存: 读缓存
计费服务 > 业务数据库: 用量`},
 {id:'iot-telemetry',category:'IoT',tags:['MQTT','时序库','告警'],name:'IoT 设备上报',description:'设备经 MQTT 接入，规则引擎分流到时序库与告警，看板查询运行状态。',code:`direction right
现场设备 [type: client]
MQTT 接入 [type: gateway, tech: EMQX]
数据平台 [color: teal] {
  规则引擎 [type: service]
  时序数据库 [type: database, tech: TDengine]
  告警服务 [type: service]
}
运维看板 [type: application]
短信与 IM 通知 [type: external]
现场设备 > MQTT 接入: 上报
MQTT 接入 --> 规则引擎: 消息
规则引擎 > 时序数据库: 写入
规则引擎 > 告警服务: 触发
告警服务 > 短信与 IM 通知
运维看板 > 时序数据库: 查询`},
 {id:'ai-rag',category:'AI 应用',tags:['RAG','向量库','LLM 网关'],name:'AI 知识库问答（RAG）',description:'文档入库生成向量，问答时先检索再经 LLM 网关调用大模型生成答案。',code:`direction right
用户端 [type: client]
应用后端 [type: application]
检索服务 [type: service]
LLM 网关 [type: gateway]
大模型服务 [type: external]
知识入库 [color: purple] {
  原始文档 [type: storage]
  文档解析 [type: service]
  向量数据库 [type: database, tech: pgvector]
}
用户端 > 应用后端: 提问
应用后端 > 检索服务: 召回
检索服务 > 向量数据库: 相似度检索
应用后端 > LLM 网关: 生成答案
LLM 网关 > 大模型服务
原始文档 --> 文档解析: 新文档
文档解析 > 向量数据库: 写入向量`},
 {id:'mobile-bff',category:'移动',tags:['BFF','推送','CDN'],name:'移动应用后端（BFF）',description:'App 经 BFF 聚合多个领域服务，静态资源走 CDN，消息通过推送服务触达。',code:`direction right
App [type: client, tech: iOS / Android]
CDN [type: cdn]
BFF 聚合层 [type: application]
后端服务 [color: blue] {
  认证服务 [type: service]
  用户服务 [type: service]
  内容服务 [type: service]
}
推送服务 [type: external]
App > CDN: 静态资源
App > BFF 聚合层: HTTPS
BFF 聚合层 > 认证服务, 用户服务, 内容服务
内容服务 --> 推送服务: 通知`},
];
export function applyStarter(design:Design,id:string):Design{
 const starter=STARTERS.find(s=>s.id===id);if(!starter)throw Error('模板不存在');const view=design.views.find(v=>v.id==='technical')||design.views.find(v=>v.level==='technical');if(!view)throw Error('缺少技术容器视图');
 const result=parseCode(design,view,starter.code);if(!result.design)throw Error('模板无效：'+result.errors.map(e=>e.line+' '+e.message).join('；'));return result.design;
}
export const CATEGORIES=['Web 与业务系统','微服务','数据与事件','IoT','AI 应用','移动'];
/** 局部模式（STORY-014）：插入到技术容器视图，“{选中}”替换为选中节点；未选中时使用占位节点。 */
export type Pattern={id:string;name:string;description:string;category:string;code:string};
const ANCHOR='业务服务 [type: service]';
export const PATTERNS:Pattern[]=[
 {id:'cache-aside',category:'性能',name:'缓存旁路',description:'读请求先查缓存，未命中回源后写入缓存。',code:'Redis 缓存 [type: cache, tech: Redis]\n{选中} > Redis 缓存: 读缓存，未命中回源'},
 {id:'read-replica',category:'数据',name:'读写分离',description:'写主库，读只读副本，主库异步复制。',code:'主库 [type: database]\n只读副本 [type: database]\n{选中} > 主库: 写\n{选中} > 只读副本: 读\n主库 --> 只读副本: 复制'},
 {id:'queue-decouple',category:'解耦',name:'消息队列解耦',description:'发布事件到队列，由异步消费者处理，削峰并解耦。',code:'消息队列 [type: queue, tech: Kafka]\n异步消费者 [type: service]\n{选中} > 消息队列: 发布事件\n消息队列 --> 异步消费者: 订阅'},
 {id:'gateway-auth',category:'接入',name:'网关鉴权与限流',description:'API 网关统一路由、鉴权与限流，令牌由认证服务校验。',code:'API 网关 [type: gateway]\n认证服务 [type: service, tech: OAuth2]\nAPI 网关 > {选中}: 路由\nAPI 网关 > 认证服务: 校验令牌'},
 {id:'load-balancer',category:'接入',name:'负载均衡多实例',description:'负载均衡把流量分发到选中服务的多个实例。',code:'负载均衡 [type: load_balancer]\n负载均衡 > {选中}: 分发'},
 {id:'cdn-static',category:'性能',name:'静态资源加速',description:'文件存对象存储，经 CDN 分发并回源。',code:'CDN [type: cdn]\n对象存储 [type: storage]\nCDN > 对象存储: 回源\n{选中} > 对象存储: 上传'},
 {id:'search-sync',category:'数据',name:'搜索索引同步',description:'数据变更事件驱动同步任务写入搜索引擎。',code:'搜索引擎 [type: database, tech: Elasticsearch]\n索引同步任务 [type: service]\n{选中} --> 索引同步任务: 变更事件\n索引同步任务 > 搜索引擎: 写索引'},
 {id:'scheduled-batch',category:'解耦',name:'定时批处理',description:'调度器定时触发批处理任务，批量调用业务服务。',code:'调度器 [type: service, tech: Cron]\n批处理任务 [type: service]\n调度器 > 批处理任务: 定时触发\n批处理任务 > {选中}: 批量调用'},
 {id:'external-callback',category:'集成',name:'第三方异步回调',description:'调用第三方后由回调接收服务异步更新状态。',code:'第三方平台 [type: external]\n回调接收 [type: service]\n{选中} > 第三方平台: 发起请求\n第三方平台 --> 回调接收: 异步回调\n回调接收 > {选中}: 更新状态'},
];
const OP=/ (-->|<>|--|>|<|-) /;
const nameOf=(line:string)=>{const t=line.trim();const q=/^"([^"]*)"/.exec(t);return q?q[1]:t.split('[')[0].trim();};
export function applyPattern(design:Design,viewId:string,patternId:string,anchorId?:string):Design{
 const view=design.views.find(v=>v.id===viewId);if(!view)throw Error('视图不存在');if(view.level!=='technical')throw Error('局部模式只适用于技术容器视图');
 const pattern=PATTERNS.find(p=>p.id===patternId);if(!pattern)throw Error('模式不存在');
 const inView=design.nodes.filter(n=>view.nodeIds.includes(n.id));const anchor=anchorId&&inView.some(n=>n.id===anchorId)?nodeToken(design,view,anchorId):null;
 let body=pattern.code;if(!anchor)body=ANCHOR+'\n'+body;body=body.split('{选中}').join(anchor||nameOf(ANCHOR));
 const names=new Set(inView.map(n=>n.name));const idOf=(tok:string)=>inView.find(n=>n.name===tok||n.id===tok)?.id;
 const lines=body.split('\n').filter(line=>{const m=OP.exec(line);if(!m)return !names.has(nameOf(line));const s=idOf(nameOf(line.slice(0,m.index))),t=idOf(nameOf(line.slice(m.index+m[0].length).split(':')[0]));return !(s&&t&&design.relationships.some(r=>(r.source===s&&r.target===t)||(r.source===t&&r.target===s)));});
 const result=parseCode(design,view,toCode(design,view)+'\n'+lines.join('\n')+'\n');if(!result.design)throw Error('模式插入失败：'+result.errors.map(e=>e.message).join('；'));return result.design;
}
