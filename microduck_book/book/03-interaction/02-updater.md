# 更新系统：签名、原子切换、健康门禁与回滚

机器人更新最怕的不是“装不上”，而是“装了一半”和“装上了起不来”。`updaterd` 把两者分开：写入总是完整目录，生效总是一次 symlink 重命名，失败总有一条回到已知良好版本的路。下面按一次更新的真实顺序，走完签名、切换、门禁与恢复。

## 为什么更新器要比被更新者活得久

`updaterd` 是一个独立 systemd 单元，而不是 `robotd` 里的一个模块：进程无法干净地替换自己正在运行的可执行文件，更新器也必须在被更新的守护进程崩溃后仍然活着，才能执行回滚。同理，`btd` 和 `updaterd` 被排除在“立即重启”的集合之外——`btd` 可能正是这次更新的传输通道，`updaterd` 正在执行更新。

但“排除”不等于“永远不重启”。两者在回复发出约 5 秒后通过 `systemd-run --on-active=5s` 重启；这是一个独立 transient unit，不是 `updaterd` 的子进程，否则重启父进程时会把子进程一起杀掉。更重要的结构不变量是：**`btd` 和 `updaterd` 必须在 `robotd` 死掉时仍能启动、运行和提供完整服务**。它们不做 `Requires=robotd`，所有对 `robotd` 的询问都是可选且有超时的；一个死掉的 socket 是正常答案，不是挂起。这条不变量在 [updater-design 精读](../../catalog/microduck/updater-design.md) 的 §4.1 里有完整论证。

## 信任从哪里开始

发布物是 GitHub Releases 上的一个压缩包，旁边放 manifest 和两个 minisign 签名。量产机器人带三把 release 公钥；开发板再加一把 dev key。签名命中集合中任意一把即有效，于是一把钥匙丢失或被撤换时，还能用另一把发布“加入新钥匙、退役旧钥匙”的更新；只有一把则丢了就只能手刷所有机器人。

验证顺序是固定的：

```text
manifest 签名 → 下载 artifact → sha256 → artifact 签名 → 解包
```

在任何一步失败之前，不会有字节被解包到活动路径。`schema_version` 故意**不作为兼容性门禁**：判断 manifest 的引擎永远是上一个版本，如果它拒绝“比自己新”的 schema，携带新引擎的更新就永远发不出去。`min_supported` 则是强制升级下限，必须从第一版就留在 schema 里，因为无法追溯地教老机器人认识一个不存在的字段。签名细节与密钥保管见 [updater-design 精读](../../catalog/microduck/updater-design.md)。

## 磁盘布局与一次原子切换

```text
/opt/robot/daemon/
├── releases/1.4.1/       上一版，保留用于回滚
├── releases/1.4.2/       新版
├── current -> releases/1.4.2
└── golden  -> releases/1.4.1   永不删除，救援只读它
```

所有 unit 的 `ExecStart` 都指向 `current/bin/...`，所以切换就是移动一个符号链接。实现用 `rename(2)`，要求临时链接与 `current` 在同一文件系统；`ln -sfn` 会先删后建，中间有一个守护进程无法 exec 的窗口。`rename` 不跟随符号链接，而 `mv` 的路径解析会，所以手写救援脚本时必须用 `mv -T`（GNU）或 `-h`（BSD），否则链接会被移动进 release 目录，`current` 原地不动。

目录、`keep_previous` 与 `golden` 的代码入口见 [updater 精读](../../catalog/microduck/updater.md)。

## 一次 apply 的顺序

把关键步骤压成一条线：

```text
preflight → 取 manifest → 验签 → 下载 → sha256 → 验包
→ 解包到 staging → orphan 检查 → preinstall hook
→ rename 成 releases/<ver> → 布防 boot counter → 切换 current
→ postinstall hook → 重启单元 → updaterd --self-test
→ 健康门禁 → 确认 trial、清理旧版本 → 回复 → 5 秒后重启 updaterd/btd
```

几个位置是刻意安排的。`preinstall` 在切换前、以 staging 树为工作目录运行，安装 ONNX Runtime、GStreamer 插件和 NPU 运行时；等切换后再装，失败时新版本已经生效。boot counter 在**切换之前**布防，于是“已切换、未确认”时断电也能被下次启动发现。`postinstall` 在切换后先装 sysusers 账户，再装 unit 并 `daemon-reload`，最后 `enable --now` 带 `[Install]` 的单元——账户先于 unit，否则 `User=` 指向不存在的账户，服务启动失败，看起来像守护进程坏了。

`updaterd --self-test` 在重启之后、门禁之前运行新二进制：加载配置、构造引擎、在碰任何状态前退出。它抓的是“新 `updaterd` 拒绝板上的 `updater.toml`”——配置属于操作者、跨安装保留，而新版本可能改了自己认识的字段。失败会带着最后一行 stderr 回滚，而不是等下次开机才发现更新器起不来。

## 健康门禁与两次启动之间的恢复

切换并重启后，`updaterd` 每 500 ms 询问一次 `robotd`，直到组件的 `health.timeout`（出厂 30 秒）。答案分三类：`healthy` 提交；`degraded` 也提交；`unhealthy`、`unreachable` 或“回答的形状读不懂”则回滚。

为什么 degraded 也提交？因为它描述的是“回滚修不了的硬件问题”：没有舵机供电的 `robotd` 在 golden 上同样起不来；回滚它会掩盖真正原因，还会在有人扶着机器人时把代码换掉。反过来，门禁必须**轮询**而不是只问一次：`robotd` 的 socket 打开后、第一个控制 tick 完成前，会回答“控制回路还没有完成一个周期”；开机时没有东西保证 `robotd` 先启动，只问一次经常正好落在这个窗口里，把“只是慢”误判成“版本坏了”。

失败后的回滚不是简单地把链接切回去：还要对上一版重新执行 `on_apply`、确认 boot counter、写 journal。失败发生在切换之前则不同——旧版本还在运行，staging 可以整个丢掉。

门禁只能覆盖“更新器还活着、门禁跑完了”的情况。如果 apply 在布防之后、确认之前被断电或取消，磁盘上会留下一个已布防的 trial。`updaterd` 每次启动先跑 `recover_on_start`：清理 staging、记录 rescue 面包屑、发布 `golden` 链接，并给每个 trial 的 `boots` 加一；`boots >= 2` 时再问一次 `robotd`，只有不健康且不 degraded 才回滚。第一次启动只记“仍在试用”，第二次才动手。

还有一层在 `updaterd` 之外：如果新版本连 `updaterd` 都起不来，上面的逻辑一行也不会执行。`robot-boot-check.timer` 在开机一秒后启动一个 oneshot，每 2 秒检查 `robotd`、`updaterd`、`btd`、`configd` 是否连续 10 秒 active；任一单元 `failed` 或 `NRestarts >= 3`，就交给 `robot-rescue`：把 `current` 指向 `golden`，留下面包屑，然后重启。

救援脚本刻意不解析 `updater.toml`——最需要它处理的，往往正是“新 `updaterd` 拒绝了这份配置”，解析同一个文件等于死于同一种病。它只 `readlink` 两个链接，`golden` 因此是 `updaterd` 发布的缓存，而不是第二份真相。面包屑用 `key=value` 而不是 JSON，因为在已经出问题的板上用 `sh` 正确引用 JSON 很难。下一次 `updaterd` 启动会把它抄进更新日志、清掉 trial、删除面包屑；顺序不能反，否则 trial 会在几次启动后把 `current` 从 golden 上移走。见 [boot-recovery 精读](../../catalog/microduck/boot-recovery.md)。

## 重启顺序：哪些单元现在重启，哪些五秒后

一次更新涉及八个守护进程：`robotd`、`configd`、`btd`、`padd`、`netpadd`、`mediad`、`tofd`、`updaterd`。重启集合从**发布包自己的 `systemd/*.service`** 推导，再减去代码里的 `NEVER_RESTART = {updaterd, btd}`。`padd`/`netpadd` 由 `ExecCondition=` 二选一，`mediad` 依赖摄像头，`tofd` 可能没有传感器；它们都该跟着 release 走，而不是等操作者记得改配置。

每个单元单独调用一次 `systemctl restart`，从不批量：`systemctl restart a b` 在任一单元不存在时整体失败，且不会重启存在的那个——这正是安装路径第一个 bug 的形状。`LoadState=not-found` 的单元跳过并警告；存在但重启失败则更新失败并回滚。新守护进程会在 `postinstall` 里被 `enable --now` 启动一次，又在 `on_apply` 里重启一次，这正常。

“已经安排重启”不等于“确实重启了”。每个守护进程启动时写 `/run/<service>/identity.json`，含版本、revision 和 `/proc/self/exe` 解析出的 release 目录；`updaterd` 每次启动与 `current` 比较，方向无关——落后或超前都算 stale，然后重启。唯一不自动修的是 `updaterd` 自己：自我重启的循环没有出口，所以它只报告，由下一次启动或一次 `apply` 修复。诊断表在 [restart-order 精读](../../catalog/microduck/restart-order.md)。

## 安装路径的四个 bug，以及它们教了什么

四个 bug 一天内接连上板，418 个测试和 `board-test.sh` 都没抓住：

1. `on_apply` 用一条命令重启多个单元，任一未知就整体失败；
2. 打包用显式 `--include` 列表，新 unit 没进包；
3. Package 步骤逐个 `cp`，新二进制没进包；
4. 重启列表存在板上的 `/etc/robot/updater.toml` 里，而 `install.sh` 故意保留它，新守护进程永远不被重启。

第四个最贵，因为它的失败长得像成功：切换发生了、门禁过了、更新报告 success，新进程却仍在跑旧代码；接着 `apply` 回答 `already_current` 并什么都不做，操作者以为修复无效。真正的修法不是再加一个诊断，而是改变归属：**重启集合从 release 推导，unit 由 `postinstall` 安装，凡是“全新安装会对板子做的事”都必须同样出现在 hook 里**，因为 hook 是每块板、每次更新都会执行的唯一路径。`apply --force` 最终没有加：`already_current` 现在会检查运行中的版本并修复 stale，而一个绕过门禁的强制开关反而会在机器人正常时关掉保护。

这段历史的价值在于错误形状，原文与测试补强见 [install-path-gap 精读](../../catalog/microduck/install-path-gap.md)。这也是最实用的结论：更新系统的正确性不在“下载和校验”，而在切换之后，谁负责让新代码真的跑起来。