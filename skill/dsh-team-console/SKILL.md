---
name: dsh-team-console
description: "给 DSH 工作台装 V2.0 可视化控制台：驾驶舱/三态看板/团队架构/依赖泳道，适合想让多智能体团队一眼看清谁在干什么的人。"
---

# dsh-team-console

给 DSH 工作区装一个**本地、零依赖**的多智能体团队控制台：打开 `http://127.0.0.1:8787`，就能看到谁在跑、哪里卡住、哪一步返工、今天该你拍板什么。

技能包**自带完整实现**（`core/`），装好就能启动，不依赖工作区里另放一份 `team-view/`。任务数据默认写到 `%USERPROFILE%\.dsh\team-console\board.json`，升级或卸载技能都不会丢。

---

## 什么时候用

- 用户说「打开工作台 / 控制台」「看看团队现在在干什么」「谁卡住了」「启动 8787」。
- 用户刚拿到这套 V2.0 控制台，需要装成 DSH 技能、配置启动脚本或排查端口问题。
- 用户想按驾驶舱 / 三态看板 / 团队架构 / 依赖泳道四个页面查看多智能体团队。

不适用：改视图实现、改数据 schema、做团队数据迁移——那属于开发任务，不是本技能的范围。

---

## 前置条件

| 项 | 要求 |
|---|---|
| Node.js | **≥ 20**，只用内置模块，**零 npm 依赖** |
| 技能包 | 含 `SKILL.md`、`scripts/`、`core/`（Release zip 解压后即是） |
| 工作区 | 任意目录即可；有 `.agent-teams/` 与 `项目书/` 时数据更完整 |
| 端口 | 默认 `8787`，可传 `1–65535`；仅监听 `127.0.0.1` |

> 控制台只读工作区里的团队与项目文件，任务状态写到自己的 `board.json`。首次启动会尝试从本机账本与 `<workspace>/.agent-teams` 导入一次。

---

## 安装

### Windows（PowerShell）

```powershell
# 仓库根目录执行；Release zip 则先解压，再把 $src 指向 dsh-team-console 目录
$src = ".\skill\dsh-team-console"
$dst = "$env:USERPROFILE\.dsh\skills\dsh-team-console"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\*" $dst -Recurse -Force
```

### macOS / Linux

```bash
mkdir -p "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console"
cp -R skill/dsh-team-console/. "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console/"
```

### 装完确认

```bat
dir "%USERPROFILE%\.dsh\skills\dsh-team-console\SKILL.md"
dir "%USERPROFILE%\.dsh\skills\dsh-team-console\core\serve-workbench.mjs"
```

然后重启 DSH，让技能目录重新加载。之后在会话里说「用 dsh-team-console 启动工作台」即可命中本技能。

---

## 启动

```bat
:: 参数：[工作区] [端口]，都可省略；省略工作区时用当前目录
"%USERPROFILE%\.dsh\skills\dsh-team-console\scripts\start-workbench.bat" "D:\your-workspace" 8787
```

```bash
sh "$HOME/.dsh/skills/dsh-team-console/scripts/start-workbench.sh" "/path/to/workspace" 8787
```

默认值：工作区 = 当前目录，端口 = `8787`。

脚本会：

1. 检查 Node.js ≥ 20；
2. 校验技能自带的 `core/serve-workbench.mjs` 与工作区存在；
3. 设置任务数据文件（未指定 `WORKBENCH_BOARD` 时用 `%USERPROFILE%\.dsh\team-console\board.json`）；
4. 最小化启动服务（Linux/macOS 前台运行）；
5. 轮询 `/api/health`，健康后打开浏览器。

打开后：

| 路径 | 页面 |
|---|---|
| `/` | 总览驾驶舱（默认落地页） |
| `/kanban` | 三态任务看板 |
| `/team` | 团队架构（编制 / 运行双模式） |
| `/deps` | 依赖图 + 泳道时间线 |
| `/legacy` | 旧版工作台 |
| `/api/health` | 健康检查，返回 `{ ok, server, v, pid, workspaces }` |

---

## 数据放在哪

| 数据 | 位置 |
|---|---|
| 任务存储 | `%USERPROFILE%\.dsh\team-console\board.json`（可用 `WORKBENCH_BOARD` 覆盖） |
| 团队 / 成员 / 消息 | `<workspace>/.agent-teams/`（只读导入） |
| 项目书 | `<workspace>/项目书/*.md`（只读） |
| 可选账本镜像 | `%USERPROFILE%\.dsh\task-board\ledger-v2.json`（启动加 `--no-mirror-ledger` 可关） |

备份控制台：复制 `board.json` 即可。想从头再来：停服务后删掉它，再启动会重新导入。

---

## 卸载

1. 停掉服务：结束监听 8787 的 `node` 进程。

   ```bat
   netstat -ano | findstr :8787
   taskkill /PID <pid> /F
   ```

   ```bash
   lsof -i :8787        # 或 ss -ltnp | grep 8787
   kill <pid>
   ```

2. 删除技能目录：

   ```bat
   rmdir /S /Q "%USERPROFILE%\.dsh\skills\dsh-team-console"
   ```

   ```bash
   rm -rf "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console"
   ```

卸载**不会**删除 `%USERPROFILE%\.dsh\team-console\board.json`，也不会改工作区里的 `.agent-teams/`。需要彻底清理时手动删除该 `board.json`。

---

## 常见问题

**`serve-workbench.mjs not found`**
技能包不完整，`core/` 没被复制过去。重新解压 Release zip，确认 `skills\dsh-team-console\core\serve-workbench.mjs` 存在；旧版布局也可用 `DSH_TEAM_CONSOLE_HOME` 指向实现目录。

**8787 被占用 / 页面还是旧界面**
先查占用：`netstat -ano | findstr :8787`，结束旧 `node` 进程后重启；或换端口 `start-workbench.bat "<workspace>" 8788`。换端口后所有页面与 API 都在新端口下。

**页面能开但数据是空的**
确认工作区参数指向了正确目录；首次启动只导入一次，若工作区路径变了，可停服务后设置新的 `WORKBENCH_BOARD`，或访问 `/api/resync` 手动重新导入。

**工作区不对 / 看到别的团队数据**
启动时第一个参数就是工作区路径；页面也可用 `?ws=<id|标题|路径>` 或 `?sid=<会话>` 切换。确保启动命令里的路径是想要的那个。

**页面空白或样式没加载**
先看 `/api/health` 是否 200；再强制刷新（Ctrl+F5）；仍不对就确认 `core/styles/v2.css` 与 `core/views/*.mjs` 齐全，然后重启服务。

**界面数字为什么有「—（暂缓）」**
这是如实标注：常驻业务完成率、今日资源消耗等数据层尚未建立（计划书 6.7 / 6.8 / 第 9 章暂缓），控制台不编造数字。

**升级技能会丢数据吗**
不会。`board.json` 在技能目录之外；覆盖技能文件后重启即可，数据仍在。

---

## 边界

- 本技能不直接改账本、不写 `.agent-teams/`，只启动服务；页面写入都走 `POST /api/action`。
- 6.5 详情面板未纳入本版；6.7 建议中心、6.8 知识库、第 9 章资源消耗明确暂缓。
- 单进程、单机、仅 `127.0.0.1`，不要暴露到公网。
