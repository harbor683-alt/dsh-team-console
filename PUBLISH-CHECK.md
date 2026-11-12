# 发布自检记录（PUBLISH-CHECK）

- 检查日期：2026-11-12
- 检查对象：`team-view/github/` 发布树（工作树，未提交）
- 检查人：发布员（t9）
- 结论：**通过**，可由仓库维护者统一提交并按 `PUBLISH.md` 发 Release。

> 前置条件：V2.0 验收（t7）已通过；本记录只覆盖发布包本身。

---

## 1. 文件清单与体积

| 路径 | 字节 | 说明 |
|---|---:|---|
| `README.md` | 18,225 | 中文主文档；四图 + 前后对比 + 架构图 |
| `LICENSE` | 1,086 | MIT，版权人 `dsh-team-console contributors` |
| `PUBLISH.md` | 9,185 | 发布步骤（不含本机路径） |
| `PUBLISH-CHECK.md` | 本文件 | 发布自检记录 |
| `.gitignore` | 385 | 忽略依赖、日志、dist、临时脚本、运行数据 |
| `assets/architecture.svg` | 7,617 | 手写 SVG 架构图 |
| `images/01-cockpit.png` | 131,156 | 1280×800 |
| `images/02-kanban.png` | 97,666 | 1280×800 |
| `images/03-team-arch.png` | 69,630 | 1280×800 |
| `images/04-dep-swim.png` | 97,406 | 1280×800 |
| `images/05-before-after.png` | 606,200 | 2600×980 前后对比 |
| `core/` | 11 个 `.mjs` + `styles/v2.css` + `重开工作台.bat` | 可直接运行 |
| `skill/dsh-team-console/` | 17 个文件 | 自带 `core/` 的可安装技能包 |
| `dist/dsh-team-console-skill.zip` | 112,004 | 发布产物，`dist/` 不入库 |

`core/` 文件：`serve-workbench.mjs`、`stage.mjs`、`workbench.mjs`、`console.mjs`、`orchestra.mjs`、`workspaces.mjs`、`store.mjs`、`views/{cockpit,kanban,team-arch,dep-swim}.mjs`、`styles/v2.css`、`重开工作台.bat`。`views` 未改实现，只复制。

---

## 2. 脱敏

- 全树（排除 `.git/`）按 `PUBLISH.md` §0 的四组敏感串检查：**0 命中**。
- 工作区实现里的默认路径、会话目录、演示文案已改为 `os.homedir()` 或 `process.cwd()`；`DSH_HOME` 可用环境变量覆盖。
- 仓库不包含：任务账本、`.agent-teams/`、`core/data/`、`v2-backup/`、日志、墓碑、临时脚本、`_preview*`。
- 截图：01–04 按队长指示取自 `v2-after`，已确认画面不含用户名或本机绝对路径；05 的旧版顶栏（含绝对路径）已裁掉，替换为说明文字。
- `deepseek-flash` 是示例数据中的模型名，不是用户名或本机路径，保留。

---

## 3. README 与架构图

- README 含 5 张 PNG 与 1 张 SVG，路径全部存在：`images/01-cockpit.png`、`02-kanban.png`、`03-team-arch.png`、`04-dep-swim.png`、`05-before-after.png`、`assets/architecture.svg`。
- README 中 `待补截图` 占位：**0 条**。
- 相对链接检查：除本文件外全部存在；本文件创建后复查通过。
- 架构图：43 个 `<text>`，最小字号 12，最大圆角 6；`gradient` / `filter` / `drop-shadow` 均为 0。
- Chromium 直接打开 `assets/architecture.svg`：正常渲染，控制台 0 条报错。
- 功能章节覆盖 6.2 / 6.6 / 6.3 / 6.4 / 6.10；6.7、6.8、第 9 章明确写“暂缓”。

---

## 4. JavaScript 语法

```text
node --check  core/*.mjs core/views/*.mjs
node --check  skill/dsh-team-console/core/*.mjs skill/dsh-team-console/core/views/*.mjs
```

结果：全部通过（0 语法错误）。

---

## 5. 干净目录启动（core）

临时目录只放 `core/`，使用临时 `DSH_HOME`、不存在的账本路径、独立 `WORKBENCH_BOARD`：

```text
node core/serve-workbench.mjs <tmp-ws> --port=8795 --no-mirror-ledger
```

| 路径 | 状态码 |
|---|---:|
| `/` | 200 |
| `/kanban` | 200 |
| `/team` | 200 |
| `/deps` | 200 |
| `/legacy` | 200 |
| `/styles/v2.css` | 200 |
| `/api/health` | 200 |
| `/api/data` | 200 |

`/api/health` 返回 `{"ok":true,"server":"workbench","v":2,...}`；`/api/data` 的 `projects` 读到 2 个示例项目书。进程已关闭，8795 无残留监听。

`core/重开工作台.bat`：

- 不存在的工作区：`exit /b 1`，报 `workspace not found`。
- 正常启动（8797）：轮询 `/api/health` 成功，返回 0，健康检查 200；测试后已按端口终止进程。

---

## 6. 技能包启动

### 6.1 `start-workbench.sh`（8796）

```text
DSH_HOME=<tmp-home> sh skill/dsh-team-console/scripts/start-workbench.sh <tmp-ws> 8796
```

- 解析到 `skill/dsh-team-console/core/serve-workbench.mjs`（自带 core，无需外部 `team-view/`）。
- `/`、`/kanban`、`/team`、`/deps` 均 200；`/api/health` 为 v2。
- `board.json` 落在 `<tmp-home>/team-console/board.json`。
- 进程已关闭，8796 无残留监听。

### 6.2 `start-workbench.bat`（8798）

- 在临时 `DSH_HOME` 下启动成功，健康检查 200，`board.json` 落在 `<DSH_HOME>/team-console/board.json`。
- 进程已关闭，8798 无残留监听。
- 两个 `.bat` 均已转为 CRLF；LF-only 会导致 cmd 解析异常，已修复并复测。

---

## 7. 技能包 zip

- 文件：`dist/dsh-team-console-skill.zip`，112,004 字节。
- 条目：17 个；全部以 `dsh-team-console/` 开头（无裸文件、无 `skill/` 前缀）。
- 包含：`SKILL.md`、`README.md`、`scripts/start-workbench.bat`、`scripts/start-workbench.sh`、`core/`（含 `styles/`、`views/`、`重开工作台.bat`）。
- 不包含：`.git/`、`core/data/`、日志、账本、`.agent-teams/`。
- 仓库副本与 zip 内文件 SHA256 逐项一致：`SKILL.md`、`README.md`、两个启动脚本、`core/serve-workbench.mjs`、`core/重开工作台.bat` 全部 `MATCH`。
- zip SHA256：`5865bc5802cdb7be51b20f55a6eed22b9c707d64ab590d03c6cab6de8c99639a`。

---

## 8. git 状态

- 本次**没有**执行 `git init`、`git add`、`git commit`、`git push`。
- `git status --short` 只列出本任务应提交的改动：README、LICENSE、PUBLISH、.gitignore、assets、core、images、skill。
- `dist/` 被 `.gitignore` 忽略；`images/*.png`、`skill/`、`core/` 均未被忽略（`git check-ignore` 无输出）。
- 工作树干净度交给仓库维护者统一提交。

---

## 9. 遗留说明

- `core/` 是开发工作区实现的**脱敏副本**，不是逐字节相同：默认路径、会话根目录、演示文案做了环境变量化/相对化；业务逻辑未改。
- `skill/dsh-team-console/core/` 与 `core/` 逐文件一致（`diff -r` 无输出）。
- 发布前请由维护者再次确认：远端仓库历史中没有旧版敏感内容（本记录只检查当前工作树）。
