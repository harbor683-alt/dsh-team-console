---
name: dsh-team-console
description: "给 DSH 工作区装「流氏工作台」：团队关系图画布首页（拖拽平移 / 滚轮缩放 / 切团队 / 点成员对话）+ 驾驶舱 / 项目书 / 拷问台 / 任务看板四枚方块 + 可折叠依赖泳道。适合想让多智能体团队一眼看清谁在干什么、卡在哪、该你拍板什么的人。"
---

# 流氏工作台 · dsh-team-console

给 DSH 工作区装一块**本地、零依赖**的多智能体团队画布：打开 `http://127.0.0.1:8787`，团队关系图铺满整页，左上角四枚方块切换视图，底部抽屉拉开是依赖泳道。

技能包**自带完整实现**（`core/`），装好即可启动，不依赖工作区里另放一份 `team-view/`。任务数据默认写到 `%USERPROFILE%\.dsh\team-console\board.json`，升级或卸载技能都不会丢。

---

## 什么时候用

- 用户说「打开工作台 / 流氏工作台」「看看团队现在在干什么」「谁卡住了」「启动 8787」。
- 用户想按画布 / 驾驶舱 / 项目书 / 拷问台 / 任务看板 / 依赖泳道查看多智能体团队，或直接找某个成员对话。
- 用户要把这套控制台装成 DSH 技能、配置启动脚本或排查端口问题。

不适用：改视图实现、改数据 schema、做团队数据迁移——那属于开发任务，不是本技能的范围。

---

## 前置条件

| 项 | 要求 |
|---|---|
| Node.js | **≥ 20**，只用内置模块，**零 npm 依赖** |
| 技能包 | 含 `SKILL.md`、`scripts/`、`core/`（Release zip 解压后即是） |
| 工作区 | 任意目录即可；有 `.agent-teams/` 与 `项目书/` 时数据更完整 |
| 端口 | 默认 `8787`，可传 `1–65535`；仅监听 `127.0.0.1` |

> 工作台只读 `.agent-teams` 与 `项目书`；任务状态写自己的 `board.json`。首次启动会从本机账本与团队文件导入一次。

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

---

## 启动

### Windows

```bat
scripts\start-workbench.bat <工作区路径> [端口]
```

或直接双击技能目录里的 `core\重开工作台.bat`（默认端口 8787）。

### macOS / Linux

```bash
sh scripts/start-workbench.sh <工作区路径> [端口]
```

启动后打开 <http://127.0.0.1:8787/>。健康检查：

```bash
curl http://127.0.0.1:8787/api/health
# {"ok":true,"server":"workbench","v":8,"pid":...,"workspaces":N}
```

---

## 页面

| 路径 | 内容 |
|---|---|
| `/` | 画布首页：团队关系图 + 四枚方块（驾驶舱 / 项目书 / 拷问台 / 任务看板）+ 底部依赖泳道抽屉 + 成员对话面板 |
| `/cockpit` | 驾驶舱：队伍在岗、五项指标、等我处理、动态流 |
| `/projects` | 项目书：书架 + Markdown 阅读器（表格/列表/代码/引用） |
| `/grill` | 拷问台：设计树逐轮提问，答完生成 `project-card.md` |
| `/team` | 团队架构：编制/运行视图、横向/纵向布局、角色状态与连线；`?team=` 单团队，`?pane=1` 窄栏 |
| `/deps` | 依赖泳道：任务依赖图 + 泳道时间线 |
| `/api/member-chat` | GET 读成员对话；POST 以「真人」身份写一条消息到成员收件箱 |
| `/kanban` | 任务看板（三态） |
| `/spaces` | 全部工作区索引 |

`embed=1` 去导航与留白，适合浮层或 DSH 侧栏；`canvas=1` 是画布专用团队图样式；`pane=1` 是右侧栏窄版。

### 画布交互

- 空白处拖动平移；滚轮以指针为中心缩放（40%–240%），右下角有缩放条与复位。
- 左上角团队 chip 下拉切换团队，选择记在 localStorage。
- 成员卡：红点=空闲、绿点=忙碌；忙碌卡底部蓝色光带流动。
- 点成员卡：右侧弹出对话面板（上 3/4 历史、下 1/4 输入），消息读写 `<team>/inbox/<member>.jsonl`。
- 顶栏工作区下拉切换后，整页与底部泳道一起切到该工作区。

---

## 数据

| 数据 | 位置 | 读写 |
|---|---|---|
| 团队 / 成员 / 团队任务 | `<workspace>/.agent-teams/*/team.json`、`inbox/*.jsonl` | 只读 |
| 项目书 | `<workspace>/项目书/*.md` | 只读 |
| 任务状态 | `%USERPROFILE%\.dsh\team-console\board.json`（或 `$DSH_HOME/team-console/board.json`） | 读写 |
| 账本镜像 | `~/.dsh/task-board/ledger-v2.json` | 可选，`--no-mirror-ledger` 关闭 |

换存储位置：`WORKBENCH_BOARD=<path>`。只看演示数据：`--demo`。

---

## 排障

| 现象 | 处理 |
|---|---|
| 端口被旧进程占着 | 先 `curl /api/health` 看 `v`；旧版没有 `v` 或 `v` 偏小，按端口杀掉后重启 |
| 页面能开但没有数据 | 工作区路径不对，或该工作区没有 `.agent-teams/`；用 `--demo` 先看空态 |
| Windows 下 `.bat` 一闪而过 | 在 cmd 里手动执行，看 stderr；确认 Node 在 PATH |
| 任务改完刷新丢失 | 检查 `board.json` 是否可写；`WORKBENCH_BOARD` 是否指向只读位置 |
| 想看旧版单页 | 已移除；`/sheet`、`/classic` 返回 404 属正常 |

---

## 升级 / 卸载

- 升级：覆盖 `core/` 与 `SKILL.md`，保留 `%USERPROFILE%\.dsh\team-console\board.json`。
- 卸载：删除技能目录即可；`board.json` 独立存放，不会跟着删。

---

## 许可

MIT
