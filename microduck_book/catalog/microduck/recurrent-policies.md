---
id: microduck/recurrent-policies
title: 循环策略
description: LSTM 策略的模型契约、内存生命周期、model_api 2 兼容门、离线排练与测试方式。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/recurrent-policies.md
snapshotPath: source-snapshots/microduck/docs/recurrent-policies.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/recurrent-policies.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 循环策略

运行时同时接受前馈策略和 mjlab/rsl_rl 导出的显式状态 LSTM。两者都吃现有的 61 维观测，在 50 Hz 下产出同样的 14 个原始关节动作。观测归一化必须烤进导出的模型。训练用的 critic 不部署，这不增加传感器，也不改动作滤波。

## 模型契约

所有张量都是 float32，输入输出按名字匹配，与顺序无关。

| 模型 | 输入 | 输出 |
|---|---|---|
| 前馈 | `obs [1, 61]` | 一个 `[1, 14]` 输出（原有输出名仍接受） |
| LSTM | `obs [1, 61]`、`h_in [layers, 1, hidden]`、`c_in [layers, 1, hidden]` | `actions [1, 14]`、`h_out`、`c_out`，形状同上 |

batch 维可以是符号的；推理始终只有一台机器人。层数与隐藏宽度必须是正静态维，且在四个状态张量间一致。每个状态上限 1,048,576 个元素。名字、秩、类型、宽度不支持或有多余张量，加载即失败；warm-up 也会拒绝非法或非有限输出。GRU 与其他循环导出签名未实现。

## 清单：model_api 2

循环策略发布时应写 **`model_api: 2`**，让更旧的 daemon 在安装前就拒绝。本 daemon 也接受现有的 API 1 前馈模型。清单 schema、观测宽度与动作宽度都没变。发布与清单字段见[策略清单](policy-manifest.md)。

## 内存生命周期

每个加载的策略拥有预分配的 hidden 与 cell 张量，每次成功推理都把新状态拷进缓冲。推理失败清空内存；非有限输出在两个状态提交前就被拒。warm-up 的状态丢弃。

内存在这些时刻从零开始：初次激活、切换网络（包括切回）、显式禁用、暂停或跌倒恢复后的控制器 reset、链式技能重启。短暂的传感器掉线沿用现有的恢复宽限期。网络活跃期间改命令保留内存。

替换一个**非活跃**槽位，只有在它的 ONNX 文件 SHA-256 相同时才保留活跃网络的内存。活跃模型变了就从零开始，即使路径没变。要这个保证就用自包含的 ONNX 导出：外部引用的权重文件不在 ONNX 文件摘要里。显式控制器 reset 总是清空所有槽位。

原有的动作缩放与可选运行时滤波保持配置不变。训练时没有动作滤波的策略，要在部署调参里关掉那些滤波器；加了循环并不会让不匹配的滤波配置变正确。

## 离线排练与板端计时

例子走生产用的 Rust 推理路径，从不打开电机总线：

```sh
export ORT_DYLIB_PATH=/path/to/libonnxruntime.so
cargo run --release -p duck-control --example policy-rehearsal -- policy.onnx > rehearsal.json
```

它先 warm-up actor、清状态，再用标称重力、零命令和上一动作反馈测 1000 次推理。JSON 给出 p50/p95/p99/max 延迟、超过 20 ms 的次数与动作。**要在 Radxa 上跑编译好的例子**才能确立板上预算；开发机的数字不算。这些计时不含传感器读取、电机写入与调度延迟。

要与 PyTorch 或 Python ONNX Runtime 做确定性多步对比，第二个参数传 JSON 数组：

```json
[{"obs": ["replace with exactly 61 numbers"], "reset": true}]
```

每条记录给完整观测（含上一动作），在回合边界设 `reset`，然后拿返回的动作序列与相同观测、相同 reset 的参考比较。这检查推理与内存处理，不检查物理 sim2real 迁移。训练好的 checkpoint 用训练仓库的归一化导出器导出。

## 测试与夹具

```sh
cargo test -p duck-control
# 需要 ONNX Runtime >= 1.23
cargo test -p duck-control --test recurrent_policy -- --ignored
cargo test -p robotd recurrent_memory_resets_with_controller_feedback -- --ignored
```

入库的小夹具用真正的 ONNX LSTM 算子，覆盖内存连续性、reset、策略切换、回退选择、warm-up、热替换、动态 batch、非法契约与非有限状态。用 `python duck-control/tests/fixtures/generate.py` 在装好 `onnx` 与 `numpy` 的环境里重新生成。