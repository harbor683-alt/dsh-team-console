# dsh-team-console 技能包

把 V2.0 团队控制台安装成一个 DSH 技能。技能包自带可运行的 `core/`，装完即可用，不需要另外维护工作区里的 `team-view/`。

## 包含什么

```text
dsh-team-console/
├─ SKILL.md              技能说明（frontmatter: name / description）
├─ README.md             本文件
├─ core/                 控制台实现（serve-workbench.mjs + views + styles）
└─ scripts/
   ├─ start-workbench.bat    Windows 启动器
   └─ start-workbench.sh     macOS / Linux 启动器
```

## 安装

### 从仓库目录

```powershell
$src = ".\skill\dsh-team-console"
$dst = "$env:USERPROFILE\.dsh\skills\dsh-team-console"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\*" $dst -Recurse -Force
```

```bash
mkdir -p "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console"
cp -R skill/dsh-team-console/. "${DSH_HOME:-$HOME/.dsh}/skills/dsh-team-console/"
```

### 从 Release zip

下载 `dsh-team-console-skill.zip`，解压后应得到顶层目录 `dsh-team-console/`；把它整体放到 `%USERPROFILE%\.dsh\skills\`（macOS / Linux 为 `$DSH_HOME/skills/`）。重启 DSH 生效。

## 启动

```bat
"%USERPROFILE%\.dsh\skills\dsh-team-console\scripts\start-workbench.bat" "D:\your-workspace" 8787
```

```bash
sh "$HOME/.dsh/skills/dsh-team-console/scripts/start-workbench.sh" "/path/to/workspace" 8787
```

- 第一个参数是工作区，省略时用当前目录。
- 第二个参数是端口，默认 `8787`，只接受 `1–65535`。
- 脚本会检查 Node ≥ 20、启动服务、轮询 `/api/health`，健康后打开 `http://127.0.0.1:<port>/`。

## 数据

- 任务存储默认 `%USERPROFILE%\.dsh\team-console\board.json`，可用 `WORKBENCH_BOARD` 覆盖。
- 首次启动从本机账本与 `<workspace>/.agent-teams` 导入一次；之后以 `board.json` 为准。
- 升级或卸载技能都不会删除 `board.json`。

## 卸载

1. 结束监听对应端口的 `node` 进程。
2. 删除 `%USERPROFILE%\.dsh\skills\dsh-team-console`（macOS / Linux：`$DSH_HOME/skills/dsh-team-console`）。
3. 需要彻底清理时，再删除 `%USERPROFILE%\.dsh\team-console\board.json`。

## 注意

- 单机、单进程、仅监听 `127.0.0.1`，不要暴露到公网。
- 不修改工作区里的 `.agent-teams/` 与账本；页面写入走 `POST /api/action`。
- 技能包与仓库 `core/` 保持同一份实现；发布时由 `PUBLISH.md` 的同步步骤生成副本。
