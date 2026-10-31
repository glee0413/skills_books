# 手柄、BLE、duckctl 与声音

Microduck 没有“遥控器协议”这种东西。手柄、手机、笔记本和浏览器各自走一条传输，最后都收敛成同一种 JSON-RPC 调用，送进 `robotd` 的 unix socket。`robotd` 不关心请求来自 evdev、UDP 还是蓝牙，只负责判断这个意图能不能执行。这一章看这些入口怎样把人的动作变成意图，以及声音为什么也算一种交互。

## 四条入口，一个目的地

```text
蓝牙手柄 ── evdev ── padd ────┐
UDP 手柄 ────────── netpadd ──┼── NDJSON/JSON-RPC ──→ robotd
duckctl ── BLE ── btd ────────┤
浏览器 ── WebRTC ── mediad ───┘
```

`padd` 和 `netpadd` 是普通客户端，直接连 `/run/robotd.sock`，没有任何特权。`btd` 是 BLE 到本地 socket 的转发器，只放行它路由表允许的方法；`mediad` 则把 WebRTC 的 control datachannel 接到同一套会话代码上。四条路都使用 [IPC 契约](../../catalog/microduck/ipc.md) 里的 `Call` 类型，所以新增一个技能不需要为每种传输各写一遍。

## padd：把模拟量变成有语义的意图

`padd` 用 `gilrs` 读手柄，把按键、摇杆和扳机映射成意图。映射的原则是“每个部位只做一件事”：ABXY 和肩键跑技能，十字键**选择**摇杆的含义，Start 和 Select 是长按——切断力矩或关机不能因为拇指擦过就发生。

几个实现细节决定了手感。按键取**边沿**而不是状态，否则按住十字键会在一秒内切换五十次；Start/Select 同时读按住时长和释放事件，所以“按一下”和“按 1.5 秒”是两件事。连续意图（走路、转头）会去重：与上一帧相同且不要求运动时不重发，只按心跳保活；离散意图（技能、声音）则请求并读回复，因为“被拒绝，原因是……”是真实结果。

没有手柄时它**什么都不发**，而不是发一条零速度。零速度会掩盖“手柄断了”，而 `robotd` 的 deadman 本来就会让机器人停下。正在驱动的手柄消失则不同：一秒后机器人问“你去哪了”（一声 `inquire`），如果还站着就坐下；手柄回来时问候一声，按 A 站起。

## netpadd：28 字节的 UDP 手柄

`netpadd` 让同一局域网里的程序用手柄状态驱动机器人，适合笔记本插着手柄、机器人不在手边的场景。每个数据报就是完整状态：

```text
DKPD | ver=1 | flags | seq:u32 | t_ms:u32 | lx ly rx ry lt rt:i16 | buttons:u16
 4B     1B      1B       4B         4B            12B                2B      = 28B
```

规则围绕“最新状态才有意义”：序号必须比上一条新，落后或超前 1000 以上都丢掉；比同一条流见过的最快交付晚超过 `stale_ms`（默认 300 ms）也丢掉，所以 Wi-Fi 攒了一批再突然放出，不会让机器人倒退走。`stale_ms` 没收到新状态就立刻停止行走，但保留会话；`timeout_ms`（默认 1000 ms）才认为客户端消失，放下手柄并坐下。第一个发送者锁住机器人，其他人要等它安静超过 `timeout_ms` 才能接管。

这是一件**没有认证的局域网工具**：能到达 4210 端口的人就能驱动，包括长按 Select 关机。它适合可信网络和低延迟演示，不适合作为通用远程控制；后者是 WebRTC 的职责。完整报文和调参见 [udp-pad 精读](../../catalog/microduck/udp-pad.md)。

## btd：只做传输，而且只开一扇小门

`btd` 的 GATT 服务只有一个 characteristic：写入是请求，订阅是回答，里面跑的还是 NDJSON 的 JSON-RPC。它不拥有任何状态——名字、Wi-Fi、配对都在 `configd`，更新在 `updaterd`；否则每个服务都要依赖蓝牙，连“改个名字”都得经过 radio。

真正的设计在路由表：`route.rs` 对 `Call` 的每个变体做穷尽匹配，新增方法如果不写进来就编译不过。BLE 只放行配置、状态、更新，以及少量一次性动作，比如 `robot.enable`、`robot.do`、`robot.sound`。**遥控类方法一律拒绝**：`robot.move`、`robot.head` 这类每秒几十次的流不适合 20 字节通知预算，也不适合一块开机后前 73 秒根本不存在的网卡；它们属于 WebRTC。恢复出厂（`resetToGolden`）同样不走 radio。详见 [btd 精读](../../catalog/microduck/btd.md)。

## duckctl：放在笔记本上的客户端

`duckctl` 永远不装在机器人上。它是手机 App 的替代品，用来在没有网络、没有 ssh 的情况下找到并配置一只鸭子：扫描 BLE 广播，读出租户名和 IPv4 地址，然后通过 `btd` 发 `info`、Wi-Fi、更新等命令。发布物跟着每个 `daemon-v*` release 走，可以用 `uvx`、Homebrew 或预编译包拿到。

它还有两个超出“配置工具”的用法。`duckctl udp-pad` 把笔记本上的手柄桥接成 `netpadd` 的数据报，并可选地在笔记本本地播放扳机音效；笔记本没有鸭子的 SoC 序列号，所以第一次运行会随机选一个声线并记住。另一个是 `duckctl update apply`，它通过 BLE 触发 `updaterd`，进度以通知流回来——更新本身由机器人自己下载，BLE 断了也不影响。命令全集见 [duckctl 精读](../../catalog/microduck/duckctl.md)。

## NFC：碰一下就能配对

插着 CLRC663 读卡器（`/dev/ttyACM0`）的机器人，可以用一张写着地址的 NFC 标签完成手柄配对。把标签靠近，`nfcd` 读出文本或 URI 记录里的 `98:B6:E9:28:06:09`，交给 `configd` 走与 `robotctl pad pair` 相同的绑定流程；读到时叫一声，配对成功再问候一声，失败没有第二声。

规则刻意保守：已经有手柄在驱动时，碰标签什么也不做，避免别人的标签把正在用的手柄顶掉；一次触碰只尝试一次，失败要拿开再碰。`nfcd` 常驻，读卡器插上后三十秒内会被接管。配对与排错见 [pair-gamepad 精读](../../catalog/microduck/pair-gamepad.md)。

## 声音：身份、合唱与特雷门琴

鸭子的声音不是播放录音，而是从 SoC 序列号派生出的合成器。`sha256(serial)` 的前 8 个十六进制字符作为种子，决定音高、谐波倾斜、鼻音、颤音和节奏；同一个种子永远得到同一只鸭子，不同种子听起来像不同生物。多数标签有 10 个变体，`chirp` 和 `greet` 12 个，`wheee` 6 个（每个再分 start/loop/end 三段），所以不会像卡住的录音。七个标签是 `alarm`、`greet`、`inquire`、`peck`、`chirp`、`coo`、`wheee`，全部以 48 kHz 原生渲染，随 release 携带，板上不需要 Python、numpy 或 ffmpeg。

合唱则把声音变成多机行为。两只鸭子各自唱四个声部之一；没有指挥选举，id 较小的那只指挥，其他鸭子看同一组 BLE 广播。板上没有共享时钟，于是指挥每拍改一次广播里的计数器，计数变化就是下拍；跟随者用约 25 拍平均相位，把 radio 抖动压进合奏需要的 ±20 ms。声部按音高分配，最低的唱低音，指挥广播名册，大家重放同一套座位。合唱默认关闭，未开启的鸭子连广播都不发——不参与，也不可见。实现与片段见 [sounds 精读](../../catalog/microduck/sounds.md)。

特雷门琴把头部的 ToF 变成乐器：手越靠近，音越高，嘴随音符张开。它只取可演奏范围内最近的回报，空旷处静音，40 cm 的墙会奏出稳定音；每个 ToF 状态码是否算“有效”可配置，`hold_ms` 用来跨过闪烁的丢帧。它和合唱一样默认关闭，因为“另一只鸭子走进来就开始动”不是任何人要求的动作。日常命令都在 [cheatsheet 精读](../../catalog/microduck/cheatsheet.md) 里。