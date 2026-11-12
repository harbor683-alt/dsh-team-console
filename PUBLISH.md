# 发布说明（PUBLISH）

本文件只讲**怎么把这个开源仓库发到 GitHub、怎么打包技能**。它不替代验收：发布动作必须在 V2.0 验收通过之后执行。

> 仓库由维护者统一提交；普通贡献者不要自行 `git init`、`git push` 或改远端。下面的命令由发布人执行。

---

## 0. 前置条件（硬门槛）

发布前逐条确认，任何一条不满足都**不要 push、不要发 Release**：

- [ ] **V2.0 验收通过**：1280×800 下驾驶舱前三区免滚动；8787 打开即驾驶舱；工作区切换、看板拖拽与筛选、架构双模式、依赖图与泳道联动均可用；视觉符合 6.10。
- [ ] 四张真实截图已就位：`images/01-cockpit.png`、`02-kanban.png`、`03-team-arch.png`、`04-dep-swim.png`，均为 1280×800，且每张 > 20KB；另有 `images/05-before-after.png` 前后对比。
- [ ] `README.md` 中不再有 `<!-- 待补截图 -->` 注释；四张图都换成真实相对路径图片。
- [ ] `PUBLISH-CHECK.md` 自检通过（路径存在、端点表与实际路由一致、zip 内 `SKILL.md` 哈希一致、`.gitignore` 没有误伤 `images/` 与 `skill/`、无临时文件）。
- [ ] **实现代码开源且一致**：`core/` 与 `skill/dsh-team-console/core/` 是同一份实现（逐文件 SHA256 一致）；与开发工作区实现同版本，但已做路径脱敏。
- [ ] 技能包 zip 已生成：`dist/dsh-team-console-skill.zip`，**zip 顶层目录必须是 `dsh-team-console/`**，且含 `SKILL.md`、`scripts/`、`core/`。
- [ ] 仓库里**没有**账本、`.agent-teams/`、`core/data/`、`v2-backup/`、日志、临时脚本或本机绝对路径（示例统一用 `%USERPROFILE%`、`D:\your-workspace` 等占位）。
- [ ] 全树脱敏 grep 无命中（排除 `.git/` 的远端配置）：

  ```bash
  # 在仓库根目录执行；敏感串在命令里拆开拼装，避免本文件自己命中
  bad_user=$(printf '354%s' '38')
  bad_win=$(printf 'C:%s' '\Users')
  bad_ws=$(printf 'E:%s' '\作品')
  bad_h=$(printf 'har%s' 'bor')
  grep -RIn --exclude-dir=.git --exclude-dir=dist \
    -e "$bad_user" -e "$bad_win" -e "$bad_ws" -e "$bad_h" .
  ```

- [ ] 版本号已确定（例如 `v2.0.0`）；`README.md` 与 `SKILL.md` 口径一致（Node ≥ 20、零依赖、8787、MIT）。

> 验收没通过时，本仓库只能作为内部预览，不能对外宣称「V2.0 已交付」。

---

## 1. 发布前自检

在仓库根目录执行：

```bash
# 1) 占位注释必须为空
grep -n "待补截图" README.md && { echo "STOP: placeholders remain"; exit 1; }

# 2) 截图必须存在且 > 20KB
ls -l images/01-cockpit.png images/02-kanban.png images/03-team-arch.png images/04-dep-swim.png images/05-before-after.png

# 3) 关键文件必须存在
ls -l README.md LICENSE PUBLISH.md PUBLISH-CHECK.md .gitignore assets/architecture.svg \
      core/serve-workbench.mjs skill/dsh-team-console/SKILL.md

# 4) 所有 JS 语法检查
for f in core/*.mjs core/views/*.mjs skill/dsh-team-console/core/*.mjs skill/dsh-team-console/core/views/*.mjs; do
  node --check "$f" || exit 1
done

# 5) core 与技能包 core 一致
diff -r core skill/dsh-team-console/core && echo "core copies identical"

# 6) 技能包 zip 顶层目录
python -c "import zipfile; z=zipfile.ZipFile('dist/dsh-team-console-skill.zip'); n=z.namelist(); assert all(x.startswith('dsh-team-console/') for x in n), n[:5]; print(len(n),'entries; top-level ok')"
```

再确认不会提交垃圾：

```bash
git status --short
git check-ignore -v images/01-cockpit.png skill/dsh-team-console/SKILL.md core/serve-workbench.mjs
```

第二条命令**不应该有输出**——如果 `images/`、`skill/` 或 `core/` 被忽略，先修 `.gitignore`。

---

## 2. 更新技能包副本

技能包里的 `core/` 是仓库 `core/` 的副本：

```bash
cd skill/dsh-team-console
rm -rf core
cp -R ../../core ./core
cd ../..
```

确认没有把运行时数据带进技能包：

```bash
find skill/dsh-team-console/core -type d -name data -print
```

预期没有输出；如果之前运行过技能，先删掉 `core/data/` 再复制。

---

## 3. 提交与发布（由仓库维护者执行）

仓库已经初始化，发布人只提交变更：

```bash
git add README.md LICENSE PUBLISH.md PUBLISH-CHECK.md .gitignore assets images core skill
git status --short
git commit -m "docs: 收口 V2.0 开源发布包（core / 截图 / 技能包）"
git push origin main
```

推送前确认暂存区只包含：`README.md`、`LICENSE`、`PUBLISH.md`、`PUBLISH-CHECK.md`、`.gitignore`、`assets/architecture.svg`、`images/*.png`、`core/**`、`skill/dsh-team-console/**`。**不应**包含 `dist/`、`core/data/`、`v2-backup/`、`*.log`、`_*.mjs`。

> 仓库已有远端与提交时，不要重新 `git init`；远端有他人提交时先 `git pull --rebase`，不要 `--force` 覆盖历史。

---

## 4. 打 tag 与 Release

```bash
git tag -a v2.0.0 -m "V2.0.0: 驾驶舱 / 三态看板 / 团队架构 / 依赖泳道"
git push origin v2.0.0
```

用 GitHub CLI 发 Release（未安装 `gh` 时改用网页端「Draft a new release」）：

```bash
gh release create v2.0.0 dist/dsh-team-console-skill.zip \
  --title "V2.0.0 · 四屏可视化控制台" \
  --notes "驾驶舱、三态看板、团队架构、依赖图+泳道；零 npm 依赖，Node.js ≥ 20。技能包解压后为 dsh-team-console/，自带 core/。"
```

> `dist/` 已被 `.gitignore` 忽略，Release 资源从本地路径上传，不进入 git 历史。

### 打包技能包

用 Python 的 zipfile 可以确保顶层目录与文件顺序稳定：

```bash
cd skill/dsh-team-console
python - <<'PY'
import os, zipfile
root = 'dsh-team-console'
out = os.path.join('..', '..', 'dist', 'dsh-team-console-skill.zip')
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk('.'):
        dirs[:] = sorted(d for d in dirs if d not in ('.git', 'data', '__pycache__'))
        for f in sorted(files):
            p = os.path.join(base, f)
            rel = os.path.relpath(p, '.').replace(os.sep, '/')
            z.write(p, root + '/' + rel)
print(out, os.path.getsize(out))
PY
cd ../..
```

Windows 也可以：

```bat
if not exist dist mkdir dist
powershell -NoProfile -Command "Compress-Archive -Path 'skill\dsh-team-console' -DestinationPath 'dist\dsh-team-console-skill.zip' -Force"
```

验证 zip 顶层目录：

```bash
python -c "import zipfile; n=zipfile.ZipFile('dist/dsh-team-console-skill.zip').namelist(); print(n[:6]); assert all(x.startswith('dsh-team-console/') for x in n)"
```

预期首行是 `dsh-team-console/SKILL.md`，而不是 `skill/dsh-team-console/...` 或裸文件。

---

## 5. 发布后验证

- [ ] 无痕窗口打开仓库：README 四张图、前后对比与架构图都能加载，没有 404。
- [ ] 下载 Release 里的 zip，解压后目录为 `dsh-team-console/SKILL.md`、`dsh-team-console/scripts/start-workbench.*`、`dsh-team-console/core/serve-workbench.mjs`。
- [ ] 按 `skill/dsh-team-console/README.md` 安装到 `%USERPROFILE%\.dsh\skills\dsh-team-console`，重启 DSH，能命中技能并启动 8787。
- [ ] 记录 zip 的 SHA256 到 `PUBLISH-CHECK.md`：

  ```bash
  python -c "import hashlib; print(hashlib.sha256(open('dist/dsh-team-console-skill.zip','rb').read()).hexdigest())"
  ```

- [ ] 把 Release 链接、截图版本、验收结论补进 `PUBLISH-CHECK.md`。

---

## 6. 出问题怎么办

**push 被拒（non-fast-forward）**
远端有本地没有的提交。先 `git pull --rebase origin main`，解决冲突后再 push；不要 `--force` 覆盖别人的历史。

**截图在 GitHub 上不显示**
检查路径大小写与扩展名（必须正好是 `images/01-cockpit.png` 等）；确认 PNG 已 `git add`，不是只存在于本地。

**Release 资源下不下来 / 顶层目录不对**
重新执行第 4 节的打包命令；用 Python 检查 `namelist()`，确保每一行都以 `dsh-team-console/` 开头。

**clone 后启动失败**
在干净目录执行 `node --check core/serve-workbench.mjs`；确认 Node ≥ 20；用 `WORKBENCH_BOARD=./tmp-board.json node core/serve-workbench.mjs "$PWD" --port=8790 --no-mirror-ledger` 排查数据路径问题。

**误发了未验收版本**
立即把 Release 标为 pre-release 或删除 Release，仓库首页加醒目提示；修正后重新打 tag（不要复用已发布的 tag 名）。需要撤回提交时用 `git revert`，不要改写已推送的历史。

**发现用户数据或本机路径混进仓库**
停止发布，`git rm --cached <path>` 后补充 `.gitignore`，确认历史中无敏感内容；若已推送，按 GitHub 文档清理历史并轮换可能泄露的凭据。

---

## 7. 本仓库的边界

- **包含**实现代码：`core/` 可直接运行；`skill/dsh-team-console/core/` 是同一份副本。
- **不包含**任务账本、`.agent-teams/`、`core/data/`、截图之外的运行数据与日志。
- 开发工作区的 `v2-backup/`、`回滚V2.0.bat` 是一次性迁移工具，不随开源仓库分发；本仓库的升级/回滚方式见 README「升级与回滚」。
