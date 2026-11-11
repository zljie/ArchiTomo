/** ADDM-BASE 1.0.0：来自 Goal Owner 提供的《ADDM_元模型规则Profile_v1.json》（intake/active/attachments/addm-v1.0），原样转为模块以便浏览器与 Node 共同加载。 */
const profile: unknown = {
 "profileId": "ADDM-BASE",
 "version": "1.0.0",
 "displayName": "架构即未来 · DDD驱动架构设计元模型",
 "description": "架构设计平台内部 DDD 模型与目标系统类型化架构图的统一规范。L0 采用 BC-01 的外部引用，不复制源事实。",
 "contextBoundaries": [
  {
   "id": "BC-01",
   "name": "IntentAndScope",
   "class": "supporting",
   "owns": [
    "DesignProject",
    "Goal",
    "Constraint",
    "QualityScenario"
   ]
  },
  {
   "id": "BC-02",
   "name": "ArchitectureModeling",
   "class": "core",
   "owns": [
    "ModelElement",
    "ModelRelation",
    "ArchitectureView"
   ]
  },
  {
   "id": "BC-03",
   "name": "ArchitectureDecision",
   "class": "core",
   "owns": [
    "ArchitectureDecision"
   ]
  },
  {
   "id": "BC-04",
   "name": "MetamodelCatalog",
   "class": "supporting",
   "owns": [
    "ModelProfile",
    "ArchitecturePattern"
   ]
  },
  {
   "id": "BC-05",
   "name": "ArchitectureAssurance",
   "class": "core",
   "owns": [
    "QualityReview",
    "EvidenceRecord"
   ]
  },
  {
   "id": "BC-06",
   "name": "BaselineEvolution",
   "class": "supporting",
   "owns": [
    "ArchitectureBaseline",
    "ChangeProposal"
   ]
  }
 ],
 "levels": [
  {
   "id": "L0",
   "name": "目标与上下文",
   "description": "设计目标、质量场景、约束和利益相关人：源事实由 BC-01 管理"
  },
  {
   "id": "L1",
   "name": "业务架构",
   "description": "业务能力、流程、目标业务系统的限界上下文与领域概念"
  },
  {
   "id": "L2",
   "name": "应用架构",
   "description": "承担业务能力的系统与职责、跨系统接口、数据所有权"
  },
  {
   "id": "L3",
   "name": "技术方案架构",
   "description": "技术运行单元、技术服务、存储、集成通道与部署单元"
  },
  {
   "id": "L4",
   "name": "组件架构",
   "description": "模块、内部组件、接口契约、扩展点和配置单元"
  }
 ],
 "elementTypes": [
  {
   "id": "Goal",
   "level": "L0",
   "ownerContext": "BC-01",
   "referenceMode": "externalRef"
  },
  {
   "id": "Concern",
   "level": "L0",
   "ownerContext": "BC-01",
   "referenceMode": "externalRef"
  },
  {
   "id": "Constraint",
   "level": "L0",
   "ownerContext": "BC-01",
   "referenceMode": "externalRef"
  },
  {
   "id": "QualityScenario",
   "level": "L0",
   "ownerContext": "BC-01",
   "referenceMode": "externalRef"
  },
  {
   "id": "Stakeholder",
   "level": "L0",
   "ownerContext": "BC-01",
   "referenceMode": "externalRef"
  },
  {
   "id": "TargetBoundedContext",
   "level": "L1",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "BusinessCapability",
   "level": "L1",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "BusinessProcess",
   "level": "L1",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "DomainConcept",
   "level": "L1",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "BusinessRule",
   "level": "L1",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "ApplicationSystem",
   "level": "L2",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "SystemResponsibility",
   "level": "L2",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "IntegrationContract",
   "level": "L2",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "DataOwnership",
   "level": "L2",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "RuntimeUnit",
   "level": "L3",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TechnicalService",
   "level": "L3",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "DataStore",
   "level": "L3",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "IntegrationChannel",
   "level": "L3",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "DeploymentUnit",
   "level": "L3",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "Module",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "Component",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "InterfaceContract",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "Adapter",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "ExtensionPoint",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "ConfigurationUnit",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TargetAggregate",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TargetEntity",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TargetValueObject",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TargetDomainEvent",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "TargetDomainService",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  },
  {
   "id": "RepositoryPort",
   "level": "L4",
   "ownerContext": "BC-02",
   "referenceMode": "canonical"
  }
 ],
 "relationTypes": [
  {
   "id": "motivates",
   "label": "目标驱动能力",
   "sourceTypes": [
    "Goal"
   ],
   "targetTypes": [
    "BusinessCapability"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "scopes",
   "label": "目标限制业务范围",
   "sourceTypes": [
    "Goal"
   ],
   "targetTypes": [
    "TargetBoundedContext",
    "BusinessProcess"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "realizedBy",
   "label": "业务能力由应用实现",
   "sourceTypes": [
    "BusinessCapability"
   ],
   "targetTypes": [
    "ApplicationSystem"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "ownedByContext",
   "label": "领域概念由目标限界上下文管理",
   "sourceTypes": [
    "DomainConcept",
    "BusinessRule"
   ],
   "targetTypes": [
    "TargetBoundedContext"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "supportsProcess",
   "label": "业务能力支撑流程",
   "sourceTypes": [
    "BusinessCapability"
   ],
   "targetTypes": [
    "BusinessProcess"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "implementedBy",
   "label": "应用由技术运行单元实现",
   "sourceTypes": [
    "ApplicationSystem"
   ],
   "targetTypes": [
    "RuntimeUnit",
    "TechnicalService"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "contains",
   "label": "同一层级或邻接层级包含",
   "sourceTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "Module"
   ],
   "targetTypes": [
    "RuntimeUnit",
    "Component",
    "Module"
   ],
   "allowedPairs": [
    [
     "ApplicationSystem",
     "RuntimeUnit"
    ],
    [
     "RuntimeUnit",
     "Component"
    ],
    [
     "RuntimeUnit",
     "Module"
    ],
    [
     "Module",
     "Component"
    ]
   ],
   "crossContext": false,
   "acyclic": true,
   "singleParent": true
  },
  {
   "id": "dependsOn",
   "label": "结构依赖",
   "sourceTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "TechnicalService",
    "Module",
    "Component"
   ],
   "targetTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "TechnicalService",
    "Module",
    "Component"
   ],
   "sameTypeOnly": true,
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "integratesWith",
   "label": "跨应用协作",
   "sourceTypes": [
    "ApplicationSystem"
   ],
   "targetTypes": [
    "ApplicationSystem"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "governedBy",
   "label": "由业务/技术约束限制",
   "sourceTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "Component",
    "IntegrationContract"
   ],
   "targetTypes": [
    "Constraint"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "mustSatisfy",
   "label": "由质量场景约束",
   "sourceTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "TechnicalService"
   ],
   "targetTypes": [
    "QualityScenario"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "justifiedBy",
   "label": "经架构决策说明",
   "sourceTypes": [
    "ApplicationSystem",
    "RuntimeUnit",
    "TechnicalService",
    "DataStore",
    "Component"
   ],
   "targetTypes": [
    "ArchitectureDecision"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "verifiedBy",
   "label": "由证据验证",
   "sourceTypes": [
    "QualityScenario"
   ],
   "targetTypes": [
    "EvidenceRecord"
   ],
   "crossContext": true,
   "acyclic": false
  },
  {
   "id": "contextProvidesTo",
   "label": "目标限界上下文上游/下游关系",
   "sourceTypes": [
    "TargetBoundedContext"
   ],
   "targetTypes": [
    "TargetBoundedContext"
   ],
   "properties": [
    "integrationPattern",
    "upstreamRole",
    "downstreamRole"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "definesAggregate",
   "label": "目标限界上下文定义目标聚合",
   "sourceTypes": [
    "TargetBoundedContext"
   ],
   "targetTypes": [
    "TargetAggregate"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "aggregateMember",
   "label": "目标聚合的内部实体/值对象",
   "sourceTypes": [
    "TargetAggregate"
   ],
   "targetTypes": [
    "TargetEntity",
    "TargetValueObject"
   ],
   "crossContext": false,
   "acyclic": true
  },
  {
   "id": "publishesEvent",
   "label": "目标聚合发出领域事件",
   "sourceTypes": [
    "TargetAggregate"
   ],
   "targetTypes": [
    "TargetDomainEvent"
   ],
   "crossContext": false,
   "acyclic": false
  },
  {
   "id": "usesRepositoryPort",
   "label": "目标领域服务使用存储端口",
   "sourceTypes": [
    "TargetDomainService"
   ],
   "targetTypes": [
    "RepositoryPort"
   ],
   "crossContext": false,
   "acyclic": false
  }
 ],
 "viewpoints": [
  {
   "id": "STATIC_STRUCTURE",
   "name": "静态结构视图"
  },
  {
   "id": "DYNAMIC_BEHAVIOR",
   "name": "动态行为视图"
  },
  {
   "id": "DATA_INFORMATION",
   "name": "数据与信息视图"
  },
  {
   "id": "RUNTIME_DEPLOYMENT",
   "name": "运行与部署视图"
  }
 ],
 "commands": [
  "DefineScope",
  "ProposeGoal",
  "AcceptGoal",
  "CreateElement",
  "ReviseElement",
  "EstablishRelation",
  "RemoveRelation",
  "ArrangeView",
  "ProposeDecision",
  "AcceptDecision",
  "StartReview",
  "AttachEvidence",
  "PublishBaseline",
  "ProposeChange"
 ],
 "events": [
  "ScopeDefined",
  "GoalAccepted",
  "ElementCreated",
  "ElementChanged",
  "RelationEstablished",
  "DecisionAccepted",
  "ReviewCompleted",
  "QualityGateFailed",
  "BaselinePublished",
  "ChangeProposed"
 ],
 "states": {
  "DesignProject": [
   "DRAFT",
   "ACTIVE",
   "ARCHIVED"
  ],
  "ModelElement": [
   "DRAFT",
   "PROPOSED",
   "APPROVED",
   "RETIRED"
  ],
  "ArchitectureDecision": [
   "PROPOSED",
   "EVALUATING",
   "ACCEPTED",
   "REJECTED",
   "SUPERSEDED"
  ],
  "QualityReview": [
   "PENDING",
   "RUNNING",
   "PASSED",
   "FAILED"
  ],
  "ArchitectureBaseline": [
   "CANDIDATE",
   "PUBLISHED",
   "SUPERSEDED"
  ]
 },
 "invariants": [
  {
   "id": "INV-001",
   "scope": "ModelElement",
   "severity": "error",
   "rule": "element.type 必须在 profile 中声明；level 与 type 一致"
  },
  {
   "id": "INV-002",
   "scope": "ModelRelation",
   "severity": "error",
   "rule": "relation.type、source.type、target.type 三元组必须在白名单中"
  },
  {
   "id": "INV-003",
   "scope": "ModelRelation",
   "severity": "error",
   "rule": "同一关系的端点 projectId 一致，或显式引用已登记的外部项目基线"
  },
  {
   "id": "INV-004",
   "scope": "ModelRelation",
   "severity": "error",
   "rule": "contains 不允许环；同一子节点的 contains 父节点最多一个"
  },
  {
   "id": "INV-005",
   "scope": "ArchitectureView",
   "severity": "error",
   "rule": "视图只存元素/关系稳定 ID 与布局，不复制源结构事实"
  },
  {
   "id": "INV-006",
   "scope": "ArchitectureDecision",
   "severity": "error",
   "rule": "ACCEPTED 必须含备选方案、权衡、理由与受影响对象；单方案需登记豁免理由"
  },
  {
   "id": "INV-007",
   "scope": "QualityReview",
   "severity": "error",
   "rule": "评审绑定被检查的版本快照；严重缺陷阻断基线发布"
  },
  {
   "id": "INV-008",
   "scope": "ArchitectureBaseline",
   "severity": "error",
   "rule": "PUBLISHED 版本只读；修订必须产生新基线"
  },
  {
   "id": "INV-009",
   "scope": "Traceability",
   "severity": "error",
   "rule": "核心业务能力必须具有至少一个 realizedBy 应用系统"
  },
  {
   "id": "INV-010",
   "scope": "Traceability",
   "severity": "warning",
   "rule": "重要技术构件需要目标/约束或决策的上游依据"
  },
  {
   "id": "INV-011",
   "scope": "Evidence",
   "severity": "error",
   "rule": "硬性质量场景必须存在有效证据或批准的风险接受记录"
  },
  {
   "id": "INV-012",
   "scope": "CrossContext",
   "severity": "error",
   "rule": "跨上下文仅用 ID 和版本引用；引用验证基于已发布快照，不做跨聚合强事务"
  }
 ],
 "targetDddExtension": {
  "optional": true,
  "strategicTypes": [
   "TargetBoundedContext"
  ],
  "tacticalTypes": [
   "TargetAggregate",
   "TargetEntity",
   "TargetValueObject",
   "TargetDomainEvent",
   "TargetDomainService",
   "RepositoryPort"
  ],
  "rules": [
   "目标聚合边界由业务不变量和事务一致性决定",
   "聚合内部实体仅通过聚合根更改",
   "RepositoryPort 是抽象接口，不表示聚合直接依赖 SAP 适配器",
   "目标领域事件表达过去发生的有业务意义的事实",
   "ContextMap 集成模式至少记录上下游与语义翻译策略"
  ]
 },
 "notes": [
  "此文件为模型 Profile 的规范草案；不能直接作为 JSON Schema 校验器，无工具 runtime 实现时仅供配置和生成。",
  "架构图的 L0–L4 不是 DDD 限界上下文或部署层。",
  "在目标系统中识别的 TargetBoundedContext 与平台 BC-01~BC-06 是两个概念域。"
 ]
};
export default profile;
