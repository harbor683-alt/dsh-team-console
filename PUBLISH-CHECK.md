# 发布自检记录（PUBLISH-CHECK）

- 检查日期：2026-11-13
- 检查对象：`team-view/github/` 发布树
- 版本：核心服务 `v = 8`（画布平移缩放 / 成员对话 / 中文团队名 / 流光状态条）
- 结论：**通过**

---

## 1. 文件清单

| 路径 | 说明 |
|---|---|
| `README.md` | 中文主文档：6 张截图 + 画布交互 + 路由 + 数据 + 目录结构 |
| `LICENSE` | MIT |
| `PUBLISH.md` | 发布步骤 |
| `.gitignore` / `.gitattributes` | 忽略运行数据与 dist；`.bat` 强制 CRLF、`.sh` 强制 LF |
| `core/` | 可直接运行：`serve-workbench.mjs`、`team-data.mjs`、`team-labels.json`、`store.mjs`、`workspaces.mjs`、`views/*.mjs`、`styles/v2.css`、`重开工作台.bat` |
| `skill/dsh-team-console/` | 可安装技能包，`core/` 与仓库 `core/` 逐文件一致 |
| `scripts/build-skill-zip.ps1` | 打包脚本（`dsh-team-console/` 前缀 + 正斜杠） |
| `dist/dsh-team-console-skill.zip` | 99,989 B，不入库 |

## 2. 语法

```text
node --check core/serve-workbench.mjs
node --check core/views/*.mjs
```

全部通过。

## 3. 干净启动（8797）

```text
WORKBENCH_BOARD=<临时文件> node core/serve-workbench.mjs <workspace> --port=8797 --no-mirror-ledger
```

| 路径 | 状态码 |
|---|---|
| `/api/health` | 200（`v:8`） |
| `/` `/cockpit` `/projects` `/grill` `/team` `/deps` `/kanban` `/spaces` | 200 |
| `/sheet` `/classic` | 404（旧版已移除） |

测完已关闭进程、删除临时 board。

## 4. 浏览器验收（8787）

- 画布：拖拽平移、滚轮缩放（40%–240%）与复位正常；空白处拖动不误触卡片；
- 团队 chip：下拉列出中文团队名（圣诞树 2026 / 论文讲解 / 冒烟测试 / V2 控制台），切换后图与选择记忆正常；
- 成员卡：红点=空闲、绿点=忙碌，忙碌卡底部蓝色光带流动；点卡不再弹详情浮层；
- 成员对话：右侧面板 3/4 历史 + 1/4 输入，消息写入 `<team>/inbox/<member>.jsonl`；Esc 关闭；
- 工作区下拉：切到 echo 后底部泳道 iframe 同步为 `ws=echo`；
- console：无报错。

## 5. 脱敏

- 工作树内无本机绝对路径、无用户名、无任务账本、无 `.agent-teams/`、无 `data/`、无日志。
- 截图不含用户名与本机路径（工作区标题为示例 `deepseek` / `echo`）。

## 6. 技能包 zip

- 文件：`dist/dsh-team-console-skill.zip`，99,989 B；
- 条目全部以 `dsh-team-console/` 开头，含 `SKILL.md`、`README.md`、`scripts/`、`core/`；
- 不含 `.git/`、`core/data/`、日志、账本。

## 7. git

- 提交并推送到 `https://github.com/harbor683-alt/dsh-team-console`（main）。
- `dist/` 被忽略；`core/`、`images/`、`skill/` 正常入库。
