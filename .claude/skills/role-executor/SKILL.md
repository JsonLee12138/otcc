---
name: role-executor
description: 角色执行器。当用户提出工作时，自动分析任务、选择最合适的角色、安装所需 skills 并按角色职责执行。触发时机：(1) 用户请求任何开发任务时，(2) 需要确定使用哪个角色时，(3) 需要加载特定角色关联的 skills 时。
---

# Role Executor

## 概述

Role Executor 是 OTCC 项目的核心执行引擎。它在处理任何工作请求时自动：

1. 分析用户任务
2. 匹配最合适的角色
3. 安装缺失的 skills
4. 根据角色职责执行

## 工作流程

### Step 1: 角色发现

扫描所有可用角色：

- **本地角色**: `.otcc/roles/*.json`
- **全局角色**: `~/.claude/plugins/marketplaces/.otcc/roles/*.json`

读取每个角色的 `name`、`description`、`inScope`、`outOfScope` 字段。

### Step 2: 角色匹配

基于用户请求的关键词和意图，选择最匹配的角色：

1. 提取用户请求中的关键动词和名词
2. 与每个角色的 `inScope`/`outOfScope` 进行语义匹配
3. 计算匹配分数，选择得分最高的角色
4. 若无匹配度足够的角色，返回 `none` 并使用默认方式处理

**匹配规则**：

- 精确关键词匹配：`inScope` 中的词项完全包含在请求中
- 语义相似匹配：请求意图与角色职责描述相似
- 排除匹配：`outOfScope` 中包含的词项会降低匹配度

### Step 3: Skills 检查与安装

读取选中角色的 `skills` 字段，检查每个 skill 是否已安装：

```bash
# 检查 skill 是否已安装
ls .claude/skills/<skill-name> 2>/dev/null || ls ~/.claude/skills/<skill-name> 2>/dev/null
```

**缺失时安装**：

- 若使用 `find-skills` agent：调用 `agent-team:find-skills` 查找并安装
- 若为本地 skill：使用 `npx otcc skill add <skill-name>`
- 远程 skill：使用完整标识符 `owner/repo@suffix`

### Step 4: 角色上下文加载

加载选中角色的完整定义：

1. 读取角色 JSON 文件
2. 加载角色的 `prompt` 作为系统上下文补充
3. 加载角色的 `inScope`/`outOfScope` 明确职责边界

### Step 5: 任务执行

按角色职责边界执行：

1. **在 `inScope` 范围内**：充分发挥角色专长
2. **在 `outOfScope` 范围内**：明确拒绝或移交
3. **跨角色请求**：识别并告知用户需要切换角色

## 角色文件格式

```json
{
  "name": "角色名称",
  "fileName": "file-name",
  "version": "1.0.0",
  "description": "角色描述",
  "prompt": "系统提示词补充",
  "inScope": ["职责范围1", "职责范围2"],
  "outOfScope": ["职责范围外1", "职责范围外2"],
  "skills": ["skill-name-1", "skill-name-2"]
}
```

## 角色优先级

当多个角色匹配度相同时：

1. 本地项目角色优先于全局角色
2. 版本号更高的角色优先
3. 名称字典序更靠前的角色优先

## 默认行为

若无法匹配任何角色：

1. 使用通用方式处理请求
2. 告知用户可用的角色列表供参考
3. 可建议用户指定角色

## 参考文档

- 角色匹配逻辑详情：See [role-matcher.md](references/role-matcher.md)
