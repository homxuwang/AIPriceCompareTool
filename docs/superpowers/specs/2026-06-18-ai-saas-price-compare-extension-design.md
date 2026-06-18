# AI SaaS 比价浏览器插件 MVP 设计

## 概述

本文档定义了一个浏览器插件的 MVP 版本，用于帮助用户比较不同第三方 AI SaaS 平台上的模型价格。插件不抓取网页，也不自动识别价格。用户手动录入套餐价格、积分数量、模型消耗规则，然后生成对比表格。

MVP 仅面向本地使用，数据存储在浏览器本地，并支持 JSON 导入导出。第一版只做表格输出。图表、收费、云同步以及更高级的自动化能力都明确不在本次范围内。

## 目标

- 支持同一模型在多个第三方 SaaS 平台之间对比
- 支持多个模型在多个第三方 SaaS 平台之间对比
- 同时支持“套餐积分折算”和“直接单位定价”两种价格录入方式
- 支持文本、图片、视频、音频四类模型
- 支持货币换算，内置默认汇率，并允许用户修改
- 同时生成“标准单位成本”和“典型单次成本”两类比较结果
- 数据本地持久化，并支持 JSON 导入导出

## 非目标

- 不接入官方模型提供方价格
- 不做网页识别或自动采集数据
- 不做账号系统或云同步
- MVP 不做图表
- MVP 不做支付系统或订阅限制

## 产品方向

推荐的产品形态是一个基于 Manifest V3 的本地轻量级浏览器插件，核心体验放在插件的 `Options Page` 中。MVP 不要求必须有 popup。

之所以采用这个结构，是因为产品需要同时满足：

- 多平台数据录入
- 套餐和模型规则复用
- 横向对比工作流
- 后续平滑扩展为筛选、图表和收费功能

## 主要用户流程

1. 创建一个或多个第三方 SaaS 平台
2. 在平台下添加一个或多个套餐
3. 在平台下添加模型计费规则
4. 按需调整汇率
5. 选择对比模式和使用场景
6. 生成对比表格
7. 如有需要，导出 JSON 数据

## 信息架构

`Options Page` 采用单页结构，分为四个主要功能区。

### 1. 平台与套餐管理

该区域用于管理平台元数据和套餐信息。

平台字段：

- `name`
- `defaultCurrency`
- `notes`

套餐字段：

- `name`
- `price`
- `currency`
- `billingCycle`
- `creditAmount`
- `notes`

套餐既可以表示固定订阅，也可以表示积分包，或者混合形式。只要涉及积分折算，`creditAmount` 就是必填项。

### 2. 模型计费规则管理

该区域定义某个平台上的某个模型是如何收费的。

每条规则都关联：

- 一个平台
- 一个模型
- 一种计费模式

MVP 支持的模型类型：

- `text`
- `image`
- `video`
- `audio`

MVP 支持的计费模式：

- `plan_credit_based`
- `direct_price_based`

### 3. 对比设置

该区域控制比较的对象，以及成本估算时采用的场景参数。

对比模式：

- `same_model_across_platforms`
- `multiple_models_across_platforms`

场景设置：

- 文本输入 token 数
- 文本输出 token 数
- 图片张数
- 视频时长
- 音频时长

界面应提供默认值，同时允许用户针对当前这次对比临时修改。

### 4. 结果表格

该区域展示生成后的对比表格。MVP 只支持表格输出，但结构需要为后续图表扩展留出空间。

## 数据模型

MVP 使用结构化数据保存在浏览器本地存储中。

### Platform

```ts
type Platform = {
  id: string;
  name: string;
  defaultCurrency: string;
  notes?: string;
};
```

### Plan

```ts
type Plan = {
  id: string;
  platformId: string;
  name: string;
  price: number;
  currency: string;
  billingCycle?: "monthly" | "yearly" | "one_time" | "custom";
  creditAmount?: number;
  notes?: string;
};
```

### Model

```ts
type Model = {
  id: string;
  name: string;
  category: "text" | "image" | "video" | "audio";
};
```

### Unit Definition

`UnitDefinition` 用于描述模型如何消耗积分，或者直接价格是按什么单位表示的。

```ts
type UnitType =
  | "per_1k_input_tokens"
  | "per_1k_output_tokens"
  | "per_image"
  | "per_second"
  | "per_minute";

type UnitDefinition = {
  unitType: UnitType;
  value: number;
  unitLabel?: string;
};
```

对于 `plan_credit_based`，`value` 表示每个单位消耗多少积分。

对于 `direct_price_based`，`value` 表示每个单位对应的价格，单位为规则所使用的币种。

### Model Pricing Rule

```ts
type ModelPricingRule = {
  id: string;
  platformId: string;
  modelId: string;
  pricingMode: "plan_credit_based" | "direct_price_based";
  planId?: string;
  currency?: string;
  directPriceLabel?: string;
  unitDefinitions: UnitDefinition[];
  notes?: string;
};
```

### Exchange Rate Settings

```ts
type ExchangeRateSettings = {
  baseCurrency: string;
  rates: Record<string, number>;
  updatedAt: string;
};
```

默认展示目标币种为 `CNY`。

### Scenario Settings

```ts
type ScenarioSettings = {
  textInputTokens: number;
  textOutputTokens: number;
  imageCount: number;
  videoSeconds: number;
  audioMinutes: number;
};
```

MVP 默认值：

- `textInputTokens = 1000`
- `textOutputTokens = 500`
- `imageCount = 1`
- `videoSeconds = 5`
- `audioMinutes = 1`

## 成本计算设计

核心计算引擎分两步完成结果计算。

### 第一步：计算标准单位成本

对于 `plan_credit_based` 规则：

`creditUnitCost = plan.price / plan.creditAmount`

然后：

`unitCost = creditUnitCost * unitDefinition.value`

例子：

- 套餐价格：`39 CNY`
- 套餐积分：`400`
- 图片模型消耗：`20 credits per image`

则：

- `creditUnitCost = 39 / 400 = 0.0975 CNY`
- `unitCost = 0.0975 * 20 = 1.95 CNY per image`

对于 `direct_price_based` 规则：

`unitCost = unitDefinition.value`

之后再根据汇率设置，把结果换算到用户选择的目标币种中。

### 第二步：计算典型单次成本

引擎基于当前场景参数，把标准单位成本组合成一次使用的总成本。

文本模型：

`singleRunCost = inputCost + outputCost`

其中：

- `inputCost` 来自 `per_1k_input_tokens`
- `outputCost` 来自 `per_1k_output_tokens`

图片模型：

`singleRunCost = perImageCost * imageCount`

视频模型：

`singleRunCost = perSecondCost * videoSeconds` 或 `perMinuteCost * derivedMinutes`

音频模型：

`singleRunCost = perMinuteCost * audioMinutes`

## 表格输出

MVP 默认生成的对比表格应包含以下列：

- `Platform`
- `Model`
- `Category`
- `Pricing Mode`
- `Plan Name`
- `Plan Total Price`
- `Total Credits`
- `Unit Usage Description`
- `Original Currency Unit Cost`
- `Exchange Rate`
- `Converted CNY Unit Cost`
- `Typical Single-Run Cost`
- `Notes`

该结构同时支持两类对比：

- 同一模型跨平台对比
- 多模型跨平台对比

## 交互规则

### 仅使用 Options Page

MVP 以 `Options Page` 作为主入口，因为数据录入和比较流程已经超出 popup 的空间和复杂度承载范围。

### 表单行为

- 必填字段必须明确标识
- 不完整的积分折算规则不能参与结果生成
- 缺失的场景字段应回退到默认值
- 汇率应内置默认值，并允许用户编辑

### 结果生成

用户应能：

- 选择一个或多个平台
- 选择一个或多个模型
- 选择对比模式
- 对本次运行临时覆盖默认场景参数
- 生成结果时不改动已保存的模型规则

## 校验与异常处理

MVP 需要明确处理以下情况。

### 不完整的积分套餐规则

如果某条积分折算规则关联了套餐，但该套餐缺少 `creditAmount`，则该规则在生成对比时应被标记为无效，并在界面上说明原因。

### 缺失单位定义

如果规则存在，但没有任何可用的 `unitDefinitions`，则不能生成结果行。

### 缺失汇率

如果某模型使用的币种在当前汇率设置中不存在，则生成对比时应提示校验错误，并跳过该结果行，直到用户补齐汇率。

### 文本模型只填了一半价格

如果只填写了输入价格或输出价格，则未填写的一侧按 `0` 处理，但界面上应明确标识这是一条不完整规则。

### 模型同名问题

MVP 不负责自动归一化不同平台上的模型命名。用户需要自己保证模型名称足够清晰，例如手动区分不同版本或不同档位。

## 持久化

所有数据保存在浏览器本地存储中。

MVP 同时支持：

- 导出全部数据为 JSON
- 导入 JSON 用于恢复或共享数据

导入时应校验数据结构；如果文件格式不合法，不应静默覆盖已有数据。

## 技术架构

推荐的实现结构：

- Manifest V3 浏览器插件
- 使用 React 或类似组件化框架实现 Options Page
- 单独的浏览器本地存储封装层
- 与 UI 分离的纯计算引擎

建议的模块划分：

- `storage/`
- `models/`
- `features/platforms/`
- `features/plans/`
- `features/rules/`
- `features/comparison/`
- `lib/currency/`
- `lib/calculation/`

计算层应保持与框架无关，便于做单元测试。

## 测试策略

### 单元测试

必须覆盖：

- 积分折算成本计算
- 直接价格成本计算
- 汇率换算
- 单次场景成本聚合
- 文本模型部分价格缺失时的处理

### 组件测试

必须覆盖：

- 表单校验
- 结果表格渲染
- 导入导出流程

### 基准手工验证

MVP 必须跑通这个基准场景：

- 套餐：`39 CNY / 400 credits`
- 模型：`gpt-image-1`
- 规则：`20 credits per image`

预期结果：

- `1.95 CNY per image`

## 后续扩展方向

当前设计为以下能力预留了扩展空间：

- 柱状图等图表输出
- 保存常用对比预设
- 更丰富的计费单位
- 高级筛选与排序
- 价格历史记录
- 付费功能控制
- 可选的云同步能力

## 当前约束

当前工作区不是 Git 仓库，所以虽然可以把 spec 写到本地，但无法按 brainstorming 工作流要求提交 commit，除非后续先把项目初始化为 Git 仓库。
