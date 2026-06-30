const messages = {
  'zh-CN': {
    app: {
      title: 'AI SaaS 比价工作台',
      subtitle: '左侧录入数据，中间配置参数、对比条件和计算说明，右侧稳定输出结果表。',
      loadDemo: '载入示例数据',
      exportJson: '导出 JSON',
      importJson: '导入 JSON',
    },
    metrics: {
      platforms: '网站',
      plans: '套餐',
      models: '模型',
      rules: '规则',
      currency: '结果币种',
    },
    entry: {
      title: '数据录入',
      subtitle: '网站、套餐、模型、规则都集中在这一列，用 tab 切换录入焦点。',
      platforms: '网站',
      plans: '套餐',
      models: '模型',
      rules: '规则',
      savedPlatforms: '已录入网站',
      savedPlans: '已录入套餐',
      savedModels: '已录入模型',
      savedRules: '已录入规则',
    },
    controls: {
      title: '参数与对比',
      subtitle: '汇率放在整体参数里，对比条件和计算说明拆开，避免信息混在一起。',
      settings: '整体参数',
      comparison: '对比设置',
      calculation: '计算说明',
      settingsNote: '汇率、默认场景和默认结果币种都放在这里保存。对比页只负责筛选和生成。',
      comparisonNote: '当前会以已保存的整体参数为默认值；你可以只调整这次对比的筛选和场景覆盖值。',
      calculationNote: '这里展示表格背后的成本算法，后续切英文时只需要补充英文文案字典。',
    },
    results: {
      title: '结果输出',
      subtitle: '结果区固定存在，不做 tab，生成后可以一直盯着看。',
      count: '结果条数',
      currency: '目标币种',
      exchangeRateStatus: '汇率状态',
      configured: '已配置',
      unconfigured: '未配置',
      downloadMd: '下载 MD',
      downloadCsv: '下载 CSV',
      empty: '还没有结果。先录入网站、套餐、模型和规则，再在第二列生成对比表。',
    },
    forms: {
      platformTitle: '新建网站',
      platformHint: '第三方 SaaS 平台的基础信息。',
      platformName: '网站名',
      defaultCurrency: '默认币种',
      notes: '备注',
      savePlatform: '保存网站',

      planTitle: '新建套餐',
      planHint: '录入价格、周期和积分总量，供后续积分折算使用。',
      platformOwner: '所属网站',
      planName: '套餐名',
      price: '价格',
      currency: '币种',
      cycle: '周期',
      credits: '积分数量',
      savePlan: '保存套餐',

      modelTitle: '新建模型',
      modelHint: '模型是跨平台复用的对比对象。',
      modelName: '模型名',
      category: '模型类型',
      saveModel: '保存模型',

      ruleTitle: '新建规则',
      ruleHint: '把网站、模型和计费方式连起来，支持积分折算和直接价格。',
      platform: '网站',
      model: '模型',
      pricingMode: '计费模式',
      planOutputBased: '套餐产能模式',
      linkedPlan: '关联套餐',
      directCurrency: '直接价格币种',
      includedOutputUnits: '套餐总可生成数量',
      textInputPer1k: '文本输入 / 1K',
      textOutputPer1k: '文本输出 / 1K',
      imagePerUnit: '图片 / 张',
      videoPerSecond: '视频 / 秒',
      videoPerMinute: '视频 / 分钟',
      audioPerSecond: '音频 / 秒',
      audioPerMinute: '音频 / 分钟',
      saveRule: '保存规则',

      settingsTitle: '整体参数',
      targetCurrency: '默认结果币种',
      defaultTextInput: '默认文本输入 tokens',
      defaultTextOutput: '默认文本输出 tokens',
      defaultImageCount: '默认图片张数',
      defaultVideoSeconds: '默认视频秒数',
      defaultAudioMinutes: '默认音频分钟',
      saveSettings: '保存整体参数',

      comparisonTitle: '对比设置',
      filterPlatforms: '平台筛选',
      filterModels: '模型筛选',
      runtimeTextInput: '本次文本输入',
      runtimeTextOutput: '本次文本输出',
      runtimeImageCount: '本次图片张数',
      runtimeVideoSeconds: '本次视频秒数',
      runtimeAudioMinutes: '本次音频分钟',
      resultCurrency: '结果币种',
      generate: '生成对比表',
    },
    cards: {
      empty: '暂无数据',
      unknownPlatform: '未知平台',
      unknownModel: '未知模型',
      noNotes: '无备注',
      credits: '积分',
    },
    flash: {
      invalidModel: '请先选择一个有效模型。',
      invalidUnits: '当前规则没有任何有效的单位价格或积分消耗。',
      platformSaved: '网站已保存',
      planSaved: '套餐已保存',
      modelSaved: '模型已保存',
      ruleSaved: '规则已保存',
      settingsSaved: '整体参数已保存',
      exportDone: 'JSON 已导出。',
      downloadMdDone: 'MD 已下载。',
      downloadCsvDone: 'CSV 已下载。',
      importDone: 'JSON 已导入。',
      importFailed: 'JSON 导入失败。',
      generateFailed: '生成结果失败。',
      generatedPrefix: '已生成',
      generatedSuffix: '条结果。',
      demoLoaded: '已载入演示数据，现在直接点“生成对比表”就能看到 1.95 CNY。',
    },
    resultsTable: {
      platform: 'Platform',
      model: 'Model',
      category: 'Category',
      pricingMode: 'Pricing Mode',
      planName: 'Plan Name',
      planTotalPrice: 'Plan Total Price',
      totalCredits: 'Total Credits',
      includedUnits: '套餐总可生成数量',
      unitUsageDescription: 'Unit Usage Description',
      originalUnitCost: 'Original Currency Unit Cost',
      exchangeRate: 'Exchange Rate',
      convertedUnitCost: 'Converted Unit Cost',
      singleRunCost: 'Typical Single-Run Cost',
    },
  },
};

const calculationContent = {
  'zh-CN': [
    {
      title: '汇率换算',
      summary: '不同平台可以用不同原币种录入，系统会先算出原币种成本，再统一换算到目标币种。',
      formula: '目标币种成本 = 原币种成本 × 原币种汇率 ÷ 目标币种汇率',
      example:
        '例：如果某模型单位成本是 0.2 USD，并且设置 USD = 7.2、CNY = 1，那么 0.2 × 7.2 ÷ 1 = 1.44 CNY。',
    },
    {
      title: '积分套餐折算',
      summary: '当平台提供的是套餐价格和积分总量时，先把它折算成每积分成本。',
      formula: '每积分成本 = 套餐价格 ÷ 套餐总积分',
      example:
        '例：39 CNY ÷ 400 credits = 0.0975 CNY / credit。',
    },
    {
      title: '套餐产能模式',
      summary: '当平台直接给出“某套餐对某模型可以生成多少张”时，系统会把套餐价格直接除以可生成数量。',
      formula: '单位成本 = 套餐价格 ÷ 套餐总可生成数量',
      example:
        '例：Starter 套餐 19 USD，对 GPT Image 2 1K 可生成 2000 张，则单位成本 = 19 ÷ 2000 = 0.0095 USD / image。',
    },
    {
      title: '单个模型单位成本',
      summary: '图片、视频、音频或其他单单位模型，先求标准单位成本，再进入结果表。',
      formula:
        '积分折算模式：模型单位成本 = 每积分成本 × 该模型每单位消耗积分\n套餐产能模式：模型单位成本 = 套餐价格 ÷ 套餐总可生成数量\n直接价格模式：模型单位成本 = 用户录入的每单位价格',
      example:
        '例：如果 gpt-image-1 每张图消耗 20 credits，那么 0.0975 × 20 = 1.95 CNY / image。',
    },
    {
      title: '文本模型单次成本',
      summary: '文本模型不是一个固定单价，而是输入和输出两部分组合出来的。',
      formula:
        '文本单次成本 = 输入成本 + 输出成本\n输入成本 = 每 1K 输入 token 成本 × (本次输入 token ÷ 1000)\n输出成本 = 每 1K 输出 token 成本 × (本次输出 token ÷ 1000)',
      example:
        '例：如果每 1K 输入 = 0.2 USD、每 1K 输出 = 0.4 USD、本次输入 = 1000、本次输出 = 500，那么输入成本 = 0.2 USD，输出成本 = 0.2 USD，单次文本成本 = 0.4 USD。',
    },
  ],
};

export function createTranslator(locale) {
  const activeMessages = messages[locale] ?? messages['zh-CN'];

  return function translate(path) {
    const result = path.split('.').reduce((current, key) => current?.[key], activeMessages);
    return result ?? path;
  };
}

export function buildCalculationSections(locale) {
  return calculationContent[locale] ?? calculationContent['zh-CN'];
}
