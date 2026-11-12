# dsh-team-console（技能包说明）

一个给 **DSH 多智能体工作区**用的启动技能：把已有的 V2.0 可视化控制台跑起来，并处理端口、路径、账本这几类常见问题。

- 技能名：`dsh-team-console`
- 适用：Windows / macOS / Linux
- 依赖：Node.js ≥ 20；**零 npm 依赖**
- 默认地址：`http://127.0.0.1:8787`（仅本机）

## 包里有什么

```text
dsh-team-console/
├─ SKILL.md                      技能说明（frontmatter + 触发场景 / 安装 / 启动 / 卸载 / FAQ）
├─ README.md                     本文件
└─ scripts/
   ├─ start-workbench.bat        Windows 启动器
   └─ start-workbench.sh         macOS / Linux 启动器
```

**不包含**控制台实现（`serve-workbench.mjs`、`views\*.mjs`、`styles\v2.css`）。实现随工作区走，技能只负责启动与排障，避免两份代码各自演化。

## 安装

Windows：

```powershell
# 在仓库根目录执行；若用 Release 的 zip，把 $src 指向解压后的 dsh-team-console 目录
$src = ".\skill\dsh-team-console"
$dst = "$env:USERPROFILE\.dsh\skills\dsh-team-console"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\*" $dst -Recurse -Force
```

macOS / Linux：

```bash
mkdir -p "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console"
cp -R . "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console/"
```

重启 DSH 后生效。

## 启动

```bat
scripts\start-workbench.bat "D:\your-workspace" 8787
```

```bash
sh scripts/start-workbench.sh "/path/to/workspace" 8787
```

两个参数都可省略：工作区默认取控制台目录的上一级，端口默认 `8787`。脚本会做 Node 版本检查、路径检查、健康检查，成功后才打开浏览器。

如果实现目录不在「脚本向上四级」，脚本会先尝试 `<workspace>/team-view`；仍找不到时再设置：

```bat
setx DSH_TEAM_CONSOLE_HOME "D:\your-workspace\team-view"
```

```bash
export DSH_TEAM_CONSOLE_HOME="/path/to/workspace/team-view"
```

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 总览驾驶舱（默认） |
| `/kanban` | 三态任务看板 |
| `/team` | 团队架构（编制 / 运行） |
| `/deps` | 依赖图 + 泳道时间线 |
| `/legacy` | 旧版工作台 |
| `/api/health` | 健康检查 |

## 卸载

结束监听端口的 `node` 进程，然后删除 `%USERPROFILE%\.dsh\skills\dsh-team-console`（或 `$DSH_HOME/skills/dsh-team-console`）。不会动工作区与账本。

## 注意

- 服务只监听 `127.0.0.1`，不要改成公网监听。
- 所有写操作走 `POST /api/action`；不要手改 `ledger-v2.json`。
- 测试请用 `WORKBENCH_LEDGER` 指向隔离账本。
- V2.0 的 6.7 建议中心、6.8 知识库、第 9 章资源消耗为暂缓项，界面显示「—（暂缓）」，不是故障。

## License

MIT © 2026 deepseek workspace
