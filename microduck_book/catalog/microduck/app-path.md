---
id: microduck/app-path
title: 手机 BLE 配置路径
description: 本页讲手机如何经 btd 的单一 GATT 特征到达 configd，包括路由与两层授权、BLE 会话与广播的实测教训，以及用 NetworkManager 配置 Wi-Fi 的坑。
project: microduck
sourceCommit: b2b0d213a402caeac492dd662ea891faa17f67c0
sourceRef: daemon-dev-main
sourcePath: docs/design/app-path-design.md
snapshotPath: source-snapshots/microduck/docs/design/app-path-design.md
sourceUrl: https://github.com/pollen-robotics/microduck/blob/b2b0d213a402caeac492dd662ea891faa17f67c0/docs/design/app-path-design.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 手机 BLE 配置路径

手机配置机器人：Wi-Fi、名字、重启、版本、触发更新。`btd` 与 `configd` 同时落地，因为**它们是同一个功能**：`btd` 不拥有任何东西，所以需要 `configd`；`configd` 提供 PIN，`btd` 才能配对；`btd` 路由一个方法，`configd` 就必须回答它。原文标注的"实测"结论来自 Radxa Zero 3W，不是推理。

## 一个特征，一张路由表

GATT 上只有一个服务、**一个特征**：读一次拿 API 版本，写 NDJSON 请求字节，订阅它收答案。没有长度头——换行就是帧界，`serde_json` 会把字符串里的换行转义；重组缓冲上限 8 KiB，因为无线电范围内任何人都能碰到它。

**读到的版本用来说明，不用来拒绝**：跨链路没有东西检查它，因偏斜拒绝的客户端拒绝的正是"没有网络时唯一的出路"。

`btd/src/route.rs` 的一张表决定调用**是否**允许、**哪个 socket** 回答、**哪条连接**承载。对 `Call` 的匹配是穷尽的：新增方法会让 `btd` 编译失败；`_ => None` 会静默拒绝新方法，是长期错误。`update.pin` 被拒，因为误触 pin 住的机器人会拒绝此后所有更新还自称最新；`system.pairingPin` 是承重的一条——未配对端能读或改的 passkey 会让配对成为表演。`update.rollback`/`select` 现在允许：只有拿着手机、没有 ssh 的人能回退一个"过了门禁、但行为更糟"的发布。

## 两层授权，名字而非 uid

第一层是 socket 模式 `0660` 加组 `robot`，决定谁能**连上并说话**；第二层是 `allow_users` / `--allow-user`，决定谁能发**变更**调用。只读调用跳过第二层，支持人员能检查无权修改的机器人。两层必须分开：`btd` 在 `robot` 组才够得着 socket，而在组里不等于"可以换固件"；所以都授给**具名服务**。

**按名字，绝不按 uid**：`systemd-sysusers` 动态分配。`SO_PEERCRED` 只报**主** gid，这是陷阱：`SupplementaryGroups=` 能让进程穿过 socket 模式却到不了第二层，漏掉它正是"BLE 上所有变更调用 `PERMISSION_DENIED`、只读全部正常"的原因。

**`btd` 无特权，`configd` 以 root 跑。** `btd` 解析无线电范围内任何人的字节；`configd` 只见到经 peer 凭据的本地 socket 送来的已解析 JSON。**把解析器放在边界的安全侧，比加固 dispatcher 更重要。**

## 会话、广播与实测教训

会话在 central 订阅时创建、离开时丢弃。早期"与服务工作一样长"的答案错了：BlueZ 每个特征只保留**一个** notify 状态。一条残留半行会毁掉**下一个**客户端：第一个 pump 把出站接收器从共享槽拿走，第二个订阅的回复写进没人读的 channel。所以泵同时等队列与 `notifier.stopped()`。

**广播间隔是机器人的属性**：未指定时 BlueZ 用内核默认 **1.28 秒**。实测机器人信号最强（−36 dBm），120 秒只被听到 16 次，最长静默 31 秒；改成 **100–150 ms** 后 151 次、最长静默 3.8 秒。不用规范允许的 20 ms：一根天线同时承载 BLE、手柄与 Wi-Fi。

## Wi-Fi：为什么必须迁到 NetworkManager

Armbian 无头镜像跑 netplan + `systemd-networkd` + `wpa_supplicant`。netplan 是配置**生成器**：没有扫描 API，`netplan apply` 只报"配置已应用"而不报关联是否成功——而"给我看网络"和"密码错了"正是 provisioning 最需要的两句话。开了 D-Bus 的 `wpa_supplicant` 也不持有接口（netplan 另跑一个 `-c` 实例），`RequiredForOnline=no` 又让启动更糟。所以 `scripts/migrate-network.sh` 只迁一次，且在把现有凭据复制进 NM profile 之前拒绝切换，否则无头板会离线且无路可回；它还有 90 秒启动兜底。

`BadKey` 是迁移的全部理由：NM 以 device state reason 7 报告密码被拒，`configd` 映射为 `BadKey`、`NotFound`、`Timeout`、`Unsupported`、`Other`，**未映射的原因绝不能变成 `BadKey`**——那会让人反复重输一个本来正确的密码。`configd` 在 `AddAndActivateConnection` 后轮询 NM，而不是在激活**开始**时返回。

三个实测修正：**扫描要等扫描**，`configd` 等 `LastScan` 前进；**结果从激活读，不从设备读**，设备在它已用的网络上保持 `ACTIVATED`，曾让 `connect` 对不在范围的网络返回 `connected` 并报出旧 SSID；**重新 provisioning 是替换而非累积**，先枚举该 SSID 的所有 profile 再删，`net.forget` 删全部。

## 配对与加密现状

六位 PIN 由 `configd` 存、`btd` 在服务任何东西前检查，**不由蓝牙绑定检查**，这是规范逼的：LE passkey entry 里一方显示、一方输入，实现 `request_passkey` 等于声明"能输入"，macOS 于是拿走显示角色；`DisplayPasskey` 又让显示方随机生成，无法呈现存的值。

所以配对是 just-works：agent handler 全为 `None`，`bluer` 发布为 `NoInputNoOutput`；RPC 特征的读要求 `encrypt_read`，这才是 central 会绑定的原因。之后 `btd` 只接受 `system.authenticate`；它由传输层回答而非转发，所以路由表有 `Route::Local`。

三个承重细节：PIN **每次尝试都从 `configd` 取**，不缓存；**按字符串比较**，`042042` 与 `42042` 不同；**三次尝试后关闭会话**，`attempts_remaining` 回给客户端。出厂 PIN 是 `000000` 且公开，开箱时只证明物理在场；安全依赖 PIN 每机独有。

**目前加密是关的**：`encrypt_read` 在 macOS 上让读**挂起**，BlueZ 以加密不足拒绝，没有提示、错误或重试。所以测试板以 `--require-pairing` 关闭运行，**PIN 与 Wi-Fi 口令明文过链路**。默认故意不安全：若默认要求配对，全新安装安全但**不可用**，每个客户端都挂在版本读上。**在交给任何人之前必须关闭这个口子。**

## 身份与广播内容

同一镜像刷出的每块板都广播 `radxa-zero3`。身份来自 **SoC serial**，由 `system.info` 报告：熔在芯片里，重刷、换模块都存活，不需要 provisioning。zero3 读设备树 `serial-number`；beta 读 `/proc/cpuinfo`，因为 beta 镜像的 U-Boot 早读三字节，同批每颗芯片 serial 相同——最初两块 beta 都是 `duck-d041`。

默认名是 `duck-` 加 serial 的 SHA-256 前四个十六进制字符，如 `duck-c51b`。哈希而非截取，因为无法保证芯片 id 哪一段在芯片间变化；用 SHA-256 而非 `std` 的 hasher，后者输出跨 Rust 版本不稳定。名字走**扫描响应**，因为地址与服务 UUID 已占满传统广播。

**广播还带 IPv4**：`duckctl scan` 不连接任何东西，而"我该 ssh 到哪"原本只在 `net.status` 里。四字节放在公司 id `0xFFFF` 的 manufacturer data 里；**它不是身份校验**，只从同时广播服务 UUID 的设备读取。没有地址的机器人广播 `0.0.0.0`，好让列表区分"没有网络"与"旧发布没有该字段"。**机器人有两个名字且都要设**：广播的 Local Name 与 BlueZ 从 `Adapter.Alias` 取的 GAP Device Name。
