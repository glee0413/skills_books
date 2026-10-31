---
id: cedar-docs/auth-patterns
title: 授权模式
description: 用六种端点模式决定授权请求的主体、动作、资源与实体切片，并以邮件营销平台为例完整演示。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_bestpractices/bp-authorization-patterns.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_bestpractices/bp-authorization-patterns.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_bestpractices/bp-authorization-patterns.md
license: Apache-2.0
kind: concept
translatedAt: 2026-10-31
---

# 授权模式

应用里的每个 API 端点都能归入少数几种授权模式。先判断端点属于哪一种，就能确定每次调用授权时主体、动作、资源分别取什么，以及要构造哪些实体。这是[最佳实践概览](./best-practices.md)中“识别你的授权模式”的展开。

## 六种模式

**单资源读、改、删。** 主体对某个已存在的具体资源执行动作，例如 `GetPhoto`、`DeleteDocument`。这是最直接的模式，主体、动作、资源都能从请求直观映射：

```
principal = App::User::"alice"
action    = App::Action::"GetPhoto"
resource  = App::Photo::"photo-123"
```

**资源创建。** 主体要创建尚不存在的资源，例如 `UploadPhoto`、`CreateEmailCampaign`。资源还不存在，无法对它授权；请求里的资源应取新资源将归属的**容器**，可能是租户、文件夹/相册/项目，或单租户场景下的应用本身。若应用同时建模文件夹与相册，容器及其父级都要进入实体切片。

```
principal = App::User::"alice"
action    = App::Action::"UploadPhoto"
resource  = App::Folder::"alice-vacation-2024"
```

**资源列表。** 主体列出某类资源，例如 `ListPhotos`。与创建类似，授权对象是容器；额外要考虑动作名是否应固化容器层级。相比泛化的 `ListPhotos`，`ListPhotosForAccount` 或 `ListPhotosForFolder` 更精确，因为它写明了查的是哪一级容器。常见做法是把列表权限当作容器级的全有全无，但让列表接口只返回元数据；需要完整内容时再对每个资源单独调用 `Get` 授权。

```
principal = App::User::"alice"
action    = App::Action::"ListPhotosForFolder"
resource  = App::Folder::"alice-vacation-2024"
```

**批量读、改、删。** 主体一次对多个资源执行同一动作，例如老师批量提交考勤，或用户在表格里多选后删除。这需要**复合授权**：对批次中的每个资源各做一次单资源授权。在 Cedar 搭配 Amazon Verified Permissions 时用 `BatchIsAuthorized`。移动文件也是复合场景——源容器与目标容器都要授权：从源移除、向目标添加。

**开放端点。** 动作不针对任何具体资源，例如 `Login`、`Signup`、`ResetPassword`。此时主体身份并不可信，调用方可能未认证或持有未验证的凭据。资源取**应用**（或服务）实体。这个模式适合让策略控制应用整体入口，例如限制登录只对状态正常的账户开放，或限制注册只接受特定邮箱域。

**隐式作用域端点。** 资源由主体自身隐含推出，例如 `GetDashboardData`、`GetMyProfile`、`ListMyNotifications`。请求里不带资源标识，业务逻辑从 JWT 取出用户并返回该用户范围内的数据。由于资源隐含于主体，动作的资源类型同样建模为**应用**实体，与开放端点一致。此时要回答的问题是“这个主体能否使用该功能”，而不是“能否访问某个具体资源”。

## 实体切片

每次 `IsAuthorized` 都需要一个实体切片：授权引擎求值所需的实体列表，含属性与父子关系。切片由可复用的部分拼成：

- **主体切片**：主体及其父级（角色、组、租户）。它相对稳定——用户的角色和组不常变，租户永不变——因此可以取一次并缓存。更重要的是，取某个用户主体切片的**代码**是固定的：查用户、查角色、查租户，再转成 Cedar 实体格式。
- **资源切片**：资源及其父级（容器、租户）。它随资源类型和具体资源变化。若目标资源就是 `Tenant`，可能无需查库；若是 `EmailMessage`，则要查出所属 `EmailCampaign` 及其租户。

完整切片 = 主体切片 + 资源切片，授权模式决定资源切片长什么样。

## 构造切片的步骤

1. 把 HTTP 请求映射为 Cedar 动作；
2. 由动作和主体类型确定资源类型——按“动作映射到业务领域”的做法，每个动作应只对应一种资源类型；
3. 取主体切片（可缓存）；
4. 取该资源类型与具体资源的资源切片；
5. 合并后调用 `IsAuthorized`。

每个切片构造器都能独立使用和测试。资源切片构造器的数量取决于 schema 中不同资源类型的数量及其访问方式，通常远少于端点数量。

## 案例：邮件营销平台

原文用一个含 `Tenant`、`Role`、`User`、`EmailCampaign`、`EmailMessage`、`Application` 的 schema 走完全部端点。以租户 `acme` 中属于 `admin` 角色的用户 `alice` 为例，主体切片是：

```json
[
    {
        "uid": { "type": "EmailApp::User", "id": "alice" },
        "attrs": { "email": "alice@acme.com", "displayName": "Alice" },
        "parents": [
            { "type": "EmailApp::Role", "id": "admin" },
            { "type": "EmailApp::Tenant", "id": "acme" }
        ]
    },
    {
        "uid": { "type": "EmailApp::Role", "id": "admin" },
        "attrs": {},
        "parents": []
    },
    {
        "uid": { "type": "EmailApp::Tenant", "id": "acme" },
        "attrs": { "planTier": "enterprise", "maxUsers": 100 },
        "parents": []
    }
]
```

这份切片可被 `alice` 的多次请求复用，缓存策略视应用需要而定。`login`、`signup`、`getDashboardData` 的资源切片只有一个合成出来的应用实体，不需要查库：

```json
[
    {
        "uid": { "type": "EmailApp::Application", "id": "emailApp" },
        "attrs": {},
        "parents": []
    }
]
```

创建或列出活动时，资源是租户；`get/update/deleteEmailCampaign` 的资源是活动及其父租户；创建或列出消息时资源是所属活动；消息的单资源操作则要带上消息、活动、租户三层。`deleteEmailMessage` 看似一个动作，实际对应批量端点，因此对每条消息各查一次，逐条决定允许删除哪些。

把这些端点归类后，13 个 HTTP 端点只需要 5 个切片构造器：`principalSlice`（用户、角色、租户）、`applicationSlice`（代码中合成，不查库）、`tenantSlice`、`emailCampaignSlice`（活动加父租户，可复用 `tenantSlice`）、`emailMessageSlice`（消息、父活动、租户，可复用 `emailCampaignSlice`）。每个授权请求都是主体切片加某个资源切片。模式识别带来的收益就在这里：端点会增长，切片构造器不会同比例增长。