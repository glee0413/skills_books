---
id: microduck/robotd-control
title: robotd control.rs
description: 逐 tick 拆解 robotd 的控制器：命令重编码、网络选择、动作缩放、低通滤波与一次性技能的状态机。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: robotd/src/control.rs
snapshotPath: source-snapshots/microduck/robotd/src/control.rs
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/robotd/src/control.rs
license: Apache-2.0
kind: reference
translatedAt: 2026-10-31
---

# robotd control.rs：把传感器与命令变成关节目标

`robotd/src/control.rs` 是 50 Hz 回路里唯一做高层决策的模块。模块文档第一句就把边界钉死了：这里是 `duck_control::io::RobotIo::read` 与安全层 `apply` 之间的纯计算，**不持有任何 IO 句柄**，所以它在构造上就不可能命令电机，只能提出目标。它取代了原型 `microduck_runtime` 的 `control_step`，同时保留了原型的优先级链和所有数值默认值。

## 一个 tick 的六个阶段

模块头写下的顺序就是 `Controller::step` 的顺序：先让技能窗口前进或过期（roulade 窗口、kick 计时、ground pick 相位、sit↔stand 的起立），再把调用方的平滑命令按当前技能重新编码，然后按 `roulade > kick > ground pick > sit/rise > stand-by-magnitude > walk` 选出网络，跑 ONNX 得到 action，最后用 `home pose + action_scale × action` 合成目标、可选地过一阶低通。窗口的推进放在本 tick 使用之后，和原型“电机写完之后再推进相位”一致。

## 调参：数值就是行为

`Tuning` 把原型的默认值写成结构体：`action_scale` 0.9、`standing_action_scale` 1.0、`standing_gain_ratio` 0.8、`gain` 200、`head_lowpass: Some(0.5)`、`legs_lowpass: Some(0.7)`。后两个必须与训练一致，否则迁移会退化，测试 `the_defaults_match_the_prototype` 就是在钉这件事。头部低通只覆盖 `HEAD_JOINTS = 5..9`（neck_pitch、head_pitch、head_yaw、head_roll），腿部低通跳过头部和 `duck_control::model::MOUTH_INDEX`。

`SkillTuning` 收集脚本化技能的数字：`ground_pick_period` 4.0 秒、`ground_pick_end_phase` 0.7（走到 1.0 会把伸手动作在退出时重放一遍）、`sitstand_rise_s`、`sitstand_ramp_s`，以及一份 `Vec<robotd_params::SkillDef>`。技能定义来自配置，`SkillDef` 里的 `name`、`duration`、`chain`、`command`、`unwind`、`params` 决定它跑多久、按住是否续接、运行期间躯干速度是多少。

## 三个状态机

`Sit` 只有 `Up`、`Sitting`、`Rising { remaining }` 三态，姿态标志走 twist 的 vx 槽：1 表示坐、0 表示站。`ActiveSkill { index, phase, remaining, chain }` 描述一个正在跑的一次性技能，`SkillPhase::Holding` 驱动 `command`，`SkillPhase::Unwinding` 驱动 `unwind`，后者专为不会自己收尾的策略准备。`CHAIN_WINDOW = 0.15` 秒是“按钮还按着”的判据：客户端每 tick 重发请求，七个 tick 的容差足以吃掉丢包，又短到不会把新按下误认成按住。

`move_blocked()` 统一了拒绝规则：一次只做一个动作，且坐姿下一个都不许做。`start_skill` 因此返回 `Result<bool, &'static str>`，`Ok(true)` 表示真的启动了，`Ok(false)` 表示只是刷新了正在进行的那条链——客户端按住按钮时每秒会打进来五十次，不该被当成第二次动作。作者在这里明确写了与原型的分歧：原型允许 pick 抢占 kick 的尾巴，也允许技能从坐姿滚出去，那都是从一个没训练过的姿态起手。

## 对外的生命周期 API

`carry_over` 用于换策略但不换驱动网络的情形：座位、半途的技能、ground-pick 相位、观测回灌的 `last_action`、低通锚点全部搬过去，于是换网络这件事对下一个 tick 不可见。`reset` 清反馈状态（重启策略、清 recurrent 记忆），`stop_moves` 只终止在途动作并保留座位，`forget` 连座位一起忘掉——对应扭矩消失之后的重新上电。`seed_from_pose` 让反馈从机器人实际保持的姿态起步，而不是从零开始拖。`Step { targets, label, gain, busy }` 是每 tick 的产出，`label` 用 `Cow` 是因为固定网络借字符串、配置技能必须持有名字。

`Driving` 枚举把 `Net` 的技能索引换成技能名，因为索引只在一份技能表里有意义，而策略切换可能正要装另一份。

## 与系统其余部分的接缝

控制器由 `robotd/src/main.rs` 的 `control_loop` 每 tick 调用，见 [robotd main.rs](robotd-main.md)。策略、观测、动作散布都在 `duck_control` 里：`Observation::build` 组装输入，`Observation::scatter_action` 把 `ACTION_LEN` 的输出摊回关节，`Policy::infer` 选网络。`busy` 会被回路拿去门控跌倒反射和“能否重启”，所以一个配置成持续十秒的技能，等于十秒没有跌倒反射——源码把这个后果写在字段注释里，而不是让它被默默继承。