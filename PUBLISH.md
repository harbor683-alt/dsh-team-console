# 发布说明（PUBLISH）

本文件只讲**怎么把这个展示包发到 GitHub**。它不替代验收：发布动作必须在 t7 验收通过之后执行。

---

## 0. 前置条件（硬门槛）

发布前逐条确认，任何一条不满足都**不要 push、不要发 Release**：

- [ ] **t7 验收通过**：按《V2.0改造交接》第 5 节核对完 —— 1280×800 下驾驶舱前三区免滚动；8787 打开即驾驶舱；工作区切换、看板拖拽与筛选、架构双模式、依赖图与泳道联动均可用；视觉符合 6.10。
- [ ] 四张真实截图已就位：`images/01-cockpit.png`、`02-kanban.png`、`03-team-arch.png`、`04-dep-swim.png`，均为 1280×800，且每张 > 20KB。
- [ ] `README.md` 中不再有 `<!-- 待补截图 -->` 注释；四个图位都已换成真实相对路径图片。
- [ ] `PUBLISH-CHECK.md` 自检通过（相对路径存在、端点表与实际路由一致、zip 内 `SKILL.md` 哈希一致、`.gitignore` 没有误伤 `images/` 与 `skill/`、无临时文件）。
- [ ] 技能包 zip 已生成：`dist/dsh-team-console-skill.zip`，**zip 顶层目录必须是 `dsh-team-console/`**。
- [ ] 仓库里**没有**实现文件、账本、`.agent-teams/`、`v2-backup/`、日志或本机绝对路径泄露（示例统一用 `%USERPROFILE%`、`D:\your-workspace` 等占位，并说明可用环境变量覆盖）。
- [ ] 版本号已确定，例如 `v2.0.0`；`README.md` 与 `SKILL.md` 的口径一致（Node ≥ 20、零依赖、8787、MIT）。

> t7 没通过时，本仓库只能作为内部预览，不能对外宣称「V2.0 已交付」。

---

## 1. 发布前自检

在 `team-view\github\` 下执行：

```bat
cd /d D:\your-repo\team-view\github

:: 1) 占位注释必须为空
findstr /n "待补截图" README.md

:: 2) 四张截图必须存在且非空
dir images\01-cockpit.png images\02-kanban.png images\03-team-arch.png images\04-dep-swim.png

:: 3) 关键文件必须存在
dir README.md LICENSE PUBLISH.md .gitignore assets\architecture.svg skill\dsh-team-console\SKILL.md

:: 4) 技能包必须存在
dir dist\dsh-team-console-skill.zip
```

```bash
# macOS / Linux 等价检查
cd team-view/github
grep -n "待补截图" README.md && echo "STOP: placeholders remain" && exit 1
ls -l images/01-cockpit.png images/02-kanban.png images/03-team-arch.png images/04-dep-swim.png
ls -l README.md LICENSE PUBLISH.md .gitignore assets/architecture.svg skill/dsh-team-console/SKILL.md
ls -l dist/dsh-team-console-skill.zip
```

再确认不会提交垃圾：

```bat
git status --short
git check-ignore -v images\01-cockpit.png skill\dsh-team-console\SKILL.md
```

第二条命令**不应该有输出**——如果 `images/` 或 `skill/` 被忽略，先修 `.gitignore`。

---

## 2. 初始化仓库并首次提交

```bat
cd /d D:\your-repo\team-view\github
git init
git add .
git commit -m "docs: DSH 团队控制台 V2.0 展示包（四屏截图 / 架构图 / 技能包）"
git branch -M main
```

提交前建议再看一眼暂存区：

```bat
git status
git diff --cached --stat
```

预期只包含：`README.md`、`LICENSE`、`PUBLISH.md`、`PUBLISH-CHECK.md`、`.gitignore`、`assets/architecture.svg`、`images/*.png`、`images/.gitkeep`、`skill/dsh-team-console/**`。**不应**包含 `dist/`、`v2-backup/`、`*.log`、`_*.mjs`。

---

## 3. 建远端并 push

先在 GitHub 建一个空仓库（不要勾选自动生成 README / LICENSE / .gitignore），建议名 `dsh-team-console`，可见性按需选择。

```bat
git remote add origin https://github.com/<owner>/dsh-team-console.git
git push -u origin main
```

如果远端已有提交（例如先建了 README），不要强推覆盖；先 `git pull --rebase origin main` 合并，再 push。

检查：

```bat
git remote -v
git log --oneline -1
```

打开仓库网页，确认 README 开头能看到：一句话定位、四张截图、架构图。GitHub 对 SVG 支持良好；若架构图不显示，检查 `assets/architecture.svg` 是否被正确提交、文件名大小写是否一致。

---

## 4. 打 tag 与 Release

```bat
cd /d D:\your-repo\team-view\github

git tag -a v2.0.0 -m "V2.0.0: 驾驶舱 / 三态看板 / 团队架构 / 依赖泳道"
git push origin v2.0.0
```

用 GitHub CLI 发 Release（未安装 `gh` 时改用网页端「Draft a new release」）：

```bat
gh release create v2.0.0 dist\dsh-team-console-skill.zip ^
  --title "V2.0.0 · 四屏可视化控制台" ^
  --notes "驾驶舱、三态看板、团队架构、依赖图+泳道；零 npm 依赖，Node.js ≥ 20。技能包解压后为 dsh-team-console/。"
```

```bash
# macOS / Linux
gh release create v2.0.0 dist/dsh-team-console-skill.zip \
  --title "V2.0.0 · 四屏可视化控制台" \
  --notes "驾驶舱、三态看板、团队架构、依赖图+泳道；零 npm 依赖，Node.js ≥ 20。技能包解压后为 dsh-team-console/。"
```

> `dist/` 已被 `.gitignore` 忽略，Release 资源从本地路径上传，不进入 git 历史。

### 打包技能包（如果还没有）

```bat
cd /d D:\your-repo\team-view\github
if not exist dist mkdir dist
powershell -NoProfile -Command "Compress-Archive -Path 'skill\dsh-team-console' -DestinationPath 'dist\dsh-team-console-skill.zip' -Force"
```

```bash
cd team-view/github
mkdir -p dist
powershell -NoProfile -Command "Compress-Archive -Path 'skill/dsh-team-console' -DestinationPath 'dist/dsh-team-console-skill.zip' -Force"
# 或：cd skill && zip -r ../dist/dsh-team-console-skill.zip dsh-team-console
```

验证 zip 顶层目录：

```bat
tar -tf dist\dsh-team-console-skill.zip | findstr /B "dsh-team-console/"
```

预期首行是 `dsh-team-console/`，而不是 `skill/dsh-team-console/` 或裸文件。

---

## 5. 发布后验证

- [ ] 无痕窗口打开仓库：README 四张图与架构图都能加载，没有 404。
- [ ] 下载 Release 里的 zip，解压后目录为 `dsh-team-console/SKILL.md`、`dsh-team-console/scripts/start-workbench.*`。
- [ ] 按 `skill/dsh-team-console/README.md` 安装到 `%USERPROFILE%\.dsh\skills\dsh-team-console`，重启 DSH，能命中技能并启动 8787。
- [ ] 记录 zip 的 SHA256 到 `PUBLISH-CHECK.md`：

  ```bat
  powershell -NoProfile -Command "Get-FileHash 'dist\dsh-team-console-skill.zip' -Algorithm SHA256"
  ```

- [ ] 把 Release 链接、截图版本、t7 验收结论补进 `PUBLISH-CHECK.md`。

---

## 6. 出问题怎么办

**push 被拒（non-fast-forward）**
远端有本地没有的提交。先 `git pull --rebase origin main`，解决冲突后再 push；不要 `--force` 覆盖别人的历史。

**截图在 GitHub 上不显示**
检查路径大小写与扩展名（必须正好是 `images/01-cockpit.png` 等）；确认 PNG 已 `git add`，不是只存在于本地。

**Release 资源下不下来 / 顶层目录不对**
重新执行第 4 节的打包命令；`Compress-Archive -Path 'skill\dsh-team-console'` 会保留顶层目录。用 `tar -tf` 复核后再上传。

**误发了未验收版本**
立即把 Release 标为 pre-release 或删除 Release，仓库首页加醒目提示；修正后重新打 tag（不要复用已发布的 tag 名）。需要撤回提交时用 `git revert`，不要改写已推送的历史。

**发现实现文件或账本混进仓库**
停止发布，`git rm --cached <path>` 后补充 `.gitignore`，确认历史中无敏感内容；若已推送，按 GitHub 文档清理历史并轮换可能泄露的凭据。

---

## 7. 本仓库不做什么

- 不包含 `serve-workbench.mjs`、`views/*.mjs`、`styles/v2.css` 的实现副本；这些随工作区分发。
- 不包含任务账本与团队运行数据。
- 不负责回滚实现：回滚脚本在工作区的 `team-view\回滚V2.0.bat`，见 README「回滚」一节。
