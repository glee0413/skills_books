# 术语表

| 英文 | 中文 | 说明 |
|---|---|---|
| daemon | 守护进程 | systemd 管理的常驻服务 |
| robotd | robotd | 控制守护进程，拥有电机总线和 50 Hz 回路 |
| updaterd | updaterd | 更新守护进程，负责验证、切换、健康门禁与回滚 |
| configd | configd | Wi-Fi、身份、配对、重启 |
| btd | btd | BLE GATT 传输 |
| padd / netpadd | padd / netpadd | 手柄输入传输 |
| mediad | mediad | 摄像头、音频、WebRTC |
| tofd | tofd | 头部 ToF 深度传感器 |
| IPC | 进程间通信 | 这里指 Unix socket 上的 JSON-RPC 2.0 / NDJSON |
| JSON-RPC | JSON-RPC | 请求/响应/通知协议 |
| NDJSON | 按行 JSON | 一行一个 JSON 对象 |
| intent | 意图 | 客户端发给 robotd 的高层动作请求 |
| observation | 观测 | 策略输入，来自关节、IMU、命令等 |
| policy | 策略 | 这里指 ONNX 神经网络步态策略 |
| kinematics | 运动学 | 关节角与末端位姿之间的映射 |
| odometry | 里程计 | 根据足端接触和 IMU 估计位姿 |
| safety | 安全层 | 唯一能写电机目标的层 |
| health gate | 健康门禁 | 更新后询问 robotd 是否健康 |
| rollback | 回滚 | 把 current 切回上一版 |
| release | 发布 | 一个完整的 daemon 目录 |
| golden | 黄金版本 | 出厂/恢复用的已知良好版本 |
| WebRTC | WebRTC | 实时音视频与数据通道 |
| BLE | 低功耗蓝牙 | 手机配置与更新触发的入口 |
| NPU | 神经网络处理器 | RK3566 上的推理单元 |
| ONNX | ONNX | 策略模型格式 |
| MuJoCo | MuJoCo | 仿真物理引擎 |
| sim2real | 仿真到现实 | 在仿真训练、在真机部署 |
| API version | API 版本 | `duck-ipc-proto` 的协议版本 |