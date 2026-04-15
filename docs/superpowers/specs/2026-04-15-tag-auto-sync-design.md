# OTCC tag 命令自动同步版本设计

## 概述

调整当前 `bun run tag -- vX.Y.Z` 的语义：默认模式不再要求 `package.json.version` 预先等于 tag version，而是直接将 `package.json`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` 三处 `version` 同步为目标版本，然后创建对应 git tag。`--check` 模式继续保留为只读校验入口，供 CI 在发布前复用。

## 背景

当前实现中：

- `bun run tag -- v0.1.2` 会先读取 `package.json.version`
- 如果 `package.json.version !== 0.1.2`，命令立即失败
- 这要求使用者先手动修改 `package.json`

而用户的真实预期是：`tag` 命令本身就是“版本准备 + 打 tag”的单一入口。也就是说，执行该命令时应直接把所有版本文件改成目标版本，而不是先要求仓库已经处于目标版本。

## 目标

- `bun run tag -- vX.Y.Z` 一次性完成三处版本文件同步与 git tag 创建
- 保留 `bun run tag -- --check vX.Y.Z` 作为只读一致性校验入口
- 在 tag 已存在时拒绝执行，且不修改任何文件
- 保持实现简单，不引入额外命令拆分

## 非目标

- 不自动创建 git commit
- 不自动 push tag
- 不引入 changeset 或 changelog 生成
- 不增加新的 CLI 命令名（如 `tag:create`）

## 方案对比

### 方案 A：默认模式直接改三处版本并打 tag（推荐）

- `bun run tag -- v0.1.2`
  - 解析 tag
  - 检查 git tag 不存在
  - 更新 `package.json` 与 `.claude-plugin/*`
  - 创建 git tag
- `bun run tag -- --check v0.1.2`
  - 只校验三处版本是否一致

**优点：** 最符合用户预期；命令语义完整；本地使用最直接。  
**缺点：** `tag` 默认模式从“校验型”变为“修改型”。

### 方案 B：默认模式只改版本，不自动打 tag

- `bun run tag -- v0.1.2` 只更新版本文件
- 用户再手动执行 `git tag v0.1.2`

**优点：** 副作用更少。  
**缺点：** 需要两步操作，不符合用户刚确认的行为预期。

### 方案 C：拆成两个命令

- `bun run tag -- v0.1.2` 改版本
- `bun run tag:create -- v0.1.2` 打 tag

**优点：** 职责最纯。  
**缺点：** 增加命令复杂度，对当前项目是过度设计。

## 推荐方案

采用 **方案 A**：保留 `--check` 只读模式，但把默认模式调整为“同步三处版本 + 创建 git tag”。

用户视角：

- `bun run tag -- v0.1.2`：做完版本文件更新与打 tag
- `bun run tag -- --check v0.1.2`：只读校验

实现视角：

- 继续沿用现有 `scripts/tag.ts` 入口
- 继续保留 `verifyReleaseTag()` 给 CI 使用
- 调整 `syncReleaseTag()` 使其负责写 `package.json` 与 `.claude-plugin/*`

## 架构设计

### 1. 解析与校验层

保留现有职责：

- `parseReleaseTag(tag)`：把 `v1.2.3` 解析为 `1.2.3`
- 校验 tag 必须匹配 `vX.Y.Z`

### 2. 版本文件同步层

从“只同步 `.claude-plugin/*`”扩展为“同步全部版本文件”：

- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

建议将版本文件路径抽象成一个常量列表，例如：

- `VERSION_FILES = ['package.json', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']`

同步函数的职责变为：

- 逐个读取上述 JSON 文件
- 直接把顶层 `version` 字段更新为目标版本
- 写回文件并保留末尾换行

### 3. 只读校验层

`verifyReleaseTag()` 保持只读：

- 解析 tag
- 读取 `package.json` 与 `.claude-plugin/*`
- 校验三处 `version` 都等于目标版本
- 不修改文件
- 不创建 git tag

### 4. git 层

保留当前 git 逻辑，但执行顺序要确保无半成状态：

1. 解析 tag
2. 检查 tag 不存在
3. 更新三处版本文件
4. 创建 git tag

其中第 2 步必须在写文件之前，避免 tag 已存在时留下脏文件。

## 数据流

### 默认模式

输入：`v0.1.2`

1. 解析得出 `version = 0.1.2`
2. 检查 `git tag --list v0.1.2` 结果为空
3. 将以下文件的顶层 `version` 改成 `0.1.2`：
   - `package.json`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json`
4. 执行 `git tag v0.1.2`
5. 输出成功信息

### `--check` 模式

输入：`v0.1.2`

1. 解析得出 `version = 0.1.2`
2. 读取三处版本文件
3. 若任一文件的 `version !== 0.1.2`，直接失败
4. 若三处都一致，输出校验通过信息

## 错误处理

### 默认模式

- **非法 tag 格式**：直接失败，不修改文件
- **git tag 已存在**：直接失败，不修改文件
- **任一文件读写失败**：直接失败，不创建 tag
- **git tag 创建失败**：直接失败；由于 tag 存在性检查已提前做，正常场景下不会先因 tag 已存在而脏写

### `--check` 模式

- **任一版本文件缺少 `version` 字段**：直接失败
- **任一版本不一致**：直接失败并指出文件路径与实际版本

## 测试策略

### 需要调整的现有测试

当前测试中存在一条旧假设：默认模式要求 `package.json.version` 先等于目标版本。该假设需要移除。

例如：

- 旧测试：`fails before writing files when package.json version does not match the tag`

这条测试不再符合新的设计，应改为新的行为验证。

### 新的核心测试

1. **默认模式会更新三处版本并创建 git tag**
   - 初始版本可与目标版本不同
   - 运行后断言三处都变为目标版本
   - 断言 git tag 被创建

2. **`--check` 模式在版本不一致时失败**
   - `package.json` 不一致
   - `plugin.json` 不一致
   - `marketplace.json` 不一致

3. **tag 已存在时不改任何文件**
   - 预先创建同名 tag
   - 执行默认模式
   - 断言退出失败
   - 断言三个文件都未被改写

4. **非法 tag 时失败且不改文件**
   - 输入如 `1.2.3`
   - 断言退出失败
   - 断言三个文件保持不变

## 与现有实现的边界变化

### 保留不变

- `scripts/tag.ts` 的入口形式
- `--check` 模式的存在与用途
- `parseReleaseTag()` 的 tag 解析职责
- workflow 中使用 `bun run tag -- --check "$RELEASE_TAG"` 的做法

### 需要修改

- `syncReleaseTag()`：不再先要求 `package.json.version === tagVersion`
- 版本同步逻辑：从只改 `.claude-plugin/*` 扩展为同时改 `package.json`
- 对应集成测试：从“package.json 不一致时报错”改成“package.json 不一致时由默认模式主动修正”

## 成功标准

当以下条件成立时，设计视为成功：

1. 执行 `bun run tag -- v0.1.2` 后，`package.json`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` 的 `version` 都变为 `0.1.2`
2. 同一命令会创建 git tag `v0.1.2`
3. 若 tag 已存在，命令失败且三处文件都不被改写
4. 执行 `bun run tag -- --check v0.1.2` 时，命令不会修改任何文件
5. CI 仍可通过 `--check` 模式做发布前只读校验
