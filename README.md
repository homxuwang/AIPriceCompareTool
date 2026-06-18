# AI SaaS Price Compare Extension

一个零构建的 Manifest V3 浏览器插件 MVP，用于手动录入第三方 AI SaaS 平台的套餐、积分和模型计费规则，并生成成本对比表格。

## 功能范围

- 平台、套餐、模型、计费规则本地录入
- 支持积分折算和直接价格两种录入模式
- 支持 `text`、`image`、`video`、`audio`
- 支持汇率设置和典型场景参数设置
- 支持生成对比表
- 支持 JSON 导入导出

## 本地测试

```bash
npm test
```

## 加载插件

1. 打开 Chrome 或其他 Chromium 浏览器
2. 进入 `chrome://extensions`
3. 打开右上角 `Developer mode`
4. 点击 `Load unpacked`
5. 选择当前项目根目录：`AIPriceCompareTool`
6. 打开插件的 `Options`

## 快速验证示例

1. 打开 `Options Page`
2. 点击 `载入示例数据`
3. 点击 `生成对比表`
4. 确认结果表中出现 `gpt-image-1`
5. 确认 `Converted CNY Unit Cost` 与 `Typical Single-Run Cost` 都为 `1.95`
