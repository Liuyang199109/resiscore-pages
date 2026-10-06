/*
 * 社区级评分离线包（可增量更新）。
 * 该包保存名称别名和少量经多来源核验的原始项目字段，不保存任何会被误认为真实分值的历史分数。
 * 交通、CBD 距离和单价必须优先使用当前小区的坐标、路线和公开均价，
 * 不能用一组历史分数覆盖不同小区的实时计算结果。
 */
globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE = {
  schemaVersion: 1,
  generatedAt: '2026-10-04',
  // 公开楼盘资料补录。该区块只保存原始字段和来源，不保存前端计算出的分数。
  // 高新仕林苑在广州住宅目录中缺记录，因此用多来源公开楼盘页做补录。
  qualityOverrides: [
    {
      name: '高新仕林苑',
      aliases: ['高新·仕林苑', '仕林花园', '高新仕林花园'],
      district: '黄埔区',
      constructionStatus: '在建',
      openingYear: 2024,
      plannedHandoverYear: 2027,
      greenRate: 45,
      officialGreenRate: 35,
      plotRatio: 2.2,
      parkingCount: 2683,
      advertisedParkingCount: 3033,
      householdCount: 1395,
      buildingCount: 14,
      maxFloor: 31,
      developer: '广州厦广仕有限责任公司（广州高新区投资集团子公司）',
      propertyCompany: '龙湖物业服务集团有限公司',
      propertyFee: 2.8,
      sourceUrl: 'https://mfang.58.com/gz/loupan/59109808/params/',
      sourceUrls: [
        'https://mfang.58.com/gz/loupan/59109808/params/',
        'https://m.fang.com/xf/housereport/gz/2811206512.html',
        'https://gz.fang.anjuke.com/fangyuan/14688106.html?from_loupan=523950',
        'https://mzj.gz.gov.cn/gk/dmgg/content/post_9810524.html'
      ],
      sourceLabel: '58爱房、房天下、安居客与广州市民政局地名公告交叉核验',
      sourceStatus: '平台公开项目参数；绿地率另保留官方规划值35%，未将营销口径覆盖官方口径'
    }
  ],
  cities: {
    guangzhou: {
      source: '名称别名包（不含评分；所有维度由当前数据源计算）',
      phaseDataPolicy: {
        version: 1,
        lookupOrder: ['phase-field', 'phase-record', 'parent-project-field', 'missing'],
        fallbackScope: 'same-parent-only',
        siblingPhaseFallback: false,
        parentFallbackAllowed: true,
        note: '每个评分维度和原始字段分别回退；只有当前期缺字段时才使用同一父项目整体数据。'
      },
      // 分期清单只保存可审计的名称、层级、户数和坐标基线。查询时优先
      // 使用期级字段；期级字段缺失时按维度回退到父项目，绝不回退到另一期。
      phaseRecords: [
        {
          name: '大壮名城一期',
          aliases: ['大壮名城一期花园', '大壮名城1期'],
          parentName: '大壮名城',
          phase: '一期',
          phaseLabel: '一期',
          district: '黄埔区',
          dataStatus: 'phase-known-coordinate-missing',
          coordinateSource: '公开资料可确认一期已交付，但当前离线包尚未取得一期独立人行出入口坐标；交通、CBD和生活配套按规则回退父项目坐标',
          fallbackPolicy: 'parent-project-by-dimension',
          sourceUrls: ['https://gz.focus.cn/loupan/110112077.html']
        },
        {
          name: '大壮名城二期·名门',
          aliases: ['大壮名城二期', '大壮名城名门', '名成名门花园', '大壮名成花园', '大壮名城2期'],
          parentName: '大壮名城',
          phase: '二期',
          phaseLabel: '二期 · 名门',
          district: '黄埔区',
          developer: '广州市暹岗大有投资有限公司',
          address: '黄埔区开泰大道与科丰路交汇处',
          dataStatus: 'phase-known-coordinate-missing',
          coordinateSource: '公开资料可确认二期为名门组团，但当前离线包尚未取得二期独立人行出入口坐标；交通、CBD和生活配套按规则回退父项目坐标',
          fallbackPolicy: 'parent-project-by-dimension',
          sourceUrls: ['https://gz.newhouse.fang.com/loupan/2811173750/', 'https://gz.focus.cn/loupan/110112077.html']
        },
        {
          name: '大壮名城三期',
          aliases: ['大壮名城3期'],
          parentName: '大壮名城',
          phase: '三期',
          phaseLabel: '三期',
          district: '黄埔区',
          dataStatus: 'phase-known-coordinate-missing',
          coordinateSource: '公开资料可确认项目按三期滚动建设，但当前离线包尚未取得三期独立人行出入口坐标；交通、CBD和生活配套按规则回退父项目坐标',
          fallbackPolicy: 'parent-project-by-dimension',
          sourceUrls: ['https://gz.newhouse.fang.com/loupan/2811173750/dongtai/all/9_5/']
        },
        {
          name: '科城山庄一期峻和园',
          aliases: ['科城山庄一期·峻和园', '科城山庄峻和园', '峻和园', '科城山庄一期景和园', '景和园'],
          parentName: '科城山庄',
          phase: '一期',
          phaseLabel: '一期 · 峻和园',
          district: '黄埔区',
          latitude: 23.187632,
          longitude: 113.479177,
          householdCount: 606,
          developer: '广州峻和投资有限公司',
          address: '黄埔区水西路北侧科城山庄',
          sourceUrl: 'https://www.hp.gov.cn/gkmlpt/content/5/5053/post_5053624.html',
          sourceLabel: '黄埔区政府公开答复（一期峻和园，606户）'
        },
        {
          name: '科城山庄二期锦泽园',
          aliases: ['科城山庄二期·锦泽园', '科城山庄锦泽园', '锦泽园', '科城山庄二期景泽园', '景泽园'],
          parentName: '科城山庄',
          phase: '二期',
          phaseLabel: '二期 · 锦泽园',
          district: '黄埔区',
          latitude: 23.190018,
          longitude: 113.479979,
          householdCount: 1712,
          developer: '广州锦泽房地产开发有限公司',
          address: '广州市黄埔区峻福路与峻祥路交汇处',
          sourceUrl: 'https://www.hp.gov.cn/gkmlpt/content/5/5053/post_5053624.html',
          sourceLabel: '黄埔区政府公开答复（二期锦泽园，1712户）'
        },
        {
          name: '科城山庄三期峻森园',
          aliases: ['科城山庄三期·峻森园', '科城山庄峻森园', '峻森园', '科城山庄三期景森园', '景森园'],
          parentName: '科城山庄',
          phase: '三期',
          phaseLabel: '三期 · 峻森园',
          district: '黄埔区',
          latitude: 23.191512,
          longitude: 113.481216,
          householdCount: 3020,
          developer: '广州峻森投资有限公司',
          address: '广州市黄埔区水西路、峻泰路一带',
          sourceUrl: 'https://www.hp.gov.cn/gkmlpt/content/5/5053/post_5053624.html',
          sourceLabel: '黄埔区政府公开答复（三期峻森园，规划约3020户）'
        }
      ],
      records: {
        '大壮名城': {},
        '星樾山畔': {},
        '星月山畔': { aliasOf: '星樾山畔' },
        '科城山庄峻森园': {},
        '科城山庄': { type: 'parent', hasPhases: true },
        '高新仕林苑': {},
        '仕林花园': { aliasOf: '高新仕林苑' },
        '品秀星樾': {},
        '品秀新苑': { aliasOf: '品秀星樾' },
        '星樾花园': { aliasOf: '品秀星樾' }
      }
    }
  }
};
