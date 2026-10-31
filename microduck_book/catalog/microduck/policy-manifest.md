---
id: microduck/policy-manifest
title: 策略清单
description: manifest.json 用 kind 与 command.encoding 两个轴，说明一个 ONNX 策略如何被加载、驱动和结束，以及单策略仓库与官方集合怎样共用同一套字段。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/policy-manifest.md
snapshotPath: source-snapshots/microduck/docs/policy-manifest.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/policy-manifest.md
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# 策略清单

这是 `manifest.json` 的契约：它放在 microduck `.onnx` 旁边，说明这个策略是什么、机器人拿每个字段做什么。原文刻意只用一套词汇覆盖两种形态——**单策略仓库**（Hub 上的 `<user>/microduck-<name>`，一个 `policy.onnx`，字段写在顶层）和**官方集合**（`pollen-robotics/microduck-policies`，十个文件，同样的字段在 `policies` 下按条目各写一次）。一个读取器同时理解两者，于是向发布者提要求变成“加一个字段”，而不是“改用我们的格式”。写入方是 `microduck_rl` 里的 `uv run publish`，读取方是 `robotctl policy load <slot> <repo>` 与 `robotctl policy add <name> <repo>`。

## 两个轴：谁结束策略，喂它什么命令

`kind` 回答“谁结束这个策略”。`episodic` 跑 `duration_s` 秒后自己回到安全姿态，命令恒定时就成为技能；`perpetual` 一直跑到被告知停止——步态，或必须由人结束的姿态；配上 `unwind_s` 就变成带 `--hold` 的技能；`scripted` 是“可中断的 episodic”，守护进程能在运行途中改它的命令，坐下↔站起属于这一类。

`command.encoding` 回答“守护进程喂它什么”。缺省或 `constant` 表示窗口内固定 twist、回程用 `idle`；`phase` 表示 `[cos 2πφ, sin 2πφ, 0]`，φ 在 `period_s` 秒内从 0 走到 `end_phase`；`posture_flag` 表示某个槽位携带 `sit` 或 `stand`。只有 constant 命令的 episodic 策略能当通用一次性技能；`phase` 与 `posture_flag` 会被 `policy add` 拒绝，只能进入守护进程亲自驱动的槽位。判断依据是 encoding 而不是名字。

## 字段：缺席不算证据

除集合内的 `file` 外，所有字段都可选；缺席不构成证据——机器人只在某个声明**存在且错误**时才拒绝一个策略。真正把关的是 `model_api`（比守护进程新则拒绝）、`obs_len`（61）、`action_len`（14）和 `robot.model`（`microduck`）。技能层读 `name`、`duration_s`、`chain`、`action_scale`、`unwind_s`、`command.idle`；坐下↔站起还读 `ramp_s`，关机坐下要等它加 1 秒再缓缓进入休息姿态。`mode`、`slot`、`entry_pose`、`command.period_s`、`command.end_phase` 供集合与展示使用。`description` 明确标注为不可信文本，只出现在 `policy search` 的结果和 `policy fetch` 的进入路径上。循环 LSTM 导出要求 `model_api: 2`，既有前馈导出仍是 API 1，张量契约见[循环策略](./recurrent-policies.md)。

## 单策略仓库

```json
{
  "schema_version": 2,
  "model_api": 1,
  "obs_len": 61,
  "action_len": 14,
  "robot": { "model": "microduck", "hw_rev": 1, "servos": "xl330", "control_hz": 50 },
  "name": "polite-bow",
  "kind": "episodic",
  "duration_s": 4.0,
  "chain": false,
  "entry_pose": "standing",
  "description": "Bows from a two-foot stand and comes back up.",
  "command": { "encoding": "constant", "idle": [0, 0, 0],
               "twist": "unused (zeros)", "head": "unused (zeros)", "body": "unused (zeros)" },
  "training": { "task_id": "Mjlab-PoliteBow-Flat-MicroDuck", "repo": "pollen-robotics/microduck_rl",
                "commit": "0bf9897", "branch": "bow", "dirty": false,
                "run": "pollen-robotics/mjlab_microduck/abc123", "checkpoint": 3000,
                "exported": "2026-09-02T14:05:00Z" }
}
```

仓库里恰好一个 `.onnx`，名为 `policy.onnx`。`robotctl policy add polite-bow <user>/microduck-polite-bow` 会读 `duration_s`、`chain`、`action_scale`、`command.idle`、`unwind_s`，并在 `obs_len`、`action_len`、`model_api`、`robot.model` 或非 constant 编码上拒绝，然后写入技能。`RemiFabre/microduck-flamingo-cycle` 是已发布的 `perpetual` 例子：没有 `duration_s`，所以必须 `--hold`，而它的 `command.idle` 就是 unwind 阶段驱动的东西。

## 官方集合与预览片段

官方集合把同样的字段放进 `policies` 数组，每项加一个 `file`。集合的 `phase` 条目决定每个模式的地面抓取时序，`scripted` 条目决定坐下↔站起，因此“重训一个周期更长的抓取”只是一次打标签，而不是一次守护进程发版。`file` 必须是纯文件名，带目录或前导点的条目会被 seeder 和 `robotctl policy update` 双双跳过。清单本身**安装进集合里**，即 `/opt/robot/policies/current/manifest.json` 是 `robotd` 读技能的地方，同时也是下载列表：加一个策略等于加一条条目和一个 tag，首次播种与之后每次 `policy update` 都按正在安装的那个修订取列表。

预览视频不是字段，而是路径约定，`robotctl policy search` 会把它挂在描述旁边。查找顺序是 `media/preview.mp4`、`preview.mp4`、文件名以 `preview` 开头的 `.mp4`/`.webm`/`.mov`、任意 `.mp4`/`.webm`/`.mov`、任意 `.gif`；同一步内按路径最浅、名字最短、字典序决胜，所以每个变体各带一个片段的仓库每次搜索都得到同一答案。最后一步意味着只放了录屏的仓库就会展示录屏：发布者选择随仓库发布的片段胜过没有片段。预览从 Hub 已返回的文件列表里读，不额外发请求；描述则要为每个带清单的仓库发一次 `manifest.json` GET，几秒内没回就丢弃而不是等待。

## schema 1 到 2 的变化

schema 1 是官方集合最早的形状：`kind` 只有 `perpetual`、`episodic`、`scripted`，其中 `scripted` 表示“守护进程生成命令”，用在抓取上。schema 2 把这个含义移到 `command.encoding`，让 `scripted` 改指“可中断的 episodic”，并新增 `chain`、`ramp_s`、`mode`、`entry_pose`、`training`、`eval` 和 `command.*` 的时序字段。读 schema 1 文件的守护进程会得到原型时期的时序和同样的三个技能，没有任何东西因为版本号被拒绝。

策略如何离开守护进程产物、如何从 Hub 安装与回滚，见[策略通道](./policy-channel.md)。