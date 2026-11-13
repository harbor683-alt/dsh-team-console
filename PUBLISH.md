# 发布步骤

仓库：<https://github.com/harbor683-alt/dsh-team-console>

## 0. 前置

- Node.js ≥ 20（`node --check` 与本地启动都只依赖它）；
- PowerShell 5+（仅打包 zip 用）；
- 发布树就是当前仓库根目录，**不要**把工作区运行数据带进来。

## 1. 同步 core

运行实现位于工作区 `team-view/`，发布树 `core/` 是脱敏副本。每次发布前同步：

```bash
cp team-view/serve-workbench.mjs team-view/team-data.mjs team-view/store.mjs team-view/workspaces.mjs \
   team-view/team-labels.json team-view/github/core/
cp team-view/views/*.mjs team-view/github/core/views/
cp team-view/styles/v2.css team-view/github/core/styles/
cp team-view/重开工作台.bat team-view/github/core/
rm -rf team-view/github/skill/dsh-team-console/core
cp -R team-view/github/core team-view/github/skill/dsh-team-console/core
```

`core/` 与 `skill/dsh-team-console/core/` 必须逐文件一致。

## 2. 自检

```bash
node --check core/serve-workbench.mjs
node --check core/views/*.mjs

# 干净目录启动（临时工作区 + 临时 DSH_HOME + 独立 board）
node core/serve-workbench.mjs <tmp-ws> --port=8796 --no-mirror-ledger
```

`/`、`/cockpit`、`/projects`、`/grill`、`/team`、`/deps`、`/kanban`、`/spaces`、`/api/health` 应为 200；`/sheet`、`/classic` 应为 404。结果记入 `PUBLISH-CHECK.md`。

## 3. 截图

`images/` 用 1280×800 实机截图：

| 文件 | 内容 |
|---|---|
| `01-canvas.jpg` | 画布首页（团队 chip + 关系图 + 底部抽屉） |
| `02-projects.jpg` | 项目书浮层 |
| `03-grill.jpg` | 拷问台 |
| `04-team.jpg` | 团队架构 |
| `05-deps.jpg` | 依赖泳道抽屉 |
| `06-cockpit.jpg` | 驾驶舱 |

## 4. 打包技能 zip

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-skill-zip.ps1
```

产物 `dist/dsh-team-console-skill.zip`（`dist/` 不入库）；条目必须以 `dsh-team-console/` 开头、用 `/` 分隔。

## 5. 提交与发布

```bash
git add -A
git commit -m "feat(ui): 画布首页 + 团队切换 chip + 中文团队名；移除旧版单页"
git push origin main
```

打 tag 并附 zip：

```bash
git tag v3.0.0
git push origin v3.0.0
gh release create v3.0.0 dist/dsh-team-console-skill.zip --title "流氏工作台 v3.0" --notes-file README.md
```

## 6. 脱敏检查

```bash
grep -rIn --exclude-dir=.git -e "35438" -e "C:\\Users" -e "ghp_" -e "sk-proj" .
```

必须 0 命中。
