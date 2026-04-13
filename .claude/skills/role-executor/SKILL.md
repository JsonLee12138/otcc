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

使用 Claude Code 工具扫描所有可用角色：

1. `Glob({ pattern: ".otcc/roles/*.json" })` — 扫描本地项目角色
2. `Glob({ pattern: "~/.claude/plugins/marketplaces/.otcc/roles/*.json" })` — 扫描全局角色
3. `Read` 每个角色文件，提取 `name`、`description`、`inScope`、`outOfScope` 字段

### Step 2: 角色匹配

基于用户请求的关键词和意图，选择最匹配的角色：

1. 阅读用户请求，理解其核心意图和目标
2. 与每个角色的 `inScope` 进行语义匹配，判断职责是否覆盖请求
3. 检查 `outOfScope`，若请求明确落在排除范围则降低匹配度
4. 选择匹配度最高的角色；若无足够匹配的角色，返回 `none` 并使用默认方式处理

**匹配规则**：

- 语义优先：不依赖关键词精确匹配，理解请求与角色职责的语义关系
- outOfScope 排除：请求核心落在 outOfScope 时，即使 inScope 有部分匹配也应排除
- 用户优先：若用户明确指定角色名称，直接加载该角色，跳过匹配流程

### Step 3: Skills 检查与安装

读取选中角色的 `skills` 字段，检查每个 skill 是否已安装：

1. `Glob({ pattern: ".claude/skills/<skill-name>" })` — 检查本地项目 skills
2. `Glob({ pattern: "~/.claude/skills/<skill-name>" })` — 检查全局 skills

**缺失时安装**：

- 使用 `otcc:find-skills` 查找并安装缺失的 skill

### Step 4: 角色上下文加载

加载选中角色的完整定义：

1. `Read` 角色 JSON 文件获取完整内容
2. 将角色的 `prompt` 内容纳入当前对话上下文，指导后续行为
3. 将角色的 `inScope`/`outOfScope` 纳入上下文，明确职责边界

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
