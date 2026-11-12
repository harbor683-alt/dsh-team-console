---
name: dsh-team-console
description: "给 DSH 工作台装 V2.0 可视化控制台：驾驶舱/三态看板/团队架构/依赖泳道，适合想让多智能体团队一眼看清谁在干什么的人。"
---

# dsh-team-console

给 DSH 工作区装一个**本地、零依赖**的多智能体团队控制台：打开 `http://127.0.0.1:8787`，就能看到谁在跑、哪里卡住、哪一步返工、今天该你拍板什么。

本技能只负责**安装引导、启动与排障**，不复制 `serve-workbench.mjs` 等实现文件；实现仍在工作区的 `team-view\` 目录里，避免两份代码各自演化。

---

## 什么时候用

- 用户说「打开工作台 / 控制台」「看看团队现在在干什么」「谁卡住了」「启动 8787」。
- 用户刚拿到这套 V2.0 控制台，需要装成 DSH 技能、配置启动脚本或排查端口问题。
- 用户想在 1280×800 下看驾驶舱、三态看板、团队架构、依赖泳道四个页面。

不适用：需要改视图实现、改账本结构、做数据迁移时——那属于开发任务，不是本技能的范围。

---

## 前置条件

| 项 | 要求 |
|---|---|
| Node.js | **≥ 20**，只用内置模块，**零 npm 依赖** |
| 控制台实现 | 工作区里存在 `team-view\serve-workbench.mjs`、`views\*.mjs`、`styles\v2.css` |
| 数据 | 任务账本可读；团队目录 `.agent-teams\` 与 `项目书\` 可选（缺失时界面降级） |
| 端口 | 默认 `8787`，可传 `1–65535` 的端口；仅监听 `127.0.0.1` |

> 控制台是 DSH 工作区的一部分，不在本技能包内。若实现目录不在默认相对位置，用环境变量 `DSH_TEAM_CONSOLE_HOME` 指向它。

---

## 安装

### Windows（PowerShell）

```powershell
# 在仓库根目录执行；若用 Release 的 zip，把 $src 指向解压后的 dsh-team-console 目录
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
```

然后重启 DSH，让技能目录重新加载。重启后在会话里说「用 dsh-team-console 启动工作台」即可命中本技能。

### 配置实现目录（按需）

如果 `team-view\` 不在默认位置，按下面的顺序排查并设置一次环境变量（脚本也会先尝试 `<工作区>\team-view`）：

```bat
setx DSH_TEAM_CONSOLE_HOME "D:\your-workspace\team-view"
```

```bash
export DSH_TEAM_CONSOLE_HOME="/path/to/workspace/team-view"
```

脚本的解析顺序：`DSH_TEAM_CONSOLE_HOME` → `<工作区>\team-view`（传了工作区参数时）→ 脚本目录向上四级（仓库内布局）→ 报错并提示设置变量。

---

## 启动

```bat
:: 参数：[工作区] [端口]，都可省略
scripts\start-workbench.bat "D:\your-workspace" 8787
```

```bash
sh scripts/start-workbench.sh "/path/to/workspace" 8787
```

默认值：工作区 = 控制台目录的上一级（`team-view\..`），端口 = `8787`。

脚本会：检查 Node 版本 → 校验 `serve-workbench.mjs` 与工作区存在 → 最小化启动服务 → 轮询 `/api/health` → 健康后打开浏览器。服务日志留在最小化的控制台窗口里。

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

卸载**不会**删除工作区里的 `team-view\`、任务账本或团队数据。

---

## 常见问题

**`serve-workbench.mjs not found`**
说明技能只装在本机技能目录、实现不在默认相对路径。设置 `DSH_TEAM_CONSOLE_HOME` 指向包含 `serve-workbench.mjs` 的目录（通常是 `<workspace>\team-view`），重新打开终端再启动。

**8787 被占用 / 页面还是旧界面**
先查占用：`netstat -ano | findstr :8787`，结束旧 `node` 进程后重启；或换端口 `start-workbench.bat "<workspace>" 8788`。换端口后所有页面与 API 都在新端口下。旧进程未退出时，浏览器会继续命中旧代码。

**账本写入报 `EPERM`**
账本默认在 `%USERPROFILE%\.dsh\task-board\ledger-v2.json`，可能位于工作区之外。不要直接改文件：页面所有写入都走 `POST /api/action`。测试时用 `WORKBENCH_LEDGER` 指向隔离的测试账本，并在启动服务的那个环境里设置。

**工作区不对 / 看到别的团队数据**
启动时第一个参数就是工作区路径。页面也可用 `?ws=<id|标题|路径>` 或 `?sid=<会话>` 切换；不带参数时按「最近会话 → 默认工作区」解析。

**页面空白或样式没加载**
先看 `/api/health` 是否 200；再强制刷新（Ctrl+F5）；仍不对就核对实现目录里 `/styles/v2.css` 与 `views\*.mjs` 是否齐全，然后重启服务。

**界面数字为什么有「—（暂缓）」**
这是如实标注：常驻业务完成率、今日资源消耗等数据层尚未建立（计划书 6.7 / 6.8 / 第 9 章暂缓），控制台不编造数字。

---

## 边界

- 本技能不修改账本、不直接写 `.agent-teams\`，只启动与排障。
- 不包含 V2.0 实现代码；实现随工作区分发。
- 6.5 详情面板未纳入本版；6.7 建议中心、6.8 知识库、第 9 章资源消耗明确暂缓。
- 单进程、单机、仅 `127.0.0.1`，不要暴露到公网。
