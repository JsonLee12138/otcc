# Role Matcher Reference

## 匹配算法

### 1. 关键词提取

从用户请求中提取关键信息：

```typescript
interface TaskKeywords {
  verbs: string[]; // 动词：build, create, fix, design...
  nouns: string[]; // 名词：cli, api, frontend, database...
  domain: string[]; // 领域：payment, auth, logging...
}
```

### 2. 评分计算

```
matchScore = (inScopeMatches * 10) - (outOfScopeMatches * 15) + semanticBonus
```

| 条件                        | 分数 |
| --------------------------- | ---- |
| 精确关键词匹配 `inScope`    | +10  |
| 语义相似 `inScope`          | +5   |
| 精确关键词匹配 `outOfScope` | -15  |
| 语义相似 `outOfScope`       | -8   |

### 3. 阈值规则

- `score >= 15`：强匹配，直接选用
- `score 8-14`：中匹配，考虑选用
- `score 1-7`：弱匹配，可能选用但需确认
- `score <= 0`：不匹配，尝试下一个角色

## 匹配示例

### 示例 1

**用户请求**："帮我创建一个新的 CLI 命令"

**分析**：

- verbs: `create`
- nouns: `cli`, `command`
- domain: `cli`

**匹配结果**：`cli-developer` (score: 25)

- `inScope` 匹配：`CLI command design and implementation` +10
- `inScope` 匹配：`Command arguments and flags` +5
- `outOfScope` 匹配：无

### 示例 2

**用户请求**："设计一个用户认证系统"

**分析**：

- verbs: `design`
- nouns: `auth`, `system`
- domain: `auth`

**匹配结果**：`none` (所有角色 score <= 0)

- `cli-developer`：`auth` 不在 inScope
- `skill-developer`：`auth system` 不在 inScope

## 角色列表

当前可用角色：

| 角色名                        | 文件名                          | 主要职责               |
| ----------------------------- | ------------------------------- | ---------------------- |
| CLI Developer                 | `cli-developer`                 | CLI 命令设计与实现     |
| Skill Developer               | `skill-developer`               | Claude Code skill 开发 |
| Tech Research Design Engineer | `tech-research-design-engineer` | 技术调研与设计         |
| Mock Service Developer        | `mock-service-developer`        | Mock 服务开发          |

## 特殊规则

### 1. 组合任务

若请求涉及多个领域：

1. 分别计算每个领域的匹配度
2. 选择得分最高的角色
3. 若最高分角色无法覆盖关键部分，提示用户

### 2. 模糊请求

若请求过于模糊（如"帮我做这个"）：

1. 基于当前文件上下文推断意图
2. 若无法推断，请求用户澄清

### 3. 明确指定

若用户明确指定角色：

```
使用 cli-developer 角色
```

→ 直接加载指定角色，跳过匹配流程
