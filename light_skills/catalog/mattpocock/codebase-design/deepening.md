---
id: mattpocock/codebase-design/deepening
title: deepening
description: 在给定依赖的情况下，安全地深化一簇浅模块，并按依赖类别决定跨接缝的测试方式。
project: mattpocock
sourceCommit: 5beb35b040e3de97e54fa9e386d7e42d15c295c2
sourceRef: v1.3.1-47-g5beb35b
sourcePath: skills/engineering/codebase-design/DEEPENING.md
snapshotPath: source-snapshots/mattpocock/codebase-design/deepening.md
license: MIT
translatedAt: 2026-10-30
parentSkill: mattpocock/codebase-design
---

# 深化

在给定依赖的情况下，如何安全地深化一簇浅模块。假定你已经掌握 [SKILL.md](SKILL.md) 里的词汇：**module**、**interface**、**seam**、**adapter**。

## 依赖类别

评估一个深化候选时，先给它的依赖分类。类别决定了深化后的模块如何跨接缝测试。

### 1. 进程内（In-process）

纯计算、内存状态、没有 I/O。总是可以深化：把这些模块合并，直接透过新接口测试。不需要适配器。

### 2. 可用本地替身（Local-substitutable）

有本地测试替身的依赖（Postgres 用 PGLite，内存文件系统）。只要替身存在就可以深化。深化后的模块在测试套件里带着替身运行来测试。接缝在内部；模块的外部接口上不需要端口。

### 3. 远程但自有（端口与适配器）

跨网络边界的自有服务（微服务、内部 API）。在接缝处定义一个**端口**（接口）。深模块拥有逻辑；传输作为**适配器**注入。测试用内存适配器。生产用 HTTP/gRPC/队列适配器。

建议的措辞形状：*“在接缝处定义一个端口，为生产实现一个 HTTP 适配器、为测试实现一个内存适配器，这样即使部署在网络两端，逻辑也待在一个深模块里。”*

### 4. 真正的外部（Mock）

你无法控制的第三方服务（Stripe、Twilio 等）。深化后的模块把外部依赖作为注入的端口接住；测试提供一个 mock 适配器。

## 接缝纪律

- **一个适配器意味着假想的接缝。两个适配器才意味着真实的接缝。** 除非至少有两个适配器站得住脚（典型是生产 + 测试），否则不要引入端口。只有一个适配器的接缝只是间接层。
- **内部接缝与外部接缝。** 深模块可以有内部接缝（对其实现私有，供它自己的测试使用），也可以有位于其接口处的外部接缝。不要因为测试会用到内部接缝，就把它们暴露到接口上。

## 测试策略：替换，而不是叠加

- 一旦深化模块接口处的测试存在，针对浅模块的旧单元测试就成了浪费；删掉它们。
- 在深化模块的接口处写新测试。**接口就是测试面**。
- 测试断言透过接口可观察到的结果，而不是内部状态。
- 测试应当能经受内部重构，因为它们描述行为，而不是实现。如果实现一变测试就得改，那它就是在测试接口之外的东西。