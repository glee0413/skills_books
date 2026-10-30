# gstack 与 mattpocock_skills：相同与差异

这一章不讨论某一个具体技能，而是把两个项目放在一起看。它们都在回答同一个问题：怎样让 AI agent 按工程纪律工作，而不是凭感觉生成代码。但它们的答案来自两种不同的职业经验，也服务于两种不同的使用场景。

## 一个共同的前提

两个项目都反对“vibe coding”。它们都认为，agent 的能力越强，越需要结构、反馈和判断，而不是更长的提示词。

共同点可以概括为五条：

- **先想清楚再动手。** gstack 用 office-hours 和多种 plan review 逼问产品和方案；mattpocock 用 grilling、domain-modeling 和 to-spec 把模糊想法收敛成规格。
- **把工作拆小。** gstack 把研发拆成 Think、Plan、Build、Review、Test、Ship、Reflect；mattpocock 把工程纪律拆成一个个可组合的技能，再用 tracer bullet 和垂直切片推进。
- **用反馈回路约束 agent。** gstack 有 review、QA、browser evidence、health、eval；mattpocock 有 TDD、红绿循环、seam、diagnosing-bugs 和 code-review。
- **保留人的决定权。** gstack 在关键节点设置 STOP 和批准门；mattpocock 反复强调“决策是用户的，事实才是 agent 的”。
- **把上下文写下来。** gstack 用设计文档、计划、review report、learnings、gbrain；mattpocock 用 GLOSSARY、ADR、spec、ticket、handoff 和 writing-for-agents。

这些共同点说明，两者并不是互相替代的产品，而是同一套工程价值观的两种组织方式。

## 最大的差异：团队流程，还是个人方法

gstack 的出发点是一支**虚拟工程团队**。它把 CEO、工程经理、设计师、DX 负责人、QA、安全官、发布工程师、SRE 等角色拆成独立的技能，再用一条接近真实 sprint 的流程把它们串起来。你调用一个角色，得到的是一种视角；你按顺序调用一组角色，得到的是一条从想法到上线的流水线。

mattpocock_skills 的出发点是一套**个人工程方法**。它不模拟组织角色，而是把工程判断拆成可复用的动作：怎样追问、怎样写规格、怎样拆工单、怎样测试、怎样审查、怎样把领域语言写进代码。它更像一位经验丰富的工程师坐在你旁边，随时递给你一个具体做法，而不是一支团队围着你开会。

这个差异会渗透到很多细节：

| 维度 | gstack | mattpocock_skills |
|---|---|---|
| 基本单位 | 角色和命令 | 工程纪律和可组合技能 |
| 默认场景 | 从想法到生产上线的完整交付 | 在现有代码库里把一件事想清楚、做对 |
| 流程形状 | 线性 sprint，有明确阶段和门禁 | 网状组合，按任务需要拼技能 |
| 主要产出 | 设计文档、计划、PR、部署、生产验证 | 规格、工单、测试、代码审查、领域文档 |
| 对工具链的依赖 | 较高：Bun、浏览器、Codex/Claude、Docker、macOS 浏览器等 | 较低：大多是 Markdown 和宿主自带工具 |
| 风格 | 强烈、具体、产品化、带作者判断 | 克制、可改造、强调方法和写作 |

## 流程上的差异

gstack 的流程是“一条主线，多个门”。它默认你会从 office-hours 开始，经过 CEO、工程、设计、DX 等计划评审，再进入实现、review、QA、ship、canary 和 retro。每个阶段都有对应的专家角色，前一阶段的产物会喂给后一阶段。它关心的是：这件事有没有被完整地做过一遍。

mattpocock 的流程是“一条主链，多个入口”。它有一条常见链路：grill-with-docs → to-spec → to-tickets → implement → tdd → code-review。但它不要求你每次从第一步走到最后一步。你可以只拿 grilling 来压力测试一个决定，只拿 tdd 来做一个行为，只拿 code-review 来审查一个分支。它关心的是：你当前缺的是哪一种工程判断。

这带来一个实际区别：

- 如果你要的是一套“从今天开始按这个流程做产品”的完整系统，gstack 更直接。
- 如果你要的是一套“在已有工作方式里补上工程纪律”的工具箱，mattpocock 更轻。

## 审查与证据的差异

两者都重视审查，但审查的对象不同。

gstack 的 review 更像一次上线前的多角色会诊。它会把代码、测试、文档、设计、DX、安全、部署都纳入视野，还会引入 Codex 或 Claude 的第二意见，要求证据、覆盖率和明确的通过/阻塞结论。它关心的是：这个改动能不能安全地进入生产。

mattpocock 的 code-review 更像一次工程标准检查。它从两个轴看 diff：**Standards**（是否符合仓库的编码标准，以及 Fowler 式的坏味道基线）和 **Spec**（是否忠实实现了原始规格）。它用两个并行子代理，避免标准审查和规格审查互相污染。它关心的是：这段代码是否值得留在代码库里。

一个偏“发布风险”，一个偏“代码质量”。两者并不冲突，甚至可以叠加：先用 mattpocock 的 code-review 看代码本身，再用 gstack 的 review 看它能不能上线。

## 上下文与记忆的差异

gstack 把记忆当作基础设施。它有 context-save/context-restore、learn、gbrain、session timeline、telemetry 和 learnings log。它希望 agent 在不同会话、不同机器、不同项目之间保留经验，甚至把“这次学到了什么”变成下一次的默认行为。

mattpocock 把记忆当作写作。它用 GLOSSARY 统一领域语言，用 ADR 记录决策，用 spec 和 ticket 保存工作意图，用 handoff 把上下文交给下一个会话，用 writing-for-agents 教你怎么写 agent 能读的文档。它不追求一个庞大的记忆系统，而是追求“该写下来的东西写得足够短、足够准”。

一个偏系统，一个偏文本。系统更容易自动化，文本更容易被人 review 和迁移。

## 对 agent 的假设不同

gstack 假设 agent 运行在一个能力较强的宿主里：能跑 Bash、能开浏览器、能调子代理、能读文件、能执行 CI。它的大量技能依赖这些能力，甚至依赖特定的宿主和模型。

mattpocock 假设 agent 的基本能力就是读、写、问和调用工具。它尽量把技能写成宿主无关的 Markdown，把“调用另一个技能”写成明确的 Skill 工具指令，把“用户调用”和“模型调用”分开。它更像一套可以搬来搬去的工程习惯。

这也是为什么 gstack 的安装和配置更重，而 mattpocock 的技能更容易被复制、改写和嵌入其他项目。

## 相同点背后的不同动机

两者都强调“问问题”，但动机不同。

gstack 的 office-hours 问的是产品问题：这件事值不值得做、用户是谁、痛点是否真实、最小可行产品是什么。它最终要产出一份能进入下游流程的设计文档。

mattpocock 的 grilling 问的是决策问题：这个计划还有哪些分支没定、哪些事实需要查、哪些决定必须由用户做。它最终要达成的是共同理解，而不是一份文档。

两者都强调“审查”，但审查的对象不同：gstack 审查上线风险，mattpocock 审查代码和规格的一致性。

两者都强调“复盘”，但复盘的对象不同：gstack 的 retro 看团队、交付、测试健康和成长机会；mattpocock 的 retro 更关注 agent 的工作环境、导航、自动化检查和编码标准。

## 怎么选

可以用四个问题来判断：

1. **你要的是一支团队，还是一套方法？** 需要角色分工和端到端流程，选 gstack；需要补上某一种工程判断，选 mattpocock。
2. **你是在做新产品，还是在改现有代码？** 新产品和从 0 到 1 的交付，gstack 的流程更完整；现有代码库里的规格、测试和审查，mattpocock 更贴地。
3. **你的工具链有多重？** 能接受 Bun、浏览器、Docker、外部模型和第二意见，gstack 的空间更大；希望尽量少依赖，mattpocock 更合适。
4. **你想要多少作者判断？** gstack 给出强观点和具体做法；mattpocock 给出可改造的原则和模板。前者省决策，后者省束缚。

## 怎么组合

最实际的用法不是二选一，而是各取所长：

- 用 mattpocock 的 grilling、domain-modeling、to-spec、to-tickets 把问题和规格想清楚。
- 用 mattpocock 的 tdd、codebase-design、code-review 把代码做扎实。
- 用 gstack 的 plan-ceo-review、plan-eng-review、plan-design-review、plan-devex-review 做多角色计划评审。
- 用 gstack 的 qa、review、cso、ship、land-and-deploy、canary 做上线前的证据和交付。
- 用两者的 retro 各做一次复盘：一次看工程环境，一次看团队交付。

这不是把两套流程叠加成更重的流程，而是把“想清楚”“做扎实”“安全上线”分别交给更擅长的技能。

## 一句话总结

gstack 把工程经验组织成一支虚拟团队，mattpocock 把工程经验组织成一套可组合的个人方法。前者让你按流程走完一整条交付链，后者让你在需要的地方补上一种判断。它们共享同一种反 vibe coding 的立场，但一个偏向组织，一个偏向手艺。