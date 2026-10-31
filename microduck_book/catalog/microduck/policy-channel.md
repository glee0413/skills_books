---
id: microduck/policy-channel
title: 策略通道
description: 本页讲 ONNX 策略如何脱离守护进程发布独立迭代，官方、社区、本地三种来源如何共存，以及加载、重载与重置为什么都是配置编辑。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/policy-channel-design.md
snapshotPath: source-snapshots/microduck/docs/design/policy-channel-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/policy-channel-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 策略通道

九个 `.onnx` 原本装在 daemon 产物里，`robotd` 从 `/opt/robot/daemon/current/policies/` 加载。于是重训一个步态要发一次 daemon 发布，修一个 daemon bug 要重下 6 MB 没变的权重，笔记本上训好的策略只能经 CI 或整包 sideload 才能到达鸭子。

两个需求不同：自家策略独立版本化（普通组件），以及别人能试、判断、退回不是自己训的策略（本页重点）。

## 三种来源，一个槽位

槽位（`walk`、`stand`、`sitstand`、`ground_pick`、`kick_left`、`kick_right`、`roulade`）由三种来源之一填充：**official** 来自 `policies` 组件，有 manifest 与 semver、已签名、按 `auto_apply` 自动更新、是 `reset` 的目标；**community** 来自任意其他 HF 仓库，记录 repo/revision/commit，不签名、不自动应用、只报告；**local** 是板上的路径，无来源信息。

来源由 HF 组织决定：**`pollen-robotics/*` 是官方，其他都是社区**。一个常量、一处判断，**不做成配置键**：能被指定信任哪个组织的机器人，其"官方"徽章没有意义。来源也决定行为：社区与本地永不自动应用、永不是 reset 目标，且无论显示在哪里都带着来源。

**社区策略故意不要求签名**：策略不是二进制，`robotd` 的 joint clamp、跌倒松力、意图死区和 `obs[1,61] → actions[1,14]` 形状门才是边界。**沙箱才是边界，不是签名**；daemon 二进制没有这样的沙箱，所以组件路径的规则不动。

## 加载与重置就是改配置

`policy.walk` 在 `robotd.toml` 里本来就是 `Option<PathBuf>`，未设置意味着"解析为本模式的默认值"；`robotctl configure` 也已能通过 `toml_edit` 精确设置或删除它触碰的键，且不破坏注释。于是 `policy load <slot> <x>` 写 `policy.<slot>` 再热重载，`policy reset <slot>` 删除该键再热重载，`policy reset` 删除全部七个。

**写键的是 `robotd`，不是调用者。** `robot.loadPolicy` 在排队交换之前先把槽位记进 `robotd.toml`，所以持久性是**方法**的属性，而不是碰巧调用它的那条命令的属性。一开始反过来：`robotctl` 写文件、守护进程只改内存，等于给了手机一个被否决的"临时模式"。写入器放在 `robotd_params::edit`，写者持文件锁。临时的"试到重启为止"模式被否决过：它给"机器人在跑什么"制造第二个真相源，也让 `reset` 几乎失去意义。

## 热重载与失败

加载策略复用 `robot.setMode` 的路径：IPC 校验并置意图，回路在工作线程上加载并预热，再判断变化是否触及**正在驱动**的网络；触及就回 home（torque 开着）换入，不触及就原地换入并带上座位、技能与滤波状态。

**只有正在驱动的网络变了才动机器人**：设计后的第一份现场报告是加载 walk、走路、坐下、`policy reset walk`，机器人却回到 home 站了起来——reset 对配置是对的，对机器人是错的，因为 `sitstand` 正持有它而 reset 没碰 `sitstand`。回路改用上一 tick 实际驱动的网络的解析路径比较。

**已经为真的请求不做任何事**：重置没人覆盖过的槽位，或加载正在跑的文件，都回答"已接受但没排队"，否则 `policy reset` 会让未改动的机器人回家、重载七个网络、再回到原样。唯一例外是带错误的槽位——启动时加载失败的覆盖已被内存丢弃，读起来像"没覆盖"，重置它正是清除错误与配置行的方式。

**失败不能让你失去原有步态**：切模式失败留下 `policy_error` 与不健康是对的，试验失败则不是；所以加载失败时**保留正在跑的控制器**并返回原因。

## 坏覆盖不能卡住 daemon 更新

社区或本地策略试用时能加载，却可能在**下次启动**失败——文件被删、库被清、板子重刷后配置还在。`robotd` 于是每次启动都报 unhealthy，`updaterd` 会因为这个没有发布该负责的原因回滚 daemon 发布，形成更新循环。

规则：**社区或本地**覆盖加载失败 → 回落到该槽位的**官方**默认，报 **degraded** 并点名文件；**官方**策略失败 → 仍是 **unhealthy**。这正是 `HealthResult::degraded` 的意义：缺失的覆盖是板子的属性，回退 daemon 修不好；官方策略坏了是坏包，回滚正确。这**不会悄悄修配置**：覆盖仍写着，`robotctl health` 说明哪个文件加载不了，`policy reset <slot>` 才是修复。

## 种子与钉住

`robotd` 从 `/opt/robot/policies/current` 读，不再从发布内部读。`scripts/seed-policies.sh` 在每次 postinstall 与新装时运行，从 Hub 取钉住的集合到 `/opt/robot/policies/releases/seed-<pin>/`，再把 `current` 指过去。ONNX Runtime 与 GStreamer 插件同样由 board setup 安装：策略是板子需要的第三样东西，发布没有理由永远背着它。

**钉住是下限，不是上限**：它随 daemon 发布走，升它就要一次 daemon 发布。它决定新板装什么，以及这个 daemon 能接受的最旧官方集合。板上的集合低于钉住值时，postinstall 会把它抬上去，否则只存在于新集合的默认文件（v5 的 `velstand.onnx`）会让只更新了 daemon 的板子加载不了步态、被回滚。超过钉住值、来自别的 repo、或没有 `.source` 记录的集合不动。越过钉住值是 `robotctl policy update`，也正是重训步态无需 daemon 发布就能到达机器人的原因。

不重复下载已有集合，不装半份下载，抓取失败也不拿旧集合替换可用集合。**已安装的集合永不替换，无论钉住值说什么**：只有"装了东西"与"什么都没装"两个状态，只有后者会抓取——否则一次无关的 daemon 更新会静默回退某人用 `policy update` 选的步态。

**策略不再随 daemon 回滚**：回滚不跑钩子，所以因为策略坏而被回滚的发布会留下那个策略继续运行；退路是向前 `apply daemon --version <older>`，它会跑钩子并重新 seed。**首次安装连不上 Hub 的板子没有步态**：`robotd` 保持姿态并报 degraded，门禁通过，下次更新再抓；seeder 绝不能失败，因为 postinstall 非零退出会回滚无关的发布。

技能也从代码变成配置：`[[policy.skill]]` 用 `name`、`path`、`duration` 声明 one-shot，`kind` 决定谁结束它——episodic 自己回到安全姿态，perpetual 需要 `unwind` 与 `unwind_s` 收尾。**运行中的技能整个时长关闭跌倒反射**。
