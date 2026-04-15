## CLI 命令

所有命令使用 `npx @jsonlee_12138/otcc` 前缀：

### otcc role create

创建新角色：

```bash
npx @jsonlee_12138/otcc role create --name "前端架构师" --file-name "frontend-architect" --description "负责前端技术选型"
npx @jsonlee_12138/otcc role create --interactive    # 交互式创建（引导式流程）
```

**参数**：

| 参数                   | 说明                                                 |
| ---------------------- | ---------------------------------------------------- |
| `--name`, `-n`         | 角色名称                                             |
| `--file-name`          | 文件名 (kebab-case)                                  |
| `--description`, `-d`  | 角色描述                                             |
| `--prompt`, `-p`       | 系统提示词                                           |
| `--in-scope`, `-i`     | 职责范围内的工作（逗号分隔）                         |
| `--out-of-scope`, `-o` | 职责范围外的工作（逗号分隔）                         |
| `--skills`, `-s`       | 关联的 skills（逗号分隔，格式：`owner/repo@suffix`） |
| `--interactive`, `-I`  | 交互式创建模式                                       |
| `--global`, `-g`       | 保存到全局目录                                       |

### otcc role list

列出所有角色：

```bash
npx @jsonlee_12138/otcc role list [--local] [--global]
```

### otcc role show

查看角色详情：

```bash
npx @jsonlee_12138/otcc role show <fileName>
```

### otcc role delete

删除角色：

```bash
npx @jsonlee_12138/otcc role delete <fileName> [--local] [--global]
```

### otcc role validate

验证角色文件：

```bash
npx @jsonlee_12138/otcc role validate <fileName>
```

### otcc role import

从全局模板导入角色到本地：

```bash
npx @jsonlee_12138/otcc role import <fileName>
```
