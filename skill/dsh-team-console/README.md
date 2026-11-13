# dsh-team-console 技能包

把「流氏工作台」安装成一个 DSH 技能。技能包自带可运行的 `core/`，装完即可用，不需要另外维护工作区里的 `team-view/`。

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

## 快速开始

```bat
scripts\start-workbench.bat <工作区路径> 8787
```

```bash
sh scripts/start-workbench.sh <工作区路径> 8787
```

打开 <http://127.0.0.1:8787/>：团队关系图画布打底，左上角四枚方块（驾驶舱 / 项目书 / 拷问台 / 团队架构），底部依赖泳道可折叠。

## 数据

- 团队与项目书：只读 `<workspace>/.agent-teams/` 与 `<workspace>/项目书/`；
- 任务状态：写 `%USERPROFILE%\.dsh\team-console\board.json`（或 `$DSH_HOME/team-console/board.json`）；
- 升级 / 卸载技能都不会删这份数据。

## 完整文档

安装、路由、排障与设计说明见 `SKILL.md`；仓库级说明见根目录 `README.md`。
