# 感知与媒体：camera、ToF、检测器

`robotd` 的 50 Hz 回路只关心十五个关节、IMU 和一条电机总线。摄像头、麦克风、深度和神经网络都以各自的方式留在那条回路之外：视频归 `mediad`，深度归 `tofd`，音频分类则是 `robotd` 里的旁路线程。这一章沿着一条帧的路径，看这套分工怎样在 RK3566 上真正跑起来。

## 感知为什么不在控制进程里

把 `mediad` 从 `robotd` 拆出去，理由不是代码整洁，而是故障域：媒体管线崩溃、GStreamer 插件版本不对、摄像头排线松了，都不能让电机控制停摆。`tofd` 是同一条规则用在更小的传感器上——ToF 启动时要通过 I²C 上传约 90 KB 固件，耗时以秒计，而这条总线还和音频 codec 共用；大多数鸭子根本没装这个传感器，把重试循环放进控制进程毫无好处。架构上的结论写在 [architecture 精读](../../catalog/microduck/architecture.md) 里：`robotd` 对安全拥有最终权威，控制回路从不阻塞等待另一个服务，跨进程读取一律是 last-value-wins 缓存。

## 一条视频帧经过什么

`mediad` 的管线可以压成一张图：

```text
camera ── raw ── tee ─┬─ queue ─ webrtcsink ── mpph264enc ── peer
                      │            └─ control datachannel
                      └─ queue(leaky) ─ appsink ── 按需取一帧
```

关键在 tee 的位置：它在编码之前，直接接相机原始帧。这样“按需一帧”和“跑检测器”都不必先解码刚编码好的 H.264。每条分支有自己的 `queue`，原始分支是 leaky 的——慢消费者丢旧帧，而不是把编码分支一起拖住。原始分支也不会为每一帧复制内存：只有有人发 `media.frame` 时，`appsink` 才把**下一帧**交出去，因此拿到的不是停掉的相机留下的最后一帧。

编码走 Rockchip 的 MPP（`/dev/mpp_service`），不是 V4L2 M2M；`mpph264enc` 与 `webrtcsink` 都不在 Debian 里，得从 `microduck-gst-plugins` 的固定版本安装。`mediad.service` 少写一行 `Environment=GST_PLUGIN_PATH=/usr/local/lib/gstreamer-1.0`，编码器就“不存在”；少写 `SupplementaryGroups=video`，`mpph264enc` 连注册都不会发生。这些坑和实测数据都在 [media-bringup 精读](../../catalog/microduck/media-bringup.md) 里。

## 不旋转，也不假装自动曝光

相机装歪了四分之一圈。看起来最直接的修法——在 tee 前加 `videoflip`——实测把 30 fps 打到 8 fps：翻转后的缓冲让 RGA 拒绝，MPP 退回软件转换，SoC 冲到 97 °C 后降频。现在管线一帧都不转，只通过 `media.video` 把 `rotate` 度数告诉对端，浏览器用 CSS 转，检测器把它折进本来就有的重采样。

曝光同理。板上的 `rkaiq_3A` 只在流启动时收敛一次，之后就不再跟踪；更糟的是，`mediad` 重启流会让它错过 stream-start 事件，永远等下去，画面发绿。现在的做法是让 `mediad::exposure` 自己闭环：每秒两次从 tee 的原始分支读平均亮度，目标 90，按“快门→模拟增益→快门→数字增益”的顺序做阻尼乘法调整。它和 3A 引擎不能同时写，所以 `setup-rkaiq.sh` 关掉引擎的 AE；引擎每次启动时再用 drop-in 里的 `try-restart mediad` 把流弹一次，保证它等的事件还没发生。

## ToF：8×8 的距离与三种含义

头部传感器是 VL53L5CX 或 VL53L8CX，8×8 共 64 个区，约 15 Hz 出一帧。两代硬件在板上可互换，所以 `tofd` 先读 ID 再决定加载哪套驱动，而不是编译期二选一。ST 的 Ultra Lite Driver 以 C 源码 vendor 进来：40 KB 寄存器序列，加上一份每次启动都要上传的固件，重写或依赖第三方 crate 都不划算。

一帧不是“64 个距离”，而是距离加状态。`tof` crate 把状态压成三种：

```rust
pub enum Zone {
    Range(f32),     // 状态 5 或 9，且距离为正
    NoTarget,       // 状态 255：测了，量程内没有东西
    Unusable(u8),   // 其他状态：这次测量失败
}
```

把后两种混成空白，地图就丢掉了“这里是空的”和“我不知道”的区别。帧本身是传感器坐标，不做重投影——那需要头部正向运动学，`tofd` 没有，也不伪造；要几何的消费者以后把 `tof.frame` 和关节状态合起来即可。

省电的尝试最后落在 IMU 上，而不是深度：实测测距线程只占单核 0.5%，头部 IMU 却占 4.5%，而且没有任何订阅者。于是 `[head_imu] enabled` 默认关闭，深度照常输出。这段测量过程见 [tof-on-demand 精读](../../catalog/microduck/tof-on-demand.md)。

## 检测器：NPU、ONNX 与一条不占控制回路的线程

鸭子检测器从 Hugging Face 的固定 tag 安装到 `/opt/robot/detector/current`，`mediad` 按扩展名选后端：`.rknn` 走 RK3566 的 0.8 TOPS NPU，`.onnx` 走 CPU。两者都是 `duck-detect` 里的绑定，NPU 通过 `dlopen` 加载 `librknnrt.so`，因此笔记本上仍能 `cargo build`；量化模型的输出去量化在运行时完成，解码器只拿浮点。

检测器是一个**线程，不是 tokio task**：单帧推理加解码约 60 ms，占住 WebRTC 信令的 worker 会让会话建立莫名卡顿。它按 2 Hz  pacing，这个数字是热约束——满速跑会让板子到 95 °C 并降频，“为了看得清楚而走得更差”。取帧用请求式接口，超时没帧就记一次 `starved`；结果通过 `media.detections` 通知发给控制通道，每十秒打一行心跳，让“没检测到”“线程死了”“tee 没帧”在日志里能分开。

音频那边是 `pet-detect`：16 kHz 单声道、40 带 log-mel、1 秒窗、约 20 KB 的 CNN，输出带迟滞的 `Start`/`End`。它没有放进 `mediad`，而是在 `robotd` 里以 `arecord` 子进程工作——麦克风是单客户端设备，所有分析共享同一条流。控制回路只做非阻塞的 `try_recv_event()`，听到抚摸就播一声 `coo`，模型再慢也拖不住 20 ms 的 tick。相关实测见 [npu-bringup 精读](../../catalog/microduck/npu-bringup.md)。

## 感知怎样留在回路之外

三条规则贯穿始终。第一，**传特征，不传帧**：一帧 720p 原始数据约 1.8 MiB，而“鸭子在 (x,y)”只有几十字节；把像素塞给 `robotd` 只会浪费内存带宽。第二，**订阅而非调用**：消费者读本地缓存的最新值，`mediad` 卡住只会让感知变旧，不会给电机控制加抖动。第三，**发布者不等待**：检测结果进 `broadcast` 通道，没有订阅者就丢掉；控制通道的 peer 太慢时只保留最新一条，滞后计数增加而生产线不停。

到目前为止，检测结果主要供控制台画框，步态策略并不读它。这不是遗漏，而是顺序：先让感知在传感器旁边稳定地产生特征，等行为层真正需要“那边有只鸭子”时，再以一条状态流接进 `robotd`。媒体与检测的实现细节见 [mediad 精读](../../catalog/microduck/mediad.md)，深度驱动与帧格式见 [tof 精读](../../catalog/microduck/tof.md)。