---
id: cedar-docs/integration-express
title: 在 Express 中集成 Cedar
description: 用 authorization-for-expressjs 中间件为 Express 应用接入 Cedar 的完整步骤，从 OpenAPI 生成 schema 到提供 principal 实体。
project: cedar-docs
sourceCommit: a0b28494644671804c60301fee4d59f5fc4fbd99
sourceRef: a0b2849
sourcePath: docs/collections/_auth/integration-express.md
snapshotPath: source-snapshots/cedar-docs/docs/collections/_auth/integration-express.md
sourceUrl: https://github.com/cedar-policy/cedar-docs/blob/a0b28494644671804c60301fee4d59f5fc4fbd99/docs/collections/_auth/integration-express.md
license: Apache-2.0
kind: tutorial
translatedAt: 2026-10-31
---

# 在 Express 中集成 Cedar

官方 Express 集成采用**中间件**思路：把授权挂在请求链上，不改动已有的路由处理器。中间件拦截请求，按你定义的策略求值，只把已授权的请求放行到业务代码。原文称，相比开发者自己设计集成方式，这种标准化做法能少写约 90% 的代码，同时减少自定义集成代码带来的安全风险。

开始之前，需要安装 Node.js 与 npm，并有一个 Express 应用；如果要用真实身份登录，还需要一个 OpenID Connect（OIDC）身份提供方（纯测试可省略）。示例围绕仓库 `cedar-policy/authorization-for-expressjs` 展开。

## 第一步：安装中间件包

```bash
npm i --save @cedar-policy/authorization-for-expressjs
```

这个包同时负责生成 Cedar schema、生成示例策略，以及在应用内执行授权。

## 第二步：从 API 生成 schema

[schema](./schema.md) 定义应用的授权模型：有哪些实体类型、允许哪些动作。官方建议给 schema 指定一个命名空间，示例用 `YourNamespace`。应用启动时会用这份 schema 验证策略。

该包能读取应用的 OpenAPI 规范并生成 Cedar schema，其中 `paths` 对象是必需的。若没有规范，可以先用 `express-openapi-generator` 生成：

```bash
npx @cedar-policy/authorization-for-expressjs generate-schema --api-spec openapi.json --namespace YourNamespace --mapping-type SimpleRest
```

命令会在包根目录生成 `v4.cedarschema.json`。

## 第三步：定义授权策略

Cedar 的默认行为是拒绝：没有配置任何策略时，所有请求都会被拒。先根据 schema 生成示例策略：

```bash
npx @cedar-policy/authorization-for-expressjs generate-policies --schema v4.cedarschema.json
```

策略会写入 `/policies` 目录，随后按业务改写。示例给了两条：管理员组可做任意动作，员工组只能做四个与资源相关的动作。

```cedar
// Defines permitted administrator user group actions
permit (
    principal in YourNamespace::UserGroup::"<userPoolId>|administrator",
    action,
    resource
);

// Defines permitted employee user group actions
permit (
    principal in YourNamespace::UserGroup::"<userPoolId>|employee",
    action in
        [YourNamespace::Action::"GET /resources",
         YourNamespace::Action::"POST /resources",
         YourNamespace::Action::"GET /resources/{resourceId}",
         YourNamespace::Action::"PUT /resources/{resourceId}"],
    resource
);
```

注意动作命名：默认是 `<HTTP Method> /<PATH>`；如果 OpenAPI 里写了 `operationId`，schema 中的动作名会改用 `operationId`，策略里的写法必须同步。策略规模变大后，可以用 Cedar Analysis CLI 分析实际授予了哪些权限。

## 第四步：在应用里调用 Cedar

先构造决策引擎与中间件。下面这段放在 `app.js` 顶部：

```javascript
const { ExpressAuthorizationMiddleware, CedarInlineAuthorizationEngine } = require('@cedar-policy/authorization-for-expressjs');

const policies = [
    fs.readFileSync(path.join(__dirname, 'policies', 'policy_1.cedar'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'policies', 'policy_2.cedar'), 'utf8')
];

const cedarAuthorizationEngine = new CedarInlineAuthorizationEngine({
    staticPolicies: policies.join('\n'),
    schema: {
        type: 'jsonString',
        schema: fs.readFileSync(path.join(__dirname, 'v4.cedarschema.json'), 'utf8'),
    }
});

const expressAuthorization = new ExpressAuthorizationMiddleware({
    schema: {
        type: 'jsonString',
        schema: fs.readFileSync(path.join(__dirname, 'v4.cedarschema.json'), 'utf8'),
    },
    authorizationEngine: cedarAuthorizationEngine,
    principalConfiguration: {
        type: 'custom',
        getPrincipalEntity: principalEntityFetcher
    },
    skippedEndpoints: [
        {httpVerb: 'get', path: '/login'},
        {httpVerb: 'get', path: '/api-spec/v3'},
    ],
    logger: {
        debug: s => console.log(s),
        log: s => console.log(s),
    }
});
```

然后把它挂到请求链上，位置很关键：必须放在认证中间件之后，这样 `req.user` 才有值；不需要鉴权的端点通过 `skippedEndpoints` 排除。

```javascript
const app = express();

app.use(express.json());
app.use(verifyToken());   // validate user token
// ... other pre-authz middlewares

app.use(expressAuthorization.middleware);

// ... other middlewares
```

## 第五步：提供 principal 实体

Cedar 需要用户所属组和属性才能判断。中间件通过配置里的 `getPrincipalEntity` 回调取得 principal 实体，这个函数要自己实现：

```javascript
async function principalEntityFetcher(req) {
    const user = req.user;   // it's common practice for the authn middleware to store the user info from the decoded token here
    const userGroups = user["groups"].map(userGroupId => ({
        type: 'YourNamespace::UserGroup',
        id: userGroupId       
    }));
    return {
        uid: {
            type: 'YourNamespace::User',
            id: user.sub
        },
        attrs: {
            ...user,
        },
        parents: userGroups 
    };
}
```

返回值的形状正是[实体与上下文 JSON 语法](./entities-syntax.md)里的 `uid`、`attrs`、`parents`。组 ID 必须与策略中 `UserGroup::"..."` 的写法一致，否则 `principal in ...` 永远不匹配。

## 排错与后续

授权失败时依次检查：schema 格式、策略格式、JWT 是否有效，并打开 debug 日志看中间件拿到了什么。跑通之后可以继续做自定义映射器、为决策加监控与日志、为不同角色补充策略。

同一套中间件模式在其他框架上的抽象见[Cedar 集成方式](./integrations.md)；想自己封装时，底层接口见 [Rust SDK](../cedar/sdk.md)。