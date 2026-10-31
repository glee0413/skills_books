# 变更记录

## 2026-10-31

### 新增

- 初始化 Microduck 学习书工程，固定 `pollen-robotics/microduck` 的 commit。
- 建立 48 个来源条目的快照和来源清单，覆盖设计文档、使用文档、项目记录和关键代码模块。
- 规划 16 章，覆盖架构、IPC、控制回路、运动学、感知、交互、更新、远程访问、构建测试、仿真和故障史。

### 完善

- 加深 12 个设计类条目：`app-path`、`remote-webrtc`、`ipc`、`control`、`cargo-workspace`、`deploy` 等按实测结论重写，补齐 BLE 单特征与两层授权、广播间隔、NetworkManager 迁移、WebRTC 信令与桥接、`rename(2)` 信任链、日志与版本恢复等细节。
- 修正 `microduck/duckctl` 的 ID 冲突：文档页保留 `microduck/duckctl`，源码页改为 `microduck/duckctl-code`。
- 构建脚本与预览提示改为 Microduck 来源，去掉从 Cedar 书复制的残留文案。
- 验证：`npm run build`（66 页，48/48 条目）；`npm run check`（0 issue）；`book/` 与 `catalog/` 相对链接 0 处悬空。