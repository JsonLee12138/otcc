# otcc init 设计说明

## 背景

当前项目需要提供一个 `init` CLI，用于在用户当前项目的 `CLAUDE.md` 中注入角色优先提示词，确保后续任务执行前先进行角色检查。

本次设计明确采用最小可用方案：只支持一个固定初始化动作，不引入额外可配置项。

## 目标

实现一个 `otcc init` 命令，完成以下行为：

- 读取随 CLI 包发布的模板文件 `templates/role-priority-prompt.md`
- 将模板内容包裹为固定标签块：`<otcc-role>...</otcc-role>`
- 将该标签块写入当前工作目录下的 `CLAUDE.md` 顶部
- 若 `CLAUDE.md` 不存在，则自动创建
- 若已存在 `<otcc-role>` 块，则整块替换为最新内容
- 多次执行结果保持稳定，不重复注入

## 非目标

本次不包含以下能力：

- 不支持自定义 tag 名称
- 不支持自定义目标文件名
- 不支持交互式确认
- 不支持自动备份
- 不支持多模板、多初始化步骤或通用 block 注入框架

## 命令设计

### 命令形态

采用单命令：

```bash
otcc init
```

命令职责保持单一：初始化当前项目的 `CLAUDE.md` 角色优先提示块。

### 命令行为

执行 `otcc init` 时：

1. 读取包内模板 `templates/role-priority-prompt.md`
2. 生成如下 block：

```md
<otcc-role>
...模板正文...
</otcc-role>
```

3. 定位当前工作目录下的 `CLAUDE.md`
4. 根据目标文件状态执行创建、插入或替换
5. 输出与实际结果匹配的成功提示

## 模板文件与发布设计

### 模板路径

运行时模板固定放在：

```text
templates/role-priority-prompt.md
```

### 发布要求

在 `package.json` 的 `files` 字段中显式包含 `templates/`，确保 npm 包发布后该模板文件可用。

### 设计原因

将模板作为包内运行时资源，而不是依赖调用方项目中的 `docs/role-priority-prompt.md`，有以下好处：

- 命令行为稳定，不受调用方目录结构影响
- 模板始终跟随 CLI 一起发布
- 模板升级只依赖 CLI 版本升级
- 运行时依赖边界清晰

## CLAUDE.md 注入规则

### 目标文件

目标文件固定为当前工作目录下的：

```text
CLAUDE.md
```

### 写入规则

#### 场景 1：`CLAUDE.md` 不存在

自动创建文件，并写入完整 `<otcc-role>` block。

#### 场景 2：`CLAUDE.md` 存在，但没有 `<otcc-role>` block

将 `<otcc-role>` block 插入到文件顶部，并与原始内容之间保留一个空行。

#### 场景 3：`CLAUDE.md` 存在，且已有 `<otcc-role>...</otcc-role>`

将首个完整 block 整块替换为最新模板内容。

### 幂等性要求

重复执行 `otcc init` 时，最终文件内容保持稳定：

- 不重复追加多个 `<otcc-role>` block
- 已存在 block 时始终更新为当前模板内容

### 异常格式处理

若检测到损坏的 block，例如只有开始标签没有结束标签，则命令直接报错，不尝试自动修复。

## 模块拆分设计

### 命令层

建议新增：

```text
src/commands/init.ts
```

职责：

- 解析并执行 `otcc init`
- 定位当前目录中的 `CLAUDE.md`
- 调用核心注入逻辑
- 根据结果输出用户提示

### 核心逻辑层

建议新增：

```text
src/core/init/claude.ts
```

职责：

- 读取模板文件
- 生成 `<otcc-role>` block
- 判断当前应执行创建、插入还是替换
- 处理 block 完整性校验
- 返回最终文本及操作结果类型

### 设计原则

- 命令层负责 CLI 交互
- 核心层负责纯文本变换和文件内容决策
- 不提前抽象为通用 block 注入框架，避免过度设计
- 为将来可能出现的其他 init 子能力保留 `src/core/init/` 扩展空间

## 错误处理

仅处理真实边界错误，保持行为明确。

### 报错场景

1. 模板文件不存在或未随包发布
   - 直接报错，提示 CLI 安装内容不完整

2. 当前目录下目标文件不可写
   - 直接报错

3. 发现损坏的 `<otcc-role>` block
   - 直接报错，不自动猜测修复

### 成功提示

根据实际执行结果区分输出：

- 已创建 `CLAUDE.md`
- 已在 `CLAUDE.md` 顶部插入 `<otcc-role>`
- 已更新现有 `<otcc-role>`

## 测试设计

测试分为两层。

### 纯逻辑测试

验证文本变换逻辑：

1. `CLAUDE.md` 不存在时，生成仅含 `<otcc-role>` 的新内容
2. 已存在普通内容但无 block 时，正确插入到顶部
3. 已存在 `<otcc-role>` block 时，正确整块替换
4. 连续执行两次，结果保持不变
5. 存在不完整 block 时抛错

### 命令级测试

验证 CLI 行为：

1. `otcc init` 操作当前目录下的 `CLAUDE.md`
2. 成功消息与实际执行分支一致
3. 模板缺失时命令失败退出

## 验收标准

实现完成后，应满足以下结果：

- `package.json` 的 `files` 字段包含 `templates/`
- 发布产物中包含 `templates/role-priority-prompt.md`
- 在空项目目录执行 `otcc init` 时可正确创建 `CLAUDE.md`
- 在已有 `CLAUDE.md` 的项目中可正确插入或替换 `<otcc-role>`
- 重复执行不会产生重复 block
- 异常 block 格式会明确失败，而非静默修改
