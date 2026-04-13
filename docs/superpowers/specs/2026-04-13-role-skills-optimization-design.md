# Role Skills 优化设计

## 概述

优化 role-creator 和 role-executor 两个 skill 的提示词质量、工具引用准确性和文档结构。

## 问题

1. `find-skills` 引用不正确，应为 `otcc:find-skills`
2. role-executor 的匹配算法使用不可操作的伪代码打分公式，而非 LLM 语义判断
3. role-executor 使用 shell 命令而非 Claude Code 工具
4. role-executor Step 4 误解了 Claude Code 的 system prompt 机制
5. references/role-matcher.md 含硬编码角色列表，会过时
6. role-creator SKILL.md 混入大量 CLI 参数文档

## 设计

### role-executor SKILL.md

| 步骤               | 当前                     | 改为                                       |
| ------------------ | ------------------------ | ------------------------------------------ |
| Step 1 角色发现    | shell `ls` 扫描          | `Glob` + `Read` 读取 `.otcc/roles/*.json`  |
| Step 2 角色匹配    | 手动打分公式             | LLM 基于 inScope/outOfScope 语义匹配       |
| Step 3 Skills 安装 | `agent-team:find-skills` | `otcc:find-skills`                         |
| Step 4 上下文加载  | "加载为系统上下文补充"   | `Read` 角色 JSON，将 prompt 纳入对话上下文 |

### references/role-matcher.md

- 删除硬编码角色列表
- 删除具体打分公式（`matchScore = ...`）
- 保留匹配原则描述（语义匹配、outOfScope 排除、优先级规则）
- 更新示例使用泛化角色名而非具体角色

### role-creator SKILL.md

- Step 3: `find-skills` → `otcc:find-skills`
- 删除 `## CLI 命令` 整段（从 `## CLI 命令` 到文件末尾）
- 新建 `references/cli-commands.md` 存放 CLI 参数文档
- SKILL.md 末尾添加一句话引用 `references/cli-commands.md`

## 不变的部分

- 角色文件格式（JSON schema）
- 角色创建 5 步流程（标准化输入 → AI 生成 → 选择 Skills → CLI 执行 → 验证）
- 角色优先级规则（本地 > 全局）
- executor 的默认行为（无匹配时告知用户）
