---
id: cedar-docs/integrations
title: Cedar 集成方式
description: 说明 Cedar 集成以中间件形式提供的价值、它替应用完成的四个步骤，以及一次集成必须具备的组成部分。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_auth/integrations.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_auth/integrations.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_auth/integrations.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# Cedar 集成方式

Cedar 的集成（integration）要解决的问题是：在应用里实现细粒度授权，同时尽量少写代码，并遵循具体框架自身的惯例。集成通常以中间件组件和工具的形式提供，把应用与 Cedar 直接接起来，而不是让每个团队从零封装一遍决策调用。

## 集成带来什么

原文列了五点收益：几分钟内就能把授权接进去；沿用框架特定的模式与约定；降低维护负担；减少安全实现上的错误；让开发者专注于业务逻辑而不是授权代码。这些收益有共同来源——集成把“请求如何变成 Cedar 的输入、决策如何落回 HTTP 响应”这类重复工作封装掉了，开发者只需要提供策略和少量映射。

## 一次集成做四件事

无论哪个框架，集成在请求链上完成的工作都可以拆成四步：

1. 通过框架特定的中间件**拦截**进入的请求；
2. 从请求中**提取**授权所需的上下文；
3. 调用 Cedar，**得出**授权决策；
4. 依据决策**执行**访问控制——放行到业务处理，或直接返回拒绝。

这四步对应 PARC 的填充过程：主体通常来自认证结果（token 的 `sub`、`groups`），动作来自 HTTP 方法与路径，资源来自路径参数或请求体，上下文来自请求头、时间、MFA 状态等。

## 一次集成必须具备的组成部分

接口各异，要回答的问题却一致。第一，一份 [schema](./schema.md)：声明实体类型、属性、动作以及动作适用的主体/资源/上下文。第二，一组策略：给出允许与拒绝规则，并能在启动时通过 schema 校验。第三，principal 映射：把认证后的用户变成带 `uid`、`attrs`、`parents` 的实体。第四，请求映射：把端点变成动作、把参数变成资源。第五，拒绝语义：返回什么状态码与错误体、哪些端点跳过鉴权。任何一环缺失，授权都会退化成“全部拒绝”或“意外放行”。

## 从 Express 看一个完整实现

[在 Express 中集成 Cedar](./integration-express.md) 把上述内容具体化了：安装 `@cedar-policy/authorization-for-expressjs`，从 OpenAPI 的 `paths` 生成 schema，用生成器产出示例策略，注册 `ExpressAuthorizationMiddleware`，再用 `getPrincipalEntity` 回调提供用户实体，并用 `skippedEndpoints` 排除登录等端点。其中“从 OpenAPI 生成动作名”和“用回调提供 principal”两步，是其他框架集成也要自己回答的问题。

## 何时自己写集成

如果所用框架没有官方集成，或主体与资源的提取逻辑很特殊，可以直接基于 [Rust SDK](../cedar/sdk.md) 或 WASM 接口自行封装。即便自研，也建议保留上面四步的边界：认证在前、Cedar 决策在中、业务处理在后，避免把授权判断散落到各个 handler 里——那正是集成想要消除的重复与遗漏。