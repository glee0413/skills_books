---
id: microduck/npu-bringup
title: NPU 启动
description: 把量化后的鸭子检测器跑在 RK3566 的 NPU 上：模型从 Hub 取、运行时 dlopen、duck-bench 测什么，以及 media.frame 的快照约定。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/project/npu-bringup.md
snapshotPath: source-snapshots/microduck/docs/project/npu-bringup.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/project/npu-bringup.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# NPU 启动

RK3566 有一颗小的 INT8 NPU：0.8 TOPS、单核。这篇记录把训练好的鸭子检测器放上去的过程——跑什么、期待什么、以及在行为能消费它之前还缺什么。模型在 [duck_detector](https://github.com/pollen-robotics/duck_detector) 训练，以量化后的 `.rknn` 到这里；首个参考模型是 320×320 的 `yolo11n`，单类，留出 session 上 mAP50 为 0.976，INT8 后 3.9 MB，桌面上仍是 2/2 检出、95% 框重叠。

## 模型走 Hub，和策略一样

`duck_detector` 把每次运行发布到 [`pollen-robotics/microduck-duck-detector`](https://huggingface.co/pollen-robotics/microduck-duck-detector)，仓库根下固定名字：`duck_detect.rknn` 给 NPU，`duck_detect.onnx` 给 CPU 兜底，每个 run 一个 tag。`mediad` 从 `/opt/robot/detector/current` 读，填它的是 `scripts/seed-detector.sh`（release 的 postinstall 钩子调用，安装 `[workspace.metadata.detector]` 的 pin，且绝不碰不是它装的集合）、`robotctl duck-detector check` 和 `sudo robotctl duck-detector update [--version <tag>]`（装一个修订并把 `mediad` 重启到它上面）。它和策略通道是同一套机器换了根：pin 是下限、不存在半装上线、重训是一个 tag 而不是一次守护进程发版。

给机器人用的 run 该打 `vN`（`v2` 高于 `v1`，`experimental` 不算），因为 `update` 的“最新”按版本 tag 排序。

## 两个实现决定

`duck-detect` 装着 letterbox、运行时绑定和解码；`scripts/setup-npu.sh` 启用 NPU 节点、安装 `librknnrt.so` 并报告驱动。

**用 `dlopen`，不链接。** `librknnrt.so` 是不在任何 Debian 套件里的厂商 blob，链接它的 crate 无法在 CI 里交叉编译；`robotd` 也是这么够到 ONNX Runtime 的。代价是 `duck-detect/src/rknn.rs` 的代码量，收益是 `cargo board --bins` 在笔记本上照旧能用。**运行时负责反量化。** 量化模型的输出张量是 int8 带 scale 与 zero point，`rknn_outputs_get` 被要求转成 float——替代方案是把 scale 带进解码器，然后安静地错一次。

## 驱动是门槛，基准是一把尺

驱动在厂商内核里，主线没有。**一次普通的 `robotctl update` 就会做这件事**：`hooks/preinstall` 跑 release 自带的那份，和 `setup-gstreamer.sh`、`setup-rkaiq.sh` 并列，永不致命，报告进更新日志；于是早于 NPU 存在的板子靠更新被修好，而不是靠有人记得某条命令。手动跑只是重试：

```bash
sudo sh /opt/robot/daemon/current/scripts/setup-npu.sh
```

**第一次带上它的更新会要求重启。** Armbian 在每块 Radxa Zero 3 上把 `npu@fde40000` 设成 `status = "disabled"`，原厂板子有硬件、有内核、有驱动，仍然没有 NPU；脚本写入修好它的 overlay，节点下次启动绑定。跑 release 里的副本，不要跑 `/usr/local/sbin/robot-setup-npu`：overlay 源就在脚本旁边。

`duck-bench` 是测量工具，不进 release——打包会为了两个人把它放到每台机器人上——所以经 `scp` 过去：

```bash
cargo board --bins -p duck-detect
scp target/aarch64-unknown-linux-gnu/release/duck-bench microduck@<robot>:/var/tmp/
scp <the>.rknn microduck@<robot>:/var/tmp/duck.rknn
scp -r datasets/raw/<a-session> microduck@<robot>:/var/tmp/frames
```

```bash
/var/tmp/duck-bench --model /var/tmp/duck.rknn --frames /var/tmp/frames
```

它按重要性回答三个问题：**跑得起来吗**（运行时、模型平台或驱动版本不对，都在这里失败而不是在守护进程里）；**还看得见鸭子吗**（报每帧检出数，因为“能跑且什么都没检出”和“正常”长得一样）；**代价是多少**（延迟分位数和**本进程**烧掉的 CPU——用 NPU 的理由是别打扰 50 Hz 回路，那是一个该测量的断言）。`--threshold` 是第一个该动的旋钮：**量化模型的分数在自己的尺度上**，浮点模型的 0.5 不是它的 0.5，“什么都没检出”更可能是阈值而不是转换坏了，先试 `0.2`。

## 数字，以及数字的误读

板上一轮 paced 2 Hz、30 帧：驱动/运行时 0.9.8 / 2.3.2，延迟 p50 25.7 ms、p95 58.4 ms（推理加解码），每帧 CPU 20.7 ms，SoC 63 °C。

**那个 CPU 数字不是 NPU 的代价，报法却诱导人这么读。** 延迟列只乘 `infer` + `decode`；CPU 列是整圈进程 CPU 除以帧数，所以还包含 `letterbox_rgb`——一次 1280×720 → 320×320 的重采样，跑在 CPU 上且完全不在延迟里。剩下部分是否意味着 `rknn_run` 忙等还不知道。2 Hz 下它是一个核的 4%，但引用为感知的价格之前该分开测。

## 感知要贴着传感器

`mediad` 有一条正是为此存在的 raw tee 分支。**`media.frame` 已完成**：在 `mediad` 自己的 unix socket（`/run/mediad/media.sock`）上回答**一帧**，像其他观测 socket 一样组可读。它也意味着采数据集不必再停掉 `mediad` 让出相机。它先回一个 JSON-RPC 头、写明字节数，再跟那些字节：一帧原始数据约 1.8 MiB，不适合 base64 塞进控制回复；它向 tee 要**下一帧**而不是缓存帧，读者不会被交到一台已停相机停住的那一帧。

检测器最终应**进入 `mediad`**：订阅 raw 分支、以几 Hz 跑模型、把检出发布到状态流。这是感知贴着传感器的地方，产出特征而不是搬运像素，也是行为层将来消费的东西——依赖蓝牙（“有鸭子**在附近**”）的行为于是能改成依赖视觉（“有鸭子**在那里**”）。

拍快照用 `robotctl frame --output frame.uyvy`，它存一帧新的 packed UYVY 并把 JSON 元数据打到 stderr：宽、高、字节数、采集时间戳和 `rotate`——相机相对正立顺时针转过的度数，与 `media.video` 告诉 WebRTC peer 的是同一个数。转换时用这些尺寸并施加那个旋转，例如 90° 安装的 1280×720 采集用 `ffmpeg -f rawvideo -pixel_format uyvy422 -video_size 1280x720 -i frame.uyvy -frames:v 1 -vf transpose=1 frame.png`；文件只在完整响应到达后才写。

**像素是传感器交付的像素，`rotate` 只上报不施加**——管线不再转帧，因为 `videoflip` 让编码器失去零拷贝路径并让板子掉了 22 fps，每个消费者自己转。省掉 `-vf`，画面就是横的且没有任何说明，这正是 `rotate` 存在的意义；`--flip-in-pipeline` 已转过时它是 `0`。在 LAN 浏览器打开 `http://<robot>:8080/frame` 或用 `curl --fail http://<robot>:8080/frame -o frame.png` 会得到**正立** PNG 与 `Cache-Control: no-store`——这是例外，因为 PNG 没地方携带角度。相机停住或不可用时返回 HTTP 503，绝不返回上一张好图；该路由与现有控制台同 LAN 边界、无额外认证。本地端点支持同一连接上先 `hello` 再 `media.frame`，socket 可用 `mediad --frame-socket <path>` 与 `robotctl --media-socket <path> frame` 配置，抢不到会中止启动，已存在的文件或监听者保持原样；本地最多 16 连接、每个限 5 秒，HTTP 快照最多 4 个、截止 3 秒，元数据上限 4 KiB，两个客户端都拒绝非法几何与超过 16 MiB 的负载。

`media.frame` 有意**没有** `Call`/服务通道路由：JSON 头后面跟着二进制尾巴，WebRTC 控制 datachannel 和 `duckctl` 的 BLE 传输都不搬运快照。策略如何发布与安装见[策略清单](./policy-manifest.md)，媒体管线见[媒体启动](./media-bringup.md)。