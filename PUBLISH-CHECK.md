# 发布自检记录（PUBLISH-CHECK）

- 检查日期：2026-11-13
- 检查对象：`team-view/github/` 发布树（`main`）
- 结论：**通过**，可提交并打 Release。

---

## 1. 文件清单

| 路径 | 说明 |
|---|---|
| `README.md` | 中文主文档：画布首页 / 驾驶舱 / 项目书 / 拷问台 / 团队架构 / 依赖泳道 + 路由 + 数据 |
| `LICENSE` | MIT |
| `PUBLISH.md` | 发布步骤 |
| `PUBLISH-CHECK.md` | 本文件 |
| `.gitattributes` | `.bat` 强制 CRLF，`.sh` 强制 LF |
| `.gitignore` | 忽略依赖、日志、`dist/`、运行数据 |
| `images/01-canvas.jpg` … `06-cockpit.jpg` | 1280×800 实机截图，6 张 |
| `core/` | 15 个文件：`serve-workbench.mjs`、`team-data.mjs`、`store.mjs`、`workspaces.mjs`、`team-labels.json`、`views/*.mjs`（9）、`styles/v2.css`、`重开工作台.bat` |
| `skill/dsh-team-console/` | 技能包：`SKILL.md`、`README.md`、`scripts/`（bat + sh）、`core/`（与仓库 `core/` 逐文件一致） |
| `scripts/build-skill-zip.ps1` | 用 .NET 重新打包，条目统一正斜杠 |
| `dist/dsh-team-console-skill.zip` | 发布产物（`dist/` 不入库） |

---

## 2. 语法

```text
node --check core/serve-workbench.mjs
node --check core/team-data.mjs core/store.mjs core/workspaces.mjs
node --check core/views/*.mjs
```

结果：全部通过。

---

## 3. 干净目录启动

临时工作区 + 临时 `DSH_HOME` + 独立 `WORKBENCH_BOARD`，只放 `core/`：

```text
node core/serve-workbench.mjs <tmp-ws> --port=8796 --no-mirror-ledger
```

| 路径 | 状态码 |
|---|---:|
| `/` `/cockpit` `/projects` `/grill` `/team` `/deps` `/kanban` `/spaces` | 200 |
| `/api/health` | 200，`{"ok":true,"server":"workbench","v":5,"workspaces":1}` |
| `/sheet` `/classic`（旧版页面，已移除） | 404 |

进程已关闭，8796 无残留监听。

---

## 4. 运行实例（8787）

- `/api/health` → `{"ok":true,"server":"workbench","v":5,"pid":47224,"workspaces":2}`；
- 画布首页：团队 chip 显示中文名（`圣诞树 2026`），点开下拉列出 `圣诞树 2026 3 人` / `论文讲解 3 人`；选中后 iframe 切到 `&team=<id>`、chip 更新、菜单收回；
- `/team?…&canvas=1&team=christmas-tree-2026` 含 `ta-block--single`；不带 `team` 时为多团队并含 `ta-block__name`；
- 旧路由 `/sheet` `/classic` 均 404。

---

## 5. 脱敏

- 全树（排除 `.git/`）搜索 `35438`、`C:\Users`、`ghp_`、`sk-proj`：**0 命中**。
- `DSH_HOME` 默认取 `os.homedir()`，`WORKBENCH_WS` 可覆盖默认工作区；不再硬编码本机路径。
- 不含任务账本、`.agent-teams/`、`data/`、日志、备份目录。

---

## 6. 技能包 zip

- 文件：`dist/dsh-team-console-skill.zip`，94,061 字节。
- 条目：21 个，全部以 `dsh-team-console/` 开头，路径分隔符为 `/`（由 `scripts/build-skill-zip.ps1` 生成）。
- 包含 `SKILL.md`、`README.md`、`scripts/`、`core/`（含 `styles/`、`views/`、`team-labels.json`、`重开工作台.bat`）。
- 不含 `.git/`、`core/data/`、日志、账本。

---

## 7. git

- 提交后 `git status --short` 为空；
- `dist/` 被忽略；`images/*.jpg`、`core/`、`skill/` 未被忽略；
- `.bat` 文件为 CRLF（25 个 CR / 25 个 LF），`.gitattributes` 固定该行为。

---

## 8. 已知边界

- `core/` 是工作区实现的脱敏副本（只改了默认路径与注释），业务逻辑一致；
- 技能包 `core/` 与仓库 `core/` 保持逐文件一致，改一处要同步另一处；
- 发布前由维护者确认远端历史无旧版敏感内容（本次只检查当前工作树）。
