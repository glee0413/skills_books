---
id: microduck/boot-recovery
title: 启动恢复网
description: 当新 release 的 daemon 起不来时，boot check 如何切回 golden 并避免重启循环。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/boot-recovery-net.md
snapshotPath: source-snapshots/microduck/docs/design/boot-recovery-net.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/boot-recovery-net.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 启动恢复网

`updaterd` 在更新中不会重启自己；它靠自测、延迟重启和启动对账来降低风险。但这些都假设 `updaterd` 能启动。如果新 release 的 daemon 在开机时根本起不来，启动对账也跑不到，所以需要一层在 `updaterd` 之外、也不从 `current` 读取的恢复网。

## 组成

- `robot-boot-check.timer`：每次开机 1 秒后触发。
- `robot-boot-check.service`：oneshot，观察 release 是否起来；没起来就交给 rescue。
- `/usr/local/sbin/robot-boot-check`：判定脚本。
- `/usr/local/sbin/robot-rescue`：把 `current` 切到 `golden`，记录 breadcrumb，重启。
- `golden` symlink：`updaterd` 发布的、有“始终可用”保证的 release。
- `rescued` breadcrumb：上次尝试和循环保护。

两个脚本都是 `/bin/sh`，由 `install.sh` 和 `hooks/postinstall` **复制**到 `/usr/local/sbin`，不从 `current` 读。原因很直接：rescue 要修复的正是 `current` 里的 release；如果它自己是 release 里的二进制，wrong arch、缺库、启动 panic 都会让它一起坏掉。

## 触发条件

不用 `OnFailure=`，因为这些 unit 是 `Restart=always` / `on-failure`，会无限重启而永远不进入 `failed`。boot check 反过来看：每 2 秒检查成员 unit，满足任一条件就结束：

- 有成员没起来（`failed` 或 restart 次数持续增长）→ 立刻交棒；
- 所有成员连续 10 秒 `active` → release 起来了；
- 到达 `boot_deadline_s`（默认 60 秒）→ 按现有证据判定；从未稳定过的成员不强行算失败。

截止时间不是“等 60 秒”，而是“60 秒后对未稳定的启动做判断”；`updaterd` 每 10 秒重启，约 45 秒会露馅，所以截止时间不能低于它。

## 循环保护

rescue 会写 `rescued` breadcrumb，记录上次尝试。如果切回 golden 后仍然起不来，不能无限重启、反复 rescue；breadcrumb 让下一次 rescue 知道“已经试过了”，停下来留下可诊断的板子。这个循环保护是“永不砖机”承诺的最后一道边界。

## 与 updater 的分工

`updater-design.md` 拥有 store、health gate 和 boot counter；`restart-order.md` 拥有更新时的重启顺序；这页只拥有“开机时 daemon 起不来”的判定、成员规则、rescue 和循环保护。三者的边界要分清，否则文档会互相矛盾。