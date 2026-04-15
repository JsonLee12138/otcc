# OTCC npm 发布与 tag 版本同步设计

## 概述

为当前 OTCC 项目增加一套最小可维护的发布流程：使用本地 `bun run tag -- vX.Y.Z` 作为显式版本同步与打 tag 入口，同时新增 GitHub Actions workflow 在 `v*` tag 推送后执行校验、构建与 npm 发布。

## 背景

当前仓库已有 npm 包基础信息，`package.json` 维护主版本号，但 `.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json` 中也存在独立 `version` 字段。发布时若这些文件版本不一致，会导致插件元数据与 npm 包版本漂移。

用户希望：

1. npm 发布由 GitHub Actions 自动执行
2. 发布触发方式为推送 `v*` tag
3. `.claude-plugin` 中两个文件的版本号在本地通过单独脚本处理
4. 允许通过 `bun run tag` 调用，也可额外提供 Makefile 包装
5. 版本策略为“必须一致”：本地脚本校验 `package.json` 与目标 tag 一致，CI 再做最终保护

## 目标

- 提供明确的本地发布前入口，而不是依赖隐式 git hook
- 保证 `package.json`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` 三处版本一致
- 在推送 `v*` tag 后自动执行 npm 发布
- 在本地和 CI 两层都阻止错误版本发布

## 非目标

- 不实现自动 bump `package.json` 版本号
- 不实现 changeset 或自动生成 changelog
- 不将发布逻辑拆成复杂多阶段 release pipeline
- 不依赖 git hook 拦截原生 `git tag` 命令

## 方案对比

### 方案 A：脚本主入口 + GitHub Actions 发布（推荐）

- 新增 `scripts/tag.ts` 作为显式入口
- 通过 `package.json` script 提供 `bun run tag -- vX.Y.Z`
- 可选提供 `make tag VERSION=vX.Y.Z` 作为薄封装
- GitHub Actions 监听 `v*` tag 并执行最终校验和发布

**优点：** 入口明确、行为可预测、符合当前需求、易测试。  
**缺点：** 需要用户遵循约定，不直接使用原生 `git tag`。

### 方案 B：仅 Makefile + GitHub Actions

- 把所有逻辑写在 Makefile target 中

**优点：** 调用简短。  
**缺点：** 逻辑堆在 shell 中，可测试性与可维护性较差，不适合作为核心实现。

### 方案 C：CI 内自动改写版本再发布

- 本地只打 tag，CI 根据 tag 改写版本号并发布

**优点：** 本地操作少。  
**缺点：** 源码状态与发布产物可能不一致，调试困难，不符合“本地显式同步版本”的要求。

## 推荐方案

采用 **方案 A：脚本主入口 + GitHub Actions 发布**。

原因：

- 版本修改发生在本地，语义清晰，可审查
- CI 只做校验与发布，职责单一
- 避免用 git hook 做 Git 原生不支持的 `pre-tag` 拦截
- 保持实现简单，符合当前项目规模

## 架构设计

### 1. 本地 tag 脚本单元

新增 `scripts/tag.ts`，负责：

- 读取命令参数中的 tag，例如 `v0.1.2`
- 校验 tag 格式必须为 `vX.Y.Z`
- 归一化出版本号 `0.1.2`
- 读取 `package.json` 并校验其 `version` 必须等于 `0.1.2`
- 读取 `.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json`
- 将这两个文件的 `version` 更新为 `0.1.2`
- 检查目标 git tag 是否已存在
- 执行 `git tag v0.1.2`

脚本应尽量将“纯逻辑”和“副作用”分离：

- 纯逻辑：版本解析、版本比较、JSON 内容变换
- 副作用：读写文件、执行 git 命令

这样更容易写测试并复用。

### 2. package.json 脚本入口

在 `package.json` 中新增脚本，例如：

- `"tag": "bun run scripts/tag.ts"`

使用方式：

- `bun run tag -- v0.1.2`

这里保持最小入口，不在 package script 中塞入复杂 shell 逻辑。

### 3. Makefile 薄封装

可选新增 `Makefile`，仅提供一层更顺手的调用，例如：

- `make tag VERSION=v0.1.2`

Makefile 不应重复实现业务逻辑，只做参数转发到 `bun run tag -- $(VERSION)`。

### 4. GitHub Actions 发布单元

新增 `.github/workflows/release-npm.yml`。

触发条件：

- `push.tags: ['v*']`
- 可额外支持 `workflow_dispatch`

主要职责：

- 检出代码
- 安装 Bun
- 安装依赖
- 从 tag 提取版本号
- 校验 tag、`package.json.version`、`.claude-plugin/plugin.json.version`、`.claude-plugin/marketplace.json.version` 一致
- 执行 `bun run typecheck`
- 执行 `bun test`
- 执行 `bun run build`
- 执行 `npm publish --access public`

workflow 不负责改写仓库文件，只负责失败即阻断发布。

## 数据流

### 本地脚本数据流

输入：`v0.1.2`

1. 解析为：
   - `tag = v0.1.2`
   - `version = 0.1.2`
2. 读取 `package.json.version`
3. 若 `package.json.version !== version`，直接失败
4. 更新：
   - `.claude-plugin/plugin.json.version = version`
   - `.claude-plugin/marketplace.json.version = version`
5. 检查 `git tag` 中是否已存在 `v0.1.2`
6. 若不存在，则创建 tag
7. 输出成功信息

### CI 数据流

输入：GitHub push tag 事件

1. 从 `github.ref_name` 提取 `v0.1.2`
2. 归一化得到 `0.1.2`
3. 对比仓库中的三个版本字段
4. 不一致则 workflow 失败
5. 一致则执行类型检查、测试、构建、发布

## 错误处理

### 本地脚本

- **非法 tag 格式**：直接退出并提示必须使用 `vX.Y.Z`
- **package.json 版本不一致**：直接退出，不修改任何文件，不创建 tag
- **目标 tag 已存在**：直接退出，避免重复发布
- **文件写入失败**：直接退出，不继续执行 `git tag`
- **git 命令失败**：直接退出并保留错误输出

### CI

- **tag 与版本文件不一致**：直接失败，阻止 npm 发布
- **typecheck/test/build 任一步失败**：直接失败
- **npm 认证失败**：发布步骤失败并输出标准错误

## 安全与可维护性

- 不在 workflow 中硬编码 token，使用 npm 官方认证方式
- workflow 最小权限化，默认只开放发布所需权限
- 不在 shell 中直接插值不可信事件内容；tag 值先进入环境变量再使用
- 版本同步逻辑集中在一个脚本文件中，避免分散到 hook、Makefile 和 CI 多处重复实现

## 测试策略

### 单元测试

为脚本中的纯逻辑补充测试：

- `parseTag('v0.1.2') -> '0.1.2'`
- 非法输入报错
- 版本一致性校验逻辑
- 更新 JSON 版本字段的纯函数

### 集成测试

如果当前测试基础允许，可对脚本核心流程做轻量集成测试：

- 使用临时目录中的 fixture 文件模拟 `package.json` 与 `.claude-plugin/*`
- 验证脚本在一致时会写入文件
- 验证脚本在不一致时不会写入文件

`git tag` 调用应保持很薄，尽量通过隔离函数减少对真实 git 的依赖。

### 发布前验证

CI workflow 本身作为最终回归防线：

- typecheck
- unit tests
- build
- version consistency check

## 目录与职责建议

- `scripts/tag.ts`：tag 参数解析、版本一致性校验、版本同步、创建 tag
- `src/...`：不新增与该流程强耦合的 CLI command，避免为单次发布动作过度建模
- `Makefile`：可选，提供 `make tag VERSION=vX.Y.Z` 转发
- `.github/workflows/release-npm.yml`：tag 发布 workflow

## 为什么不使用 git hook

Git 没有原生 `pre-tag` hook，因此无法可靠实现“用户执行原生 `git tag` 时自动先同步版本”。

可以用 hook 做提交或推送时校验，但不能优雅替代本次需求中的“tag 前执行版本同步”。对于当前目标，显式脚本入口比隐式 hook 更可控、更容易理解。

## 成功标准

当以下条件成立时，设计视为成功：

1. 开发者可执行 `bun run tag -- v0.1.2` 完成本地版本同步与打 tag
2. `.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json` 会被更新到 `0.1.2`
3. 若 `package.json.version !== 0.1.2`，脚本立即失败且不创建 tag
4. 推送 `v0.1.2` 后，GitHub Actions 会自动执行校验、构建与 npm 发布
5. CI 在任意版本不一致时阻止发布
