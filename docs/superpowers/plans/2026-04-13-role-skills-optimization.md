# Role Skills 优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- []`) syntax for tracking.

**Goal:** 优化 role-creator 和 role-executor 两个 skill 的提示词质量、工具引用准确性和文档结构。

**Architecture:** 这是一个纯文案修改任务，涉及 4 个文件的编辑和 1 个新文件的创建。不需要代码变更。

**Tech Stack:** Markdown, Claude Code Skill 格式

---

### Task 1: 修复 role-executor SKILL.md 的工具引用和执行指令

**Files:**

- Modify: `.claude/skills/role-executor/SKILL.md`

- [ ] **Step 1: 修改 Step 1（角色发现）— 替换 shell 命令为 Claude Code 工具**

将当前 Step 1 中的：

```markdown
### Step 1: 角色发现

扫描所有可用角色：

- **本地角色**: `.otcc/roles/*.json`
- **全局角色**: `~/.claude/plugins/marketplaces/.otcc/roles/*.json`

读取每个角色的 `name`、`description`、`inScope`、`outOfScope` 字段。
```

替换为：

```markdown
### Step 1: 角色发现

使用 Claude Code 工具扫描所有可用角色：

1. `Glob({ pattern: ".otcc/roles/*.json" })` — 扫描本地项目角色
2. `Glob({ pattern: "~/.claude/plugins/marketplaces/.otcc/roles/*.json" })` — 扫描全局角色
3. `Read` 每个角色文件，提取 `name`、`description`、`inScope`、`outOfScope` 字段
```

- [ ] **Step 2: 修改 Step 2（角色匹配）— 替换打分公式为语义匹配**

将当前 Step 2 中的匹配规则和打分公式替换为：

```markdown
### Step 2: 角色匹配

基于用户请求的关键词和意图，选择最匹配的角色：

1. 阅读用户请求，理解其核心意图和目标
2. 与每个角色的 `inScope` 进行语义匹配，判断职责是否覆盖请求
3. 检查 `outOfScope`，若请求明确落在排除范围则降低匹配度
4. 选择匹配度最高的角色；若无足够匹配的角色，返回 `none` 并使用默认方式处理

**匹配规则：**

- 语义优先：不依赖关键词精确匹配，理解请求与角色职责的语义关系
- outOfScope 排除：请求核心落在 outOfScope 时，即使 inScope 有部分匹配也应排除
- 用户优先：若用户明确指定角色名称，直接加载该角色，跳过匹配流程
```

- [ ] **Step 3: 修改 Step 3（Skills 安装）— 修正引用名称**

将 Step 3 中的 `agent-team:find-skills` 替换为 `otcc:find-skills`：

```markdown
**缺失时安装：**

- 使用 `otcc:find-skills` 查找并安装缺失的 skill
- 若为本地 skill：使用 `npx otcc skill add <skill-name>`
- 远程 skill：使用完整标识符 `owner/repo@suffix`
```

- [ ] **Step 4: 修改 Step 4（上下文加载）— 明确加载机制**

将 Step 4 替换为：

```markdown
### Step 4: 角色上下文加载

加载选中角色的完整定义：

1. `Read` 角色 JSON 文件获取完整内容
2. 将角色的 `prompt` 内容纳入当前对话上下文，指导后续行为
3. 将角色的 `inScope`/`outOfScope` 纳入上下文，明确职责边界
```

- [ ] **Step 5: 验证修改结果**

确认 SKILL.md 中不再包含：`ls` 命令、`matchScore` 公式、`agent-team:find-skills` 引用、"系统上下文补充"措辞。

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/role-executor/SKILL.md
git commit -m "fix(role-executor): use Claude Code tools and semantic matching"
```

---

### Task 2: 重写 references/role-matcher.md

**Files:**

- Modify: `.claude/skills/role-executor/references/role-matcher.md`

- [ ] **Step 1: 重写文件内容**

将 `role-matcher.md` 整体替换为以下内容：

```markdown
# Role Matcher Reference

## 匹配原则

### 语义匹配

不依赖关键词精确匹配。LLM 应理解用户请求的核心意图，判断该意图是否属于角色 `inScope` 覆盖的职责范围。

### outOfScope 排除

若用户请求的核心目标明确落在角色的 `outOfScope` 范围内，即使 `inScope` 有部分相关，也应排除该角色。

### 优先级规则

当多个角色匹配度相近时：

1. 本地项目角色优先于全局角色
2. 用户明确指定的角色优先于自动匹配

## 匹配示例

### 示例 1：明确匹配

**用户请求**："帮我创建一个新的 CLI 命令"

**分析**：请求核心是 CLI 命令创建，属于 `cli-developer` 角色的 inScope 范围。

**匹配结果**：`cli-developer`

### 示例 2：无匹配

**用户请求**："设计一个用户认证系统"

**分析**：认证系统设计不属于任何现有角色的 inScope 范围。

**匹配结果**：`none`，使用默认方式处理，告知用户可用角色列表。

### 示例 3：outOfScope 排除

**用户请求**："重构整个前端架构"

**分析**：即使 `cli-developer` 角色可能涉及部分前端代码，但"前端架构重构"明确在其 outOfScope 中。

**匹配结果**：排除 `cli-developer`，匹配 `none`。

## 特殊规则

### 组合任务

若请求涉及多个领域：选择能覆盖核心需求的角色，若最高匹配角色无法覆盖关键部分，提示用户。

### 模糊请求

若请求过于模糊（如"帮我做这个"）：基于当前文件上下文推断意图，若无法推断则请求用户澄清。

### 明确指定

若用户明确指定角色名称，直接加载该角色，跳过匹配流程。
```

- [ ] **Step 2: 验证修改结果**

确认文件中不再包含：硬编码角色列表、`matchScore` 打分公式、具体分数阈值。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/role-executor/references/role-matcher.md
git commit -m "fix(role-executor): remove hardcoded role list and scoring formula from matcher reference"
```

---

### Task 3: 修复 role-creator SKILL.md 引用并迁移 CLI 文档

**Files:**

- Modify: `.claude/skills/role-creator/SKILL.md`
- Create: `.claude/skills/role-creator/references/cli-commands.md`

- [ ] **Step 1: 修正 role-creator 中 find-skills 引用**

在 SKILL.md 的 Step 3 中，将 `find-skills` 替换为 `otcc:find-skills`。

搜索并替换（共 2 处）：

- `find-skills` → `otcc:find-skills`（在 Step 3 的"AI 推荐"和"回退逻辑"段落中）

- [ ] **Step 2: 创建 references/cli-commands.md**

```bash
mkdir -p .claude/skills/role-creator/references
```

创建 `.claude/skills/role-creator/references/cli-commands.md`，内容为从 SKILL.md 中移出的 CLI 命令段落（从 `## CLI 命令` 到文件末尾）。

- [ ] **Step 3: 从 SKILL.md 中删除 CLI 命令段落**

删除 SKILL.md 中从 `---` 分隔线到文件末尾的全部内容（即 `## CLI 命令` 及其所有子章节），并在 SKILL.md 末尾添加引用：

```markdown
## 参考文档

- CLI 命令参数详情：See [cli-commands.md](references/cli-commands.md)
```

- [ ] **Step 4: 验证修改结果**

确认 SKILL.md 中不再包含 CLI 参数表格和命令用法示例。确认 `references/cli-commands.md` 包含完整的 CLI 命令参考。

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/role-creator/SKILL.md .claude/skills/role-creator/references/cli-commands.md
git commit -m "fix(role-creator): correct find-skills reference and move CLI docs to reference file"
```
