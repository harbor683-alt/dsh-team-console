# 流氏工作台 · dsh-team-console

给 DSH（DeepSeek Harness）里的多智能体团队做的一块**本地画布**：团队关系图铺满整页，可拖拽平移、滚轮缩放；左上角四枚方块切换视图，点成员直接在右侧对话；底部抽屉拉开就是依赖泳道。零 npm 依赖，只监听 `127.0.0.1:8787`。

![画布首页](images/01-canvas.jpg)

---

## 它解决什么

多智能体跑起来之后，真正难的是三件事：

1. **谁在干什么** —— 团队里每个角色、模型、当前任务、今天完成多少；
2. **卡在哪** —— 任务之间的依赖、并行/串行关系、哪一步返工；
3. **该你拍板什么** —— 待决策、待验收、异常，集中在一屏。

流氏工作台把这三件事压到一张画布上：**关系图打底，面板浮在上面**，不来回跳页。

---

## 画布怎么用

- **平移**：在空白处按住鼠标拖动（触屏同样支持 pointer 事件）；
- **缩放**：滚轮以指针为中心缩放，范围 40%–240%；右下角 `− / 100% / + / 复位` 也能控制；
- **换团队**：点左上角「● 圣诞树 2026 ⌄」下拉选另一个团队，画布当场切换，选择会被记住；
- **成员卡**：红点 = 空闲，绿点 = 忙碌；忙碌卡底部有一条蓝色光带从左往右流动；卡片上直接显示角色、模型、当前任务、今日完成；
- **点成员**：右侧弹出对话面板——上面 3/4 是历史消息，下面 1/4 是输入框，`Ctrl/Cmd+Enter` 发送；
- **底部抽屉**：点「依赖泳道」那一栏展开/收起，展开后展示任务依赖图 + 泳道时间线；
- **工作区**：顶栏的工作区下拉切换后，整页（含底部泳道）一起切到那个工作区。

### 驾驶舱

队伍在岗、五项指标、待办与动态流。数字缺数据源时显示「暂缓」，不猜、不补、不编。

![驾驶舱](images/04-cockpit.jpg)

### 项目书

左列书脊（名称 / 日期 / 大小），右侧直接读 Markdown 原文：标题、列表、引用、代码块、表格、粗体、行内代码、链接。文件改动后刷新即最新。

![项目书](images/02-projects.jpg)

### 拷问台

把「需求还没想清」的部分做成设计树：每轮只问前置条件已定的问题，每题给推荐答案，答完落成 `project-card.md`，再交给 Agent 去干。

![拷问台](images/03-grill.jpg)

### 成员对话

点画布上的成员卡，右侧弹出 3/4 历史 + 1/4 输入的对话面板；消息直接读写该成员的收件箱 `<team>/inbox/<member>.jsonl`，和 Agent Teams 共用同一条通道。

![成员对话](images/06-chat.jpg)

### 依赖泳道

任务依赖图 + 泳道时间线，按团队分页；可切「显示关系 / 全局 / 按小时 / 事件」。底部抽屉与顶栏工作区保持同步。

![依赖泳道](images/05-deps.jpg)

### 动态反馈

- 「编制视图 / 运行视图」固定在右上角，画布怎么拖都在原位；
- 正在工作的成员：卡片顶部一条蓝色流光，卡片到执行层的连线变成流动虚线；
- 平移与缩放会记住（localStorage `cw-pan`），下次打开还是同一视角；
- 团队成员或任务有变化时，画布每 6 秒比对一次签名并静默刷新（视角不丢）；
- 工作区被删除后，旧的 `?ws=` 链接直接 404「这个工作区已经不在了」，不再回落到默认工作区。

---

## 快速开始

要求：**Node.js ≥ 20**（只用内置模块，零依赖）。

```bash
# Windows / macOS / Linux 通用
node core/serve-workbench.mjs <你的工作区路径> --port=8787

# Windows 也可以直接双击
core\重开工作台.bat
```

然后打开 <http://127.0.0.1:8787/>。

首次启动会在 `%USERPROFILE%\.dsh\team-console\board.json`（或 `$DSH_HOME/team-console/board.json`）建本地任务库，并从 `.agent-teams` 与全局账本导入一次；之后任务状态只写这份 `board.json`。

> 只想看示例数据：`--demo`。想换存储位置：`WORKBENCH_BOARD=<path>`。想关掉账本镜像：`--no-mirror-ledger`。

---

## 路由

| 路径 | 说明 |
|---|---|
| `/` | 画布首页（团队关系图 + 四枚方块 + 底部抽屉 + 成员对话） |
| `/cockpit` | 驾驶舱 |
| `/projects` | 项目书书架 + 阅读器 |
| `/grill` | 拷问台 |
| `/team` | 团队架构（`?team=<id>` 单团队、`?pane=1` 右侧窄栏） |
| `/deps` | 依赖泳道 + 泳道时间线 |
| `/kanban` | 任务看板（三态） |
| `/spaces` | 全部工作区索引 |
| `/api/health` | `{ ok, server, v, pid, workspaces }` |
| `/api/data` | 当前工作区的汇总数据 |
| `/api/member-chat?team=&member=` | 读成员收件箱中的对话 |
| `POST /api/member-chat` | 以「真人」身份给成员写一条消息 |
| `/api/projects` `/api/project?id=` | 项目书列表 / 原文 |
| `/api/grill` | 拷问台轮次读写 |
| `/api/action` | 新建/更新任务 |

`embed=1` 用于嵌进浮层或 DSH 侧栏（去导航、去多余留白）；`canvas=1` 是画布专用的团队图与平移缩放；`pane=1` 是右侧栏窄版。

---

## 数据从哪来

- 团队与任务：`<workspace>/.agent-teams/*/team.json`、`inbox/*.jsonl`；
- 项目书：`<workspace>/项目书/*.md`（排除 `_模板.md`）；
- 任务状态：本地 `board.json`（DSH 任务账本只做首次导入与可选镜像，不做运行时依赖）；
- 团队显示名：`core/team-labels.json`（id/原名 → 中文名，没配的显示原名）。

工作台**只读**团队与项目文件；唯一写回是你在对话面板里发出的消息（追加到对应成员的 `inbox/<member>.jsonl`）。

---

## 目录结构

```text
core/
  serve-workbench.mjs      # HTTP 服务与路由
  team-data.mjs            # 任务 / 团队装载（含中文名映射）
  team-labels.json         # 团队中文名映射
  store.mjs                # board.json 读写、账本导入、镜像
  workspaces.mjs           # 工作区发现与解析
  views/
    canvas.mjs             # 画布首页（平移缩放外壳、成员对话、工作区切换）
    cockpit.mjs            # 驾驶舱
    projects.mjs           # 项目书
    grill.mjs              # 拷问台
    team-arch.mjs          # 团队关系图（单团队 / 多团队）
    dep-swim.mjs           # 依赖泳道
    kanban.mjs             # 三态看板
    spaces.mjs             # 全部工作区
    shell.mjs              # 公共样式覆盖（嵌入模式 / 画布 / 窄栏）
  styles/v2.css            # 设计令牌与基础组件
  重开工作台.bat
skill/dsh-team-console/    # 可安装的 DSH 技能包（自带同一份 core）
scripts/                   # 启动脚本（bat / sh）
```

---

## 设计说明

- 主色 `#4d6bfe`，页面底色 `#f7f9fc`，点阵网格 24px，圆角 14–16px，正文 14px/1.55；
- 一页只留一个视觉重点（关系图），面板全部是浮层，避免多页来回切；
- 状态点：红 = 空闲、绿 = 忙碌（与「运行/异常」等状态色分开，只用于成员卡）；
- 卡片默认克制：1px 细边、极浅阴影，hover 才抬升；
- 兼容 `prefers-reduced-motion`：关闭流光与呼吸动画；iframe 与抽屉都懒加载。

---

## 作为 DSH 插件

仓库自带的是**独立控制台**。若想让它出现在 DSH 左侧菜单和对话右侧栏，需要另一个薄插件 `dsh-workbench`（不在本仓库）：

- 入口用 `sidebar.panellist` 注册，页面用 `main` 槽注册，`key` 对齐；
- 右侧栏用 `sidebar.right.pane.tab` 注册「团队架构」，指向 `/team?embed=1&canvas=1&pane=1`；
- 插件启动时用 `/api/health` 的 `v` 判断端口上是不是新版，不匹配就替换旧进程。

---

## 开发

```bash
node --check core/serve-workbench.mjs
node --check core/views/*.mjs
node core/serve-workbench.mjs <workspace> --port=8794
```

改 `.mjs` 后重启进程即可，无构建步骤。

---

## License

MIT
