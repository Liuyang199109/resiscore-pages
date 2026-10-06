const factors = [
  {
    id: 'transport',
    name: '交通位置',
    short: '交通位置',
    weight: 15,
    score: null,
    subscores: [
      { id: 'station-distance', name: '地铁站距离组合', score: null, max: 50, points: null, configuredMaxPoints: 10, current: '正在加载广州交通数据' },
      { id: 'station-level', name: '地铁站等级组合', score: null, max: 50, points: null, configuredMaxPoints: 5, current: '正在加载广州交通数据' }
    ]
  },
  {
    id: 'center',
    name: '地理位置',
    short: '地理位置',
    weight: 15,
    distanceKm: null,
    peakTransitMinutes: null,
    subscores: [
      { id: 'cbd-distance', name: '到市级 CBD 直线距离', max: 50, current: '待匹配小区坐标' },
      { id: 'peak-transit-time', name: '高峰公共交通时间', max: 50, current: '待补充路线时间' }
    ]
  },
  {
    id: 'school',
    name: '学区资源',
    short: '学区资源',
    weight: 15,
    score: 0,
    // 学区资源和其他多分项维度保持同样的人工修正方式：
    // 上方直接修改小学、初中各自的实际贡献分，维度总分按九年制加成自动计算。
    subscores: [
      { id: 'school-elementary', name: '小学', max: 100, points: 7.5, current: '待补充小学排名数据' },
      { id: 'school-middle', name: '初中', max: 100, points: 7.5, current: '待补充初中排名数据' }
    ]
  },
  // 单价示例按元/㎡记录；最终得分会根据当前维度权重换算。
  { id: 'price', name: '单价压力', short: '单价压力', weight: 20, pricePerSqm: null },
  {
    id: 'life',
    name: '生活配套',
    short: '生活配套',
    weight: 15,
    subscores: [
      { id: 'commercial', name: '2km 商业店铺', maxPoints: 5, points: null, current: '待匹配小区' },
      { id: 'dining', name: '2km 餐饮店铺', maxPoints: 4, points: null, current: '待匹配小区' },
      { id: 'mature-mall', name: '大型成熟商场加分', maxPoints: 3, points: null, current: '待匹配小区' },
      { id: 'tertiary-hospital', name: '最近三级医院', maxPoints: 2, points: null, current: '待匹配小区' },
      { id: 'local-medical', name: '最近基层医疗', maxPoints: 1, points: null, current: '待匹配小区' },
      { id: 'park', name: '最近公园', maxPoints: 3, points: null, current: '待匹配小区' }
    ]
  },
  {
    id: 'quality',
    name: '小区品质',
    short: '小区品质',
    weight: 15,
    // 各子项的 points 是该项对“小区品质”维度的实际贡献上限。
    // score 使用 0–100 百分制，便于在人工修正模式下按实际情况录入。
    subscores: [
      { id: 'age', name: '小区老旧程度', score: null, max: 100, points: 4, current: '待补充房龄数据' },
      { id: 'greenery', name: '小区绿化情况', score: null, max: 100, points: 2, current: '待补充绿化数据' },
      { id: 'elevator-household', name: '小区梯户比', score: null, max: 100, points: 2, current: '待补充梯户比数据' },
      { id: 'noise', name: '噪音情况', score: null, max: 100, points: 2, current: '待现场评估' },
      { id: 'max-floor', name: '最高层数', score: null, max: 100, points: 2, current: '待补充楼栋数据' },
      { id: 'floorplan-quality', name: '房型质量', score: 100, max: 100, points: 1, current: '未发现公开吐槽，默认 1 分' },
      { id: 'developer', name: '开发商品牌', score: null, max: 100, points: 1, current: '待补充开发商数据' },
      { id: 'floor-height', name: '层高', score: null, max: 100, points: 1, current: '待补充楼栋数据' }
    ]
  },
  {
    id: 'future',
    name: '未来潜力',
    short: '未来潜力',
    weight: 5,
    // 未来潜力不再使用单一总分，按影响房价相对表现的四个因素加权。
    subscores: [
      { id: 'future-amenities', name: '生活配套成熟度', score: null, max: 100, points: 40, current: '待补充规划与兑现数据' },
      { id: 'future-transport', name: '交通兑现度', score: null, max: 100, points: 20, current: '待补充规划与开通节点' },
      { id: 'future-industry', name: '产业与人口导入', score: null, max: 100, points: 20, current: '待补充产业与人口数据' },
      { id: 'future-supply', name: '供需竞争压力', score: null, max: 100, points: 20, current: '待补充供应与去化数据' }
    ]
  }
];

// 七大维度在分项得分、权重调节、评分细则和横向对比中统一使用这一展示顺序。
// 保留稳定的内部 id，避免历史保存结果和原始数据覆盖失效。
const FACTOR_DISPLAY_ORDER = ['price', 'center', 'transport', 'school', 'quality', 'life', 'future'];
factors.sort((left, right) => FACTOR_DISPLAY_ORDER.indexOf(left.id) - FACTOR_DISPLAY_ORDER.indexOf(right.id));

// Automatic transport scoring has a deliberately asymmetric 10 + 5 point
// split.  It used to be deleted by setFactorWeights({ clearConfiguredCaps:
// true }), which silently changed the automatic model to 7.5 + 7.5 after a
// page load or weight reset.  Keep this in one place so the UI and exports
// always use the same caps.
const DEFAULT_AUTOMATIC_SUBSCORE_CAPS = {
  transport: { 'station-distance': 10, 'station-level': 5 }
};

function restoreAutomaticSubscoreCaps() {
  factors.forEach((factor) => {
    factor.subscores?.forEach((subscore) => {
      const baseCap = DEFAULT_AUTOMATIC_SUBSCORE_CAPS[factor.id]?.[subscore.id];
      if (Number.isFinite(Number(baseCap))) {
        const baseWeight = Object.values(DEFAULT_AUTOMATIC_SUBSCORE_CAPS[factor.id] || {})
          .reduce((sum, value) => sum + Number(value || 0), 0);
        const weight = Number(factor.weight);
        const scaledCap = Number.isFinite(weight) && baseWeight > 0
          ? Number(baseCap) * weight / baseWeight
          : Number(baseCap);
        subscore.configuredMaxPoints = round1(scaledCap);
      }
      else delete subscore.configuredMaxPoints;
    });
  });
}

// 统一读取公共数据：浏览器使用静态文件或 RESISCORE_DATA_BASE_URL，
// 微信运行时使用 wx.request。所有广州包都保留随版本发布的内置回退，
// 避免某一个远端文件暂时未同步时把已经存在的数据显示成“待补充”。
function joinDataUrl(path) {
  const base = globalThis.RESISCORE_DATA_BASE_URL || '';
  if (/^https?:\/\//i.test(path) || !base) return path;
  return `${String(base).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
}

function requestAppJson(path) {
  const target = joinDataUrl(path);
  if (typeof wx !== 'undefined' && typeof wx.request === 'function') {
    return new Promise((resolve, reject) => {
      wx.request({
        url: target,
        method: 'GET',
        dataType: 'json',
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
          else reject(new Error(`HTTP ${response.statusCode}`));
        },
        fail: reject
      });
    });
  }
  return fetch(target, { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
}

function activeDataLoad(token, cityId) {
  return token === state.dataLoadToken && cityId === state.cityId;
}

// 学区资源数据优先使用已登记来源；官方排名缺失时使用数据包中的中性估值，并允许用户覆盖。
// 正式排名口径固定为广州市全市、同一学段的学校池；黄埔区区内名次不能直接代替全市名次。
// 排名分按全市学校名次线性映射到 0–100 分：第 1 名 100 分，末位 0 分。
const SCHOOL_RANKING_SCOPE = '广州市全市（同一学段）';
const schoolDistrict = {
  elementary: {
    label: '小学',
    mode: 'fixed',
    schools: [{ name: '', rank: null, totalSchools: null, probability: 1 }],
    manualPoints: null,
    manualPointsEdited: false
  },
  middle: {
    label: '初中',
    mode: 'lottery',
    schools: [{ name: '', rank: null, totalSchools: null, probability: null }],
    manualPoints: null,
    manualPointsEdited: false
  },
  // null 表示尚未从招生文件确认，必须由数据源或用户明确选择“是/否”。
  nineYearContinuity: null,
  // 第三方“附近学校”候选不会覆盖官方招生地段；使用时按待确认摇号候选处理。
  mappingMeta: {
    provisional: false,
    elementary: 'missing',
    middle: 'missing',
    sourceUrls: [],
    notice: '',
    unclassifiedSchools: []
  }
};

const rules = [
  {
    id: 'transport',
    summary: '筛选小区主要出入口 1.5km 内的步行地铁路线；有已登记地图路线时直接使用，其他有坐标的小区自动按小区中心与地铁站坐标估算并标明来源。距离按“最高分 + 其他站点分 × 0.5”组合并折合 10 分，站点等级按同一方式组合并折合 5 分，交通位置最终封顶 15 分',
    sections: [
      {
        title: '1.5km 内地铁站步行距离组合（展示满分 10）',
        bands: [
          ['优秀', '步行距离 ≤ 300m', '9.2–10 分'],
          ['良好', '步行距离 301–500m', '8.4–9.2 分'],
          ['中等', '步行距离 501–800m', '7–8.4 分'],
          ['偏弱', '步行距离 801–1,200m', '5–7 分'],
          ['较弱', '步行距离 1,201–1,500m', '3.3–5 分'],
          ['组合规则', '最高站点距离分 + 0.5 × 其余站点距离分之和', '原始分封顶 50'],
          ['范围', '只纳入主要出入口到可用地铁出入口 ≤ 1,500m 的路线', '距离项封顶 10 分']
        ]
      },
      {
        title: '1.5km 内地铁站等级组合（展示满分 5）',
        bands: [
          ['核心枢纽', '位于中心区域，3 条及以上线路换乘或城市级枢纽', '4.2–5 分'],
          ['重点换乘', '2 条线路换乘，或连接重要就业 / 商业板块', '3.2–4.1 分'],
          ['普通站点', '单线站点，但周边仍有稳定生活与通勤需求', '2–3.1 分'],
          ['远郊站点', '单线普通站，距城市中心较远且换乘价值有限', '0–1.9 分'],
          ['组合规则', '最高站点等级分 + 0.5 × 其余站点等级分之和，再按 5 分上限折算', '等级项封顶 5 分'],
          ['数据要求', '每条路线保存起点入口、站点出入口、来源、日期和路线质量', '估算值可由用户修正']
        ]
      }
    ]
  },
  {
    id: 'center',
    summary: '广州以天河中央商务区（天河北、珠江新城、广州国际金融城）为目标区域；CBD 距离按当前小区坐标计算，高峰公共交通暂无授权路线时按 CBD 距离生成带“估算”标记的代理时间。',
    sections: [
      {
        title: '到市级 CBD 直线距离（贡献满分 7.5）',
        bands: [
          ['核心', '≤ 3km，按满分计', '7.5'],
          ['近距', '3–8km，按区间线性递减', '6.3–7.5'],
          ['中距', '8–15km，按区间线性递减', '4.8–6.3'],
          ['偏远', '15–25km，按区间线性递减', '2.7–4.8'],
          ['远距', '> 25km，最低保留 0 分', '0–2.7']
        ]
      },
      {
        title: '高峰公共交通时间（贡献满分 7.5）',
        bands: [
          ['优秀', '≤ 25分钟，按满分计', '7.5'],
          ['良好', '25–35分钟，按区间线性递减', '6.3–7.5'],
          ['中等', '35–50分钟，按区间线性递减', '4.8–6.3'],
          ['偏弱', '50–70分钟，按区间线性递减', '2.7–4.8'],
          ['较弱', '> 70分钟，最低保留 0 分', '0–2.7']
        ]
      }
    ]
  },
  { id: 'school', summary: '小学、初中分别按广州市全市排名计分；确定学位直接取分，摇号按概率加权后 ×0.8，九年连读再 ×1.2', bands: [['确定学位', '直接进入对应学校，学校排名分即为该学段得分', '按广州全市排名'], ['摇号入学', 'Σ（学校排名分 × 摇号概率）× 0.8', '不确定性折减'], ['九年连读', '小学与初中合成分 × 1.2（最终分数保持 100 分制）', '鼓励连读']] },
  { id: 'price', summary: '单价按 1 万–10 万元/㎡区间幂函数换算，低价段更敏感；优先使用社区离线评分或本地挂牌/成交单价，均未命中时再输入单价。' },
  { id: 'life', summary: '生活配套基础满分 15 分：2km 商业 5 分、2km 餐饮 4 分、医疗 3 分、公园 3 分；大型成熟商场为额外加分，1 个加 2 分、2 个及以上加 3 分，最终封顶 15 分' },
  {
    id: 'quality',
    summary: '小区品质满分 15 分，读取广州公开小区目录明确字段。建成年代和知名开发商可直接评分；绿化率、噪音、房型质量和层高按评分规则计算。开发商已填写但暂未命中品牌表时按 0.5 分临时计分并标记待确认；房型质量默认 1 分，发现公开吐槽房型不好时计 0 分。',
    sections: [
      { title: '小区老旧程度（满分 4 分）', bands: [
        ['4 分', '新房，或小区建成不超过 2 年', '4'],
        ['3 分', '超过 2 年且不超过 5 年', '3'],
        ['2 分', '超过 5 年且不超过 10 年', '2'],
        ['1 分', '超过 10 年且不超过 20 年', '1'],
        ['0 分', '超过 20 年', '0']
      ] },
      { title: '小区绿化情况（满分 2 分）', bands: [
        ['2 分', '绿化率 ≥ 40%，按满分计', '2'],
        ['1.5–2 分', '绿化率 30%–40%，区间内线性换算', '1.5–2'],
        ['1–1.5 分', '绿化率 20%–30%，区间内线性换算', '1–1.5'],
        ['0–1 分', '绿化率 0%–20%，区间内线性换算', '0–1']
      ] },
      { title: '小区梯户比（满分 2 分）', bands: [
        ['2 分', '单梯服务户数少于 50 户', '2'],
        ['1 分', '单梯服务户数 50–80 户', '1'],
        ['0 分', '单梯服务户数大于 80 户', '0']
      ] },
      { title: '噪音情况（满分 2 分）', bands: [
        ['2 分', '实测噪音 ≤ 45 dB，按满分计', '2'],
        ['1.5–2 分', '45–55 dB，区间内线性换算', '1.5–2'],
        ['1–1.5 分', '55–65 dB，区间内线性换算', '1–1.5'],
        ['0–1 分', '65–75 dB，区间内线性换算', '0–1'],
        ['0 分', '实测噪音 ≥ 75 dB', '0']
      ] },
      { title: '最高层数（满分 2 分）', bands: [
        ['2 分', '最高层数小于 25 层', '2'],
        ['1 分', '最高层数 25–32 层', '1'],
        ['0 分', '最高层数 33 层及以上', '0']
      ] },
      { title: '房型质量（满分 1 分）', bands: [
        ['1 分', '未在公开网页、问答或评论中发现房型不好的吐槽，按默认值计满分', '1'],
        ['0 分', '公开网页、问答或评论中发现明确的房型不好吐槽，计 0 分；可人工复核后修改', '0']
      ] },
      { title: '开发商品牌（满分 1 分）', bands: [
        ['1 分', '开发商属于知名品牌', '1'],
        ['0.5 分', '已有开发商名称但暂未命中知名品牌表；按中性临时值计分，待确认后可人工调整', '0.5'],
        ['0 分', '已确认开发商属于普通品牌，或明确没有可识别的品牌优势', '0']
      ] },
      { title: '层高（满分 1 分）', bands: [
        ['1 分', '住宅层高 ≥ 3 米，按满分计', '1'],
        ['0–1 分', '2–3 米，按实际米数线性换算；2.8 米为 0.8 分，2.3 米为 0.3 分', '0–1'],
        ['0 分', '住宅层高 ≤ 2 米', '0']
      ] }
    ]
  },
  {
    id: 'future',
    summary: '优先使用小区/项目级公开规划证据；缺少逐小区字段时，广州11区使用有来源的片区代理。生活配套与交通兑现度取当前小区公开点位和路线结果，产业人口与供需使用官方片区规划，并在结果中标明“区域代理”。',
    sections: [
      { title: '生活配套成熟度（贡献 40%）', bands: [['优秀', '商场、餐饮、医疗和日常服务已形成成熟生活圈', '80–100'], ['较好', '主要配套基本齐全，仍有少量项目待兑现', '60–80'], ['中等', '基础配套可用，但大型商业或服务存在缺口', '40–60'], ['偏弱', '主要依赖周边板块，生活便利性不足', '20–40'], ['较弱', '配套明显滞后，短期难以改善', '0–20']] },
      { title: '交通兑现度（贡献 20%）', bands: [['优秀', '核心轨道或快速路已开通，通勤优势稳定', '80–100'], ['较好', '已有轨道基础，未来 3 年有明确兑现节点', '60–80'], ['中等', '交通规划在推进，但兑现时间存在不确定性', '40–60'], ['偏弱', '主要依赖自驾或接驳，轨道兑现较远', '20–40'], ['较弱', '交通改善主要停留在远期规划', '0–20']] },
      { title: '产业与人口导入（贡献 20%）', bands: [['优秀', '成熟产业集群和持续就业人口已形成', '80–100'], ['较好', '产业基础较强，仍有明确扩容和导入计划', '60–80'], ['中等', '有产业规划，但人口导入速度尚不确定', '40–60'], ['偏弱', '产业距离较远，人口主要依赖住宅开发', '20–40'], ['较弱', '缺少稳定产业支撑', '0–20']] },
      { title: '供需竞争压力（贡献 20%）', bands: [['优秀', '新增供应有限，配套和就业能持续吸收需求', '80–100'], ['较好', '供应适中，去化压力可控', '60–80'], ['中等', '未来供应较多，涨幅可能被部分稀释', '40–60'], ['偏弱', '新房集中上市或去化偏慢，二手房承压', '20–40'], ['较弱', '供给明显过剩，短期存在价格下行压力', '0–20']] }
    ]
  }
];

// 评分细则卡片与分项得分共用七大维度展示顺序。
rules.sort((left, right) => FACTOR_DISPLAY_ORDER.indexOf(left.id) - FACTOR_DISPLAY_ORDER.indexOf(right.id));

const CITY_DATA_KEY = 'resiscore.cityData.v1';
const CUSTOM_CITY_KEY = 'resiscore.customCities.v1';
const CITY_CATALOG = [
  { id: 'guangzhou', name: '广州', subtitle: '当前城市 · 数据已就绪' },
  { id: 'shanghai', name: '上海', subtitle: '超大城市 · 需要下载数据' },
  { id: 'beijing', name: '北京', subtitle: '超大城市 · 需要下载数据' },
  { id: 'shenzhen', name: '深圳', subtitle: '一线城市 · 需要下载数据' },
  { id: 'hangzhou', name: '杭州', subtitle: '新一线城市 · 需要下载数据' },
  { id: 'chengdu', name: '成都', subtitle: '新一线城市 · 需要下载数据' }
];
const CITY_DATA_PACKS = ['交通路网与站点', 'CBD 与通勤基准', '广州 11 区招生来源索引（黄埔、荔湾、花都、南沙已标准化）', '广州公开小区均价包（估算）', '多来源小区证据与聚合索引', '商业医疗与公园', '小区品质与物业', '广州11区公开规划代理包（未来潜力）', '社区级离线评分索引'];
// These keys are retained only so the one-time startup migration can remove
// implicit overrides written by older builds. New manual edits live in memory
// until the explicit post-save consent writes the confirmed layer below.
const RAW_INPUT_OVERRIDES_KEY = 'resiscore.rawInputOverrides.v2';
const LEGACY_RAW_INPUT_OVERRIDES_KEY = 'resiscore.rawInputOverrides.v1';
// Every scalar raw-input field must carry explicit provenance before it can
// survive a browser restart.  Older builds wrote automatic life/quality
// distances into the same object as manual edits, so filtering only the CBD
// pair would still allow stale hospital/park values to override the package.
const CONFIRMED_RAW_OVERRIDE_FIELDS = new Set([
  'pricePerSqm',
  'centerDistanceKm', 'centerTransitMinutes',
  'buildYear', 'greenRate', 'ladderHouseholdRatio', 'noiseDb', 'maxFloor', 'layoutQuality', 'developer', 'floorHeight',
  'commercialCount', 'diningCount', 'matureMallCount', 'tertiaryDistanceKm', 'localMedicalDistanceKm', 'parkDistanceKm',
  'futureRaw:future-amenities', 'futureRaw:future-transport', 'futureRaw:future-industry', 'futureRaw:future-supply'
]);
// Only this explicitly confirmed layer survives a browser restart.  The v1/v2
// stores are cleared at startup because they predate the consent prompt.
const CONFIRMED_OFFLINE_OVERRIDES_KEY = 'resiscore.confirmedOfflineOverrides.v2';
const LEGACY_CONFIRMED_OFFLINE_OVERRIDES_KEY = 'resiscore.confirmedOfflineOverrides.v1';
const MANUAL_OVERRIDE_RESET_KEY = 'resiscore.manualOverrideReset.v1';
const WEIGHT_PREFERENCES_KEY = 'resiscore.weightPreferences.v1';
// Keep the last evaluated workspace across a full-page refresh.  This stores
// only the selected city and community name; all score inputs continue to be
// rebuilt from the published packages and the confirmed override layer.
const ACTIVE_VIEW_KEY = 'resiscore.activeView.v1';
// These are the model defaults. Keep them separate from the mutable factor
// objects so “恢复默认值” can reliably clear a saved profile.
const DEFAULT_FACTOR_WEIGHTS = Object.freeze({
  price: 20,
  center: 15,
  transport: 15,
  school: 15,
  quality: 15,
  life: 15,
  future: 5
});
// 自动更新按 30 天检查一次；用户点击按钮时会立即检查，不受这个间隔限制。
const CITY_DATA_AUTO_UPDATE_MS = 30 * 24 * 60 * 60 * 1000;
let cityDataRefreshPromise = null;
const state = {
  property: '大壮名城',
  cityId: 'guangzhou',
  transportData: null,
  amenityData: null,
  priceData: null,
  communityQualityData: null,
  futureData: null,
  multiSourceData: null,
  amenityLookup: { query: '', match: null, error: '' },
  schoolDistrictData: null,
  schoolDistrictManifest: null,
  schoolDistrictId: 'huangpu',
  schoolDistrictPackages: {},
  schoolLookup: { query: '', elementary: [], middle: [], notices: [], error: '' },
  manualMode: false,
  savedResults: [],
  compareResults: [],
  favoriteResults: [],
  cityData: {},
  // Every city/data load gets a generation token. A slower response from a
  // previous city must never overwrite the currently selected city's score.
  dataLoadToken: 0,
  missingPromptProperty: '',
  // When a saved/compare snapshot is loaded, keep its origin so “保存结果”
  // can ask whether to replace that historical record or create a copy.
  editingSnapshotContext: null,
  // During a workspace refresh, raw values belong to the selected snapshot,
  // not to whichever same-named community is currently open in the editor.
  refreshingSnapshotContext: null,
  // A historical result may temporarily use its own weight profile. This
  // override is cleared as soon as the user starts another evaluation.
  historyWeightOverride: null,
  // Manual source-value edits stay in memory until the user explicitly
  // chooses to sync them to the local offline override cache after saving a
  // result.  This keeps test edits from silently changing later searches.
  rawInputDrafts: {},
  transportOverrideDrafts: {},
  schoolDistrictDirty: false
};
const $ = (sel) => document.querySelector(sel);
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
// 页面与输入框统一最多保留两位小数；整数和末尾 0 不强制显示多余位数。
const formatNumber = (value, decimals = 2) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value === null || value === undefined ? '' : String(value);
  const places = Math.max(0, Math.min(2, Number.isFinite(Number(decimals)) ? Number(decimals) : 2));
  const factor = 10 ** places;
  const rounded = Math.round((number + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

function readWeightPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(WEIGHT_PREFERENCES_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function weightProfileForCity(cityId = state.cityId) {
  const stored = readWeightPreferences()[cityId];
  return stored?.weights && typeof stored.weights === 'object' ? stored : null;
}

function latestWeightProfileForCity(cityId = state.cityId) {
  const saved = weightProfileForCity(cityId)?.weights || {};
  return Object.fromEntries(factors.map((factor) => {
    const value = Number(saved[factor.id]);
    return [factor.id, Number.isFinite(value) && value > 0 ? round1(value) : DEFAULT_FACTOR_WEIGHTS[factor.id]];
  }));
}

function weightVectorsEqual(left = {}, right = {}) {
  return factors.every((factor) => round1(Number(left[factor.id]) || 0) === round1(Number(right[factor.id]) || 0));
}

function setFactorWeights(weights = {}, { clearConfiguredCaps = false } = {}) {
  factors.forEach((factor) => {
    const value = Number(weights[factor.id]);
    factor.weight = Number.isFinite(value) && value > 0 ? round1(Math.min(100, value)) : DEFAULT_FACTOR_WEIGHTS[factor.id];
    if (clearConfiguredCaps) factor.subscores?.forEach((subscore) => delete subscore.configuredMaxPoints);
  });
  if (clearConfiguredCaps) restoreAutomaticSubscoreCaps();
}

function applyWeightPreferenceForCity(cityId = state.cityId) {
  const profile = weightProfileForCity(cityId);
  setFactorWeights(profile?.weights || DEFAULT_FACTOR_WEIGHTS, { clearConfiguredCaps: true });
  renderWeightProfileStatus();
}

function renderWeightProfileStatus() {
  const status = $('#weightProfileStatus');
  if (!status) return;
  if (state.historyWeightOverride) {
    status.textContent = state.historyWeightOverride.modified
      ? '当前编辑中的历史权重已调整；搜索新小区后恢复已保存权重'
      : '当前使用历史记录权重，本次仅用于编辑；搜索新小区后恢复已保存权重';
    status.classList.remove('is-saved');
    return;
  }
  const profile = weightProfileForCity();
  const matchesSavedProfile = Boolean(profile && factors.every((factor) => (
    round1(Number(factor.weight) || 0) === round1(Number(profile.weights?.[factor.id]) || 0)
  )));
  status.textContent = !profile
    ? '当前使用默认权重'
    : matchesSavedProfile
      ? `已保存当前权重${profile.savedAt ? ` · ${String(profile.savedAt).slice(0, 10)}` : ''}，后续${cityMeta().name}小区沿用`
      : `当前权重有未保存调整，点击“保存权重”后供后续${cityMeta().name}小区沿用`;
  status.classList.toggle('is-saved', matchesSavedProfile);
}

function saveWeightPreference() {
  const total = totalWeight();
  if (!Number.isFinite(total)) return;
  state.historyWeightOverride = null;
  const stored = readWeightPreferences();
  stored[state.cityId] = {
    weights: Object.fromEntries(factors.map((factor) => [factor.id, round1(Number(factor.weight) || 0)])),
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(WEIGHT_PREFERENCES_KEY, JSON.stringify(stored));
    renderWeightProfileStatus();
    showToast(`已保存${cityMeta().name}权重，后续小区将沿用`);
  } catch (error) {
    showToast('权重保存失败，请检查浏览器本地存储权限');
  }
}

function resetWeightPreference() {
  state.historyWeightOverride = null;
  const stored = readWeightPreferences();
  delete stored[state.cityId];
  try {
    if (Object.keys(stored).length) localStorage.setItem(WEIGHT_PREFERENCES_KEY, JSON.stringify(stored));
    else localStorage.removeItem(WEIGHT_PREFERENCES_KEY);
  } catch (error) { /* 即使本地存储不可用，也恢复当前会话的默认权重 */ }
  // Use the existing proportional adjustment logic while manual mode is on,
  // then clear custom subscore caps so the default allocation is restored too.
  factors.forEach((factor) => applyFactorWeightChange(factor, DEFAULT_FACTOR_WEIGHTS[factor.id]));
  setFactorWeights(DEFAULT_FACTOR_WEIGHTS, { clearConfiguredCaps: true });
  renderWeights();
  renderScore();
  renderWeightProfileStatus();
  showToast(`已恢复${cityMeta().name}默认权重`);
}
const PRICE_SCORE_MIN = 1;
const PRICE_PER_SQM_MIN = 10000;
const PRICE_PER_SQM_MAX = 100000;
const PRICE_CURVE_EXPONENT = 2.2;
// 商业和餐饮按住宅点位周边 2km 统计；医疗、公园仍按最近点位距离评分。
const LIFE_SHOP_RADIUS_KM = 2;
const LIFE_BASE_MAX_POINTS = 15;
const LIFE_BONUS_SUBSCORE_ID = 'mature-mall';

function lifeWeightScale(factor) {
  const weight = Number(factor?.weight);
  return Number.isFinite(weight) && LIFE_BASE_MAX_POINTS > 0 ? weight / LIFE_BASE_MAX_POINTS : 1;
}

function lifeSubscoreScale(factor, subscore) {
  return subscore?.id === LIFE_BONUS_SUBSCORE_ID ? 1 : lifeWeightScale(factor);
}

function lifeScaledTotal(factor) {
  const detail = lifeResourceBreakdown();
  if (!detail.ready || !factor?.subscores?.length) return null;
  const values = factor.subscores.map((subscore) => subscorePoints(factor, subscore));
  if (values.some((value) => !Number.isFinite(value))) return null;
  return round1(Math.min(Number(factor.weight) || LIFE_BASE_MAX_POINTS, values.reduce((sum, value) => sum + value, 0)));
}

function readConfirmedOfflineOverridePackage() {
  try {
    const parse = (key) => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        return value && typeof value === 'object' ? value : {};
      } catch (error) {
        return {};
      }
    };
    const parsed = parse(CONFIRMED_OFFLINE_OVERRIDES_KEY);
    const legacy = parse(LEGACY_CONFIRMED_OFFLINE_OVERRIDES_KEY);
    const legacyRaw = legacy.raw && typeof legacy.raw === 'object' ? cloneRuntimeValue(legacy.raw) : {};
    // v1 had no provenance and may contain automatic values from any scoring
    // block.  It is therefore unsafe to retain any scalar raw field from it;
    // the active offline package is the only valid fallback.
    Object.values(legacyRaw).forEach((cityRecords) => {
      if (!cityRecords || typeof cityRecords !== 'object') return;
      Object.values(cityRecords).forEach((record) => {
        if (!record || typeof record !== 'object') return;
        Object.keys(record).forEach((field) => delete record[field]);
      });
    });
    const currentRaw = parsed.raw && typeof parsed.raw === 'object' ? cloneRuntimeValue(parsed.raw) : {};
    const currentRawProvenance = parsed.rawProvenance && typeof parsed.rawProvenance === 'object'
      ? parsed.rawProvenance : {};
    // v2 was introduced during the migration to the confirmed override layer,
    // but records written by the first v2 build had no field-level provenance.
    // They could therefore contain automatic CBD, hospital, park, quality or
    // price values. Keep only fields explicitly written by the new sync path.
    Object.entries(currentRaw).forEach(([cityId, cityRecords]) => {
      if (!cityRecords || typeof cityRecords !== 'object') return;
      const provenanceCity = currentRawProvenance?.[cityId] || {};
      Object.entries(cityRecords).forEach(([propertyKey, record]) => {
        if (!record || typeof record !== 'object') return;
        const provenance = provenanceCity?.[propertyKey] || {};
        Object.keys(record).forEach((field) => {
          if (!CONFIRMED_RAW_OVERRIDE_FIELDS.has(field)
            || provenance[field] !== SNAPSHOT_RAW_OVERRIDE_PROVENANCE) delete record[field];
        });
        if (!Object.keys(record).length) delete cityRecords[propertyKey];
      });
      if (!Object.keys(cityRecords).length) delete currentRaw[cityId];
    });
    return {
      raw: { ...legacyRaw, ...currentRaw },
      rawProvenance: currentRawProvenance,
      transport: {
        ...(legacy.transport && typeof legacy.transport === 'object' ? legacy.transport : {}),
        ...(parsed.transport && typeof parsed.transport === 'object' ? parsed.transport : {})
      },
      school: {
        ...(legacy.school && typeof legacy.school === 'object' ? legacy.school : {}),
        ...(parsed.school && typeof parsed.school === 'object' ? parsed.school : {})
      }
    };
  } catch (error) {
    return { raw: {}, transport: {} };
  }
}

function writeConfirmedOfflineOverridePackage(value) {
  try {
    localStorage.setItem(CONFIRMED_OFFLINE_OVERRIDES_KEY, JSON.stringify({
      schemaVersion: 2,
      raw: value?.raw && typeof value.raw === 'object' ? value.raw : {},
      rawProvenance: value?.rawProvenance && typeof value.rawProvenance === 'object' ? value.rawProvenance : {},
      transport: value?.transport && typeof value.transport === 'object' ? value.transport : {},
      school: value?.school && typeof value.school === 'object' ? value.school : {}
    }));
    return true;
  } catch (error) {
    return false;
  }
}

function clearLegacyOfflineOverrideStores() {
  try {
    // One-time cleanup for values created before the current consent flow.
    // After this marker is written, newly confirmed overrides are allowed to
    // persist normally in the v2 layer.
    if (localStorage.getItem(MANUAL_OVERRIDE_RESET_KEY) === 'done') return;
    localStorage.removeItem(RAW_INPUT_OVERRIDES_KEY);
    localStorage.removeItem(LEGACY_RAW_INPUT_OVERRIDES_KEY);
    localStorage.removeItem(TRANSPORT_OVERRIDES_KEY);
    localStorage.removeItem(CONFIRMED_OFFLINE_OVERRIDES_KEY);
    localStorage.removeItem(LEGACY_CONFIRMED_OFFLINE_OVERRIDES_KEY);
    localStorage.setItem(MANUAL_OVERRIDE_RESET_KEY, 'done');
  } catch (error) { /* 浏览器禁用本地存储时忽略清理 */ }
}

function migrateConfirmedOfflineOverrideStore() {
  try {
    const legacyPresent = Boolean(localStorage.getItem(LEGACY_CONFIRMED_OFFLINE_OVERRIDES_KEY));
    const currentPresent = Boolean(localStorage.getItem(CONFIRMED_OFFLINE_OVERRIDES_KEY));
    if (!legacyPresent && !currentPresent) return;
    // readConfirmedOfflineOverridePackage() already removes unproven center
    // fields from both generations. Rewrite the sanitized result so the old
    // 11.1/50 pair cannot be resurrected by a later history load.
    const sanitized = readConfirmedOfflineOverridePackage();
    if (writeConfirmedOfflineOverridePackage(sanitized)) {
      localStorage.removeItem(LEGACY_CONFIRMED_OFFLINE_OVERRIDES_KEY);
    }
  } catch (error) { /* 本地存储不可用时继续使用当前页面数据 */ }
}

function readRawInputOverride(query = state.property) {
  try {
    const stored = readConfirmedOfflineOverridePackage().raw || {};
    // 同一小区的规范名和别名共用人工修正值。旧版本按用户输入名保存的值
    // 仍会被读取，后续保存时统一写入规范名，避免“星樾花园”和“品秀星樾”各有一套修正值。
    const lookupKeys = typeof communityRawOverrideKeys === 'function'
      ? communityRawOverrideKeys(query)
      : [query];
    const record = lookupKeys.reduce((merged, key) => {
      const currentRecord = stored?.[state.cityId]?.[key] && typeof stored[state.cityId][key] === 'object'
        ? stored[state.cityId][key] : {};
      return { ...merged, ...currentRecord };
    }, {});
    // Drafts shadow persisted values, including an explicit null used to
    // clear an old override during this session.
    const drafts = lookupKeys.reduce((merged, key) => ({
      ...merged,
      ...(state.rawInputDrafts?.[state.cityId]?.[key] && typeof state.rawInputDrafts[state.cityId][key] === 'object'
        ? state.rawInputDrafts[state.cityId][key] : {})
    }), {});
    Object.entries(drafts).forEach(([field, value]) => {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) delete record[field];
      else record[field] = value;
    });
    const context = state.refreshingSnapshotContext;
    const contextMatches = context && context.cityId === state.cityId &&
      (context.property === query || communityCanonicalName(context.property) === communityCanonicalName(query));
    const contextOverrides = contextMatches && context.rawOverrides && typeof context.rawOverrides === 'object'
      ? context.rawOverrides : null;
    if (!Object.keys(record).length && !contextOverrides) return {};
    const merged = contextMatches && context.rawOverridesIsolated
      ? {}
      : { ...(record && typeof record === 'object' ? record : {}) };
    if (contextOverrides) {
      Object.entries(contextOverrides).forEach(([field, value]) => {
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) delete merged[field];
        else merged[field] = value;
      });
    }
    // Legacy versions stored an explicit null when an input was cleared.
    // Treat that as “no override” so the source value can be restored.
    return Object.fromEntries(Object.entries(merged).filter(([, value]) => {
      return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');
    }));
  } catch (error) {
    return {};
  }
}

function persistRawInputOverride(query, values) {
  if (!query) return;
  // When editing a historical snapshot, its raw values are temporarily kept
  // in an isolated context so a normal lookup cannot overwrite the record.
  // Keep that context in sync with the input the user just changed. In
  // particular, clearing an input must remove the historical override and
  // reveal the current database value instead of immediately restoring the
  // stale snapshot value.
  const context = state.refreshingSnapshotContext;
  const contextMatches = context && context.cityId === state.cityId &&
    (context.property === query || communityCanonicalName(context.property) === communityCanonicalName(query));
  if (contextMatches) {
    context.rawOverrides ||= {};
    Object.entries(values || {}).forEach(([field, value]) => {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) delete context.rawOverrides[field];
      else context.rawOverrides[field] = value;
    });
  }
  // Keep a tombstone for cleared fields so an older persisted override does
  // not reappear while the user is testing a replacement value.  The draft
  // is committed by syncPendingUserOverrides() only after explicit consent.
  state.rawInputDrafts ||= {};
  state.rawInputDrafts[state.cityId] ||= {};
  const saveKey = typeof communityCanonicalName === 'function' ? communityCanonicalName(query) : query;
  const next = { ...(state.rawInputDrafts[state.cityId][saveKey] || {}) };
  Object.entries(values || {}).forEach(([field, value]) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) next[field] = null;
    else next[field] = value;
  });
  if (Object.keys(next).length) state.rawInputDrafts[state.cityId][saveKey] = next;
  else delete state.rawInputDrafts[state.cityId][saveKey];
}

function rawInputDraftForProperty(query = state.property) {
  const lookupKeys = typeof communityRawOverrideKeys === 'function'
    ? communityRawOverrideKeys(query)
    : [typeof communityCanonicalName === 'function' ? communityCanonicalName(query) : query];
  return lookupKeys.reduce((merged, key) => ({
    ...merged,
    ...(state.rawInputDrafts?.[state.cityId]?.[key] || {})
  }), {});
}

function transportDraftForProperty(query = state.property) {
  const prefix = `${state.cityId}:${transportPropertyKey(query)}:`;
  return Object.fromEntries(Object.entries(state.transportOverrideDrafts || {})
    .filter(([key]) => key.startsWith(prefix)));
}

function pendingOfflineOverrideCount(snapshot) {
  const calculationState = snapshot?.calculationState || {};
  const raw = calculationState.pendingRawOverrides || {};
  const transport = calculationState.pendingTransportOverrides || {};
  return Object.keys(raw).length + Object.values(transport).filter((value) => value !== undefined).length
    + (calculationState.pendingSchoolDistrict ? 1 : 0);
}

function syncPendingUserOverrides(snapshot) {
  const calculationState = snapshot?.calculationState || {};
  const rawOverrides = calculationState.pendingRawOverrides || {};
  const transportOverrides = calculationState.pendingTransportOverrides || {};
  const school = calculationState.pendingSchoolDistrict;
  const packageData = readConfirmedOfflineOverridePackage();
  const rawStore = packageData.raw || {};
  const rawProvenanceStore = packageData.rawProvenance || {};
  const transportStore = packageData.transport || {};
  const schoolStore = packageData.school || {};
  const cityId = snapshot?.cityId || state.cityId;
  const sourceProperty = snapshot?.offlineOverrideProperty || snapshot?.property || state.property;
  const propertyKey = typeof communityCanonicalName === 'function'
    ? communityCanonicalName(sourceProperty)
    : sourceProperty;
  rawStore[cityId] ||= {};
  rawStore[cityId][propertyKey] ||= {};
  rawProvenanceStore[cityId] ||= {};
  rawProvenanceStore[cityId][propertyKey] ||= {};
  Object.entries(rawOverrides).forEach(([field, value]) => {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      delete rawStore[cityId][propertyKey][field];
      delete rawProvenanceStore[cityId][propertyKey][field];
    } else {
      rawStore[cityId][propertyKey][field] = value;
      if (CONFIRMED_RAW_OVERRIDE_FIELDS.has(field)) rawProvenanceStore[cityId][propertyKey][field] = SNAPSHOT_RAW_OVERRIDE_PROVENANCE;
    }
  });
  if (!Object.keys(rawStore[cityId][propertyKey]).length) delete rawStore[cityId][propertyKey];
  if (!Object.keys(rawStore[cityId]).length) delete rawStore[cityId];
  if (!Object.keys(rawProvenanceStore[cityId][propertyKey]).length) delete rawProvenanceStore[cityId][propertyKey];
  if (!Object.keys(rawProvenanceStore[cityId]).length) delete rawProvenanceStore[cityId];
  Object.entries(transportOverrides).forEach(([key, value]) => {
    if (value === null || value === undefined) delete transportStore[key];
    else transportStore[key] = value;
  });
  if (school && typeof school === 'object') {
    schoolStore[cityId] ||= {};
    schoolStore[cityId][propertyKey] = cloneRuntimeValue(school);
    schoolStore[cityId][propertyKey].mappingMeta = {
      ...(schoolStore[cityId][propertyKey].mappingMeta || {}),
      sourceKind: 'user-confirmed-offline',
      notice: '用户确认同步的本机离线覆盖'
    };
  }
  const saved = writeConfirmedOfflineOverridePackage({ raw: rawStore, rawProvenance: rawProvenanceStore, transport: transportStore, school: schoolStore });
  if (saved) {
    const draftKeys = typeof communityRawOverrideKeys === 'function' ? communityRawOverrideKeys(sourceProperty) : [propertyKey];
    draftKeys.forEach((key) => { if (state.rawInputDrafts?.[cityId]) delete state.rawInputDrafts[cityId][key]; });
    if (state.rawInputDrafts?.[cityId] && !Object.keys(state.rawInputDrafts[cityId]).length) delete state.rawInputDrafts[cityId];
    const transportPrefix = `${cityId}:${transportPropertyKey(sourceProperty)}:`;
    Object.keys(state.transportOverrideDrafts || {}).forEach((key) => {
      if (key.startsWith(transportPrefix)) delete state.transportOverrideDrafts[key];
    });
  }
  return saved;
}

function schoolRankScore(rank, totalSchools = 100) {
  const safeTotal = Math.max(1, Number(totalSchools) || 1);
  const safeRank = Math.min(Math.max(1, Number(rank) || safeTotal), safeTotal);
  const percentile = (safeRank - 1) / Math.max(1, safeTotal - 1);
  return round1(100 - percentile * 100);
}

function schoolLevelMissing(level) {
  const schools = level.schools || [];
  const missing = [];
  if (!schools.length) missing.push(`${level.label}学校`);
  schools.forEach((school, index) => {
    const prefix = `${level.label}第${index + 1}所学校`;
    if (!String(school.name || '').trim()) missing.push(`${prefix}名称`);
    if (!Number.isFinite(Number(school.rank)) || Number(school.rank) < 1) missing.push(`${prefix}全市排名`);
    if (!Number.isFinite(Number(school.totalSchools)) || Number(school.totalSchools) < 1 || Number(school.rank) > Number(school.totalSchools)) missing.push(`${prefix}全市学校总数`);
    if (level.mode === 'lottery' && (!Number.isFinite(Number(school.probability)) || Number(school.probability) < 0 || Number(school.probability) > 1)) missing.push(`${prefix}摇号概率`);
  });
  if (level.mode === 'lottery' && schools.length && schools.every((school) => Number.isFinite(Number(school.probability)))) {
    const probabilityTotal = schools.reduce((sum, school) => sum + Number(school.probability), 0);
    if (Math.abs(probabilityTotal - 1) > 0.001) missing.push(`${level.label}摇号概率合计应为 100%`);
  }
  return missing;
}

function schoolLevelScore(level) {
  const schools = level.schools || [];
  if (schoolLevelMissing(level).length) return null;
  if (level.mode === 'fixed') {
    const school = schools[0];
    return schoolRankScore(school.rank, school.totalSchools);
  }
  const weighted = schools.reduce((sum, school) => {
    const score = schoolRankScore(school.rank, school.totalSchools);
    const probability = Math.max(0, Number(school.probability) || 0);
    return sum + score * probability;
  }, 0);
  return round1(level.mode === 'lottery' ? weighted * 0.8 : weighted);
}

function schoolResourceBreakdown() {
  const missing = [...schoolLevelMissing(schoolDistrict.elementary), ...schoolLevelMissing(schoolDistrict.middle)];
  if (schoolDistrict.nineYearContinuity === null) missing.push('是否九年一贯制');
  if (missing.length) return { ready: false, missing, elementary: null, middle: null, combined: null, bonus: null, total: null };
  const elementary = schoolLevelScore(schoolDistrict.elementary);
  const middle = schoolLevelScore(schoolDistrict.middle);
  const combined = round1((elementary + middle) / 2);
  const bonus = schoolDistrict.nineYearContinuity ? 1.2 : 1;
  return {
    ready: true,
    missing: [],
    elementary,
    middle,
    combined,
    bonus,
    total: round1(Math.min(100, combined * bonus))
  };
}

function schoolLevelPoints(level, maxPoints) {
  const score = schoolLevelScore(level);
  return Number.isFinite(score) ? round1(score / 100 * maxPoints) : null;
}

function schoolManualLevelPoints(level, maxPoints) {
  if (Number.isFinite(Number(level.manualPoints))) {
    return round1(Math.min(maxPoints, Math.max(0, Number(level.manualPoints))));
  }
  return schoolLevelPoints(level, maxPoints);
}

// 单价压力直接输出“当前维度可贡献的分数”：
// 1 万元/㎡为当前权重满分，10 万元/㎡为 1 分，区间内用幂函数放大低价段差异。
function pricePressurePoints(pricePerSqm, maxPoints = 20) {
  if (pricePerSqm === null || pricePerSqm === undefined || String(pricePerSqm).trim() === '') return null;
  const price = Number(pricePerSqm);
  if (!Number.isFinite(price)) return null;
  const safePrice = price;
  const safeMax = Math.max(PRICE_SCORE_MIN, Number(maxPoints) || 20);
  const ratio = (PRICE_PER_SQM_MAX - Math.min(PRICE_PER_SQM_MAX, Math.max(PRICE_PER_SQM_MIN, safePrice)))
    / (PRICE_PER_SQM_MAX - PRICE_PER_SQM_MIN);
  return round1(PRICE_SCORE_MIN + Math.pow(ratio, PRICE_CURVE_EXPONENT) * (safeMax - PRICE_SCORE_MIN));
}

function pricePressureRawScore(factor) {
  const maxPoints = Math.max(PRICE_SCORE_MIN, Number(factor.weight) || 20);
  const hasPrice = factor.pricePerSqm !== null && factor.pricePerSqm !== undefined && String(factor.pricePerSqm).trim() !== '';
  const points = hasPrice
    ? pricePressurePoints(factor.pricePerSqm, maxPoints)
    : Number.isFinite(Number(factor.offlinePointRatio)) ? Number(factor.offlinePointRatio) * maxPoints : null;
  return Number.isFinite(points) ? round1(points / maxPoints * 100) : null;
}

function interpolateScore(value, points) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    const [upperValue, upperScore] = points[index];
    const [lowerValue, lowerScore] = points[index - 1];
    if (number <= upperValue) {
      const ratio = (number - lowerValue) / (upperValue - lowerValue);
      return round1(lowerScore + (upperScore - lowerScore) * ratio);
    }
  }
  return points[points.length - 1][1];
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function subscoreMaxPoints(factor, subscore) {
  return factor.id === 'life' ? Number(subscore.maxPoints) || 0 : factor.weight / factor.subscores.length;
}

function countBandPoints(value, bands) {
  const count = Math.max(0, Number(value) || 0);
  let points = bands[0][1];
  bands.forEach(([minimum, score]) => { if (count >= minimum) points = score; });
  return points;
}

function distanceBandPoints(distanceKm, bands) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance)) return 0;
  if (distance <= bands[0][0]) return bands[0][1];
  for (let index = 1; index < bands.length; index += 1) {
    const [upperDistance, upperScore] = bands[index];
    const [lowerDistance, lowerScore] = bands[index - 1];
    if (distance <= upperDistance) {
      const ratio = (distance - lowerDistance) / (upperDistance - lowerDistance);
      return round2(lowerScore + (upperScore - lowerScore) * ratio);
    }
  }
  return 0;
}

function transportAssessment(factor) {
  // 没有路线数组或路线不完整时不生成交通分，避免把启动演示值当成真实结果。
  if (!Array.isArray(factor.transportRoutes)) return null;
  if (typeof TransportDataStore === 'undefined' || typeof TransportDataStore.scoreTransportStationRoutes !== 'function') return { ready: false };
  return TransportDataStore.scoreTransportStationRoutes(factor.transportRoutes, { radiusM: 1500 });
}

const TRANSPORT_OVERRIDES_KEY = 'resiscore.transport.routeOverrides.v1';

function transportPropertyKey(property) {
  return normalizePlaceName(typeof communityCanonicalName === 'function' ? communityCanonicalName(property) : property);
}

function readTransportOverrides() {
  try {
    const value = readConfirmedOfflineOverridePackage().transport || {};
    const merged = { ...(value && typeof value === 'object' ? value : {}) };
    Object.entries(state.transportOverrideDrafts || {}).forEach(([key, draft]) => {
      if (draft === null || draft === undefined) delete merged[key];
      else merged[key] = draft;
    });
    return merged;
  } catch (error) {
    return {};
  }
}

function saveTransportOverride(property, route) {
  const key = `${state.cityId}:${transportPropertyKey(property)}:${normalizePlaceName(route.stationName || route.station || '')}`;
  state.transportOverrideDrafts ||= {};
  state.transportOverrideDrafts[key] = {
    walkDistanceM: route.walkDistanceM,
    distanceQuality: 'user-adjusted',
    source: '用户修正',
    verifiedAt: route.verifiedAt,
    estimateMethod: '用户按实际步行路线修正'
  };
}

function removeTransportOverride(property, route) {
  const key = `${state.cityId}:${transportPropertyKey(property)}:${normalizePlaceName(route.stationName || route.station || '')}`;
  state.transportOverrideDrafts ||= {};
  // Keep a tombstone so a previously synced route correction is hidden for
  // this session until the user explicitly confirms the deletion.
  state.transportOverrideDrafts[key] = null;
}

function applyTransportLookup(query = state.property) {
  const factor = factors.find((item) => item.id === 'transport');
  if (!factor) return;
  if (!state.transportData || typeof TransportDataStore === 'undefined' || typeof TransportDataStore.findCommunityRoutes !== 'function') {
    factor.transportRoutes = [];
    factor.transportLookup = { query, match: null, error: '广州交通数据加载中' };
    factor.subscores?.forEach((subscore) => {
      subscore.points = null;
      subscore.current = '正在加载广州交通数据';
    });
    return;
  }
  const canonicalQuery = typeof communityCanonicalName === 'function' ? communityCanonicalName(query) : query;
  const verifiedMatch = TransportDataStore.findCommunityRoutes(state.transportData, canonicalQuery);
  let match = verifiedMatch;
  let routeSource = 'community-route';
  let fallbackFromName = '';
  if ((!match || !Array.isArray(match.routes) || !match.routes.length) && communityPhaseLabel(query)) {
    const phase = findCommunityPhaseRecord(query);
    const parentName = phase?.parentName || communityPhaseBaseName(query);
    const parentRoute = parentName ? TransportDataStore.findCommunityRoutes(state.transportData, parentName) : null;
    if (parentRoute?.routes?.length) {
      match = { ...parentRoute, name: phase?.name || query, aliases: phase?.aliases || parentRoute.aliases || [], fallbackScope: 'parent-project', fallbackFromName: parentRoute.name || parentName };
      routeSource = 'parent-project-fallback';
      fallbackFromName = parentRoute.name || parentName;
    }
  }
  if ((!match || !Array.isArray(match.routes) || !match.routes.length) && typeof TransportDataStore.findEstimatedCommunityRoutes === 'function') {
    const residentialMatch = findResidentialMatch(state.amenityData, query);
    const estimatedRoutes = TransportDataStore.findEstimatedCommunityRoutes(state.transportData, residentialMatch, { radiusM: 1500 });
    if (estimatedRoutes?.length) {
      match = {
        id: `coordinate-estimate-${residentialMatch.id || normalizePlaceName(query)}`,
        name: residentialMatch.name,
        aliases: residentialMatch.aliases || [],
        routes: estimatedRoutes,
        estimated: true,
        fallbackScope: residentialMatch.fallbackScope,
        fallbackFromName: residentialMatch.fallbackFromName
      };
      routeSource = residentialMatch.fallbackScope === 'parent-project' ? 'parent-project-coordinate-estimate' : 'coordinate-estimate';
      fallbackFromName = residentialMatch.fallbackFromName || '';
    }
  }
  if (!match || !Array.isArray(match.routes) || !match.routes.length) {
    factor.transportRoutes = [];
    factor.transportLookup = { query, match: null, error: '当前小区暂无 1.5km 内地铁站坐标或入口路线数据' };
    factor.subscores?.forEach((subscore) => {
      subscore.points = null;
      subscore.current = '当前小区暂无可用地铁路线';
    });
    return;
  }
  const overrides = readTransportOverrides();
  factor.transportRoutes = match.routes.map((route) => {
    const key = `${state.cityId}:${transportPropertyKey(query)}:${normalizePlaceName(route.stationName || route.station || '')}`;
    return overrides[key] ? { ...route, ...overrides[key] } : route;
  });
  factor.transportLookup = { query, match, source: routeSource, error: '' };
  const assessment = transportAssessment(factor);
  const routeEvidenceText = routeSource.includes('parent-project')
    ? `父项目整体数据回退（${fallbackFromName || '父项目'}）`
    : routeSource === 'coordinate-estimate'
    ? '坐标估算，1个路网来源，需进一步确认'
    : '路线包记录，需进一步确认';
  factor.subscores[0].current = assessment?.ready ? `${assessment.candidates.map((route) => `${route.stationName || route.station || '地铁站'} ${formatNumber(route.walkDistanceM)}m${route.distanceQuality === 'estimated' ? '（估算）' : ''}`).join('；')} · ${routeEvidenceText}` : '待补充路线';
  factor.subscores[1].current = assessment?.ready ? `${assessment.estimatedCount ? `含 ${assessment.estimatedCount} 条估算路线` : '已核验路线'} · ${routeEvidenceText}` : '待补充路线';
}

function nearestAmenityDistance(origin, items) {
  const distances = items.map((item) => haversineKm(origin.latitude, origin.longitude, item.latitude, item.longitude));
  return distances.length ? Math.min(...distances) : null;
}

function normalizePlaceName(value) {
  return String(value || '').replace(/[\s（）()、，,·\-—]/g, '').toLowerCase();
}

function findResidentialMatch(data, query) {
  const needle = normalizePlaceName(query);
  if (!needle) return null;
  const residential = [...(data?.residential || []), ...(data?.residentialOverrides || [])];
  const residentialMatches = findCommunityNamedRecords(residential, query);
  const residentialMatch = residentialMatches.length ? mergeCommunityRecords(...residentialMatches) : null;
  if (residentialMatch) {
    // 同名/别名的 OSM 住宅记录与公开地图校准记录可能同时存在，合并字段并
    // 统一返回规范名，避免仅取第一条导致别名来源的数据无法共享。
    residentialMatch.name = communityCanonicalName(query);
    residentialMatch.aliases = [...new Set([
      ...(residentialMatch.aliases || []),
      ...communityQueryCandidates(query)
    ])];
  }
  const phaseRecord = findCommunityPhaseRecord(query);
  const hasCoordinates = (record) => Number.isFinite(Number(record?.latitude)) && Number.isFinite(Number(record?.longitude));
  if (phaseRecord) {
    // 先把分期坐标作为基线，再叠加同一期住宅目录字段。
    if (residentialMatch) {
      const merged = mergeCommunityRecords(phaseRecord, residentialMatch);
      Object.assign(merged, {
        name: phaseRecord.name,
        parentName: phaseRecord.parentName,
        phase: phaseRecord.phase,
        phaseLabel: phaseRecord.phaseLabel,
        aliases: [...new Set([...(phaseRecord.aliases || []), ...(residentialMatch.aliases || [])])]
      });
      return hasCoordinates(merged) ? merged : null;
    }
    if (hasCoordinates(phaseRecord)) return phaseRecord;
  }
  if (residentialMatch && hasCoordinates(residentialMatch)) return residentialMatch;
  // 住宅目录基线覆盖范围比生活配套住宅索引更广；当生活配套包暂未登记名称时，
  // 仍使用同一小区的公开坐标计算 CBD、交通和附近点位，并保留来源为公开目录。
  const baseline = Array.isArray(state.communityQualityData?.records) ? state.communityQualityData.records : [];
  const baselineMatch = findCommunityNamedRecords(baseline, query)[0];
  if (hasCoordinates(baselineMatch)) return baselineMatch;

  // 分期没有独立坐标时，按用户确认的原则回退到父项目坐标；
  // 只回退父项目，绝不拿其他期坐标代替。
  if (communityPhaseLabel(query)) {
    const parent = findCommunityParentRecord(residential, query) || findCommunityParentRecord(baseline, query);
    if (hasCoordinates(parent)) {
      return {
        ...parent,
        name: phaseRecord?.name || query,
        aliases: [...new Set([...(phaseRecord?.aliases || []), ...(parent.aliases || [])])],
        parentName: phaseRecord?.parentName || communityPhaseBaseName(query),
        phase: phaseRecord?.phase || communityPhaseLabel(query),
        phaseLabel: phaseRecord?.phaseLabel || communityPhaseLabel(query),
        fallbackScope: 'parent-project',
        fallbackFromName: parent.name,
        fallbackReason: '该期没有独立坐标，使用父项目整体坐标计算交通、CBD和生活配套'
      };
    }
  }
  return null;
}

function lifeResourceBreakdown() {
  const assessment = factors.find((factor) => factor.id === 'life')?.amenityAssessment;
  if (!assessment?.ready) return { ready: false, missing: assessment?.missing || ['广州小区生活配套数据'] };
  return assessment;
}

function ensureLifeRawInputs(query, defaults = {}) {
  const factor = factors.find((item) => item.id === 'life');
  if (!factor) return {};
  if (factor.rawProperty !== query) {
    factor.rawProperty = query;
    factor.rawInputs = {};
    factor.rawEditedFields = {};
  }
  factor.rawInputs ||= {};
  const fields = ['commercialCount', 'diningCount', 'matureMallCount', 'tertiaryDistanceKm', 'localMedicalDistanceKm', 'parkDistanceKm'];
  fields.forEach((field) => {
    const hasDefault = Object.prototype.hasOwnProperty.call(defaults, field);
    const hasValue = Object.prototype.hasOwnProperty.call(factor.rawInputs, field);
    // The first render can happen before the offline bundle finishes loading.
    // Fill the temporary nulls once a source value arrives, while preserving
    // fields the user has explicitly edited (including an intentional blank).
    if (!hasValue || (!factor.rawEditedFields?.[field] && hasDefault)) {
      factor.rawInputs[field] = hasDefault ? (defaults[field] ?? null) : null;
    }
  });
  const overrides = readRawInputOverride(query);
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      factor.rawInputs[field] = overrides[field];
      factor.rawEditedFields[field] = true;
    }
  });
  return factor.rawInputs;
}

function applyLifeRawInputs(factor, raw = factor?.rawInputs, baseAssessment = factor?.amenityAssessment) {
  if (!factor || !raw) return false;
  const values = {
    commercialCount: rawNumber(raw.commercialCount),
    diningCount: rawNumber(raw.diningCount),
    matureMallCount: rawNumber(raw.matureMallCount),
    tertiaryDistanceKm: rawNumber(raw.tertiaryDistanceKm),
    localMedicalDistanceKm: rawNumber(raw.localMedicalDistanceKm),
    parkDistanceKm: rawNumber(raw.parkDistanceKm)
  };
  if (Object.values(values).some((value) => value === null || value < 0)) {
    factor.amenityAssessment = { ...(factor.amenityAssessment || {}), ready: false, missing: ['生活配套原始数据'] };
    factor.subscores?.forEach((subscore) => { subscore.points = null; });
    return false;
  }
  const points = {
    commercial: countBandPoints(values.commercialCount, [[0, 0], [1, 1], [10, 2], [20, 3], [30, 4], [40, 5]]),
    dining: countBandPoints(values.diningCount, [[0, 0], [1, 1], [11, 2], [20, 3], [30, 4]]),
    matureMall: values.matureMallCount >= 2 ? 3 : values.matureMallCount === 1 ? 2 : 0,
    tertiaryHospital: distanceBandPoints(values.tertiaryDistanceKm, [[0, 2], [0.5, 1.9], [1, 1.7], [1.5, 1.5], [2, 1.3], [3, 0.9], [5, 0]]),
    localMedical: distanceBandPoints(values.localMedicalDistanceKm, [[0, 1], [0.5, 0.9], [1, 0.8], [2, 0.65], [3, 0.5], [5, 0]]),
    park: distanceBandPoints(values.parkDistanceKm, [[0, 3], [0.25, 2.9], [0.5, 2.8], [1, 2.5], [2, 1.9], [3, 1.2], [5, 0]])
  };
  const original = baseAssessment || {};
  const assessment = {
    ...original,
    ready: true,
    commercialCount: values.commercialCount,
    diningCount: values.diningCount,
    matureMallCount: values.matureMallCount,
    tertiaryDistance: values.tertiaryDistanceKm,
    localMedicalDistance: values.localMedicalDistanceKm,
    parkDistance: values.parkDistanceKm,
    points,
    baseTotal: round1(points.commercial + points.dining + points.tertiaryHospital + points.localMedical + points.park),
    bonusPoints: points.matureMall,
    rawTotal: round1(points.commercial + points.dining + points.matureMall + points.tertiaryHospital + points.localMedical + points.park),
    rawMaxPoints: LIFE_BASE_MAX_POINTS,
    total: round1(Math.min(LIFE_BASE_MAX_POINTS, points.commercial + points.dining + points.matureMall + points.tertiaryHospital + points.localMedical + points.park))
  };
  factor.amenityAssessment = assessment;
  factor.subscores.forEach((subscore) => {
    const point = subscore.id === 'commercial' ? points.commercial
      : subscore.id === 'dining' ? points.dining
        : subscore.id === 'mature-mall' ? points.matureMall
          : subscore.id === 'tertiary-hospital' ? points.tertiaryHospital
            : subscore.id === 'local-medical' ? points.localMedical : points.park;
    subscore.points = point;
    const edited = subscore.id === 'commercial' ? factor.rawEditedFields?.commercialCount
      : subscore.id === 'dining' ? factor.rawEditedFields?.diningCount
        : subscore.id === 'mature-mall' ? factor.rawEditedFields?.matureMallCount
          : subscore.id === 'tertiary-hospital' ? factor.rawEditedFields?.tertiaryDistanceKm
            : subscore.id === 'local-medical' ? factor.rawEditedFields?.localMedicalDistanceKm : factor.rawEditedFields?.parkDistanceKm;
    if (edited) subscore.current = `${point} 分 · 用户填写原始数据`;
  });
  return true;
}

function applyLifeLookup(query = state.property) {
  const factor = factors.find((item) => item.id === 'life');
  const data = state.amenityData;
  if (!data) {
    ensureLifeRawInputs(query);
    state.amenityLookup = { query, match: null, error: '广州生活配套数据尚未加载' };
    factor.amenityAssessment = { ready: false, missing: ['广州生活配套数据'] };
    return;
  }
  const match = findResidentialMatch(data, query);
  if (!match) {
    ensureLifeRawInputs(query);
    state.amenityLookup = { query, match: null, error: '未在广州开放数据中匹配到该小区' };
    factor.amenityAssessment = { ready: false, missing: [`小区「${query}」的广州开放数据坐标`] };
    factor.subscores.forEach((subscore) => { subscore.points = null; subscore.current = '待匹配小区'; });
    applyLifeRawInputs(factor);
    return;
  }
  const evidenceAmenities = communityEvidenceMetric(query, 'amenities');
  const evidenceMetricValue = (name, fallback) => {
    const value = evidenceAmenities?.metrics?.[name]?.value;
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  };
  const rawCommercialCount = (data.amenities.commercial || []).filter((item) => haversineKm(match.latitude, match.longitude, item.latitude, item.longitude) <= LIFE_SHOP_RADIUS_KM).length;
  const rawDiningCount = (data.amenities.dining || []).filter((item) => haversineKm(match.latitude, match.longitude, item.latitude, item.longitude) <= LIFE_SHOP_RADIUS_KM).length;
  // 多源证据包有值时，使用其临时平均；来源不足会在标签中保留“需进一步确认”。
  const commercialCount = evidenceMetricValue('commercialCount', rawCommercialCount);
  const diningCount = evidenceMetricValue('diningCount', rawDiningCount);
  // 公开地图补录只有 51 条样本，不能把补录入口误算成每个小区的第二来源。
  // 只有当前小区半径内实际命中补录点位时，才在来源数量中计入百度地图。
  const nearbySupplemental = (data.supplementalPois || []).filter((item) => haversineKm(match.latitude, match.longitude, item.latitude, item.longitude) <= LIFE_SHOP_RADIUS_KM);
  const amenitySourceIds = new Set(['osm-overpass']);
  if (nearbySupplemental.length) amenitySourceIds.add('baidu-public-map');
  const amenitySourceCount = amenitySourceIds.size;
  const amenitySourceConfidence = amenitySourceCount >= 3
    ? '已达到三源规则'
    : `仅${amenitySourceCount}个实际来源，需进一步确认`;
  const categorySourceLabel = (category, metricName) => {
    const metric = evidenceAmenities?.metrics?.[metricName];
    if (metric && typeof ResiScoreMultiSource !== 'undefined') return ResiScoreMultiSource.label(metric, '点位数据');
    const hasSupplemental = nearbySupplemental.some((item) => item.category === category);
    return hasSupplemental
      ? 'OSM+公开地图补录（2个实际来源，需进一步确认）'
      : 'OSM公开点位（1个实际来源，需进一步确认）';
  };
  const matureMallNames = new Set((data.amenities.commercial || [])
    .filter((item) => item.matureMall === true && haversineKm(match.latitude, match.longitude, item.latitude, item.longitude) <= LIFE_SHOP_RADIUS_KM)
    .map((item) => normalizePlaceName(item.name)));
  const matureMallCount = matureMallNames.size;
  const tertiaryDistance = evidenceMetricValue('tertiaryHospitalDistanceKm', nearestAmenityDistance(match, (data.amenities.medical || []).filter((item) => item.tertiary)));
  const localMedicalDistance = evidenceMetricValue('localMedicalDistanceKm', nearestAmenityDistance(match, (data.amenities.medical || []).filter((item) => !item.tertiary && ['hospital', 'clinic', 'doctors', 'yes'].includes(item.medicalKind))));
  const parkDistance = evidenceMetricValue('parkDistanceKm', nearestAmenityDistance(match, data.amenities.parks || []));
  const points = {
    commercial: countBandPoints(commercialCount, [[0, 0], [1, 1], [10, 2], [20, 3], [30, 4], [40, 5]]),
    dining: countBandPoints(diningCount, [[0, 0], [1, 1], [11, 2], [20, 3], [30, 4]]),
    matureMall: matureMallCount >= 2 ? 3 : matureMallCount === 1 ? 2 : 0,
    tertiaryHospital: distanceBandPoints(tertiaryDistance, [[0, 2], [0.5, 1.9], [1, 1.7], [1.5, 1.5], [2, 1.3], [3, 0.9], [5, 0]]),
    localMedical: distanceBandPoints(localMedicalDistance, [[0, 1], [0.5, 0.9], [1, 0.8], [2, 0.65], [3, 0.5], [5, 0]]),
    park: distanceBandPoints(parkDistance, [[0, 3], [0.25, 2.9], [0.5, 2.8], [1, 2.5], [2, 1.9], [3, 1.2], [5, 0]])
  };
  const assessment = {
    ready: true,
    source: [data.source?.name || '广州公开点位数据（OSM/公开地图补录样本）', phaseDataScopeLabel(match)].filter(Boolean).join('；'),
    dataScope: match.fallbackScope || 'phase-or-community',
    fallbackFromName: match.fallbackFromName || '',
    sourceCount: amenitySourceCount,
    sourceConfidence: amenitySourceConfidence,
    sourceIds: [...amenitySourceIds],
    dataGeneratedAt: data.generatedAt || '',
    property: match.name,
    match,
    commercialCount,
    diningCount,
    matureMallCount,
    tertiaryDistance,
    localMedicalDistance,
    parkDistance,
    points,
    baseTotal: round1(points.commercial + points.dining + points.tertiaryHospital + points.localMedical + points.park),
    bonusPoints: points.matureMall,
    rawTotal: round1(points.commercial + points.dining + points.matureMall + points.tertiaryHospital + points.localMedical + points.park),
    rawMaxPoints: LIFE_BASE_MAX_POINTS,
    total: round1(Math.min(LIFE_BASE_MAX_POINTS, points.commercial + points.dining + points.matureMall + points.tertiaryHospital + points.localMedical + points.park))
  };
  const raw = ensureLifeRawInputs(query, {
    commercialCount, diningCount, matureMallCount,
    tertiaryDistanceKm: tertiaryDistance, localMedicalDistanceKm: localMedicalDistance, parkDistanceKm: parkDistance
  });
  factor.amenityAssessment = assessment;
  factor.subscores.forEach((subscore) => {
    const point = subscore.id === 'commercial' ? points.commercial
      : subscore.id === 'dining' ? points.dining
        : subscore.id === 'mature-mall' ? points.matureMall
        : subscore.id === 'tertiary-hospital' ? points.tertiaryHospital
          : subscore.id === 'local-medical' ? points.localMedical : points.park;
    subscore.points = point;
    const sourceLabel = assessment.sourceCount > 1
      ? `多源点位（${assessment.sourceCount}个实际来源，${assessment.sourceConfidence}）`
      : `公开点位样本（${assessment.sourceConfidence}）`;
    const scopeNote = phaseDataScopeLabel(match);
    subscore.current = subscore.id === 'commercial' ? `${commercialCount} 个已采集点 / ${LIFE_SHOP_RADIUS_KM}km · ${categorySourceLabel('commercial', 'commercialCount')}${scopeNote ? ` · ${scopeNote}` : ''}`
      : subscore.id === 'dining' ? `${diningCount} 个已采集点 / ${LIFE_SHOP_RADIUS_KM}km · ${categorySourceLabel('dining', 'diningCount')}${scopeNote ? ` · ${scopeNote}` : ''}`
        : subscore.id === 'mature-mall' ? `${matureMallCount >= 2 ? `${matureMallCount} 个大型成熟商场 / +3 分` : matureMallCount === 1 ? '1 个大型成熟商场 / +2 分' : '2km 内未识别到大型成熟商场'}${scopeNote ? ` · ${scopeNote}` : ''}`
        : subscore.id === 'tertiary-hospital' ? `${tertiaryDistance == null ? '无' : `${formatNumber(tertiaryDistance)}km`} · ${sourceLabel}${scopeNote ? ` · ${scopeNote}` : ''}`
          : subscore.id === 'local-medical' ? `${localMedicalDistance == null ? '无' : `${formatNumber(localMedicalDistance)}km`} · ${sourceLabel}${scopeNote ? ` · ${scopeNote}` : ''}`
            : `${parkDistance == null ? '无' : `${formatNumber(parkDistance)}km`} · ${sourceLabel}${scopeNote ? ` · ${scopeNote}` : ''}`;
  });
  applyLifeRawInputs(factor, raw, assessment);
  state.amenityLookup = { query, match, error: '' };
}

function applyCenterLookup(query = state.property) {
  const factor = factors.find((item) => item.id === 'center');
  if (!factor) return;
  const overrides = readRawInputOverride(query);
  const hasDistanceOverride = Object.prototype.hasOwnProperty.call(overrides, 'centerDistanceKm');
  const hasTransitOverride = Object.prototype.hasOwnProperty.call(overrides, 'centerTransitMinutes');
  const overrideDistance = rawNumber(overrides.centerDistanceKm);
  const overrideTransit = rawNumber(overrides.centerTransitMinutes);
  const match = findResidentialMatch(state.amenityData, query);
  if (!match || !state.transportData || typeof TransportDataStore === 'undefined' || typeof TransportDataStore.distanceToCbd !== 'function') {
    factor.distanceKm = hasDistanceOverride ? overrideDistance : null;
    factor.peakTransitMinutes = hasTransitOverride ? overrideTransit : null;
    factor.centerRawProvenance = {
      distanceKm: hasDistanceOverride ? 'user-adjusted' : 'missing',
      peakTransitMinutes: hasTransitOverride ? 'user-adjusted' : 'missing'
    };
    factor.peakTransitQuality = hasTransitOverride ? 'user-adjusted' : null;
    factor.centerLookup = { query, match: null, error: '缺少小区坐标或广州 CBD 数据' };
    factor.subscores[0].current = overrideDistance !== null ? `${overrideDistance}km · 用户填写` : '待匹配小区坐标';
    factor.subscores[1].current = overrideTransit !== null ? `${overrideTransit}分钟 · 用户填写` : '待补充高峰公共交通时间';
    return;
  }
  const cbd = TransportDataStore.distanceToCbd(state.transportData, match.latitude, match.longitude);
  factor.distanceKm = cbd?.distanceKm ?? null;
  // 目前没有可授权的广州高峰 GTFS 路线包时，用 CBD 直线距离生成可解释的
  // 公交耗时代理值。它只用于让不同小区保持差异，页面明确标注“估算”，
  // 后续接入真实路线后会自然覆盖该值。
  const estimatedTransitMinutes = cbd && Number.isFinite(Number(cbd.distanceKm))
    ? Math.round(Math.min(120, Math.max(25, 24 + Number(cbd.distanceKm) * 2.35)))
    : null;
  factor.peakTransitMinutes = estimatedTransitMinutes;
  // Apply the persisted/snapshot raw values after deriving the current
  // database values.  A previous implementation reset peakTransitQuality to
  // "estimated-distance-proxy" before applying the overrides, which made a
  // historical/user value look like a fresh red estimate and caused saved
  // results to appear inconsistent after refresh.
  if (hasDistanceOverride) factor.distanceKm = overrideDistance;
  if (hasTransitOverride) factor.peakTransitMinutes = overrideTransit;
  const hasAnyOverride = hasDistanceOverride || hasTransitOverride;
  factor.peakTransitQuality = hasAnyOverride
    ? 'user-adjusted'
    : factor.peakTransitMinutes === null ? null : 'estimated-distance-proxy';
  factor.centerRawProvenance = {
    distanceKm: hasDistanceOverride ? 'user-adjusted' : (cbd ? 'estimated-distance-proxy' : 'missing'),
    peakTransitMinutes: hasTransitOverride ? 'user-adjusted' : (estimatedTransitMinutes === null ? 'missing' : 'estimated-distance-proxy')
  };
  const scopeNote = phaseDataScopeLabel(match);
  factor.centerLookup = { query, match, cbd, dataScope: match.fallbackScope || 'phase-or-community', fallbackFromName: match.fallbackFromName || '', error: cbd ? '' : '未能计算 CBD 距离' };
  factor.subscores[0].current = hasDistanceOverride ? (overrideDistance === null ? '待补充 CBD 距离' : `${formatNumber(overrideDistance)}km · 用户填写`) : cbd ? `${formatNumber(cbd.distanceKm)}km · ${cbd.anchor.name}${scopeNote ? ` · ${scopeNote}` : ''}` : '待补充 CBD 距离';
  factor.subscores[1].current = factor.peakTransitMinutes === null
    ? '待补充高峰公共交通时间'
    : hasTransitOverride ? `${formatNumber(factor.peakTransitMinutes)}分钟 · 用户填写` : `${formatNumber(factor.peakTransitMinutes)}分钟 · 按 CBD 距离估算${scopeNote ? ` · ${scopeNote}` : ''}`;
}

function findOfflineScoreRecord(query = state.property) {
  const records = globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE?.cities?.[state.cityId]?.records;
  if (!records || typeof records !== 'object') return null;
  const needles = [...new Set([
    normalizePlaceName(query),
    normalizePlaceName(typeof communityCanonicalName === 'function' ? communityCanonicalName(query) : query)
  ].filter(Boolean))];
  const found = Object.entries(records).find(([name, record]) => {
    const names = [name, ...(Array.isArray(record?.aliases) ? record.aliases : [])]
      .map(normalizePlaceName).filter(Boolean);
    return names.some((normalized) => needles.some((needle) => normalized === needle || normalized.includes(needle) || needle.includes(normalized)));
  });
  if (!found) return null;
  const [name, record] = found;
  if (record?.aliasOf && records[record.aliasOf]) return { ...records[record.aliasOf], matchedName: name };
  return { ...record, matchedName: name };
}

function findCommunityPriceRecord(query = state.property) {
  const records = Array.isArray(state.priceData?.records) ? state.priceData.records : [];
  const matches = findCommunityNamedRecords(records, query);
  // 公开抓取包里部分中文名称曾因编码损坏而无法回查；canonical 记录是按
  // 社区 URL 恢复的人工校准项，优先于同 URL 的旧乱码或泛化小区名。
  const found = matches.find((record) => record?.canonical === true) || matches[0];
  if (found && Number.isFinite(Number(found.pricePerSqm))) return found;
  if (communityPhaseLabel(query)) {
    const parent = findCommunityParentRecord(records, query);
    if (parent && Number.isFinite(Number(parent.pricePerSqm))) {
      const phase = findCommunityPhaseRecord(query);
      return {
        ...parent,
        name: phase?.name || query,
        aliases: [...new Set([...(phase?.aliases || []), ...(parent.aliases || [])])],
        phase: phase?.phase || communityPhaseLabel(query),
        phaseLabel: phase?.phaseLabel || communityPhaseLabel(query),
        fallbackScope: 'parent-project',
        fallbackFromName: parent.name,
        fallbackReason: '该期没有独立公开均价，使用父项目整体均价'
      };
    }
  }
  return null;
}

const COMMUNITY_NAME_ALIASES = {
  // “星樾山畔”为项目规范名；“星月山畔”是部分来源中的错写/历史别名。
  '星樾山畔': ['星月山畔', '星樾·山畔'],
  // 外部资料将“星樾花园”列为品秀星樾的备案名/别名；“品秀新苑”
  // 是离线包中的历史数据别名。统一规范名后，价格、交通、学区、品质、
  // 生活配套和未来潜力等来源记录按同一实体合并，保留原始名称便于追溯。
  '品秀星樾': ['品秀新苑', '星樾花园', '品秀·星樾', '越秀·星樾TOD', '越秀星樾TOD', '星樾TOD'],
  '高新仕林苑': ['高新仕林花园', '高新·仕林苑', '仕林花园'],
  // 分期必须使用独立的规范名。父项目“科城山庄”不能作为任何一期的别名，
  // 否则输入父项目时会被某一期的价格或路线记录抢先命中。
  '科城山庄一期峻和园': ['科城山庄一期·峻和园', '科城山庄峻和园', '峻和园', '科城山庄一期景和园', '景和园'],
  '科城山庄二期锦泽园': ['科城山庄二期·锦泽园', '科城山庄锦泽园', '锦泽园', '科城山庄二期景泽园', '景泽园'],
  '科城山庄三期峻森园': ['科城山庄三期·峻森园', '科城山庄峻森园', '峻森园', '科城山庄三期景森园', '景森园']
};

function communityRawOverrideKeys(query) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const keys = [communityCanonicalName(raw), raw];
  const group = Object.entries(COMMUNITY_NAME_ALIASES).find(([name, aliases]) =>
    [name, ...aliases].some((value) => normalizePlaceName(value) === normalizePlaceName(raw)));
  if (group) keys.push(group[0], ...group[1]);
  return [...new Set(keys.filter(Boolean))];
}

function communityQueryCandidates(query) {
  const needle = normalizePlaceName(query);
  if (!needle) return [];
  const aliasCandidates = Object.entries(COMMUNITY_NAME_ALIASES)
    .filter(([key, values]) => [key, ...values].some((value) => normalizePlaceName(value) === needle))
    .flatMap(([key, values]) => [key, ...values]);
  return [...new Set([query, ...aliasCandidates].flatMap(communityLookupVariants))].filter(Boolean);
}

function communityLookupVariants(value) {
  const normalized = normalizePlaceName(value);
  if (!normalized) return [];
  const numerals = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const variants = [normalized];
  Object.entries(numerals).forEach(([text, number]) => {
    if (normalized.includes(`${text}期`)) variants.push(normalized.replaceAll(`${text}期`, `${number}期`));
  });
  return [...new Set(variants)];
}

function communityRecordNames(record) {
  const canonical = normalizePlaceName(record?.name);
  const hasPhase = Boolean(communityPhaseLabel(record?.name));
  return [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])]
    .flatMap(communityLookupVariants).filter(Boolean)
    // 数据源偶尔把父级项目名作为分期记录的别名；保留分期名本身，
    // 避免选择“科城山庄”时被三期记录抢先命中。
    .filter((name, index) => index === 0 || !hasPhase || name.length >= canonical.length || !canonical.startsWith(name));
}

// 先精确匹配完整小区名，再按匹配名称长度从长到短做模糊匹配。
// 这样“科城山庄三期·峻森园”不会被父级小区“科城山庄”抢先命中。
function findCommunityNamedRecords(records, query) {
  const candidates = communityQueryCandidates(query);
  if (!candidates.length) return [];
  const queryPhase = communityPhaseLabel(query);
  const phaseCompatible = (record) => {
    if (!queryPhase) return true;
    const recordPhase = communityPhaseLabel(record?.phaseLabel || record?.name || '');
    // 输入了明确分期时，只允许返回同一期；父项目和其他期都不能回退。
    return Boolean(recordPhase) && communityPhaseCompatible(recordPhase, queryPhase);
  };
  const scopedRecords = records.filter(phaseCompatible);
  const exact = scopedRecords.filter((record) => communityRecordNames(record).some((name) => candidates.includes(name)));
  if (exact.length) return exact.sort((a, b) => Math.max(...communityRecordNames(b).map((name) => name.length), 0) - Math.max(...communityRecordNames(a).map((name) => name.length), 0));
  return scopedRecords.filter((record) => {
    const names = communityRecordNames(record);
    const fuzzy = names.some((name) => candidates.some((candidate) => name.includes(candidate) || candidate.includes(name)));
    if (!fuzzy || queryPhase) return fuzzy;
    const recordPhase = communityPhaseLabel(record?.phaseLabel || record?.name || '');
    // 未写明期数的父项目查询不能把“父名是分期名的前缀”当作命中，
    // 否则大壮名城会被错误回填为大壮名城二期，科城山庄会被错误回填为三期。
    const isParentPrefixOfPhase = Boolean(recordPhase) && candidates.some((candidate) =>
      names.some((name) => name.startsWith(candidate) && name !== candidate));
    return !isParentPrefixOfPhase;
  })
    .sort((a, b) => Math.max(...communityRecordNames(b).map((name) => name.length), 0) - Math.max(...communityRecordNames(a).map((name) => name.length), 0));
}

function communityCanonicalName(name) {
  const normalized = normalizePlaceName(name);
  const alias = Object.entries(COMMUNITY_NAME_ALIASES).find(([key, values]) =>
    [key, ...values].some((value) => normalizePlaceName(value) === normalized));
  return alias ? alias[0] : String(name || '').trim();
}

function communityPhaseLabel(name) {
  const value = String(name || '').trim();
  const normalized = normalizePlaceName(value);
  const phaseAliases = [
    ['一期 · 峻和园', ['科城山庄一期峻和园', '科城山庄峻和园', '峻和园', '科城山庄一期景和园', '景和园']],
    ['二期 · 锦泽园', ['科城山庄二期锦泽园', '科城山庄锦泽园', '锦泽园', '科城山庄二期景泽园', '景泽园']],
    ['三期 · 峻森园', ['科城山庄三期峻森园', '科城山庄峻森园', '峻森园', '科城山庄三期景森园', '景森园']]
  ];
  const matchedPhase = phaseAliases.find(([, names]) => names.some((candidate) => normalized === normalizePlaceName(candidate)));
  if (matchedPhase) return matchedPhase[0];
  const explicit = value.match(/(?:第)?([一二三四五六七八九十\d]+)期/);
  if (explicit) {
    const numerals = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const raw = explicit[1];
    const number = /^\d+$/.test(raw) ? Number(raw) : numerals[raw];
    return Number.isFinite(number) ? `${number}期` : `${raw}期`;
  }
  return '';
}

function communityPhaseNumber(value) {
  const match = String(value || '').match(/(?:第)?([一二三四五六七八九十\d]+)期/);
  if (!match) return null;
  const numerals = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const raw = match[1];
  return /^\d+$/.test(raw) ? Number(raw) : (numerals[raw] || null);
}

function communityPhaseCompatible(left, right) {
  if (!left || !right) return false;
  const leftNumber = communityPhaseNumber(left);
  const rightNumber = communityPhaseNumber(right);
  return leftNumber !== null && rightNumber !== null ? leftNumber === rightNumber : left === right;
}

function communityPhaseRecords() {
  const cityPackage = globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE?.cities?.[state.cityId];
  return Array.isArray(cityPackage?.phaseRecords) ? cityPackage.phaseRecords : [];
}

function findCommunityPhaseRecord(query = state.property) {
  return findCommunityNamedRecords(communityPhaseRecords(), query)[0] || null;
}

function communityPhaseBaseName(value) {
  const text = String(value || '').trim();
  if (!communityPhaseLabel(text)) return '';
  // 只去掉期数标记，保留“名门/峻森园”等分期名称，供父项目回退时使用。
  return text.replace(/(?:第)?[一二三四五六七八九十\d]+期.*$/i, '').replace(/[·\-—\s]+$/g, '').trim();
}

function findCommunityParentRecord(records, query) {
  if (!Array.isArray(records) || !communityPhaseLabel(query)) return null;
  const phase = findCommunityPhaseRecord(query);
  const parentName = phase?.parentName || communityPhaseBaseName(query);
  const parentNeedle = normalizePlaceName(parentName);
  if (!parentNeedle) return null;
  return records.find((record) => {
    const recordPhase = communityPhaseLabel(record?.phaseLabel || record?.name || '');
    return !recordPhase && communityRecordNames(record).some((name) => name === parentNeedle);
  }) || null;
}

function mergeCommunityRecords(...records) {
  const present = records.filter(Boolean);
  if (!present.length) return null;
  const merged = {};
  present.forEach((record) => Object.entries(record).forEach(([key, value]) => {
    if (key === 'aliases' || key === 'sourceUrls' || key === 'fallbackFields') return;
    if (value !== null && value !== undefined && String(value).trim() !== '') merged[key] = value;
  }));
  merged.aliases = [...new Set(present.flatMap((record) => Array.isArray(record.aliases) ? record.aliases : []))];
  merged.sourceUrls = [...new Set(present.flatMap((record) => Array.isArray(record.sourceUrls) ? record.sourceUrls : (record.sourceUrl ? [record.sourceUrl] : [])))];
  return merged;
}

function phaseDataScopeLabel(record) {
  if (!record?.fallbackScope) return '';
  const sourceName = record.fallbackFromName || '父项目';
  return `小区整体数据回退（${sourceName}）`;
}

function communitySearchRecords() {
  const sourceRecords = [
    state.amenityData?.residential,
    state.amenityData?.residentialOverrides,
    state.priceData?.records,
    state.communityQualityData?.records,
    state.multiSourceData?.records,
    state.futureData?.communityEvidence,
    Object.entries(globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE?.cities?.[state.cityId]?.records || {})
      .map(([name, record]) => ({ name, ...(record || {}) })),
    globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE?.cities?.[state.cityId]?.phaseRecords,
    globalThis.RESISCORE_BUNDLED_AMENITIES?.[state.cityId]?.residential,
    globalThis.RESISCORE_BUNDLED_AMENITIES?.[state.cityId]?.residentialOverrides,
    globalThis.RESISCORE_BUNDLED_PRICE_DATA?.records,
    globalThis.RESISCORE_BUNDLED_QUALITY_DATA?.records,
    globalThis.RESISCORE_BUNDLED_FUTURE_DATA?.communityEvidence,
    globalThis.RESISCORE_BUNDLED_COMMUNITY_SCORE?.cities?.[state.cityId]?.phaseRecords
  ];
  const records = new Map();
  sourceRecords.flatMap((items) => Array.isArray(items) ? items : []).forEach((record) => {
    const rawName = String(record?.name || '').trim();
    if (!rawName) return;
    const name = communityCanonicalName(rawName);
    const key = normalizePlaceName(name);
    if (!key) return;
    const aliases = [...(Array.isArray(record?.aliases) ? record.aliases : []), rawName];
    const existing = records.get(key);
    records.set(key, existing ? {
      ...existing,
      ...(['phase', 'phaseLabel', 'parentName', 'district', 'latitude', 'longitude', 'householdCount', 'developer', 'address', 'sourceUrl', 'sourceLabel']
        .reduce((out, field) => (record?.[field] !== undefined ? { ...out, [field]: record[field] } : out), {})),
      aliases: [...new Set([...existing.aliases, ...aliases])]
    } : {
      name,
      aliases,
      ...(record?.phase ? { phase: record.phase } : {}),
      ...(record?.phaseLabel ? { phaseLabel: record.phaseLabel } : {}),
      ...(record?.parentName ? { parentName: record.parentName } : {}),
      ...(record?.district ? { district: record.district } : {}),
      ...(Number.isFinite(Number(record?.latitude)) ? { latitude: Number(record.latitude) } : {}),
      ...(Number.isFinite(Number(record?.longitude)) ? { longitude: Number(record.longitude) } : {})
    });
  });
  Object.entries(COMMUNITY_NAME_ALIASES).forEach(([name, aliases]) => {
    const key = normalizePlaceName(name);
    const existing = records.get(key);
    records.set(key, { name, aliases: [...new Set([...(existing?.aliases || []), ...aliases])] });
  });
  return [...records.values()];
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left || !right) return Math.max(left.length, right.length);
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : Math.min(diagonal + 1, previous[j] + 1, previous[j - 1] + 1);
      diagonal = above;
    }
  }
  return previous[right.length];
}

function findCommunitySearchCandidates(query, limit = 8) {
  const queryVariants = communityLookupVariants(query);
  const needle = queryVariants[queryVariants.length - 1] || '';
  if (!needle || needle.length < 2) return [];
  const queryPhase = communityPhaseLabel(query);
  return communitySearchRecords().map((record) => {
    const recordPhase = communityPhaseLabel(record.phaseLabel || record.name);
    if (queryPhase && (!recordPhase || !communityPhaseCompatible(recordPhase, queryPhase))) return null;
    const names = communityRecordNames(record);
    const exact = names.some((name) => queryVariants.includes(name));
    const starts = names.some((name) => queryVariants.some((variant) => name.startsWith(variant)));
    const contains = names.some((name) => queryVariants.some((variant) => name.includes(variant) || variant.includes(name)));
    // 含明确期数时必须同时满足项目名称包含关系；不能只凭“二期/3期”
    // 的共同后缀把其他项目混入候选。
    if (queryPhase && !exact && !contains) return null;
    const distance = Math.min(...names.flatMap((name) => queryVariants.map((variant) => editDistance(variant, name))));
    const fuzzy = !contains && distance <= Math.max(1, Math.floor(needle.length * 0.34));
    if (!exact && !contains && !fuzzy) return null;
    const score = exact ? 10000 : starts ? 8000 : contains ? 6000 : 3000;
    return { ...record, phaseLabel: record.phaseLabel || communityPhaseLabel(record.name), exact, fuzzy, score: score + Math.min(needle.length, 20) - Math.min(distance, 20) / 100 };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.name.length - b.name.length).slice(0, limit);
}

function resolveCommunityQuery(query) {
  let candidates = findCommunitySearchCandidates(query, 12);
  const queryVariants = communityQueryCandidates(query);
  const exactMatches = candidates.filter((candidate) => communityRecordNames(candidate).some((name) => queryVariants.includes(name)));
  if (exactMatches.length) {
    // 已命中父项目标准名时，只保留该父项目及其同名分期；
    // 不能把“东晖花园/东海花园”等编辑距离相近的小区混进分期选择。
    candidates = candidates.filter((candidate) => {
      if (communityRecordNames(candidate).some((name) => queryVariants.includes(name))) return true;
      const names = communityRecordNames(candidate);
      return Boolean(communityPhaseLabel(candidate.phaseLabel || candidate.name))
        && queryVariants.some((variant) => names.some((name) => name.startsWith(variant)));
    });
  } else {
    const starts = candidates.filter((candidate) => queryVariants.some((variant) =>
      communityRecordNames(candidate).some((name) => name.startsWith(variant))));
    if (starts.length) candidates = starts;
  }
  const exact = candidates.filter((candidate) => communityRecordNames(candidate).some((name) => queryVariants.includes(name)));
  const related = candidates.filter((candidate) => !communityRecordNames(candidate).some((name) => queryVariants.includes(name)));
  // 输入完整分期名时，父级项目名也会因为“包含关系”出现在候选中，不能因此再次要求选择。
  // 只有真正以输入名称开头的其他子项目，才构成分期歧义。
  const childRelated = related.filter((candidate) => queryVariants.some((variant) => normalizePlaceName(candidate.name).startsWith(variant)));
  const requiresChoice = exact.length > 0 ? childRelated.length > 0 : candidates.length > 1;
  return { candidates, exact, related, best: exact[0] || candidates[0] || null, requiresChoice };
}

function hideCommunitySuggestions() {
  const list = $('#communitySuggestions');
  if (list) { list.hidden = true; list.innerHTML = ''; }
}

function renderCommunitySuggestions(query, options = {}) {
  const list = $('#communitySuggestions');
  const notice = $('#communityMatchNotice');
  if (!list) return [];
  if (notice && !options.notice) { notice.hidden = true; notice.textContent = ''; }
  const resolution = resolveCommunityQuery(query);
  if (!String(query || '').trim() || (!options.force && normalizePlaceName(query).length < 2) || !resolution.candidates.length) {
    hideCommunitySuggestions();
    return resolution.candidates;
  }
  const header = resolution.requiresChoice
    ? `找到 ${resolution.candidates.length} 个相关小区，请选择具体名称或分期`
    : resolution.best?.fuzzy ? `未完全一致，按相近名称匹配到 ${resolution.best.name}` : '可选择数据库中的标准名称';
  const displayCandidates = resolution.exact.length && !resolution.requiresChoice ? resolution.exact : resolution.candidates;
  list.innerHTML = `<div class="community-suggestion-head">${escapeHtml(header)}</div>${displayCandidates.map((candidate) => {
    const phaseLabel = candidate.phaseLabel || (resolution.requiresChoice && normalizePlaceName(candidate.name) === normalizePlaceName(query) ? '项目总名 · 请确认分期' : '');
    return `<button class="community-suggestion" type="button" role="option" data-community-name="${escapeHtml(candidate.name)}"><span><strong>${escapeHtml(candidate.name)}</strong><small>${candidate.fuzzy ? '相近名称' : candidate.exact ? '名称匹配' : '包含匹配'}</small></span>${phaseLabel ? `<span class="community-suggestion-phase">${escapeHtml(phaseLabel)}</span>` : ''}</button>`;
  }).join('')}`;
  list.hidden = false;
  if (notice && options.notice) { notice.textContent = options.notice; notice.hidden = false; }
  list.querySelectorAll('[data-community-name]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      const name = button.dataset.communityName;
      const input = $('#propertyInput');
      if (input) input.value = name;
      hideCommunitySuggestions();
      evaluate(name, { selected: true });
    });
  });
  return resolution.candidates;
}

function findCommunityQualityRecord(query = state.property) {
  const records = Array.isArray(state.communityQualityData?.records) ? state.communityQualityData.records : [];
  const direct = findCommunityNamedRecords(records, query)[0];
  const overrides = Array.isArray(globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE?.qualityOverrides)
    ? globalThis.RESISCORE_COMMUNITY_SCORE_PACKAGE.qualityOverrides : [];
  const overrideDirect = findCommunityNamedRecords(overrides, query)[0];
  const phaseRecord = findCommunityPhaseRecord(query);
  const phaseQuery = Boolean(communityPhaseLabel(query));
  if (!phaseQuery) return direct || overrideDirect || null;
  const parent = findCommunityParentRecord(records, query) || findCommunityParentRecord(overrides, query);
  const phaseData = phaseRecord || direct || overrideDirect;
  const merged = mergeCommunityRecords(parent, phaseRecord, direct, overrideDirect);
  if (!merged) return null;
  const fieldMap = {
    buildYear: ['buildYear', '建成年代'], greenRate: ['greenRate', '绿化率'],
    officialGreenRate: ['officialGreenRate', '官方绿地率'], plotRatio: ['plotRatio', '容积率'],
    parkingCount: ['parkingCount', '车位数'], advertisedParkingCount: ['advertisedParkingCount', '宣传车位数'],
    householdCount: ['householdCount', '规划户数'], buildingCount: ['buildingCount', '楼栋总数'],
    developer: ['developer', '开发企业'], propertyCompany: ['propertyCompany', '物业公司'],
    maxFloor: ['maxFloor', '最高楼层'], floorHeight: ['floorHeight', '层高'],
    ladderHouseholdRatio: ['ladderHouseholdRatio', '梯户比'], noiseDb: ['noiseDb', '噪音分贝'], layoutQuality: ['layoutQuality', '房型质量']
  };
  const fallbackFields = {};
  Object.entries(fieldMap).forEach(([field, [topLevel, sourceKey]]) => {
    const phaseValue = qualityRecordField(direct, topLevel, sourceKey)
      ?? qualityRecordField(phaseRecord, topLevel, sourceKey)
      ?? qualityRecordField(overrideDirect, topLevel, sourceKey);
    const parentValue = qualityRecordField(parent, topLevel, sourceKey);
    if ((phaseValue === null || phaseValue === undefined || String(phaseValue).trim() === '')
      && parentValue !== null && parentValue !== undefined && String(parentValue).trim() !== '') {
      fallbackFields[field] = parent.name;
    }
  });
  Object.assign(merged, {
    name: phaseData?.name || query,
    aliases: [...new Set([...(phaseData?.aliases || []), ...(parent?.aliases || [])])],
    parentName: phaseData?.parentName || parent?.name || communityPhaseBaseName(query),
    phase: phaseData?.phase || communityPhaseLabel(query),
    phaseLabel: phaseData?.phaseLabel || communityPhaseLabel(query),
    fallbackFields,
    fallbackScope: Object.keys(fallbackFields).length ? 'parent-project-fields' : undefined,
    fallbackFromName: parent?.name || ''
  });
  return merged;
}

function findCommunityDistrict(query = state.property) {
  const quality = findCommunityQualityRecord(query);
  if (quality?.district) return String(quality.district);
  const residential = findResidentialMatch(state.amenityData, query);
  if (residential?.district) return String(residential.district);
  const evidence = findCommunityEvidenceRecord(query);
  if (evidence?.district) return String(evidence.district);
  return '';
}

function futureDistrictProfile(query = state.property) {
  const district = findCommunityDistrict(query).replace(/市$/, '');
  if (!district) return null;
  const profiles = state.futureData?.districtProfiles || {};
  const key = Object.keys(profiles).find((name) => district.includes(name) || name.includes(district));
  return key ? { district, ...profiles[key] } : null;
}

function findCommunityFutureEvidence(query = state.property) {
  const records = Array.isArray(state.futureData?.communityEvidence) ? state.futureData.communityEvidence : [];
  const phaseRecord = findCommunityPhaseRecord(query);
  const direct = findCommunityNamedRecords(records, query)[0];
  if (direct) return direct;
  if (communityPhaseLabel(query)) {
    const parent = findCommunityParentRecord(records, query);
    if (parent) return { ...parent, name: phaseRecord?.name || query, phase: phaseRecord?.phase || communityPhaseLabel(query), phaseLabel: phaseRecord?.phaseLabel || communityPhaseLabel(query), fallbackScope: 'parent-project', fallbackFromName: parent.name };
  }
  return direct || null;
}

function findCommunityEvidenceRecord(query = state.property) {
  const records = Array.isArray(state.multiSourceData?.records) ? state.multiSourceData.records : [];
  const phaseRecord = findCommunityPhaseRecord(query);
  const direct = findCommunityNamedRecords(records, query)[0];
  if (direct) return direct;
  if (communityPhaseLabel(query)) {
    const parent = findCommunityParentRecord(records, query);
    if (parent) return { ...parent, name: phaseRecord?.name || query, phase: phaseRecord?.phase || communityPhaseLabel(query), phaseLabel: phaseRecord?.phaseLabel || communityPhaseLabel(query), fallbackScope: 'parent-project', fallbackFromName: parent.name };
  }
  return direct || null;
}

function communityEvidenceMetric(query, metric) {
  return findCommunityEvidenceRecord(query)?.metrics?.[metric] || null;
}

function communityEvidenceLabel(query, metric, noun = '数据') {
  const evidence = communityEvidenceMetric(query, metric);
  if (typeof ResiScoreMultiSource === 'undefined' || !evidence) return '';
  return ResiScoreMultiSource.label(evidence, noun);
}

function findStoredScoreRecord(query = state.property) {
  // 保存结果只用于工作区对比展示，不能作为当前评估的数据源。
  // 这里保留函数名以兼容旧调用方，但永远不回填历史分数。
  return null;
}

function clearOfflineScoreFields() {
  const center = factors.find((item) => item.id === 'center');
  center?.subscores?.forEach((subscore) => delete subscore.offlinePointRatio);
  const price = factors.find((item) => item.id === 'price');
  if (price) delete price.offlinePointRatio;
  ['quality', 'future'].forEach((factorId) => {
    const factor = factors.find((item) => item.id === factorId);
    if (factor) delete factor.dataCoverage;
    factor?.subscores?.forEach((subscore) => {
      subscore.score = null;
      delete subscore.offlineSource;
    });
  });
  const qualityDefaults = {
    age: '待补充房龄数据',
    greenery: '待补充绿化数据',
    'elevator-household': '待补充梯户比数据',
    noise: '待现场评估',
    'max-floor': '待补充楼栋数据',
    'floorplan-quality': '未发现公开吐槽，默认 1 分',
    developer: '待补充开发商数据',
    'floor-height': '待补充楼栋数据'
  };
  const futureDefaults = {
    'future-amenities': '待补充小区级规划与兑现数据',
    'future-transport': '待补充小区级规划与开通节点',
    'future-industry': '待补充小区级产业与人口数据',
    'future-supply': '待补充小区级供应与去化数据'
  };
  [...(factors.find((item) => item.id === 'quality')?.subscores || []), ...(factors.find((item) => item.id === 'future')?.subscores || [])]
    .forEach((subscore) => { subscore.current = qualityDefaults[subscore.id] || futureDefaults[subscore.id] || subscore.current; });
}

function applyOfflineScoreLookup(query = state.property) {
  clearOfflineScoreFields();
  const price = factors.find((item) => item.id === 'price');
  if (price?.priceProperty && normalizePlaceName(price.priceProperty) !== normalizePlaceName(query)
    && price.priceSource === 'manual') {
    price.pricePerSqm = null;
    delete price.priceSource;
    delete price.priceSourceLabel;
    delete price.priceSourceUrl;
    delete price.priceEvidence;
    delete price.priceDataScope;
    delete price.priceFallbackFromName;
  }
  let publicPrice = state.cityId === 'guangzhou' ? findCommunityPriceRecord(query) : null;
  if (!publicPrice && state.cityId === 'guangzhou') {
    const directoryRecord = findCommunityQualityRecord(query);
    if (directoryRecord && Number.isFinite(Number(directoryRecord.pricePerSqm)) && Number(directoryRecord.pricePerSqm) > 0) {
      publicPrice = {
        ...directoryRecord,
        sourceKind: 'community-directory',
        sourceUrl: directoryRecord.sourceUrl || state.communityQualityData?.source?.baseUrl || ''
      };
    }
  }
  // 房价优先使用多来源证据包的聚合值；只有在至少有两个独立来源时
  // 才覆盖单一目录值，避免把同一网页的重复链接误当作平均值。
  const priceEvidence = state.cityId === 'guangzhou' ? communityEvidenceMetric(query, 'pricePerSqm') : null;
  if (publicPrice && priceEvidence && Number(priceEvidence.sourceCount) >= 2
    && Number.isFinite(Number(priceEvidence.value))) {
    publicPrice = {
      ...publicPrice,
      pricePerSqm: Number(priceEvidence.value),
      sourceKind: 'multi-source-average',
      sourceUrl: priceEvidence.values?.map((item) => item.url).filter(Boolean).join('；') || publicPrice.sourceUrl
    };
  }
  const hasManualPrice = price
    && price.priceSource !== 'public-average'
    && Number.isFinite(Number(price.pricePerSqm))
    && Number(price.pricePerSqm) > 0;
  if (price && !hasManualPrice) {
    if (publicPrice) {
      price.pricePerSqm = Number(publicPrice.pricePerSqm);
      price.priceSource = 'public-average';
      const evidenceLabel = priceEvidence && typeof ResiScoreMultiSource !== 'undefined'
        ? ResiScoreMultiSource.label(priceEvidence, '房价') : '';
      price.priceSourceLabel = publicPrice.fallbackScope === 'parent-project'
        ? `小区整体均价回退（父项目：${publicPrice.fallbackFromName || '父项目'}）`
        : publicPrice.sourceKind === 'multi-source-average'
        ? `多来源公开均价（${evidenceLabel || '平均'}）`
        : publicPrice.sourceKind === 'community-directory' ? '广州住宅目录公开均价（估算）' : '房天下公开小区均价（估算）';
      price.priceSourceUrl = publicPrice.sourceUrl || state.priceData?.source?.baseUrl || '';
      price.priceEvidence = priceEvidence || null;
      price.priceProperty = query;
      price.priceDataScope = publicPrice.fallbackScope || 'phase-or-community';
      price.priceFallbackFromName = publicPrice.fallbackFromName || '';
      delete price.offlinePointRatio;
    } else {
      delete price.pricePerSqm;
      delete price.priceSource;
      delete price.priceSourceLabel;
      delete price.priceSourceUrl;
      delete price.priceProperty;
      delete price.priceEvidence;
      delete price.priceDataScope;
      delete price.priceFallbackFromName;
    }
  }
  const rawPriceOverride = readRawInputOverride(query);
  if (price && Object.prototype.hasOwnProperty.call(rawPriceOverride, 'pricePerSqm')) {
    const overrideValue = rawNumber(rawPriceOverride.pricePerSqm);
    if (overrideValue !== null && overrideValue > 0) {
      price.pricePerSqm = overrideValue;
      price.priceSource = 'manual';
      price.priceProperty = query;
      price.priceDataScope = 'user-edited';
      price.priceFallbackFromName = '';
      delete price.priceSourceLabel;
      delete price.priceSourceUrl;
      delete price.priceEvidence;
      delete price.offlinePointRatio;
    } else {
      delete price.pricePerSqm;
      delete price.priceSource;
      delete price.priceProperty;
      delete price.priceDataScope;
      delete price.priceFallbackFromName;
    }
  }
  applyCommunityBaselineScores(query);
}

function qualityRecordField(record, topLevelKey, sourceFieldKey) {
  if (!record) return null;
  // Prefer the canonical qualityFields contract when present. It carries the
  // normalized value and provenance while retaining the legacy top-level
  // fields below for older city packages.
  const structured = record.qualityFields && typeof record.qualityFields === 'object'
    ? record.qualityFields[topLevelKey] : null;
  if (structured && structured.status !== 'missing' && structured.value !== null && structured.value !== undefined && String(structured.value).trim() !== '') {
    return structured.value;
  }
  const direct = record[topLevelKey];
  if (direct !== null && direct !== undefined && String(direct).trim() !== '') return direct;
  const fields = record.qualitySourceFields && typeof record.qualitySourceFields === 'object'
    ? record.qualitySourceFields : {};
  const value = fields[sourceFieldKey];
  return value !== null && value !== undefined && String(value).trim() !== '' ? value : null;
}

function qualityRecordNumber(record, topLevelKey, sourceFieldKey) {
  const value = qualityRecordField(record, topLevelKey, sourceFieldKey);
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function qualityRecordText(record, topLevelKey, sourceFieldKey) {
  const value = qualityRecordField(record, topLevelKey, sourceFieldKey);
  return value === null || value === undefined ? '' : String(value).trim();
}

// 只有公开字段明确命中知名品牌时才给开发商品牌分，避免把“有开发商名称”
// 误当成“知名品牌”。新增品牌时只需扩充这个可审计的关键词表。
const KNOWN_DEVELOPER_BRANDS = [
  '保利', '越秀', '万科', '中海', '华润', '招商', '金地', '碧桂园', '雅居乐',
  '珠江投资', '珠江实业', '时代中国', '融创', '绿地', '龙湖', '金茂', '新世界',
  '中交', '中建', '中国铁建', '中国海外', '美的置业', '方圆地产', '合景泰富',
  '富力', '奥园', '恒大', '广州市城市建设开发', '厦广仕', '高新区投资集团', '高新投资集团'
];
// 只要已经接入开发企业名称、但名称暂未命中品牌表，就允许继续计算，
// 以 0.5 / 1 分的中性临时值参与评分，并在评分细则中标为“待确认”。
// 这样“已有底层数据但尚未确认品牌”的状态不会被误判为缺失数据。
const UNKNOWN_DEVELOPER_PROVISIONAL_SCORE = 50;

function knownDeveloperScore(value) {
  const text = String(value || '').replace(/\s/g, '');
  if (!text || /无开发商|暂无|未知|不详/.test(text)) return null;
  return KNOWN_DEVELOPER_BRANDS.some((brand) => text.includes(brand)) ? 100 : null;
}

function ensureQualityRawInputs(query, record) {
  const quality = factors.find((item) => item.id === 'quality');
  if (!quality) return {};
  if (quality.rawProperty !== query) {
    quality.rawProperty = query;
    quality.rawInputs = {};
    quality.rawEditedFields = {};
  }
  quality.rawInputs ||= {};
  const setDefault = (field, value) => {
    const hasDefault = value !== null && value !== undefined && String(value).trim() !== '';
    const hasValue = Object.prototype.hasOwnProperty.call(quality.rawInputs, field);
    // Quality data is loaded asynchronously too. Replace only the temporary
    // empty value; persisted/user-edited values remain authoritative.
    if (!hasValue || (!quality.rawEditedFields?.[field] && hasDefault)) {
      quality.rawInputs[field] = value ?? null;
    }
    return quality.rawInputs[field];
  };
  const sourceBuildYear = qualityRecordText(record, 'buildYear', '建成年代');
  const sourceYears = (sourceBuildYear.match(/20\d{2}|19\d{2}/g) || []).map(Number);
  const sourceLatestYear = sourceYears.length ? Math.max(...sourceYears) : null;
  const result = {
    buildYear: setDefault('buildYear', sourceLatestYear),
    greenRate: setDefault('greenRate', qualityRecordNumber(record, 'greenRate', '绿化率')),
    ladderHouseholdRatio: setDefault('ladderHouseholdRatio', qualityRecordNumber(record, 'ladderHouseholdRatio', '梯户比')),
    noiseDb: setDefault('noiseDb', qualityRecordNumber(record, 'noiseDb', '噪音分贝') ?? qualityRecordNumber(record, 'noiseLevel', '噪音')),
    maxFloor: setDefault('maxFloor', qualityRecordNumber(record, 'maxFloor', '最高层数')),
    // 房型质量由数据包的 0/1 分字段驱动；未导入明确负面证据时默认 1 分。
    // 兼容尚未迁移的旧记录；房型质量仅允许 0/1 分。
    layoutQuality: setDefault('layoutQuality', qualityRecordNumber(record, 'layoutQuality', '房型质量') ?? 1),
    developer: setDefault('developer', qualityRecordText(record, 'developer', '开发企业')),
    floorHeight: setDefault('floorHeight', qualityRecordNumber(record, 'floorHeight', '层高'))
  };
  const overrides = readRawInputOverride(query);
  Object.entries(overrides).forEach(([field, value]) => {
    if (field in quality.rawInputs) {
      quality.rawInputs[field] = value;
      quality.rawEditedFields[field] = true;
      result[field] = value;
    }
  });
  return result;
}

function qualityRawStatus(query, field) {
  const metricMap = { buildYear: 'buildYear', greenRate: 'greenRate', ladderHouseholdRatio: 'ladderHouseholdRatio', noiseDb: 'noiseLevel', maxFloor: 'maxFloor', layoutQuality: 'layoutQuality', developer: 'developer', floorHeight: 'floorHeight' };
  // Keep the canonical quality package's explicit status visible even when
  // the evidence index has downgraded an estimate to a generic provisional
  // metric because it has fewer than three independent sources.
  const canonical = findCommunityQualityRecord(query)?.qualityFields?.[metricMap[field]];
  if (canonical?.status === 'estimated') return 'estimated';
  const metric = communityEvidenceMetric(query, 'quality')?.fieldMetrics?.[metricMap[field]];
  // A legacy record can still expose a direct value while its evidence metric
  // is missing. Treat that value as provisional rather than displaying it as
  // confirmed; an explicitly edited user value is handled by the caller.
  if (metric?.status === 'estimated') return 'estimated';
  return metric?.needsConfirmation || ['provisional', 'missing'].includes(metric?.status) ? 'provisional' : 'confirmed';
}

function scoreGreenRate(value) {
  const rate = rawNumber(value);
  // 没有可靠的全市分位数数据时，直接按公开原始值区间线性换算。
  return Number.isFinite(rate) ? interpolateScore(rate, [[0, 0], [20, 50], [30, 75], [40, 100]]) : null;
}

function scoreLadderHouseholdRatio(value) {
  const ratio = rawNumber(value);
  return Number.isFinite(ratio) ? ratio < 50 ? 100 : ratio <= 80 ? 50 : 0 : null;
}

function scoreNoiseDb(value) {
  const db = rawNumber(value);
  // 噪音越低越好；区间端点对应页面展示的实际分值。
  return Number.isFinite(db) ? interpolateScore(db, [[45, 100], [55, 75], [65, 50], [75, 0]]) : null;
}

function scoreFloorHeight(value) {
  const height = rawNumber(value);
  // 住宅层高 2 米及以下不得分，2–3 米每增加 0.1 米增加 0.1 分，3 米封顶。
  return Number.isFinite(height) ? interpolateScore(height, [[2, 0], [3, 100]]) : null;
}

function rawNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function renderRuleCurrent(text) {
  const provisional = /待确认|需进一步确认|估算|待补充|未接入|待现场评估/.test(String(text || ''));
  return `<span class="rule-current${provisional ? ' is-provisional' : ''}">${escapeHtml(text || '待补充')}</span>`;
}

function futureRawOverrideKey(subscoreId) {
  return `futureRaw:${subscoreId}`;
}

function renderFutureScoreSummary(factor) {
  const items = factor?.subscores || [];
  return `<div class="future-score-summary raw-data-panel">
    <div class="raw-data-panel-head"><strong>未来潜力原始分项数据</strong><span>这里修改百分制原始代理分；下方规则会按权重自动折算为贡献分</span></div>
    <div class="future-score-grid">${items.map((item) => {
      const score = rawNumber(item.score);
      const provisional = /待确认|需进一步确认|估算|待补充|未接入/.test(String(item.current || item.offlineSource || ''));
      const inputClass = `future-raw-input ${provisional ? 'raw-data-provisional' : 'raw-data-confirmed'}`;
      return `<label class="future-score-box${provisional ? ' is-provisional' : ''}">
        <span class="future-score-name">${escapeHtml(item.name)}</span>
        <span class="future-score-input-wrap"><input class="${inputClass}" data-factor-id="future" data-subscore-id="${item.id}" type="number" min="0" max="100" step="0.1" value="${Number.isFinite(score) ? formatNumber(score) : ''}" aria-label="未来潜力${item.name}原始分" /><small> / 100 分</small></span>
        <small class="future-score-source" title="${escapeHtml(item.current || item.offlineSource || '')}">${escapeHtml(item.current || item.offlineSource || '待补充')}</small>
      </label>`;
    }).join('')}</div>
  </div>`;
}

function applyCommunityBaselineScores(query = state.property) {
  const record = findCommunityQualityRecord(query);
  const quality = factors.find((item) => item.id === 'quality');
  const future = factors.find((item) => item.id === 'future');
  const raw = ensureQualityRawInputs(query, record);
  // 每次根据原始值重建品质分项，避免用户把某个字段清空后沿用旧分数。
  quality?.subscores?.forEach((item) => {
    item.score = null;
    delete item.offlineSource;
  });
  if (!record) {
    if (quality) quality.dataCoverage = {
      recordName: query,
      sourceUrl: '',
      available: [],
      missing: (quality.subscores || []).map((item) => item.name)
    };
    if (future) future.dataCoverage = {
      recordName: query,
      available: [],
      missing: (future.subscores || []).map((item) => item.name),
      source: '当前小区未匹配广州品质目录记录；未来数据包也未接入'
    };
    return;
  }
  const set = (factor, id, score, text, source = '公开小区目录字段', evidenceMetric = null, evidenceNoun = '数据') => {
    const item = factor?.subscores?.find((subscore) => subscore.id === id);
    if (!item || score === null || score === undefined || score === '' || !Number.isFinite(Number(score))) return;
    item.score = round1(Math.max(0, Math.min(100, score)));
    const editedField = { age: 'buildYear', greenery: 'greenRate', developer: 'developer', 'floorplan-quality': 'layoutQuality', 'max-floor': 'maxFloor', 'elevator-household': 'ladderHouseholdRatio', noise: 'noiseDb', 'floor-height': 'floorHeight' }[id];
    const userEdited = factor?.id === 'quality' && editedField && quality.rawEditedFields?.[editedField];
    const evidenceLabel = !userEdited && evidenceMetric ? communityEvidenceLabel(query, evidenceMetric, evidenceNoun) : '';
    const fallbackName = !userEdited && editedField ? record.fallbackFields?.[editedField] : '';
    const fallbackLabel = fallbackName ? `小区整体数据回退（父项目：${fallbackName}）` : '';
    item.offlineSource = userEdited ? '用户填写' : [source, evidenceLabel, fallbackLabel].filter(Boolean).join(' · ');
    item.current = [text, fallbackLabel].filter(Boolean).join(' · ');
  };
  const latestYear = rawNumber(raw.buildYear);
  const age = latestYear ? Math.max(0, new Date().getFullYear() - latestYear) : null;
  const underConstruction = /在建|待交付|建设中/.test(qualityRecordText(record, 'constructionStatus', '建设状态'));
  const ageScore = underConstruction ? 100 : age === null ? null : age <= 2 ? 100 : age <= 5 ? 75 : age <= 10 ? 50 : age <= 20 ? 25 : 0;
  const green = rawNumber(raw.greenRate);
  const greenScore = scoreGreenRate(green);
  const officialGreen = qualityRecordNumber(record, 'officialGreenRate', '官方绿地率');
  set(quality, 'age', ageScore, underConstruction
    ? `项目在建，预计 ${qualityRecordField(record, 'plannedHandoverYear', '预计交付') || '待定'} 年交付`
    : age === null ? '' : `建成年代 ${latestYear}，房龄约 ${age} 年`, record.sourceLabel || '公开小区目录字段', 'quality', '品质');
  set(quality, 'greenery', greenScore, Number.isFinite(green)
    ? `平台绿化率 ${formatNumber(green)}%${Number.isFinite(officialGreen) ? `；官方规划绿地率 ${formatNumber(officialGreen)}%` : ''}`
    : '', record.sourceLabel || '公开小区目录字段', 'quality', '品质');
  const developer = String(raw.developer || '').trim();
  const developerScore = knownDeveloperScore(developer);
  const developerWasEdited = Boolean(quality.rawEditedFields?.developer);
  const developerScoreForCalculation = developer && developerScore === null
    ? UNKNOWN_DEVELOPER_PROVISIONAL_SCORE
    : developerScore;
  set(quality, 'developer', developerScoreForCalculation, `开发企业 ${developer}`, developerWasEdited ? '用户填写' : '公开小区目录字段', 'quality', '品质');
  const developerItem = quality?.subscores?.find((item) => item.id === 'developer');
  if (developerItem && developer && developerScore === null) {
    const developerFallback = !quality.rawEditedFields?.developer && record.fallbackFields?.developer
      ? ` · 小区整体数据回退（父项目：${record.fallbackFields.developer}）` : '';
    if (developerWasEdited) {
      developerItem.offlineSource = '用户填写 · 待确认';
      developerItem.current = `开发企业 ${developer}，未命中知名品牌表，暂按中性值 0.5 / 1 分，待确认后可人工调整`;
    } else {
      developerItem.offlineSource = `公开小区目录字段 · 待确认${developerFallback}`;
      developerItem.current = `开发企业 ${developer}，未命中知名品牌表，暂按中性值 0.5 / 1 分，待确认后可人工调整${developerFallback}`;
    }
  }

  // 车位总数仍可作为公开资料展示，但不再参与小区品质评分；房型质量
  // 只使用数据包中的 0/1 分，未导入明确负面证据时默认 1 分。
  const parkingCount = qualityRecordNumber(record, 'parkingCount', '车位数');
  const advertisedParkingCount = qualityRecordNumber(record, 'advertisedParkingCount', '宣传车位数');
  const buildingCount = qualityRecordNumber(record, 'buildingCount', '楼栋总数');
  const plotRatio = qualityRecordNumber(record, 'plotRatio', '容积率');
  const layoutQuality = rawNumber(raw.layoutQuality);
  const layoutQualityItem = quality?.subscores?.find((item) => item.id === 'floorplan-quality');
  const layoutField = record.qualityFields?.layoutQuality || {};
  const layoutEvidence = record.qualityFields?.layoutQualityEvidence || record.layoutQualityEvidence || layoutField.evidence || {};
  const layoutSource = layoutEvidence.source || layoutField.source || {};
  const hasNegativeLayoutEvidence = layoutQuality === 0 || layoutEvidence.status === 'negative-evidence';
  const layoutText = hasNegativeLayoutEvidence
    ? `公开信息指出房型问题${layoutEvidence.evidenceText || layoutEvidence.excerpt ? `：${layoutEvidence.evidenceText || layoutEvidence.excerpt}` : ''}`
    : '未发现公开房型负面吐槽，默认 1 分';
  set(quality, 'floorplan-quality', hasNegativeLayoutEvidence ? 0 : 100, layoutText,
    quality.rawEditedFields?.layoutQuality ? '用户填写' : (layoutSource.name || '房型质量默认规则'), 'quality', '品质');
  if (layoutQualityItem && layoutQuality === null) layoutQualityItem.current = '未发现公开吐槽，默认 1 分';
  const maxFloor = rawNumber(raw.maxFloor);
  const maxFloorScore = Number.isFinite(maxFloor) ? (maxFloor < 25 ? 100 : maxFloor <= 32 ? 50 : 0) : null;
  set(quality, 'max-floor', maxFloorScore, Number.isFinite(maxFloor) ? `最高 ${maxFloor} 层` : '', record.sourceLabel || '公开小区目录字段', 'quality', '品质');
  set(quality, 'elevator-household', scoreLadderHouseholdRatio(raw.ladderHouseholdRatio), rawNumber(raw.ladderHouseholdRatio) !== null ? `梯户比 ${formatNumber(rawNumber(raw.ladderHouseholdRatio))} 户/梯` : '', record.sourceLabel || '用户/公开小区目录字段', 'quality', '品质');
  set(quality, 'noise', scoreNoiseDb(raw.noiseDb), rawNumber(raw.noiseDb) !== null ? `实测噪音 ${formatNumber(rawNumber(raw.noiseDb))} dB` : '', record.sourceLabel || '用户/公开小区目录字段', 'quality', '品质');
  set(quality, 'floor-height', scoreFloorHeight(raw.floorHeight), rawNumber(raw.floorHeight) !== null ? `层高 ${formatNumber(rawNumber(raw.floorHeight))} m` : '', record.sourceLabel || '用户/公开小区目录字段', 'quality', '品质');
  const qualityMissing = (quality?.subscores || [])
    .filter((item) => item.score === null || item.score === undefined || item.score === '' || !Number.isFinite(Number(item.score)))
    .map((item) => item.name);
  const qualityEvidence = communityEvidenceMetric(query, 'quality');
  const qualityFieldMetrics = qualityEvidence?.fieldMetrics && typeof qualityEvidence.fieldMetrics === 'object'
    ? qualityEvidence.fieldMetrics : {};
  const qualityFieldLabels = {
    buildYear: '建成年代', greenRate: '绿化率', plotRatio: '容积率', parkingCount: '车位数', layoutQuality: '房型质量',
    buildingCount: '楼栋总数', developer: '开发企业', propertyCompany: '物业公司',
    householdCount: '住宅总户数', maxFloor: '最高楼层', floorHeight: '层高',
    ladderHouseholdRatio: '梯户比', noiseLevel: '噪音'
  };
  const qualityMissingReasons = Object.entries(qualityFieldMetrics)
    .filter(([, metric]) => metric?.status === 'missing' || metric?.needsConfirmation)
    .map(([field, metric]) => `${qualityFieldLabels[field] || field}：${metric.reason || (metric.status === 'missing' ? '公开详情未提供该字段' : '来源不足，需进一步确认')}`);
  quality.dataCoverage = {
    recordName: record.name,
    dataScope: record.fallbackScope || 'phase-or-community',
    fallbackFromName: record.fallbackFromName || '',
    fallbackFields: record.fallbackFields || {},
    sourceUrl: record.sourceUrl || '',
    available: [
      Number.isFinite(ageScore) ? '建成年代' : null,
      Number.isFinite(greenScore) ? '绿化率' : null,
      Number.isFinite(officialGreen) ? `官方规划绿地率 ${formatNumber(officialGreen)}%` : null,
      developer ? `开发企业 ${developer}` : null,
      Number.isFinite(parkingCount) ? `公开车位总数 ${formatNumber(parkingCount)} 个（仅资料，不参与评分）` : null,
      Number.isFinite(advertisedParkingCount) && advertisedParkingCount !== parkingCount ? `宣传车位口径 ${formatNumber(advertisedParkingCount)} 个（仅资料）` : null,
      Number.isFinite(qualityRecordNumber(record, 'householdCount', '规划户数')) ? `规划户数 ${formatNumber(qualityRecordNumber(record, 'householdCount', '规划户数'))} 户` : null,
      Number.isFinite(buildingCount) ? `楼栋总数 ${formatNumber(buildingCount)} 栋` : null,
      Number.isFinite(plotRatio) ? `容积率 ${formatNumber(plotRatio)}` : null,
      Number.isFinite(maxFloor) ? `最高层数 ${maxFloor} 层` : null
    ].filter(Boolean),
    missing: qualityMissing,
    missingReasons: qualityMissingReasons,
    sourceLabel: record.fallbackFields && Object.keys(record.fallbackFields).length
      ? `${record.sourceLabel || '广州小区公开目录'} · 部分字段回退父项目`
      : (record.sourceLabel || '广州小区公开目录'),
    sourceUrls: record.sourceUrls || (record.sourceUrl ? [record.sourceUrl] : [])
  };
  const futureItems = future?.subscores || [];
  futureItems.forEach((item) => {
    item.score = null;
    delete item.offlineSource;
    item.current = '未接入可审计的小区级规划、产业或供需数据';
  });
  future.dataCoverage = {
    recordName: record.name,
    available: [],
    missing: futureItems.map((item) => item.name),
    source: '当前广州离线包没有小区级规划、产业人口导入或供应去化字段；将由广州11区区域规划代理包补充并标注为片区代理'
  };
}

// 未来潜力没有覆盖全市 5743 个小区的逐户规划字段，因此使用可审计的
// 项目/片区公开证据做“区域代理”。生活成熟度和交通兑现度取当前小区已经
// 算出的公开点位/路线结果；产业与供需使用所属片区的官方规划档案。所有
// 代理项都在页面标明范围，避免把片区规划误称为小区承诺。
function applyDerivedFutureScores(query = state.property) {
  const future = factors.find((item) => item.id === 'future');
  if (!future) return;
  const profile = futureDistrictProfile(query);
  const communityEvidence = findCommunityFutureEvidence(query);
  const items = future.subscores || [];
  const overrides = readRawInputOverride(query);
  if (!profile) {
    const available = [];
    const missing = [];
    items.forEach((item) => {
      const overrideKey = futureRawOverrideKey(item.id);
      const override = overrides[overrideKey];
      if (Object.prototype.hasOwnProperty.call(overrides, overrideKey) && Number.isFinite(Number(override))) {
        item.score = round1(Math.max(0, Math.min(100, Number(override))));
        item.current = `用户填写原始分 ${item.score} 分`;
        item.offlineSource = '用户填写原始数据';
        available.push(item.name);
      } else {
        item.score = null;
        delete item.offlineSource;
        item.current = '未接入可审计的小区级规划、产业或供需数据';
        missing.push(item.name);
      }
    });
    future.dataCoverage = {
      ...(future.dataCoverage || {}),
      recordName: query,
      available,
      missing,
      source: '当前没有匹配到带官方规划证据的区域代理档案；广州11区规划代理包已覆盖区级产业与供需字段'
    };
    return;
  }
  const set = (id, rawScore, current, source) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || !Number.isFinite(Number(rawScore))) return false;
    item.score = round1(Math.max(0, Math.min(100, Number(rawScore))));
    item.current = current;
    item.offlineSource = source;
    return true;
  };
  const setWithOverride = (id, rawScore, current, source) => {
    const overrideKey = futureRawOverrideKey(id);
    if (Object.prototype.hasOwnProperty.call(overrides, overrideKey) && Number.isFinite(Number(overrides[overrideKey]))) {
      const value = round1(Math.max(0, Math.min(100, Number(overrides[overrideKey]))));
      return set(id, value, `用户填写原始分 ${value} 分`, '用户填写原始数据');
    }
    return set(id, rawScore, current, source);
  };
  const life = lifeResourceBreakdown();
  const lifeScore = life.ready ? life.total / LIFE_BASE_MAX_POINTS * 100 : null;
  const transport = factors.find((item) => item.id === 'transport');
  const transportDetail = transport ? transportAssessment(transport) : null;
  const transportScore = transportDetail?.ready
    ? (Number(transportDetail.distanceScore) + Number(transportDetail.stationLevelScore))
    : null;
  const available = [];
  const missing = [];
  if (setWithOverride('future-amenities', lifeScore,
    life.ready ? `当前生活配套 ${round1(life.total)}/${LIFE_BASE_MAX_POINTS}，折算 ${round1(lifeScore)} 分（小区当前成熟度代理）` : '等待当前小区生活配套数据',
    '当前生活配套公开点位代理')) available.push('生活配套成熟度'); else missing.push('生活配套成熟度');
  if (setWithOverride('future-transport', transportScore,
    Number.isFinite(transportScore) ? `当前交通位置 ${round1(transportScore)} 分（小区当前线路兑现代理）` : '等待当前小区交通路线数据',
    '当前交通位置公开路线代理')) available.push('交通兑现度'); else missing.push('交通兑现度');
  const industry = Number(profile.scores?.futureIndustry);
  const supply = Number(profile.scores?.futureSupply);
  if (setWithOverride('future-industry', industry, `${profile.name || profile.district}公开产业/人口规划代理 ${round1(industry)} 分`, '片区公开规划代理')) available.push('产业与人口导入'); else missing.push('产业与人口导入');
  if (setWithOverride('future-supply', supply, `${profile.name || profile.district}公开供给与更新规划代理 ${round1(supply)} 分`, '片区公开规划代理')) available.push('供需竞争压力'); else missing.push('供需竞争压力');
  future.dataCoverage = {
    recordName: query,
    mode: 'district-proxy',
    scope: profile.scope || 'district',
    scoreStatus: profile.scoreStatus || 'proxy',
    confidence: profile.confidence || 'medium',
    district: profile.district,
    available,
    missing,
    source: `已使用${profile.district}片区公开规划与当前小区生活/交通数据代理；不是小区级规划承诺（${profile.confidence || 'medium'}可信度）${communityEvidence?.fallbackScope === 'parent-project' ? `；当前期缺少独立规划证据，回退父项目「${communityEvidence.fallbackFromName || '父项目'}」` : ''}`,
    sourceIds: profile.sourceIds || [],
    sourceUrls: [...new Set([...(profile.sourceUrls || []), ...(communityEvidence?.sourceUrls || [])])],
    evidenceScope: communityEvidence?.scope || profile.scope || 'district',
    evidenceStatus: communityEvidence?.status || 'regional-plan',
    evidenceText: communityEvidence?.evidence || profile.evidenceSummary || '',
    scoreMethod: profile.scoreMethod || {},
    profileConfidence: profile.confidence || 'medium'
  };
}

function centerSubscoreScore(factor, subscore) {
  if (Number.isFinite(Number(subscore.offlinePointRatio))) {
    return round1(Number(subscore.offlinePointRatio) * (Number(subscore.max) || 100));
  }
  if (subscore.id === 'cbd-distance') {
    return interpolateScore(factor.distanceKm, [[3, 50], [8, 42], [15, 32], [25, 18], [40, 0]]);
  }
  if (subscore.id === 'peak-transit-time') {
    return interpolateScore(factor.peakTransitMinutes, [[25, 50], [35, 42], [50, 32], [70, 18], [100, 0]]);
  }
  return subscore.score;
}

function subscoreScore(factor, subscore) {
  if (factor.id === 'school') {
    const detail = schoolResourceBreakdown();
    if (!detail.ready) return null;
    return subscore.id === 'school-elementary' ? detail.elementary : detail.middle;
  }
  if (factor.id === 'life') return subscore.points;
  if (factor.id === 'transport') {
    const assessment = transportAssessment(factor);
    if (assessment) {
      if (!assessment.ready) return null;
      return subscore.id === 'station-distance' ? assessment.distanceScore : assessment.stationLevelScore;
    }
  }
  return factor.id === 'center' ? centerSubscoreScore(factor, subscore) : subscore.score;
}

function subscorePointCap(factor, subscore) {
  if (Number.isFinite(Number(subscore.configuredMaxPoints))) return Math.max(0, Number(subscore.configuredMaxPoints));
  if (factor.id === 'life') {
    const baseMax = Number(subscore.maxPoints) || 0;
    return round2(baseMax * lifeSubscoreScale(factor, subscore));
  }
  const hasConfiguredPoints = subscore.points !== null && subscore.points !== '' && Number.isFinite(Number(subscore.points));
  if (!hasConfiguredPoints) return factor.weight / factor.subscores.length;
  const configuredTotal = factor.subscores.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const scale = configuredTotal > 0 ? factor.weight / configuredTotal : 1;
  return Number(subscore.points) * scale;
}

function subscorePoints(factor, subscore) {
  const hasPoints = subscore.points !== null && subscore.points !== '' && Number.isFinite(Number(subscore.points));
  if (factor.id === 'life') {
    if (!hasPoints) return null;
    return round2(Number(subscore.points) * lifeSubscoreScale(factor, subscore));
  }
  const rawMax = Number(subscore.max) || 100;
  const rawScore = subscoreScore(factor, subscore);
  if (rawScore === null || rawScore === undefined || rawScore === '' || !Number.isFinite(Number(rawScore))) return null;
  return Number(rawScore) / rawMax * subscorePointCap(factor, subscore);
}

function subscoreCurrentActual(factor, subscore) {
  return Number.isFinite(Number(subscore.manualPoints))
    ? Number(subscore.manualPoints)
    : subscorePoints(factor, subscore);
}

function applyFactorWeightChange(factor, nextWeight) {
  const oldWeight = Number(factor.weight) || 0;
  const value = Math.min(100, Math.max(1, round1(nextWeight)));
  if (!Number.isFinite(value)) return;
  if (!factor.subscores) {
    if (state.manualMode && Number.isFinite(Number(factor.manualPoints)) && oldWeight > 0) {
      factor.manualPoints = round1(Number(factor.manualPoints) / oldWeight * value);
    }
    factor.weight = value;
    return;
  }
  if (factor.id === 'life') {
    factor.weight = value;
    if (state.manualMode && oldWeight > 0) {
      const ratio = value / oldWeight;
      factor.subscores.forEach((subscore) => {
        if (!Number.isFinite(Number(subscore.manualPoints))) return;
        const nextCap = subscorePointCap(factor, subscore);
        const nextValue = subscore.id === LIFE_BONUS_SUBSCORE_ID
          ? Number(subscore.manualPoints)
          : Number(subscore.manualPoints) * ratio;
        subscore.manualPoints = round2(Math.min(nextCap, Math.max(0, nextValue)));
      });
    }
    return;
  }
  const oldCaps = factor.subscores.map((subscore) => subscorePointCap(factor, subscore));
  const oldActuals = factor.subscores.map((subscore) => subscoreCurrentActual(factor, subscore));
  const hasConfiguredCaps = factor.subscores.some((subscore) => Number.isFinite(Number(subscore.configuredMaxPoints)));
  factor.weight = value;
  if (hasConfiguredCaps || state.manualMode) {
    factor.subscores.forEach((subscore, index) => {
      const nextCap = oldWeight > 0 ? oldCaps[index] / oldWeight * value : value / factor.subscores.length;
      subscore.configuredMaxPoints = round1(nextCap);
      if (state.manualMode && Number.isFinite(Number(oldActuals[index]))) {
        const ratio = oldCaps[index] > 0 ? oldActuals[index] / oldCaps[index] : 0;
        subscore.manualPoints = round1(Math.min(subscore.configuredMaxPoints, Math.max(0, ratio * subscore.configuredMaxPoints)));
      }
    });
  }
}

function applySubscoreMaxChange(factor, subscore, requestedMax) {
  if (!factor?.subscores?.length || !subscore) return;
  const oldCaps = factor.subscores.map((item) => subscorePointCap(factor, item));
  const oldActuals = factor.subscores.map((item) => subscoreCurrentActual(factor, item));
  const editedIndex = factor.subscores.indexOf(subscore);
  const total = Math.max(0, Number(factor.weight) || 0);
  const editedMax = Math.min(total, Math.max(0, round1(Number(requestedMax))));
  const nextCaps = Array(factor.subscores.length).fill(0);
  nextCaps[editedIndex] = editedMax;
  const otherIndexes = factor.subscores.map((_, index) => index).filter((index) => index !== editedIndex);
  const remaining = Math.max(0, total - editedMax);
  const oldOtherTotal = otherIndexes.reduce((sum, index) => sum + Math.max(0, Number(oldCaps[index]) || 0), 0);
  let assigned = 0;
  otherIndexes.forEach((index, position) => {
    if (position === otherIndexes.length - 1) {
      nextCaps[index] = round1(Math.max(0, remaining - assigned));
      return;
    }
    const share = oldOtherTotal > 0
      ? Math.max(0, Number(oldCaps[index]) || 0) / oldOtherTotal
      : 1 / otherIndexes.length;
    nextCaps[index] = round1(remaining * share);
    assigned += nextCaps[index];
  });
  factor.subscores.forEach((item, index) => {
    item.configuredMaxPoints = nextCaps[index];
    if (state.manualMode && Number.isFinite(Number(oldActuals[index]))) {
      const oldCap = Number(oldCaps[index]) || 0;
      const ratio = oldCap > 0 ? oldActuals[index] / oldCap : 0;
      item.manualPoints = round1(Math.min(nextCaps[index], Math.max(0, ratio * nextCaps[index])));
    }
  });
}

function factorScore(factor) {
  // 人工修正模式下，页面顶部和保存快照都应使用同一组人工分项值。
  // 之前这里仍读取学区/品质等维度的自动百分制分数，导致分项明细已经
  // 显示人工值，但维度状态、缺失判断和更新后的快照却走了另一条路径。
  // 统一从 factorPoints() 反推百分制展示值，避免两套计算结果分叉。
  if (state.manualMode && (factor.subscores || Number.isFinite(Number(factor.manualPoints)))) {
    const points = factorPoints(factor);
    return Number.isFinite(Number(points)) && Number(factor.weight) > 0
      ? round1(Number(points) / Number(factor.weight) * 100)
      : null;
  }
  if (factor.id === 'price') return pricePressureRawScore(factor);
  if (factor.id === 'school') return schoolResourceBreakdown().total;
  if (factor.id === 'life') {
    const total = lifeScaledTotal(factor);
    return Number.isFinite(total) && Number(factor.weight) > 0 ? round1(total / factor.weight * 100) : null;
  }
  if (factor.id === 'transport' && Array.isArray(factor.transportRoutes) && !transportAssessment(factor).ready) return null;
  if (!factor.subscores) return factor.score;
  if (factor.id === 'quality' || factor.id === 'future') {
    const points = displayedPointTotal(factor);
    if (!Number.isFinite(points)) return null;
    return round1(points / factor.weight * 100);
  }
  if (factor.id === 'transport') {
    const points = displayedPointTotal(factor);
    if (!Number.isFinite(points)) return null;
    return round1(points / factor.weight * 100);
  }
  if (factor.id === 'center') {
    const values = factor.subscores.map((item) => subscoreScore(factor, item));
    if (values.some((value) => !Number.isFinite(value))) return null;
    return round1(values.reduce((sum, value) => sum + value, 0));
  }
  return round1(factor.subscores.reduce((sum, item) => sum + subscoreScore(factor, item), 0));
}
function factorPoints(factor) {
  if (state.manualMode) {
    if (factor.subscores) {
      const values = factor.subscores.map((subscore) => {
        const maxPoints = subscorePointCap(factor, subscore);
        return Number.isFinite(Number(subscore.manualPoints)) ? Math.min(maxPoints, Math.max(0, Number(subscore.manualPoints))) : null;
      });
      if (values.every((value) => value !== null)) {
        const rawTotal = values.reduce((sum, value) => sum + value, 0);
        if (factor.id === 'school') {
          if (schoolDistrict.nineYearContinuity === null) return null;
          const bonus = schoolDistrict.nineYearContinuity === true ? 1.2 : 1;
          return round1(Math.min(factor.weight, rawTotal * bonus));
        }
        return factor.id === 'life' ? round1(Math.min(factor.weight, rawTotal)) : round1(rawTotal);
      }
      return null;
    } else if (Number.isFinite(Number(factor.manualPoints))) {
      return round1(Math.min(factor.weight, Math.max(0, Number(factor.manualPoints))));
    }
  }
  if (factor.id === 'price') {
    const hasPrice = factor.pricePerSqm !== null && factor.pricePerSqm !== undefined && String(factor.pricePerSqm).trim() !== '';
    if (!hasPrice) return Number.isFinite(Number(factor.offlinePointRatio)) ? round1(Number(factor.offlinePointRatio) * factor.weight) : null;
    return pricePressurePoints(factor.pricePerSqm, factor.weight);
  }
  if (factor.id === 'life') {
    return lifeScaledTotal(factor);
  }
  const score = factorScore(factor);
  return Number.isFinite(score) ? round1(score * factor.weight / 100) : null;
}

function uniqueSchoolNames(names) {
  return [...new Set((names || []).map((name) => String(name || '').trim()).filter(Boolean))];
}

function schoolRankingEstimate(name, levelLabel) {
  const data = state.schoolDistrictData?.data;
  const estimates = data?.rankingEstimates?.[levelLabel] || {};
  const normalized = normalizeSchoolLookupText(name);
  const entry = Object.entries(estimates).find(([school]) => normalizeSchoolLookupText(school) === normalized);
  if (!entry) return null;
  const totalSchools = Number(levelLabel === '小学'
    ? data.rankingEstimatePolicy?.primaryTotalSchools
    : data.rankingEstimatePolicy?.middleTotalSchools);
  if (!Number.isFinite(totalSchools) || totalSchools < 1) return null;
  return { rank: Number(entry[1]), totalSchools, rankingSource: 'estimate' };
}

function applySchoolLookup(query) {
  if (!state.schoolDistrictData?.search) return;
  let result = state.schoolDistrictData.search(query);
  let schoolDataScope = 'phase-or-community';
  let schoolFallbackFromName = '';
  // 已标准化的多个行政区共用一套查询入口。先保留当前包的精确命中，
  // 未命中时再逐包尝试，避免用户必须手动猜测小区所属行政区。
  const hasMapping = (value) => Boolean(value?.confirmedMapping)
    || Boolean(value?.elementary?.length)
    || Boolean(value?.middle?.length)
    || Boolean(value?.provisionalMapping?.elementary?.length)
    || Boolean(value?.provisionalMapping?.middle?.length)
    || Boolean(value?.provisionalMapping?.unclassifiedSchools?.length);
  if (!hasMapping(result)) {
    const packages = Object.entries(state.schoolDistrictPackages || {});
    for (const [districtId, packageData] of packages) {
      if (!packageData?.search || packageData === state.schoolDistrictData) continue;
      const candidate = packageData.search(query);
      if (!hasMapping(candidate)) continue;
      state.schoolDistrictData = packageData;
      state.schoolDistrictId = districtId;
      state.schoolDistrictManifest = packageData.manifest || state.schoolDistrictManifest;
      result = candidate;
      break;
    }
  }
  // 分期学区没有独立映射时，只回退到同一项目的父名称；不把其他期的学校
  // 记录当成当前期数据。页面会明确标注这一回退，后续补录期级招生地段后
  // 可直接覆盖父项目结果。
  if (!hasMapping(result) && communityPhaseLabel(query)) {
    const phase = findCommunityPhaseRecord(query);
    const parentName = phase?.parentName || communityPhaseBaseName(query);
    if (parentName && parentName !== query) {
      const parentResult = state.schoolDistrictData.search(parentName);
      if (hasMapping(parentResult)) {
        result = parentResult;
        schoolDataScope = 'parent-project';
        schoolFallbackFromName = parentName;
      }
    }
  }
  const confirmed = result.confirmedMapping;
  const provisional = result.provisionalMapping;
  const officialElementaryNames = uniqueSchoolNames(result.elementary.map((row) => row.school));
  const provisionalElementaryNames = uniqueSchoolNames(provisional?.elementary || []);
  const elementaryNames = uniqueSchoolNames(confirmed?.elementary || (officialElementaryNames.length ? officialElementaryNames : provisionalElementaryNames));
  const elementaryUsesProvisional = !confirmed?.elementary && !officialElementaryNames.length && provisionalElementaryNames.length > 0;
  const hasElementaryLottery = result.elementary.some((row) => /联合划片|电脑随机派位|摇号/.test(row.coverage));
  const elementaryMode = confirmed?.elementaryMode || (elementaryUsesProvisional
    ? 'lottery'
    : (elementaryNames.length > 1 || hasElementaryLottery ? 'lottery' : 'fixed'));
  schoolDistrict.elementary.mode = elementaryMode;
  const elementaryProbability = elementaryMode === 'lottery' && elementaryNames.length
    ? 1 / elementaryNames.length
    : 1;
  schoolDistrict.elementary.schools = elementaryNames.length
    ? elementaryNames.map((name) => ({ name, ...(schoolRankingEstimate(name, '小学') || { rank: null, totalSchools: null }), probability: elementaryProbability }))
    : [{ name: '', rank: null, totalSchools: null, probability: elementaryMode === 'fixed' ? 1 : null }];

  const directGroups = result.middle.filter((group) => group.mode === 'direct');
  const lotteryGroups = result.middle.filter((group) => group.mode === 'lottery');
  const selectedGroups = directGroups.length ? directGroups : lotteryGroups;
  const officialMiddleNames = uniqueSchoolNames(selectedGroups.flatMap((group) => group.schools));
  const provisionalMiddleNames = uniqueSchoolNames(provisional?.middle || []);
  const middleNames = uniqueSchoolNames(confirmed?.middle || (officialMiddleNames.length ? officialMiddleNames : provisionalMiddleNames));
  const middleUsesProvisional = !confirmed?.middle && !officialMiddleNames.length && provisionalMiddleNames.length > 0;
  const middleMode = confirmed?.middleMode || (middleUsesProvisional ? 'lottery' : (directGroups.length ? 'fixed' : 'lottery'));
  schoolDistrict.middle.mode = middleNames.length ? middleMode : 'lottery';
  const middleProbability = middleMode === 'lottery' && middleNames.length
    ? 1 / middleNames.length
    : 1;
  schoolDistrict.middle.schools = middleNames.length
    ? middleNames.map((name) => ({ name, ...(schoolRankingEstimate(name, '初中') || { rank: null, totalSchools: null }), probability: middleProbability }))
    : [{ name: '', rank: null, totalSchools: null, probability: null }];

  const elementaryHasNineYearDirect = selectedGroups.some((group) => {
    const middleNamesInGroup = group.schools || [];
    return middleNamesInGroup.some((middle) => /九年制|九年一贯/.test(middle)) || elementaryNames.some((primary) => middleNamesInGroup.some((middle) => {
      const a = String(primary).replace(/小学部/g, '');
      return normalizeSchoolLookupText(middle) === normalizeSchoolLookupText(a);
    }));
  });
  schoolDistrict.nineYearContinuity = confirmed?.nineYearContinuity
    ?? (elementaryUsesProvisional || middleUsesProvisional
      ? false
      : (middleNames.length ? elementaryHasNineYearDirect : null));
  schoolDistrict.mappingMeta = {
    provisional: elementaryUsesProvisional || middleUsesProvisional || Boolean(provisional?.unclassifiedSchools?.length),
    elementary: confirmed?.elementary ? 'confirmed' : (elementaryUsesProvisional ? (provisional?.sourceKind || 'third-party-nearby') : (officialElementaryNames.length ? 'official-text' : 'missing')),
    middle: confirmed?.middle ? 'confirmed' : (middleUsesProvisional ? (provisional?.sourceKind || 'third-party-nearby') : (officialMiddleNames.length ? 'official-text' : 'missing')),
    sourceUrls: provisional?.sourceUrls || [],
    sourceName: provisional?.sourceName || '',
    sourceKind: provisional?.sourceKind || '',
    notice: provisional?.notice || '',
    unclassifiedSchools: provisional?.unclassifiedSchools || []
  };
  state.schoolLookup = {
    query: query.trim(), ...result, error: '', dataScope: schoolDataScope,
    fallbackFromName: schoolFallbackFromName,
    elementarySchools: elementaryNames,
    middleSchools: middleNames,
    provisionalUsed: { elementary: elementaryUsesProvisional, middle: middleUsesProvisional }
  };
  // A user-confirmed school edit is a local overlay on top of the published
  // admissions package. It is applied only after the public lookup has built
  // its baseline, and is explicitly labelled so it cannot be mistaken for
  // an official mapping.
  const schoolOverrides = readConfirmedOfflineOverridePackage().school || {};
  const schoolKey = typeof communityCanonicalName === 'function' ? communityCanonicalName(query) : query;
  const confirmedSchool = schoolOverrides?.[state.cityId]?.[schoolKey];
  if (confirmedSchool && typeof confirmedSchool === 'object') {
    Object.keys(schoolDistrict).forEach((key) => delete schoolDistrict[key]);
    Object.assign(schoolDistrict, cloneRuntimeValue(confirmedSchool));
    schoolDistrict.mappingMeta = {
      ...(schoolDistrict.mappingMeta || {}),
      sourceKind: 'user-confirmed-offline',
      notice: '已加载用户确认的本机离线覆盖；请按最新招生文件复核'
    };
    state.schoolLookup.elementarySchools = (schoolDistrict.elementary?.schools || []).map((item) => item.name).filter(Boolean);
    state.schoolLookup.middleSchools = (schoolDistrict.middle?.schools || []).map((item) => item.name).filter(Boolean);
    state.schoolLookup.provisionalUsed = { elementary: false, middle: false };
  }
  state.schoolDistrictDirty = false;
}

function normalizeSchoolLookupText(value) {
  return String(value || '').toLowerCase().replace(/[\s\u3000·,，、。；;:：'"“”‘’（）()【】\[\]《》<>]/g, '').replace(/住宅小区|住宅项目|小区|小学部|初中部/g, '');
}

function renderSchoolLookup() {
  const lookup = state.schoolLookup;
  if (!state.schoolDistrictData) {
    if (lookup.error) return `<div class="school-lookup is-empty"><div><strong>黄埔区招生地段数据加载失败</strong><span>${escapeHtml(lookup.error)}；可刷新页面重试。</span></div><button id="schoolLookupBtn" type="button">重新加载</button></div>`;
    return '<div class="school-lookup"><strong>黄埔区招生地段数据</strong><span>正在加载 2026 年招生地段与小升初分组表……</span></div>';
  }
  if (!state.schoolDistrictData.data) {
    const district = state.schoolDistrictData.district;
    const districtName = district?.name || '当前行政区';
    return `<div class="school-lookup is-empty"><div><strong>${escapeHtml(districtName)} 2026 学区包尚未标准化</strong><span>已登记官方招生来源：${escapeHtml(district?.sourceUrl || '待补充')}；完成离线转换后才能自动匹配小区—学校映射。</span></div><button id="schoolLookupBtn" type="button">重新查询</button></div>`;
  }
  const query = escapeHtml(state.property || '');
  const districtName = state.schoolDistrictData.district?.name || '当前行政区';
  if (!lookup.query || lookup.query !== state.property) {
    return `<div class="school-lookup"><div><strong>${escapeHtml(districtName)}招生地段匹配</strong><span>输入小区名称后查询 2026 年招生地段和小升初分组。</span></div><button id="schoolLookupBtn" type="button">查询当前小区</button></div>`;
  }
  const hasElementaryMapping = lookup.elementary.length || (lookup.provisionalUsed?.elementary && lookup.elementarySchools?.length);
  const hasMiddleMapping = lookup.middle.length || (lookup.provisionalUsed?.middle && lookup.middleSchools?.length);
  const hasUnclassifiedMapping = Boolean(lookup.provisionalMapping?.unclassifiedSchools?.length);
  if (!hasElementaryMapping && !hasMiddleMapping && !hasUnclassifiedMapping) {
    return `<div class="school-lookup is-empty"><div><strong>未在招生地段表中找到“${query}”</strong><span>可尝试输入官方地段表中的完整小区名、社区名或旧改项目名。</span></div><button id="schoolLookupBtn" type="button">重新查询</button></div>`;
  }
  const provisionalKind = String(lookup.provisionalMapping?.sourceKind || '');
  const hasExtendedSpatialConsensus = Boolean(lookup.provisionalMapping?.extendedNeighborEvidence);
  const hasSpatialConsensus = Boolean(lookup.provisionalMapping?.neighborEvidence);
  const hasOfficialPhaseBridge = Boolean(lookup.provisionalMapping?.phaseBridgeEvidence)
    || /official-elementary-middle-bridge/.test(provisionalKind);
  const hasPriorYearGroup = Boolean(lookup.provisionalMapping?.externalGroupEvidence)
    || Boolean(lookup.provisionalMapping?.yuexiuMiddleGroupEvidence)
    || /official-prior-year-middle-group|official-middle-group-table|official-middle-lottery-group|official-panyu-middle-xls/.test(provisionalKind);
  const hasRoadTokenConsensus = Boolean(lookup.provisionalMapping?.roadTokenEvidence)
    || /road-token-consensus/.test(provisionalKind);
  const provisionalLabel = hasExtendedSpatialConsensus || /extended-spatial-consensus/.test(provisionalKind)
    ? '3公里内邻近小区一致候选'
    : hasSpatialConsensus || /spatial-neighbor-consensus/.test(provisionalKind)
      ? '邻近已映射小区一致候选'
    : hasRoadTokenConsensus
      ? '同道路/片区已映射小区一致候选'
    : hasPriorYearGroup
      ? '官方往年/招生范围表交叉候选'
    : hasOfficialPhaseBridge
      ? '官方小学—初中对口组表交叉候选'
    : /official-road-text-intersection|mixed-nearby-and-road-text|mixed-multi-source/.test(provisionalKind)
      ? '地址/官方地段文本交叉候选'
      : '第三方附近学校候选';
  const elementary = lookup.elementary.length
    ? lookup.elementary.map((row) => `<li><b>${escapeHtml(row.school)}</b><span>定向招生：${escapeHtml(row.coverage)}</span></li>`).join('')
    : (lookup.provisionalUsed?.elementary ? lookup.elementarySchools.map((school) => `<li class="is-provisional"><b>${escapeHtml(school)}</b><span>${provisionalLabel} · 待确认是否属于本小区学位</span></li>`).join('') : '');
  const middle = lookup.middle.length
    ? lookup.middle.map((group) => `<li><b>${escapeHtml(group.middleSchools || '待补充初中学校')}</b><span>${escapeHtml(group.mode === 'direct' ? '对口直升' : '电脑派位')} · ${escapeHtml(group.group)}</span></li>`).join('')
    : (lookup.provisionalUsed?.middle
      ? lookup.middleSchools.map((school) => `<li class="is-provisional"><b>${escapeHtml(school)}</b><span>${provisionalLabel} · 待确认是否为对口或派位学校</span></li>`).join('')
      : '<li><span>暂未从小学服务地段匹配到初中分组，需按当年小升初政策补录。</span></li>');
  const fallbackNotice = lookup.dataScope === 'parent-project'
    ? [`该期暂无独立学区映射，已回退父项目「${lookup.fallbackFromName || '父项目'}」数据`]
    : [];
  const provisionalNotice = lookup.provisionalMapping && (lookup.provisionalUsed?.elementary || lookup.provisionalUsed?.middle || lookup.provisionalMapping.unclassifiedSchools?.length)
    ? [lookup.provisionalMapping.notice || '已使用第三方“附近学校”候选，不能视为确定学位。', ...(lookup.provisionalMapping.unclassifiedSchools || []).length ? [`未分学段候选：${lookup.provisionalMapping.unclassifiedSchools.join('、')}`] : []]
    : [];
  const notices = [...(lookup.notices || []), ...fallbackNotice, ...provisionalNotice].length
    ? `<div class="school-lookup-notices">${[...(lookup.notices || []), ...fallbackNotice, ...provisionalNotice].map((item) => `<span>⚠ ${escapeHtml(item)}</span>`).join('')}</div>` : '';
  const packageData = state.schoolDistrictData.data || {};
  const packageHint = Number(packageData.sourceYear) && Number(packageData.sourceYear) < 2026
    ? `当前包来源年度为 ${packageData.sourceYear}，仅作参考，需按 2026 年官方地段核验。`
    : /ocr|summary|mirror|draft|legacy|source-derived|official-pdf|official-docx/i.test(String(packageData.mappingConfidence || ''))
      ? '当前包含Legacy文档恢复、图片/PDF OCR或地段表文本索引，命中结果请按官方附件和当年教育指导中心规则核验。'
      : '地段每年可能调整，最终以当年区教育局核准结果为准。';
  return `<div class="school-lookup"><div class="school-lookup-head"><strong>“${query}”的${escapeHtml(districtName)}招生映射</strong><button id="schoolLookupBtn" type="button">重新查询</button></div><div class="school-lookup-columns"><div><small>小学 · ${lookup.provisionalUsed?.elementary ? '待确认候选' : (lookup.elementary.length > 1 ? '联合/备选，默认等概率估算' : '地段匹配')}</small><ul>${elementary}</ul></div><div><small>初中 · ${lookup.provisionalUsed?.middle ? '待确认候选' : '对口或电脑派位（未知概率默认等概率）'}</small><ul>${middle}</ul></div></div>${notices}<em>数据年度：2026；${escapeHtml(packageHint)} 待确认候选只用于补充缺失映射，默认按待确认摇号 ×0.8 计算，排名和同学段学校总数仍可人工修改。</em></div>`;
}

function bindSchoolLookup() {
  const button = $('#schoolLookupBtn');
  if (button) button.addEventListener('click', () => {
    if (state.schoolDistrictData?.search) applySchoolLookup(state.property);
    else loadSchoolDistrictData();
    renderScore();
  });
}

function displaySubscore(factor, subscore) {
  const maxPoints = subscorePointCap(factor, subscore);
  const automatic = subscorePoints(factor, subscore);
  const hasManualPoints = subscore.manualPoints !== null && subscore.manualPoints !== '' && Number.isFinite(Number(subscore.manualPoints));
  const score = state.manualMode && hasManualPoints ? Number(subscore.manualPoints) : automatic;
  const preciseDistanceSubscore = factor.id === 'life' && ['tertiary-hospital', 'local-medical', 'park'].includes(subscore.id);
  if (score === null || score === undefined || score === '' || !Number.isFinite(Number(score))) return { score: null, max: round1(maxPoints) };
  const roundedScore = preciseDistanceSubscore ? round2(Math.min(maxPoints, Math.max(0, Number(score)))) : round1(Math.min(maxPoints, Math.max(0, Number(score))));
  return { score: roundedScore, max: round1(maxPoints) };
}

// The breakdown renders each contribution rounded to one decimal place.
// Aggregate the same displayed values for dimensions whose subscores are
// already expressed in contribution points, so the dimension total matches
// the visible subscore sum (for example 3 + 1.8 + 1 + 1.4 + 0 + 1 + 0.5 + 1 = 9.7).
function displayedPointTotal(factor) {
  const values = (factor?.subscores || []).map((subscore) => displaySubscore(factor, subscore).score);
  if (!values.length || values.some((value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)))) return null;
  return round1(values.reduce((sum, value) => sum + Number(value), 0));
}

function rawEditorSelector(factorId) {
  const selectors = {
    price: '#rulesList .rule-card[data-factor-id="price"] #raw-price-per-sqm',
    center: '#rulesList .rule-card[data-factor-id="center"] #raw-center-distance-km',
    transport: '#rulesList .rule-card[data-factor-id="transport"] .transport-distance-input',
    school: '#rulesList .rule-card[data-factor-id="school"] .school-data-input',
    quality: '#rulesList .rule-card[data-factor-id="quality"] .quality-raw-input',
    life: '#rulesList .rule-card[data-factor-id="life"] .life-raw-input',
    future: '#rulesList .rule-card[data-factor-id="future"] .future-raw-input'
  };
  return selectors[factorId] || '';
}

function bindBreakdownDataLinks() {
  document.querySelectorAll('.breakdown-edit-data').forEach((button) => button.addEventListener('click', () => {
    const selector = rawEditorSelector(button.dataset.factorId);
    const target = selector ? document.querySelector(selector) : null;
    const card = document.querySelector(`#rulesList .rule-card[data-factor-id="${button.dataset.factorId}"]`);
    const focusTarget = target || card;
    if (!focusTarget) return;
    focusTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof focusTarget.focus === 'function') focusTarget.focus();
    card?.classList.add('is-highlighted');
    window.setTimeout(() => card?.classList.remove('is-highlighted'), 1400);
  }));
}

function totalWeight() { return factors.reduce((sum, item) => sum + item.weight, 0); }
function scoreCoverage() {
  const entries = factors.map((factor) => ({ factor, points: factorPoints(factor) }));
  const complete = entries.filter(({ points }) => Number.isFinite(points));
  const availableWeight = complete.reduce((sum, { factor }) => sum + Number(factor.weight || 0), 0);
  const points = complete.reduce((sum, { points }) => sum + Number(points), 0);
  return {
    entries,
    complete,
    points: complete.length ? round1(points) : null,
    availableWeight: round1(availableWeight),
    totalWeight: round1(totalWeight()),
    completedCount: complete.length,
    totalCount: factors.length
  };
}
function weightedTotal() {
  // Keep scoring useful while data is being completed. A missing dimension is
  // excluded from the denominator, so the score reads as “54.9 / 65” instead
  // of becoming an unusable blank value until every source is filled in.
  return scoreCoverage().points;
}
function renderWeights() {
  $('#weightList').innerHTML = factors.map((factor) => `
    <div class="weight-row">
      <label for="range-${factor.id}">${factor.short}</label>
      <input id="range-${factor.id}" type="range" min="5" max="30" step="1" value="${factor.weight}" data-id="${factor.id}" aria-label="${factor.name}权重" />
      <output for="range-${factor.id}">${factor.weight}%</output>
      ${state.manualMode ? `<label class="weight-config"><span>维度满分</span><input class="factor-max-input" type="number" min="1" max="100" step="0.1" value="${factor.weight}" data-id="${factor.id}" aria-label="${factor.name}维度满分" /><small>分</small></label>` : ''}
    </div>`).join('');
  document.querySelectorAll('input[type="range"]').forEach((input) => input.addEventListener('input', (event) => {
    const item = factors.find((factor) => factor.id === event.target.dataset.id);
    if (state.historyWeightOverride) state.historyWeightOverride.modified = true;
    applyFactorWeightChange(item, Number(event.target.value));
    event.target.nextElementSibling.value = `${item.weight}%`;
    const maxInput = document.querySelector(`.factor-max-input[data-id="${item.id}"]`);
    if (maxInput) maxInput.value = item.weight;
    renderScore();
  }));
  document.querySelectorAll('.factor-max-input').forEach((input) => input.addEventListener('change', (event) => {
    const item = factors.find((factor) => factor.id === event.target.dataset.id);
    if (!item) return;
    if (state.historyWeightOverride) state.historyWeightOverride.modified = true;
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) {
      event.target.value = item.weight;
      return;
    }
    applyFactorWeightChange(item, value);
    const range = document.querySelector(`#range-${item.id}`);
    if (range) range.value = Math.min(30, Math.max(5, item.weight));
    const output = document.querySelector(`output[for="range-${item.id}"]`);
    if (output) output.value = `${item.weight}%`;
    event.target.value = item.weight;
    renderScore();
  }));
  renderWeightProfileStatus();
}
function renderBreakdown() {
  $('#breakdownList').innerHTML = factors.map((factor) => {
    const score = factorScore(factor);
    const points = factorPoints(factor);
    const width = state.manualMode && Number.isFinite(points)
      ? Math.min(100, Math.round(points / factor.weight * 100))
      : Number.isFinite(score) ? Math.min(100, Math.round(score)) : 0;
    const subitems = factor.subscores ? `<div class="breakdown-subitems">${factor.subscores.map((subscore) => {
      const display = displaySubscore(factor, subscore);
      const displayScore = Number.isFinite(display.score) ? display.score : '待补充';
      const progressWidth = Number.isFinite(display.score) ? Math.round(display.score / display.max * 100) : 0;
      const schoolLevel = factor.id === 'school'
        ? schoolDistrict[subscore.id === 'school-elementary' ? 'elementary' : 'middle']
        : null;
      const subscoreLabel = schoolLevel
        ? `${schoolLevel.label} · ${schoolLevel.mode === 'fixed' ? '确定学位' : '摇号入学'}`
        : subscore.name;
      return `<div class="breakdown-subitem">
        <span>${subscoreLabel}</span>
        <div class="progress-track"><div class="progress-fill" style="width:${progressWidth}%"></div></div>
        ${state.manualMode
          ? `<div class="manual-subscore-controls"><label class="manual-inline-score"><span>得分</span><input class="manual-score-input subscore-input" data-factor-id="${factor.id}" data-subscore-id="${subscore.id}" type="number" min="0" max="${display.max}" step="0.1" value="${Number.isFinite(display.score) ? display.score : ''}" aria-label="${factor.name}${subscore.name}人工得分" /><small> /</small></label><label class="manual-max-score"><span>满分</span><input class="manual-max-input" data-factor-id="${factor.id}" data-subscore-id="${subscore.id}" type="number" min="0" max="100" step="0.1" value="${display.max}" aria-label="${factor.name}${subscore.name}满分" /><small>分</small></label></div>`
          : `<span>${displayScore}<small> / ${display.max}</small></span>`}
      </div>`;
    }).join('')}</div>` : '';
    const schoolDetail = factor.id === 'school' ? renderSchoolBreakdown() : '';
    const scoreControl = state.manualMode && !factor.subscores
      ? `<label class="manual-inline-score"><input class="manual-score-input factor-input" data-factor-id="${factor.id}" type="number" min="0" max="${factor.weight}" step="0.1" value="${Number.isFinite(points) ? points : ''}" placeholder="待填写" aria-label="${factor.name}人工得分" /><small> / ${factor.weight}</small></label>`
      : `${Number.isFinite(points) ? points : '—'}<small> / ${factor.weight}</small>`;
    return `<div class="breakdown-group"><div class="breakdown-item">
      <span class="breakdown-name">${factor.name}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
      <span class="breakdown-score${Number.isFinite(points) ? '' : ' is-missing'}">${scoreControl}</span>
    </div>${subitems}${schoolDetail}<button class="breakdown-edit-data" type="button" data-factor-id="${factor.id}">编辑${factor.name}原始数据 <span>→</span></button></div>`;
  }).join('');
  bindManualInputs();
  bindBreakdownDataLinks();
}

function renderSchoolBreakdown() {
  const detail = schoolResourceBreakdown();
  const schoolFactor = factors.find((item) => item.id === 'school');
  const subscoreValues = schoolFactor.subscores.map((subscore) => displaySubscore(schoolFactor, subscore).score);
  const basePoints = subscoreValues.every((value) => Number.isFinite(Number(value)))
    ? round1(subscoreValues.reduce((sum, value) => sum + Number(value), 0))
    : null;
  const totalPoints = factorPoints(schoolFactor);
  const bonusValue = schoolDistrict.nineYearContinuity === true ? 1.2 : 1;
  const bonusLabel = schoolDistrict.nineYearContinuity === null ? '待选择' : String(bonusValue);
  const result = Number.isFinite(Number(totalPoints))
    ? `<div class="school-breakdown-note"><span>基础合计 ${basePoints} / ${schoolFactor.weight} × ${bonusLabel}</span><strong>学区资源合计 = ${totalPoints} / ${schoolFactor.weight}</strong></div>`
    : `<div class="school-missing-panel"><strong>学区资源暂不可计算</strong><span>请补齐红色字段；未填写完整前不会生成综合分。</span><em>缺少：${detail.missing.join('、')}</em></div>`;
  return `<div class="school-breakdown">
    <div class="school-breakdown-control-row">
      <label class="school-nine-year school-nine-year-top">九年一贯制
        <select class="school-nine-year-select" aria-label="上方九年一贯制加成">
          <option value=""${schoolDistrict.nineYearContinuity === null ? ' selected' : ''}>请选择</option>
          <option value="false"${schoolDistrict.nineYearContinuity === false ? ' selected' : ''}>否（×1）</option>
          <option value="true"${schoolDistrict.nineYearContinuity === true ? ' selected' : ''}>是（×1.2）</option>
        </select>
      </label>
      <span>小学 + 初中基础分，按九年一贯制状态自动折算</span>
    </div>
    ${result}
  </div>`;
}

function renderSchoolEditor() {
  const levels = [['elementary', schoolDistrict.elementary], ['middle', schoolDistrict.middle]];
  const provisionalNote = schoolDistrict.mappingMeta?.provisional
    ? `<div class="school-provisional-note">⚠ 学区映射包含待确认候选${schoolDistrict.mappingMeta?.sourceName ? `（${escapeHtml(schoolDistrict.mappingMeta.sourceName)}）` : ''}，当前按待确认摇号候选计算并乘 0.8；该信息不代表确定学位。请补充官方招生地段或人工修正。</div>`
    : '';
  return `<div class="school-editor">
    <div class="school-ranking-scope"><strong>排名口径：${SCHOOL_RANKING_SCOPE}</strong><span>有官方全市排名时优先采用官方数据；缺少官方排名时按“中性估值”预填，并标注为估算值。摇号实际概率未知时已按各校等概率填入，可手动覆盖。</span></div>
    ${provisionalNote}
    ${levels.map(([key, level]) => `<div class="school-editor-level">
      <div class="school-editor-head"><strong>${level.label}数据</strong><label>入学方式 <select class="school-mode-select" data-level="${key}"><option value="fixed"${level.mode === 'fixed' ? ' selected' : ''}>确定学位</option><option value="lottery"${level.mode === 'lottery' ? ' selected' : ''}>摇号</option></select></label></div>
      <div class="school-editor-columns school-editor-row${level.mode === 'lottery' ? '' : ' school-editor-row-fixed'}"><span>学校名称</span><span>广州全市同学段排名<br><em>官方 / 中性估值</em></span><span>同学段学校总数</span>${level.mode === 'lottery' ? '<span>摇号概率<br><em>实际 / 等概率</em></span>' : ''}<span>操作</span></div>
      ${level.schools.map((school, index) => `<div class="school-editor-row${level.mode === 'lottery' ? '' : ' school-editor-row-fixed'}">
        <input class="school-data-input${String(school.name || '').trim() ? '' : ' is-missing'}" data-level="${key}" data-index="${index}" data-field="name" value="${String(school.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" placeholder="学校名称" aria-label="${level.label}学校名称" />
        <input class="school-data-input${Number.isFinite(Number(school.rank)) ? '' : ' is-missing'}" data-level="${key}" data-index="${index}" data-field="rank" type="number" min="1" value="${school.rank ?? ''}" placeholder="广州全市排名" aria-label="${level.label}广州全市排名" title="${school.rankingSource === 'estimate' ? '当前为中性估算值，可修改为官方排名' : ''}" />
        <input class="school-data-input${Number.isFinite(Number(school.totalSchools)) ? '' : ' is-missing'}" data-level="${key}" data-index="${index}" data-field="totalSchools" type="number" min="1" value="${school.totalSchools ?? ''}" placeholder="广州同学段学校数" aria-label="${level.label}广州同学段学校总数" />
        ${level.mode === 'lottery' ? `<input class="school-data-input${Number.isFinite(Number(school.probability)) ? '' : ' is-missing'}" data-level="${key}" data-index="${index}" data-field="probability" type="number" min="0" max="1" step="0.01" value="${formatNumber(school.probability)}" placeholder="概率 0–1" aria-label="${level.label}摇号概率" />` : ''}
        <button class="remove-school" type="button" data-level="${key}" data-index="${index}" aria-label="删除${level.label}学校">删除</button>
      </div>`).join('')}
      ${level.mode === 'lottery' ? `<button class="add-lottery-school" type="button" data-level="${key}">＋ 添加摇号学校</button>` : ''}
    </div>`).join('')}
    <label class="school-nine-year">九年一贯制 <select class="school-nine-year-select"><option value=""${schoolDistrict.nineYearContinuity === null ? ' selected' : ''}>请选择</option><option value="false"${schoolDistrict.nineYearContinuity === false ? ' selected' : ''}>否</option><option value="true"${schoolDistrict.nineYearContinuity === true ? ' selected' : ''}>是（×1.2）</option></select></label>
  </div>`;
}

function renderSchoolRuleDetail() {
  const detail = schoolResourceBreakdown();
  const levels = [['elementary', schoolDistrict.elementary], ['middle', schoolDistrict.middle]];
  const schoolFactor = factors.find((item) => item.id === 'school');
  const levelMax = schoolFactor.weight / levels.length;
  const subscoreValues = schoolFactor.subscores.map((subscore) => displaySubscore(schoolFactor, subscore).score);
  const basePoints = subscoreValues.every((value) => Number.isFinite(Number(value)))
    ? round1(subscoreValues.reduce((sum, value) => sum + Number(value), 0))
    : null;
  const totalPoints = factorPoints(schoolFactor);
  const bonusLabel = schoolDistrict.nineYearContinuity === null
    ? '待选择'
    : schoolDistrict.nineYearContinuity ? '1.2' : '1';
  return `<div class="school-rule-detail">
    ${renderSchoolLookup()}
    ${detail.ready ? '' : `<div class="school-missing-inline">当前缺少 ${detail.missing.join('、')}，学区资源分数显示为待补充。</div>`}
    ${levels.map(([key, level], index) => {
      const levelDisplay = displaySubscore(schoolFactor, schoolFactor.subscores[index]);
      return `<div class="school-rule-level">
      <div class="school-rule-level-head"><strong class="${schoolDistrict.mappingMeta?.[key] && schoolDistrict.mappingMeta?.[key] !== 'confirmed' && schoolDistrict.mappingMeta?.[key] !== 'official-text' && schoolDistrict.mappingMeta?.[key] !== 'missing' ? 'is-provisional' : ''}">${level.label} · ${level.mode === 'fixed' ? '确定学位' : '摇号入学'}${schoolDistrict.mappingMeta?.[key] && schoolDistrict.mappingMeta?.[key] !== 'confirmed' && schoolDistrict.mappingMeta?.[key] !== 'official-text' && schoolDistrict.mappingMeta?.[key] !== 'missing' ? ' · 待确认' : ''}</strong><span>${Number.isFinite(Number(levelDisplay.score)) ? `${levelDisplay.score} / ${levelDisplay.max}` : '待补充'}</span></div>
      ${level.schools.map((school) => `<div class="school-rule-school"><span>${school.name || '未填写学校'} · 全市第 ${school.rank || '待补充'} 名${school.rankingSource === 'estimate' ? '（中性估值）' : ''}</span><span>${Number.isFinite(Number(school.rank)) && Number.isFinite(Number(school.totalSchools)) ? `排名分 ${formatNumber(schoolRankScore(school.rank, school.totalSchools))}${level.mode === 'lottery' ? ` × ${formatNumber(Number(school.probability) * 100)}%` : ''}` : '排名分待补充'}</span></div>`).join('')}
      ${level.mode === 'lottery' ? '<small class="school-rule-footnote">摇号期望分已按等概率（若无实际概率）计算，并按 0.8 不确定性系数折减</small>' : '<small class="school-rule-footnote">确定学位直接采用学校排名分</small>'}
    </div>`;
    }).join('')}
    <div class="school-rule-formula">${Number.isFinite(Number(totalPoints)) ? `小学 + 初中基础分 ${formatNumber(basePoints)} × ${bonusLabel} = <strong>${formatNumber(totalPoints)} / ${schoolFactor.weight} 分</strong><small>${detail.ready ? `原始排名分：小学 ${formatNumber(detail.elementary)}、初中 ${formatNumber(detail.middle)}；` : ''}排名口径为${SCHOOL_RANKING_SCOPE}。九年一贯制选项在上下两处联动，修改任一处都会同步重算。</small>` : '<strong>学区资源分数待补充</strong><small>广州全市排名、同学段学校总数、摇号概率和九年一贯制状态需有官方数据、中性估值或用户填写。</small>'}</div>
    ${renderSchoolEditor()}
  </div>`;
}

function renderPriceRuleDetail(factor) {
  const maxPoints = Math.max(PRICE_SCORE_MIN, Number(factor.weight) || 20);
  const currentPoints = factorPoints(factor);
  const currentRawScore = pricePressureRawScore(factor);
  const hasPrice = factor.pricePerSqm !== null && factor.pricePerSqm !== undefined && String(factor.pricePerSqm).trim() !== '' && Number.isFinite(Number(factor.pricePerSqm));
  const currentPrice = hasPrice ? `${formatNumber(Number(factor.pricePerSqm) / 10000)} 万/㎡` : Number.isFinite(currentPoints) ? '当前评分' : '待补充';
  const sourceText = factor.priceSourceLabel ? `来源：${escapeHtml(factor.priceSourceLabel)}` : hasPrice ? '来源：用户输入' : '请输入该小区单价';
  const priceProvisional = factor.priceEvidence?.needsConfirmation === true || (Number(factor.priceEvidence?.sourceCount) < 3 && factor.priceSource === 'public-average');
  const priceClass = priceProvisional ? 'raw-data-provisional' : 'raw-data-confirmed';
  const priceStatus = priceProvisional ? '<em class="raw-data-status">待确认</em>' : hasPrice ? '<em class="raw-data-status raw-data-status-confirmed">已接入</em>' : '';
  const currentPointLabel = Number.isFinite(currentPoints) ? `${currentPoints} 分` : '待补充';
  return `<div class="rule-bands">
    <div class="rule-band"><span class="band-label">当前单价</span><span class="band-text">${sourceText}</span><span class="band-score"><input id="raw-price-per-sqm" class="price-per-sqm-input ${priceClass}" type="number" min="1000" max="300000" step="100" value="${hasPrice ? formatNumber(factor.pricePerSqm) : ''}" placeholder="元/㎡" aria-label="当前小区单价" /> 元/㎡ ${priceStatus}</span></div>
    <div class="rule-band"><span class="band-label">满分</span><span class="band-text">单价 1 万元/㎡，得当前维度满分</span><span class="band-score">${maxPoints} 分</span></div>
    <div class="rule-band"><span class="band-label">换算</span><span class="band-text">1 万–10 万元/㎡之间按幂函数换算，低价段差异更明显</span><span class="band-score">${currentPrice} · ${currentPointLabel}</span></div>
    <div class="rule-band"><span class="band-label">最低</span><span class="band-text">单价 10 万元/㎡及以上</span><span class="band-score">${PRICE_SCORE_MIN} 分</span></div>
  </div>
  <div class="rule-formula">换算公式：1 + ((10 − 单价〔万元/㎡〕) ÷ 9)<sup>${PRICE_CURVE_EXPONENT}</sup> × (${maxPoints} − 1)。当前：${Number.isFinite(currentRawScore) ? `${currentRawScore} / 100 原始分，折合 ${currentPoints} / ${maxPoints} 分` : '待补充单价后计算'}。</div>`;
}

function renderCenterRawInputs(factor) {
  const distance = rawNumber(factor.distanceKm);
  const transit = rawNumber(factor.peakTransitMinutes);
  const provenance = factor.centerRawProvenance || {};
  const distanceProvisional = provenance.distanceKm
    ? provenance.distanceKm === 'estimated-distance-proxy'
    : factor.peakTransitQuality === 'estimated-distance-proxy';
  const transitProvisional = provenance.peakTransitMinutes
    ? provenance.peakTransitMinutes === 'estimated-distance-proxy'
    : factor.peakTransitQuality === 'estimated-distance-proxy';
  const status = (value, isProvisional, isUserAdjusted) => value === null ? ''
    : isUserAdjusted ? '<em class="raw-data-status raw-data-status-confirmed">用户填写</em>'
    : isProvisional ? '<em class="raw-data-status">待确认</em>'
    : '<em class="raw-data-status raw-data-status-confirmed">已接入</em>';
  const distanceUserAdjusted = provenance.distanceKm === 'user-adjusted';
  const transitUserAdjusted = provenance.peakTransitMinutes === 'user-adjusted';
  return `<div class="raw-data-panel" id="centerRawPanel"><div class="raw-data-panel-head"><strong>地理位置原始数据</strong><span>黑色/红色数值均可直接在输入框修改；修改后即时重算</span></div><div class="raw-data-grid">
    <label class="raw-data-field"><span>到 CBD 直线距离</span><span class="raw-data-input-wrap"><input id="raw-center-distance-km" class="center-raw-input ${distanceProvisional ? 'raw-data-provisional' : 'raw-data-confirmed'}" data-center-field="distanceKm" type="number" min="0" max="200" step="0.1" value="${formatNumber(distance)}" placeholder="例如 12.5" aria-label="到 CBD 直线距离" /><small>km</small>${status(distance, distanceProvisional, distanceUserAdjusted)}</span></label>
    <label class="raw-data-field"><span>高峰公共交通时间</span><span class="raw-data-input-wrap"><input id="raw-center-transit-minutes" class="center-raw-input ${transitProvisional ? 'raw-data-provisional' : 'raw-data-confirmed'}" data-center-field="peakTransitMinutes" type="number" min="0" max="300" step="1" value="${formatNumber(transit)}" placeholder="例如 45" aria-label="高峰公共交通时间" /><small>分钟</small>${status(transit, transitProvisional, transitUserAdjusted)}</span></label>
  </div><div class="missing-data-note">这里填写的是距离和时间原始值，不是地理位置最终得分。</div></div>`;
}

function renderLifeRawInputs(factor) {
  const raw = factor.rawInputs || {};
  const fields = [
    ['商业店铺数量', 'commercialCount', '家', '例如 20'],
    ['餐饮店铺数量', 'diningCount', '家', '例如 30'],
    ['大型成熟商场数量', 'matureMallCount', '个', '例如 1'],
    ['最近三级医院距离', 'tertiaryDistanceKm', 'km', '例如 1.5'],
    ['最近基层医疗距离', 'localMedicalDistanceKm', 'km', '例如 0.8'],
    ['最近公园距离', 'parkDistanceKm', 'km', '例如 1.2']
  ];
  const input = (label, key, unit, placeholder) => {
    const value = rawNumber(raw[key]);
    const edited = Boolean(factor.rawEditedFields?.[key]);
    const sourceCount = Number(factor.amenityAssessment?.sourceCount) || 0;
    const provisional = value !== null && !edited && sourceCount < 3;
    const status = value === null ? '' : provisional ? '<em class="raw-data-status">待确认</em>' : edited ? '<em class="raw-data-status raw-data-status-confirmed">用户填写</em>' : '<em class="raw-data-status raw-data-status-confirmed">已接入</em>';
    return `<label class="raw-data-field"><span>${label}</span><span class="raw-data-input-wrap"><input class="life-raw-input ${provisional ? 'raw-data-provisional' : 'raw-data-confirmed'}" data-life-field="${key}" type="number" min="0" step="0.1" value="${formatNumber(value)}" placeholder="${placeholder}" aria-label="${label}" /><small>${unit}</small>${status}</span></label>`;
  };
  return `<div class="raw-data-panel" id="lifeRawPanel"><div class="raw-data-panel-head"><strong>生活配套原始数据</strong><span>黑色/红色数值均可直接在输入框修改；修改后即时重算</span></div><div class="raw-data-grid">${fields.map((field) => input(...field)).join('')}</div><div class="missing-data-note">这里填写店铺数量和点位距离等原始值，不是生活配套最终得分。</div></div>`;
}

function renderLifeRuleDetail(factor) {
  const detail = lifeResourceBreakdown();
  const current = (id) => detail.ready ? subscorePoints(factor, factor.subscores.find((subscore) => subscore.id === id)) : null;
  const max = (id) => subscorePointCap(factor, factor.subscores.find((subscore) => subscore.id === id));
  const metric = (value, suffix = '', decimals = 1) => value !== null && value !== undefined && Number.isFinite(Number(value)) ? `${Number(value).toFixed(decimals)}${suffix}` : '待补充';
  const currentWithMax = (id, decimals = 2) => `${metric(current(id), '', decimals)} / ${metric(max(id), '', decimals)}`;
  const currentText = (id, fallback = '待补充') => detail.ready ? (factor.subscores.find((subscore) => subscore.id === id)?.current || fallback) : fallback;
  return `<div class="life-rule-detail">
    <div class="life-rule-note">生活配套原始基准满分 15 分：商业 5 分、餐饮 4 分、医疗 3 分、公园 3 分。调整当前维度权重后，大型成熟商场加分保持原值，其余基础项目按当前权重 ÷ 15 等比例换算；最终生活配套得分按当前权重封顶。商业和餐饮统计 2km 内已采集的 OSM 店铺及公开地图补充点位；医疗、公园使用 5km 范围内点位的直线距离。</div>
    ${detail.ready ? '' : `<div class="life-missing-inline">生活配套暂不可计算：${escapeHtml(detail.missing?.join('、') || '广州数据包未加载')}。请输入已登记小区名称并点击“开始评估”。</div>`}
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>2km 商业店铺（满分 5）</span>${renderRuleCurrent(currentText('commercial'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">5 分</span><span class="band-text">≥ 40 家</span><span class="band-score">${currentWithMax('commercial')}</span></div>
        <div class="rule-band"><span class="band-label">4 分</span><span class="band-text">30–39 家</span><span class="band-score">商业数量评分</span></div>
        <div class="rule-band"><span class="band-label">3 分</span><span class="band-text">20–29 家</span><span class="band-score">商业数量评分</span></div>
        <div class="rule-band"><span class="band-label">2 分</span><span class="band-text">10–19 家</span><span class="band-score">商业数量评分</span></div>
        <div class="rule-band"><span class="band-label">1 分</span><span class="band-text">1–9 家；0 家为 0 分</span><span class="band-score">商业数量评分</span></div>
      </div>
    </div>
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>2km 餐饮店铺（满分 4）</span>${renderRuleCurrent(currentText('dining'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">4 分</span><span class="band-text">≥ 30 家</span><span class="band-score">${currentWithMax('dining')}</span></div>
        <div class="rule-band"><span class="band-label">3 分</span><span class="band-text">20–29 家</span><span class="band-score">餐饮数量评分</span></div>
        <div class="rule-band"><span class="band-label">2 分</span><span class="band-text">11–19 家</span><span class="band-score">餐饮数量评分</span></div>
        <div class="rule-band"><span class="band-label">1 分</span><span class="band-text">1–10 家；0 家为 0 分</span><span class="band-score">餐饮数量评分</span></div>
      </div>
    </div>
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>大型成熟商场额外加分（最高 3）</span>${renderRuleCurrent(currentText('mature-mall'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">+3 分</span><span class="band-text">2km 内有 2 个及以上已核实的大型成熟商场</span><span class="band-score">${metric(current('mature-mall'))} / 3</span></div>
        <div class="rule-band"><span class="band-label">+2 分</span><span class="band-text">2km 内有 1 个已核实的大型成熟商场</span><span class="band-score">商场加分</span></div>
        <div class="rule-band"><span class="band-label">0 分</span><span class="band-text">2km 内未识别到大型成熟商场</span><span class="band-score">商场加分</span></div>
      </div>
    </div>
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>最近三级医院（满分 2）</span>${renderRuleCurrent(currentText('tertiary-hospital'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">2.0–1.9 分</span><span class="band-text">0–0.5km：0km 2.00 分，0.5km 1.90 分</span><span class="band-score">按距离插值</span></div>
        <div class="rule-band"><span class="band-label">1.9–1.7 分</span><span class="band-text">0.5–1km：0.5km 1.90 分，1km 1.70 分</span><span class="band-score">按距离插值</span></div>
        <div class="rule-band"><span class="band-label">1.7–1.3 分</span><span class="band-text">1–2km：1km 1.70 分，1.5km 1.50 分，2km 1.30 分</span><span class="band-score">${currentWithMax('tertiary-hospital')}（${metric(detail.tertiaryDistance, 'km')}）</span></div>
        <div class="rule-band"><span class="band-label">1.3–0 分</span><span class="band-text">2–3km：1.30→0.90 分；3–5km：0.90→0 分；超过 5km 为 0 分</span><span class="band-score">按距离插值</span></div>
      </div>
    </div>
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>最近基层医疗（满分 1）</span>${renderRuleCurrent(currentText('local-medical'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">1.0–0.8 分</span><span class="band-text">0–1km：0km 1.00 分，0.5km 0.90 分，1km 0.80 分</span><span class="band-score">按距离插值</span></div>
        <div class="rule-band"><span class="band-label">0.8–0.5 分</span><span class="band-text">1–3km：1km 0.80 分，2km 0.65 分，3km 0.50 分</span><span class="band-score">${currentWithMax('local-medical')}（${metric(detail.localMedicalDistance, 'km')}）</span></div>
        <div class="rule-band"><span class="band-label">0.5–0 分</span><span class="band-text">3–5km：0.50→0 分；超过 5km 或无点位为 0 分</span><span class="band-score">按距离插值</span></div>
      </div>
    </div>
    <div class="rule-subsection">
      <div class="rule-subsection-title"><span>最近公园（满分 3）</span>${renderRuleCurrent(currentText('park'))}</div>
      <div class="rule-bands">
        <div class="rule-band"><span class="band-label">3.0–2.8 分</span><span class="band-text">0–0.5km：0km 3.00 分，0.25km 2.90 分，0.5km 2.80 分</span><span class="band-score">按距离插值</span></div>
        <div class="rule-band"><span class="band-label">2.8–1.9 分</span><span class="band-text">0.5–2km：0.5km 2.80 分，1km 2.50 分，2km 1.90 分</span><span class="band-score">${currentWithMax('park')}（${metric(detail.parkDistance, 'km')}）</span></div>
        <div class="rule-band"><span class="band-label">1.9–0 分</span><span class="band-text">2–3km：1.90→1.20 分；3–5km：1.20→0 分；超过 5km 为 0 分</span><span class="band-score">按距离插值</span></div>
      </div>
    </div>
  </div>`;
}

function renderTransportSubscoreSummary(factor) {
  const scoreRow = (id, label) => {
    const subscore = factor.subscores?.find((item) => item.id === id);
    const display = subscore ? displaySubscore(factor, subscore) : { score: null, max: null };
    const score = Number.isFinite(Number(display.score)) ? formatNumber(display.score) : '待补充';
    const max = Number.isFinite(Number(display.max)) ? formatNumber(display.max) : '—';
    return `<div class="transport-score-row"><span>${label}</span><strong>${score}</strong><small>/ ${max}</small></div>`;
  };
  return `<div class="transport-score-summary" aria-label="交通位置分项得分">
    ${scoreRow('station-distance', '地铁站距离组合')}
    ${scoreRow('station-level', '地铁站等级组合')}
  </div>`;
}

function renderTransportRuleDetail(factor) {
  const routes = Array.isArray(factor.transportRoutes) ? factor.transportRoutes : [];
  const routeRows = routes.length
    ? routes.map((route, index) => `<div class="transport-route-row">
      <span><strong>${escapeHtml(route.stationName || route.station || '地铁站')}</strong><small>${escapeHtml(route.stationExit || '最近可用地铁出口')} · ${route.distanceQuality === 'estimated' ? '统一算法估算' : '地图步行路线'}${Number(route.walkDistanceM) > 1500 ? ' · 超出1.5km评分范围' : ''}</small><small>${escapeHtml(route.stationLevel || '站点等级')} · ${Array.isArray(route.stationLines) ? `${route.stationLines.join('/')}号线` : '线路待核'} · ${Number.isFinite(Number(route.stationLevelScore)) ? `${formatNumber(route.stationLevelScore)}/50` : '等级待核'}</small></span>
      <label><input class="transport-distance-input ${route.distanceQuality === 'estimated' ? 'raw-data-provisional' : 'raw-data-confirmed'}" data-route-index="${index}" type="number" min="0" max="10000" step="10" value="${formatNumber(Number(route.walkDistanceM) || '')}" aria-label="${escapeHtml(route.stationName || route.station || '地铁站')}步行距离" /><small>米</small>${route.distanceQuality === 'estimated' ? '<em class="raw-data-status">待确认</em>' : '<em class="raw-data-status raw-data-status-confirmed">已接入</em>'}</label>
      <em>${escapeHtml(route.estimateMethod || route.source || '')}</em>
    </div>`).join('')
    : '<div class="transport-missing-inline">请输入小区名称，系统会优先使用已核验路线；未登记路线但有坐标的小区会自动生成附近站点估算。</div>';
  return `<div class="transport-rule-detail">
    <div class="transport-rule-note">统一口径：小区最近人行道出入口 → 地铁站可用人行出口，优先使用已登记步行路线；缺少完整路线时取直线距离 × 1.15 与公开步行距离 × 1.00 的较高值，并四舍五入到 10 米。1.15 是基于已有直线/步行样本的保守绕行系数，结果标记为“估算”，用户可直接修改米数，修改后标记为“用户修正”。</div>
    <div class="transport-route-list">${routeRows}</div>
  </div>`;
}

function renderQualityRawInputs(factor) {
  const raw = factor.rawInputs || {};
  const query = state.property;
  const field = (label, key, type, unit, placeholder = '待填写', min = '', max = '', step = '0.1') => {
    const value = raw[key] === null || raw[key] === undefined || raw[key] === ''
      ? ''
      : key === 'developer' ? String(raw[key]) : formatNumber(raw[key]);
    const edited = Boolean(factor.rawEditedFields?.[key]);
    const status = value === '' ? '' : edited ? 'confirmed' : qualityRawStatus(query, key);
    const statusText = status === 'estimated' ? '估算·待确认' : status === 'provisional' ? '待确认' : value === '' ? '' : edited ? '用户填写' : '已接入';
    const provisionalStatus = status === 'provisional' || status === 'estimated';
    const statusClass = provisionalStatus ? 'raw-data-status' : 'raw-data-status raw-data-status-confirmed';
    return `<label class="raw-data-field"><span>${label}</span><span class="raw-data-input-wrap"><input class="quality-raw-input ${provisionalStatus ? 'raw-data-provisional' : 'raw-data-confirmed'}" data-raw-field="${key}" type="${type}" value="${escapeHtml(value)}" placeholder="${placeholder}"${min !== '' ? ` min="${min}"` : ''}${max !== '' ? ` max="${max}"` : ''} step="${step}" aria-label="${label}" />${unit ? `<small>${unit}</small>` : ''}${statusText ? `<em class="${statusClass}">${statusText}</em>` : ''}</span></label>`;
  };
  return `<div class="raw-data-panel" id="qualityRawPanel"><div class="raw-data-panel-head"><strong>小区品质原始数据</strong><span>黑色/红色数值均可直接在输入框修改；修改后即时重算</span></div><div class="raw-data-grid">
    ${field('建成年份', 'buildYear', 'number', '年', '例如 2018', '1900', '2100', '1')}
    ${field('绿化率', 'greenRate', 'number', '%', '例如 35', '0', '100', '0.1')}
    ${field('梯户比', 'ladderHouseholdRatio', 'number', '户/梯', '例如 50', '0', '500', '0.1')}
    ${field('噪音实测', 'noiseDb', 'number', 'dB', '例如 55', '0', '150', '0.1')}
    ${field('最高层数', 'maxFloor', 'number', '层', '例如 32', '1', '200', '1')}
    ${field('房型质量', 'layoutQuality', 'number', '分', '默认 1；有公开吐槽填 0', '0', '1', '1')}
    ${field('层高', 'floorHeight', 'number', '米', '例如 2.9', '0', '10', '0.01')}
    ${field('开发企业', 'developer', 'text', '', '例如 保利地产', '', '', 'any')}
  </div><div class="missing-data-note">这里填写的是建成年份、百分比、户/梯、分贝、层数等原始值；房型质量只填 1 分或 0 分（发现公开吐槽时填 0）。修改后即时重算。</div></div>`;
}

function renderRules() {
  $('#rulesList').innerHTML = rules.map((rule, index) => {
    const factor = factors.find((item) => item.id === rule.id);
    const currentFactorPoints = factorPoints(factor);
    const qualityFallbackLabels = {
      buildYear: '建成年代', greenRate: '绿化率', officialGreenRate: '官方绿地率', plotRatio: '容积率',
      parkingCount: '车位数', advertisedParkingCount: '宣传车位数', householdCount: '规划户数',
      buildingCount: '楼栋总数', developer: '开发企业', propertyCompany: '物业公司', maxFloor: '最高楼层',
      floorHeight: '层高', ladderHouseholdRatio: '梯户比', noiseDb: '噪音', layoutQuality: '房型质量'
    };
    const qualityFallbackNote = factor.id === 'quality' && factor.dataCoverage?.fallbackFields && Object.keys(factor.dataCoverage.fallbackFields).length
      ? `部分字段按父项目「${factor.dataCoverage.fallbackFromName || '父项目'}」回退：${Object.keys(factor.dataCoverage.fallbackFields).map((field) => qualityFallbackLabels[field] || field).join('、')}。`
      : '';
    const coverageNote = factor.id === 'quality' && factor.dataCoverage
      ? `<div class="rule-data-note"><strong>${escapeHtml(factor.dataCoverage.recordName || state.property || '当前小区')}</strong>：已接入 ${escapeHtml(factor.dataCoverage.available.join('、') || '暂无可评分字段')}；${factor.dataCoverage.missing.length ? `仍缺少 ${escapeHtml(factor.dataCoverage.missing.join('、'))}，缺失项不使用默认分。${factor.dataCoverage.missingReasons?.length ? `<br><small>${escapeHtml(factor.dataCoverage.missingReasons.join('；'))}</small>` : ''}` : '品质字段已完整覆盖。'}${qualityFallbackNote ? `<br><small>${escapeHtml(qualityFallbackNote)}</small>` : ''}</div>`
      : factor.id === 'future' && factor.dataCoverage
        ? `<div class="rule-data-note"><strong>未来潜力数据状态</strong>：${escapeHtml(factor.dataCoverage.source)}；${factor.dataCoverage.mode === 'district-proxy' ? `当前分值为公开片区规划代理，生活/交通两项使用当前小区实测结果。${factor.dataCoverage.evidenceText ? `命中证据：${escapeHtml(factor.dataCoverage.evidenceText)}` : ''}` : '没有小区级记录的项目继续显示待补充，不使用通用默认分。'}</div>`
        : '';
    const genericContent = rule.sections ? rule.sections.map((section, sectionIndex) => {
      const current = factor.subscores?.[sectionIndex];
      const display = current ? displaySubscore(factor, current) : null;
      const sourceTag = current?.offlineSource || (/待补充|未接入|待现场评估/.test(String(current?.current || '')) ? '待补充' : '示例');
      return `<div class="rule-subsection">
      <div class="rule-subsection-title"><span>${section.title}</span>${current ? renderRuleCurrent(`${sourceTag} ${current.current || ''} · ${Number.isFinite(Number(display.score)) ? formatNumber(display.score) : '待补充'}/${formatNumber(display.max)}`) : ''}</div>
      <div class="rule-bands">${section.bands.map((band) => `<div class="rule-band"><span class="band-label">${band[0]}</span><span class="band-text">${band[1]}</span><span class="band-score">${band[2]}</span></div>`).join('')}</div>
    </div>`;
    }).join('') : rule.bands ? `<div class="rule-bands">${rule.bands.map((band) => `<div class="rule-band"><span class="band-label">${band[0]}</span><span class="band-text">${band[1]}</span><span class="band-score">${band[2]}</span></div>`).join('')}</div>` : '';
    const content = rule.id === 'transport' ? renderTransportRuleDetail(factor) : rule.id === 'center' ? `${renderCenterRawInputs(factor)}${genericContent}` : rule.id === 'school' ? renderSchoolRuleDetail() : rule.id === 'price' ? renderPriceRuleDetail(factor) : rule.id === 'life' ? `${renderLifeRawInputs(factor)}${renderLifeRuleDetail(factor)}` : rule.id === 'quality' ? `${renderQualityRawInputs(factor)}${genericContent}` : rule.id === 'future' ? `${renderFutureScoreSummary(factor)}${genericContent}` : genericContent;
    const currentFactorDisplay = currentFactorPoints !== null && currentFactorPoints !== undefined && currentFactorPoints !== '' && Number.isFinite(Number(currentFactorPoints))
      ? formatNumber(currentFactorPoints) : '待补充';
    const ruleTotal = factor.subscores && factor.id !== 'school'
      ? `<div class="rule-total${factor.id === 'transport' ? ' transport-score-total' : ''}">
          <div class="rule-total-head"><span>当前${factor.name}得分</span><strong>${currentFactorDisplay}<small> / ${formatNumber(factor.weight)}</small></strong></div>
          ${factor.id === 'transport' ? renderTransportSubscoreSummary(factor) : ''}
        </div>`
      : '';
    return `<article class="rule-card" data-factor-id="${factor.id}">
      <div class="rule-card-head"><div class="rule-title"><span class="rule-index">0${index + 1}</span><h4>${factor.name}</h4></div><span class="rule-weight">权重 ${factor.weight}%</span></div>
      <p class="rule-summary">${rule.summary}</p>
      ${coverageNote}
      ${content}
      ${ruleTotal}
    </article>`;
  }).join('');
}

function renderDataConfidence() {
  const label = $('#confidenceLabel');
  const bar = $('#confidenceBar');
  if (!label || !bar) return;
  const missing = factors.filter((factor) => !Number.isFinite(factorScore(factor)));
  const hasEstimatedTransport = Boolean(factors.find((factor) => factor.id === 'transport')?.transportRoutes?.some((route) => route.distanceQuality === 'estimated'));
  if (missing.length) {
    label.textContent = `待补齐 ${missing.length} 项`;
    label.style.color = '#b56b48';
    bar.style.width = `${Math.max(22, Math.round((factors.length - missing.length) / factors.length * 100))}%`;
    return;
  }
  if (hasEstimatedTransport) {
    label.textContent = '公开数据估算';
    label.style.color = '#7e846f';
    bar.style.width = '68%';
    return;
  }
  label.textContent = '高';
  label.style.color = '';
  bar.style.width = '86%';
}

function renderSignalCard() {
  const signal = $('#citySignalName');
  const metricValue = $('#signalMetricValue');
  const metricUnit = $('#signalMetricUnit');
  const metricLabel = $('#signalMetricLabel');
  const footLabel = $('#signalFootLabel');
  const footValue = $('#signalFootValue');
  if (signal) signal.textContent = state.property || '大壮名城';
  const priceRecord = state.cityId === 'guangzhou' ? findCommunityPriceRecord(state.property) : null;
  const price = priceRecord && Number.isFinite(Number(priceRecord.pricePerSqm)) ? Number(priceRecord.pricePerSqm) : null;
  if (metricValue) metricValue.textContent = price === null ? '—' : formatNumber(price, 0);
  if (metricUnit) metricUnit.textContent = price === null ? '' : ' 元/㎡';
  if (metricLabel) metricLabel.textContent = price === null ? '暂无当前小区公开均价' : '当前公开参考均价';
  const stats = state.priceData?.stats || {};
  const recordCount = Number(stats.uniqueRows || stats.rawRows || state.priceData?.records?.length || 0);
  if (footLabel) footLabel.textContent = recordCount ? `公开均价包 ${formatNumber(recordCount, 0)} 个小区` : '公开均价包';
  const generatedAt = state.priceData?.generatedAt ? String(state.priceData.generatedAt).slice(0, 10) : '';
  if (footValue) footValue.textContent = generatedAt ? `更新 ${generatedAt}` : '待加载';
  document.querySelectorAll('[data-signal-bar]').forEach((bar) => {
    const factor = factors.find((item) => item.id === bar.dataset.factorId);
    const points = factor ? factorPoints(factor) : null;
    const max = Number(factor?.weight);
    const ratio = Number.isFinite(points) && Number.isFinite(max) && max > 0 ? Math.max(0, Math.min(1, points / max)) : null;
    bar.style.height = `${Math.max(8, Math.round((ratio ?? 0.08) * 100))}%`;
    bar.classList.toggle('is-empty', ratio === null);
    bar.title = factor ? `${factor.name}：${ratio === null ? '待补充' : `${formatNumber(points)}/${formatNumber(max)}`}` : '';
  });
}
function renderScore() {
  const schoolFactor = factors.find((item) => item.id === 'school');
  schoolFactor.score = schoolResourceBreakdown().total;
  applyDerivedFutureScores(state.property);
  syncManualScoresFromRaw(factors.find((item) => item.id === 'future'));
  const coverage = scoreCoverage();
  const total = weightedTotal();
  $('#totalScore').textContent = Number.isFinite(total) ? total.toFixed(1) : '—';
  const scoreMax = $('#scoreMax');
  if (scoreMax) scoreMax.textContent = Number.isFinite(coverage.availableWeight) && coverage.availableWeight > 0 ? formatNumber(coverage.availableWeight) : '100';
  const coverageLabel = $('#scoreCoverageLabel');
  const coveragePercent = $('#scoreCoveragePercent');
  if (coverageLabel) coverageLabel.textContent = `已完成 ${coverage.completedCount} / ${coverage.totalCount} 个维度`;
  if (coveragePercent) {
    const percent = coverage.availableWeight > 0 && Number.isFinite(total)
      ? Math.round(total / coverage.availableWeight * 100)
      : 0;
    coveragePercent.textContent = Number.isFinite(total) ? `${percent}%` : '待补充';
  }
  const scoreSummary = $('#scoreSummary');
  const missingFactors = coverage.entries.filter(({ points }) => !Number.isFinite(points)).map(({ factor }) => factor.name);
  if (scoreSummary) scoreSummary.textContent = state.manualMode
    ? (Number.isFinite(total) ? (missingFactors.length ? `人工修正已生效，当前按已完成 ${coverage.availableWeight} 分维度计算。` : '人工修正已生效，你的现场判断会直接计入综合分。') : '请补齐人工修正分数后再计算。')
    : (Number.isFinite(total) ? (missingFactors.length ? `当前显示已完成维度的阶段分数；${missingFactors.join('、')}待补充。` : '预算友好，通勤半径内的综合表现很稳。') : `${missingFactors.join('、') || '部分维度'}数据尚未补齐，请先填写原始数据。`);
  renderDataConfidence();
  renderSignalCard();
  $('#weightTotal').textContent = totalWeight();
  $('#weightTotal').parentElement.parentElement.classList.toggle('over', totalWeight() !== 100);
  const circumference = 301.59;
  const coverageRatio = coverage.availableWeight > 0 && Number.isFinite(total) ? total / coverage.availableWeight : 0;
  $('#orbitProgress').style.strokeDashoffset = circumference * (1 - Math.min(Math.max(coverageRatio, 0), 1));
  renderBreakdown();
  renderRules();
  bindFutureScoreInputs();
  bindTransportDistanceInputs();
  bindCenterRawInputs();
  bindLifeRawInputs();
  bindPriceInput();
  bindQualityRawInputs();
  bindSchoolEditor();
  bindSchoolLookup();
  renderManualToolbar();
  renderWeightProfileStatus();
  syncCurrentFavoriteScore();
  renderFavoriteButton();
  renderWorkspace();
}
function normalize() {
  if (state.historyWeightOverride) state.historyWeightOverride.modified = true;
  const sum = totalWeight();
  let remainder = 100;
  const targets = factors.map((factor, index) => {
    if (index === factors.length - 1) return Math.max(5, remainder);
    const target = Math.max(5, Math.round(factor.weight / sum * 100));
    remainder -= target;
    return target;
  });
  factors.forEach((factor, index) => applyFactorWeightChange(factor, targets[index]));
  renderWeights();
  renderScore();
}

function startManualMode() {
  state.manualMode = false;
  factors.forEach((factor) => {
    const automaticPoints = factorPoints(factor);
    if (factor.subscores) {
      factor.subscores.forEach((subscore) => {
        const automatic = subscorePoints(factor, subscore);
        subscore.manualPoints = Number.isFinite(automatic) ? round1(automatic) : null;
        delete subscore.manualScoreEdited;
      });
      delete factor.manualPoints;
      delete factor.manualScoreEdited;
    } else {
      factor.manualPoints = Number.isFinite(automaticPoints) ? automaticPoints : null;
      delete factor.manualScoreEdited;
    }
  });
  state.manualMode = true;
  renderWeights();
  renderScore();
}

function stopManualMode() {
  state.manualMode = false;
  factors.forEach((factor) => {
    delete factor.manualPoints;
    delete factor.manualScoreEdited;
    factor.subscores?.forEach((subscore) => {
      delete subscore.manualPoints;
      delete subscore.manualScoreEdited;
    });
  });
  restoreAutomaticSubscoreCaps();
  renderWeights();
  renderScore();
}

function bindManualInputs() {
  document.querySelectorAll('.manual-score-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === event.target.dataset.factorId);
    if (!factor) return;
    const raw = event.target.value.trim();
    const max = factor.subscores
      ? subscorePointCap(factor, factor.subscores.find((item) => item.id === event.target.dataset.subscoreId) || factor.subscores[0])
      : factor.weight;
    const value = raw === '' ? null : Math.min(max, Math.max(0, Number(raw)));
    if (factor.subscores) {
      const subscore = factor.subscores.find((item) => item.id === event.target.dataset.subscoreId);
      if (subscore) {
        subscore.manualPoints = Number.isFinite(value) ? round1(value) : null;
        subscore.manualScoreEdited = true;
      }
    } else {
      factor.manualPoints = Number.isFinite(value) ? round1(value) : null;
      factor.manualScoreEdited = true;
    }
    renderScore();
  }));
  document.querySelectorAll('.manual-max-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === event.target.dataset.factorId);
    const subscore = factor?.subscores?.find((item) => item.id === event.target.dataset.subscoreId);
    if (!factor || !subscore) return;
    const raw = event.target.value.trim();
    const value = raw === '' ? null : Math.min(100, Math.max(0, Number(raw)));
    if (!Number.isFinite(value)) {
      event.target.value = subscorePointCap(factor, subscore);
      return;
    }
    applySubscoreMaxChange(factor, subscore, value);
    renderScore();
  }));
}

function bindFutureScoreInputs() {
  document.querySelectorAll('.future-raw-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === event.target.dataset.factorId);
    const subscore = factor?.subscores?.find((item) => item.id === event.target.dataset.subscoreId);
    if (!factor || !subscore) return;
    const raw = event.target.value.trim();
    if (raw === '') {
      persistRawInputOverride(state.property, { [futureRawOverrideKey(subscore.id)]: null });
      renderScore();
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      renderScore();
      return;
    }
    persistRawInputOverride(state.property, { [futureRawOverrideKey(subscore.id)]: round1(value) });
    renderScore();
  }));
}

function syncManualScoresFromRaw(factor) {
  if (!state.manualMode || !factor) return;
  const previousMode = state.manualMode;
  state.manualMode = false;
  if (factor.subscores) {
    factor.subscores.forEach((subscore) => {
      if (subscore.manualScoreEdited) return;
      const score = subscorePoints(factor, subscore);
      subscore.manualPoints = Number.isFinite(score) ? round1(score) : null;
    });
  } else if (!factor.manualScoreEdited) {
    const score = factorPoints(factor);
    factor.manualPoints = Number.isFinite(score) ? round1(score) : null;
  }
  state.manualMode = previousMode;
}

function bindTransportDistanceInputs() {
  document.querySelectorAll('.transport-distance-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === 'transport');
    const route = factor?.transportRoutes?.[Number(event.target.dataset.routeIndex)];
    const raw = event.target.value.trim();
    if (!route) return;
    if (!raw) {
      removeTransportOverride(state.property, route);
      applyTransportLookup(state.property);
      syncManualScoresFromRaw(factor);
      renderScore();
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    route.walkDistanceM = Math.round(value / 10) * 10;
    route.distanceQuality = 'user-adjusted';
    route.source = '用户修正';
    route.verifiedAt = new Date().toISOString().slice(0, 10);
    route.estimateMethod = '用户按实际步行路线修正';
    saveTransportOverride(state.property, route);
    syncManualScoresFromRaw(factor);
    renderScore();
  }));
}

function bindCenterRawInputs() {
  document.querySelectorAll('.center-raw-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === 'center');
    if (!factor) return;
    const field = event.target.dataset.centerField;
    const value = rawNumber(event.target.value);
    if (!field || (value !== null && value < 0)) return;
    const overrideField = field === 'distanceKm' ? 'centerDistanceKm' : 'centerTransitMinutes';
    if (value === null) {
      persistRawInputOverride(state.property, { [overrideField]: null });
      applyCenterLookup(state.property);
    } else {
      if (field === 'distanceKm') factor.distanceKm = value;
      if (field === 'peakTransitMinutes') factor.peakTransitMinutes = value;
      factor.centerRawProvenance ||= {};
      factor.centerRawProvenance[field] = 'user-adjusted';
      factor.peakTransitQuality = 'user-adjusted';
      persistRawInputOverride(state.property, { [overrideField]: value });
    }
    syncManualScoresFromRaw(factor);
    renderScore();
  }));
}

function bindLifeRawInputs() {
  document.querySelectorAll('.life-raw-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === 'life');
    if (!factor) return;
    const field = event.target.dataset.lifeField;
    if (!field) return;
    const value = rawNumber(event.target.value);
    factor.rawInputs ||= {};
    factor.rawEditedFields ||= {};
    if (value === null) {
      delete factor.rawInputs[field];
      delete factor.rawEditedFields[field];
      persistRawInputOverride(state.property, { [field]: null });
      applyLifeLookup(state.property);
    } else {
      factor.rawInputs[field] = value;
      factor.rawEditedFields[field] = true;
      persistRawInputOverride(state.property, { [field]: value });
      applyLifeRawInputs(factor);
    }
    syncManualScoresFromRaw(factor);
    renderScore();
  }));
}

function bindPriceInput() {
  document.querySelectorAll('.price-per-sqm-input').forEach((input) => input.addEventListener('change', (event) => {
    const factor = factors.find((item) => item.id === 'price');
    if (!factor) return;
    const raw = event.target.value.trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) {
      persistRawInputOverride(state.property, { pricePerSqm: null });
      factor.pricePerSqm = null;
      delete factor.priceSource;
      delete factor.priceProperty;
      applyOfflineScoreLookup(state.property);
    } else {
      factor.pricePerSqm = value;
      factor.priceSource = 'manual';
      factor.priceProperty = state.property;
      delete factor.priceSourceLabel;
      delete factor.priceSourceUrl;
      delete factor.offlinePointRatio;
      persistRawInputOverride(state.property, { pricePerSqm: value });
    }
    syncManualScoresFromRaw(factor);
    renderScore();
  }));
}

function bindQualityRawInputs() {
  document.querySelectorAll('.quality-raw-input').forEach((input) => input.addEventListener('change', (event) => {
    const quality = factors.find((item) => item.id === 'quality');
    if (!quality) return;
    const field = event.target.dataset.rawField;
    if (!field) return;
    const raw = event.target.value.trim();
    quality.rawInputs ||= {};
    quality.rawEditedFields ||= {};
    let value = field === 'developer' ? raw : (raw === '' ? null : rawNumber(raw));
    if (field === 'layoutQuality' && value !== null && ![0, 1].includes(Number(value))) {
      const previous = quality.rawInputs[field];
      event.target.value = previous === null || previous === undefined ? '' : formatNumber(previous);
      showToast('房型质量只能填写 1 分或 0 分');
      return;
    }
    if (value === null || (field === 'developer' && !raw)) {
      delete quality.rawInputs[field];
      delete quality.rawEditedFields[field];
      persistRawInputOverride(state.property, { [field]: null });
    } else {
      quality.rawEditedFields[field] = true;
      quality.rawInputs[field] = value;
      persistRawInputOverride(state.property, { [field]: value });
    }
    applyCommunityBaselineScores(state.property);
    // 原始数据编辑后，若用户没有单独改过最终分数，则同步到人工分项值。
    syncManualScoresFromRaw(quality);
    renderScore();
  }));
}

function renderManualToolbar() {
  const label = $('#manualModeLabel');
  const hint = $('#manualModeHint');
  const toggle = $('#manualToggleBtn');
  const reset = $('#manualResetBtn');
  if (!label || !hint || !toggle || !reset) return;
  label.textContent = state.manualMode ? '人工修正中' : '自动计算';
  hint.textContent = state.manualMode ? '修改分项满分时，其余分项和实际得分会按比例联动，综合分即时重算' : '数据由规则和已登记信息自动生成';
  toggle.textContent = state.manualMode ? '退出人工修正' : '开启人工修正';
  toggle.classList.toggle('active', state.manualMode);
  reset.hidden = !state.manualMode;
}

const SAVED_RESULTS_KEY = 'resiscore.savedResults.v1';
const COMPARE_RESULTS_KEY = 'resiscore.compareResults.v1';
const FAVORITE_RESULTS_KEY = 'resiscore.favoriteResults.v1';
const MAX_SAVED_RESULTS = 24;
const MAX_COMPARE_RESULTS = 16;
const MAX_FAVORITE_RESULTS = 50;
const SCORE_MODEL_VERSION = '2026.10.05-live-community-data-v12-parity-caps-load-generation';
let activeCompareDragId = '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function readStoredResults(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    const prefix = key === COMPARE_RESULTS_KEY ? 'compare' : 'saved';
    // Older local records may predate stable IDs. Assign one on load so their
    // edit, replace and delete actions can target the exact rendered row.
    const normalized = parsed
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => item.id ? item : { ...item, id: `legacy-${prefix}-${index}` })
      .map((item) => {
        const calculationState = item.calculationState;
        if (!calculationState || typeof calculationState !== 'object') return item;
        const raw = calculationState.rawOverrides;
        if (!raw || typeof raw !== 'object') return item;
        const cleanedRaw = normalizedSnapshotRawOverrides(calculationState);
        if (JSON.stringify(cleanedRaw) === JSON.stringify(raw)) return item;
        const cleanedState = {
          ...calculationState,
          rawOverrides: cleanedRaw,
          // Keep legacy factor.rawEditedFields as the fallback provenance for
          // old records; do not promote the cleaned values to schema-v3
          // trusted fields.
          rawOverrideFields: undefined,
          rawOverrideProvenance: 'legacy-filtered'
        };
        const next = { ...item, calculationState: cleanedState };
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(existing)) {
            const index = existing.findIndex((candidate) => candidate?.id && candidate.id === item.id);
            if (index >= 0) {
              existing[index] = { ...existing[index], calculationState: cleanedState };
              localStorage.setItem(key, JSON.stringify(existing));
            }
          }
        } catch (error) { /* 清理失败不影响本次加载 */ }
        return next;
      });
    return normalized;
  } catch (error) {
    return [];
  }
}

function persistResults() {
  try {
    localStorage.setItem(SAVED_RESULTS_KEY, JSON.stringify(state.savedResults));
    localStorage.setItem(COMPARE_RESULTS_KEY, JSON.stringify(state.compareResults));
  } catch (error) {
    showToast('浏览器暂时无法保存本地记录');
  }
}

function favoriteResultKey(cityId, property) {
  const canonical = typeof communityCanonicalName === 'function'
    ? communityCanonicalName(property)
    : property;
  return `${String(cityId || '').trim()}:${normalizePlaceName(canonical || property)}`;
}

function readStoredFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITE_RESULTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.cityId && String(item.property || '').trim())
      .map((item, index) => ({
        id: item.id || `favorite-legacy-${index}`,
        key: item.key || favoriteResultKey(item.cityId, item.property),
        cityId: String(item.cityId),
        cityName: item.cityName || cityMeta(item.cityId).name,
        property: String(item.property).trim(),
        total: Number.isFinite(Number(item.total)) ? Number(item.total) : null,
        totalMax: Number.isFinite(Number(item.totalMax)) ? Number(item.totalMax) : 100,
        addedAt: item.addedAt || new Date(0).toISOString(),
        updatedAt: item.updatedAt || item.addedAt || new Date(0).toISOString()
      }))
      .slice(0, MAX_FAVORITE_RESULTS);
  } catch (error) {
    return [];
  }
}

function persistFavorites() {
  try {
    localStorage.setItem(FAVORITE_RESULTS_KEY, JSON.stringify(state.favoriteResults));
  } catch (error) {
    showToast('浏览器暂时无法保存收藏');
  }
}

function isCurrentFavorite() {
  if (!state.property || !state.cityId) return false;
  const key = favoriteResultKey(state.cityId, state.property);
  return state.favoriteResults.some((item) => item.key === key);
}

function syncCurrentFavoriteScore() {
  if (!state.property || !state.cityId) return;
  const key = favoriteResultKey(state.cityId, state.property);
  const item = state.favoriteResults.find((favorite) => favorite.key === key);
  const total = weightedTotal();
  const coverage = scoreCoverage();
  if (!item || !Number.isFinite(total)) return;
  if (Number(item.total) === Number(total) && Number(item.totalMax || 100) === Number(coverage.availableWeight || 100)) return;
  item.total = total;
  item.totalMax = coverage.availableWeight || 100;
  item.updatedAt = new Date().toISOString();
  persistFavorites();
}

function renderFavoriteButton() {
  const button = $('#favoriteResultBtn');
  if (!button) return;
  const active = isCurrentFavorite();
  button.textContent = active ? '★' : '☆';
  button.classList.toggle('is-active', active);
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', active ? '取消收藏当前评估' : '收藏当前评估');
  button.title = active ? '取消收藏' : '收藏';
}

function toggleFavoriteResult() {
  const property = String(state.property || '').trim();
  if (!property || property === '请选择小区') {
    showToast('请先完成一个小区评估，再收藏');
    return;
  }
  const key = favoriteResultKey(state.cityId, property);
  const existingIndex = state.favoriteResults.findIndex((item) => item.key === key);
  if (existingIndex >= 0) {
    state.favoriteResults.splice(existingIndex, 1);
    persistFavorites();
    renderFavoriteButton();
    renderWorkspace();
    showToast(`已取消收藏「${property}」`);
    return;
  }
  const total = weightedTotal();
  const now = new Date().toISOString();
  state.favoriteResults = [{
    id: `favorite-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    key,
    cityId: state.cityId,
    cityName: cityMeta().name,
    property,
    total: Number.isFinite(total) ? total : null,
    totalMax: scoreCoverage().availableWeight || 100,
    addedAt: now,
    updatedAt: now
  }, ...state.favoriteResults].slice(0, MAX_FAVORITE_RESULTS);
  persistFavorites();
  renderFavoriteButton();
  renderWorkspace();
  showToast(`已收藏「${property}」`);
}

function loadFavoriteResult(item) {
  if (!item) return;
  if (item.cityId !== state.cityId) {
    if (!cityDataReady(item.cityId)) {
      showToast(`「${item.cityName || item.cityId}」数据尚未下载`);
      return;
    }
    applyCity(item.cityId);
    window.setTimeout(() => evaluate(item.property, { selected: true }), 0);
  } else {
    evaluate(item.property, { selected: true });
  }
  document.querySelector('.result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removeFavoriteResult(id) {
  const item = state.favoriteResults.find((favorite) => favorite.id === id);
  if (!item) return;
  state.favoriteResults = state.favoriteResults.filter((favorite) => favorite.id !== id);
  persistFavorites();
  renderFavoriteButton();
  renderWorkspace();
  showToast(`已取消收藏「${item.property}」`);
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('resiscoreCity', state.cityId || 'guangzhou');
  url.searchParams.set('resiscoreProperty', state.property || '');
  url.hash = '';
  return url.toString();
}

async function copyShareUrl(url) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch (error) { /* 继续使用兼容性回退 */ }
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
  textarea.remove();
  return copied;
}

async function shareCurrentResult() {
  const property = String(state.property || '').trim();
  if (!property || property === '请选择小区') {
    showToast('请先完成一个小区评估，再分享');
    return;
  }
  const url = buildShareUrl();
  const total = weightedTotal();
  const coverage = scoreCoverage();
  const title = `ResiScore · ${cityMeta().name} · ${property}`;
  const text = Number.isFinite(total)
    ? `${title}，当前综合评分 ${formatNumber(total)} / ${formatNumber(coverage.availableWeight || 100)}`
    : `${title}，当前评分数据仍待补充`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      showToast('已打开系统分享面板');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  if (await copyShareUrl(url)) {
    showToast('评估链接已复制，可粘贴分享');
  } else {
    window.prompt('请复制评估链接', url);
  }
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

const SNAPSHOT_CALCULATION_STATE_VERSION = 3;
const SNAPSHOT_RAW_OVERRIDE_PROVENANCE = 'explicit-v1';
const snapshotFinite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function snapshotRawOverrideValue(value) {
  return value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '')
    ? value : null;
}

function normalizedSnapshotRawOverrides(calculationState) {
  const raw = calculationState?.rawOverrides;
  if (!raw || typeof raw !== 'object') return {};
  const explicitFields = Array.isArray(calculationState.rawOverrideFields)
    ? calculationState.rawOverrideFields.filter((field) => typeof field === 'string')
    : null;
  const trustedRawFields = calculationState.rawOverrideProvenance === SNAPSHOT_RAW_OVERRIDE_PROVENANCE
    && Number(calculationState.schemaVersion) >= SNAPSHOT_CALCULATION_STATE_VERSION
    && Boolean(explicitFields);
  // Schema 0–2 cannot distinguish a user edit from an automatic value that
  // was accidentally copied into history. Drop all legacy raw overrides and
  // let the current offline package rebuild every scoring block. New schema-v3
  // snapshots carry field-level provenance and are safe to restore.
  if (!trustedRawFields) return {};
  const fields = explicitFields;
  return Object.fromEntries([...new Set(fields)].flatMap((field) => {
    const value = snapshotRawOverrideValue(raw[field]);
    return value === null ? [] : [[field, value]];
  }));
}

function captureSnapshotCalculationState() {
  // Build this list only from explicit provenance markers.  Spreading the
  // whole local override record here used to serialize stale/automatic center
  // values into history, which then won over the current offline package.
  const rawOverrides = {};
  const rawOverrideFields = [];
  const addRawOverride = (field, value) => {
    const normalized = snapshotRawOverrideValue(value);
    if (normalized === null) return;
    rawOverrides[field] = normalized;
    rawOverrideFields.push(field);
  };
  const rawFieldGroups = {
    quality: ['buildYear', 'greenRate', 'ladderHouseholdRatio', 'noiseDb', 'maxFloor', 'layoutQuality', 'developer', 'floorHeight'],
    life: ['commercialCount', 'diningCount', 'matureMallCount', 'tertiaryDistanceKm', 'localMedicalDistanceKm', 'parkDistanceKm']
  };
  Object.entries(rawFieldGroups).forEach(([factorId, fields]) => {
    const factor = factors.find((item) => item.id === factorId);
    fields.forEach((field) => {
      if (!factor?.rawEditedFields?.[field]) return;
      addRawOverride(field, Object.prototype.hasOwnProperty.call(factor.rawInputs || {}, field)
        ? factor.rawInputs[field]
        : null);
    });
  });
  const price = factors.find((item) => item.id === 'price');
  if (price?.priceSource === 'manual') addRawOverride('pricePerSqm', Number.isFinite(Number(price.pricePerSqm)) ? Number(price.pricePerSqm) : null);
  const center = factors.find((item) => item.id === 'center');
  const centerProvenance = center?.centerRawProvenance || {};
  // Store each CBD field independently.  A user may correct the distance but
  // keep the automatically estimated transit time (or the reverse); saving
  // both fields together would turn an automatic value into a false manual
  // override on the next workspace refresh.
  if (centerProvenance.distanceKm === 'user-adjusted') {
    addRawOverride('centerDistanceKm', Number.isFinite(Number(center.distanceKm)) ? Number(center.distanceKm) : null);
  }
  if (centerProvenance.peakTransitMinutes === 'user-adjusted') {
    addRawOverride('centerTransitMinutes', Number.isFinite(Number(center.peakTransitMinutes)) ? Number(center.peakTransitMinutes) : null);
  }
  // Keep every field edited in the current evaluation, including future raw
  // scores and explicit clears.  These drafts are session-only until the user
  // confirms the post-save offline sync prompt.
  const pendingRawOverrides = rawInputDraftForProperty(state.property);
  Object.entries(pendingRawOverrides).forEach(([field, value]) => addRawOverride(field, value));
  const pendingTransportOverrides = transportDraftForProperty(state.property);
  return {
    schemaVersion: SNAPSHOT_CALCULATION_STATE_VERSION,
    manualMode: Boolean(state.manualMode),
    rawOverrides,
    rawOverrideFields: [...new Set(rawOverrideFields)],
    rawOverrideProvenance: SNAPSHOT_RAW_OVERRIDE_PROVENANCE,
    pendingRawOverrides: cloneRuntimeValue(pendingRawOverrides),
    pendingTransportOverrides: cloneRuntimeValue(pendingTransportOverrides),
    pendingSchoolDistrict: state.schoolDistrictDirty ? cloneRuntimeValue(schoolDistrict) : null,
    rawOverridesIsolated: true,
    schoolDistrict: cloneRuntimeValue(schoolDistrict),
    factors: factors.map((factor) => ({
      id: factor.id,
      weight: Number(factor.weight),
      manualPoints: snapshotFinite(factor.manualPoints) ? Number(factor.manualPoints) : null,
      // 只有用户直接改过最终分数时才标记为人工分数。原始数据的修改单独
      // 保存在 rawOverrides 中，更新时会用最新算法重新计算该原始数据。
      manualScoreEdited: Boolean(factor.manualScoreEdited),
      rawInputs: factor.rawInputs ? cloneRuntimeValue(factor.rawInputs) : null,
      rawEditedFields: factor.rawEditedFields ? cloneRuntimeValue(factor.rawEditedFields) : {},
      pricePerSqm: Object.prototype.hasOwnProperty.call(factor, 'pricePerSqm') ? factor.pricePerSqm : undefined,
      priceSource: factor.priceSource || '',
      priceProperty: factor.priceProperty || '',
      distanceKm: Object.prototype.hasOwnProperty.call(factor, 'distanceKm') ? factor.distanceKm : undefined,
      peakTransitMinutes: Object.prototype.hasOwnProperty.call(factor, 'peakTransitMinutes') ? factor.peakTransitMinutes : undefined,
      transportRoutes: Array.isArray(factor.transportRoutes) ? cloneRuntimeValue(factor.transportRoutes) : null,
      configuredMaxPoints: factor.subscores?.map((subscore) => snapshotFinite(subscore.configuredMaxPoints) ? Number(subscore.configuredMaxPoints) : null) || [],
      subscores: factor.subscores?.map((subscore) => ({
        id: subscore.id,
        manualPoints: snapshotFinite(subscore.manualPoints) ? Number(subscore.manualPoints) : null,
        manualScoreEdited: Boolean(subscore.manualScoreEdited),
        configuredMaxPoints: snapshotFinite(subscore.configuredMaxPoints) ? Number(subscore.configuredMaxPoints) : null
      })) || []
    }))
  };
}

function snapshotCalculationState(item) {
  if (item?.calculationState && typeof item.calculationState === 'object') return item.calculationState;
  if (!item) return null;
  // Older results only kept the rendered values. Reconstruct a conservative
  // compatibility state: preserve their historical weights, and treat every
  // old manual value as intentional because edit provenance was not stored.
  const manualMode = item.mode === '人工修正';
  return {
    schemaVersion: 0,
    legacy: true,
    manualMode,
    rawOverrides: {},
    rawOverridesIsolated: false,
    factors: (item.factors || []).map((factor) => ({
      id: factor.id,
      weight: factor.max,
      manualPoints: manualMode && snapshotFinite(factor.points) ? Number(factor.points) : null,
      manualScoreEdited: manualMode && snapshotFinite(factor.points),
      configuredMaxPoints: (factor.subscores || []).map((subscore) => snapshotFinite(subscore.max) ? Number(subscore.max) : null),
      subscores: (factor.subscores || []).map((subscore) => ({
        id: subscore.id,
        manualPoints: manualMode && snapshotFinite(subscore.points) ? Number(subscore.points) : null,
        manualScoreEdited: manualMode && snapshotFinite(subscore.points),
        configuredMaxPoints: snapshotFinite(subscore.max) ? Number(subscore.max) : null
      }))
    }))
  };
}

function snapshotWeightProfile(item) {
  const calculationFactors = Array.isArray(item?.calculationState?.factors) ? item.calculationState.factors : [];
  const legacyFactors = Array.isArray(item?.factors) ? item.factors : [];
  return Object.fromEntries(factors.map((factor) => {
    const saved = calculationFactors.find((candidate) => candidate.id === factor.id);
    const legacy = legacyFactors.find((candidate) => candidate.id === factor.id);
    const value = Number(saved?.weight ?? legacy?.max);
    return [factor.id, Number.isFinite(value) && value > 0 ? round1(value) : DEFAULT_FACTOR_WEIGHTS[factor.id]];
  }));
}

function formatWeightProfile(weights = {}) {
  return factors.map((factor) => `${factor.short}${formatNumber(weights[factor.id])}%`).join(' · ');
}

function scaleSnapshotConfiguredCaps(historyWeights, latestWeights) {
  factors.forEach((factor) => {
    const oldWeight = Number(historyWeights[factor.id]);
    const newWeight = Number(latestWeights[factor.id]);
    if (!Number.isFinite(oldWeight) || oldWeight <= 0 || !Number.isFinite(newWeight)) return;
    factor.subscores?.forEach((subscore) => {
      if (factor.id === 'life' && subscore.id === LIFE_BONUS_SUBSCORE_ID) return;
      if (!Number.isFinite(Number(subscore.configuredMaxPoints))) return;
      subscore.configuredMaxPoints = round1(Number(subscore.configuredMaxPoints) / oldWeight * newWeight);
    });
  });
}

function scaleSnapshotManualScores(item, historyWeights, latestWeights) {
  const calculationState = snapshotCalculationState(item);
  const savedById = new Map((calculationState?.factors || []).map((factor) => [factor.id, factor]));
  const legacyById = new Map((item?.factors || []).map((factor) => [factor.id, factor]));
  factors.forEach((factor) => {
    const oldWeight = Number(historyWeights[factor.id]);
    const newWeight = Number(latestWeights[factor.id]);
    if (!Number.isFinite(oldWeight) || oldWeight <= 0 || !Number.isFinite(newWeight)) return;
    const saved = savedById.get(factor.id);
    const legacy = legacyById.get(factor.id);
    if (!factor.subscores && Number.isFinite(Number(factor.manualPoints))) {
      factor.manualPoints = round1(Number(factor.manualPoints) / oldWeight * newWeight);
      return;
    }
    factor.subscores?.forEach((subscore, index) => {
      if (factor.id === 'life' && subscore.id === LIFE_BONUS_SUBSCORE_ID) return;
      if (!Number.isFinite(Number(subscore.manualPoints))) return;
      const savedSubscore = saved?.subscores?.find((candidate) => candidate.id === subscore.id);
      const legacySubscore = legacy?.subscores?.find((candidate) => candidate.id === subscore.id);
      const oldCap = Number(savedSubscore?.configuredMaxPoints
        ?? saved?.configuredMaxPoints?.[index]
        ?? legacySubscore?.max
        ?? oldWeight / factor.subscores.length);
      const newCap = Number(subscorePointCap(factor, subscore));
      if (!Number.isFinite(oldCap) || oldCap <= 0 || !Number.isFinite(newCap)) return;
      subscore.manualPoints = round2(Math.min(newCap, Math.max(0, Number(subscore.manualPoints) / oldCap * newCap)));
    });
  });
}

function prepareSnapshotCalculationState(item, { useSnapshotWeights = true } = {}) {
  const calculationState = snapshotCalculationState(item);
  const savedFactors = calculationState?.factors || [];
  const savedById = new Map(savedFactors.map((factor) => [factor.id, factor]));
  const legacyById = new Map((item.factors || []).map((factor) => [factor.id, factor]));
  factors.forEach((factor) => {
    const saved = savedById.get(factor.id);
    const legacy = legacyById.get(factor.id);
    const weight = Number(saved?.weight ?? legacy?.max);
    if (useSnapshotWeights && Number.isFinite(weight) && weight > 0) factor.weight = weight;
    factor.subscores?.forEach((subscore, index) => {
      const savedSubscore = saved?.subscores?.find((item) => item.id === subscore.id);
      const configuredMax = savedSubscore?.configuredMaxPoints ?? saved?.configuredMaxPoints?.[index];
      if (snapshotFinite(configuredMax)) subscore.configuredMaxPoints = Number(configuredMax);
      else delete subscore.configuredMaxPoints;
    });
  });
  state.refreshingSnapshotContext = calculationState
    ? {
      cityId: state.cityId,
      property: item.property,
      // Only explicit, provenance-backed fields are restored. All schema 0–2
      // raw values are ignored so loading a history item cannot replace the
      // current package with an old automatic estimate from any factor.
      rawOverrides: cloneRuntimeValue(normalizedSnapshotRawOverrides(calculationState)),
      rawOverridesIsolated: true
    }
    : null;
  return { calculationState, savedById, legacyById };
}

function restoreSnapshotRuntimeInputs(item, prepared) {
  const { calculationState } = prepared;
  // Reapply only session-level user corrections. The historical factor
  // snapshot itself contains automatic routes/mappings from an older package;
  // restoring it wholesale was another way stale data bypassed the refresh.
  if (calculationState?.pendingTransportOverrides && typeof calculationState.pendingTransportOverrides === 'object') {
    state.transportOverrideDrafts ||= {};
    Object.entries(calculationState.pendingTransportOverrides).forEach(([key, value]) => {
      state.transportOverrideDrafts[key] = cloneRuntimeValue(value);
    });
    applyTransportLookup(item.property);
  }
  if (calculationState?.pendingSchoolDistrict && typeof calculationState.pendingSchoolDistrict === 'object') {
    Object.keys(schoolDistrict).forEach((key) => delete schoolDistrict[key]);
    Object.assign(schoolDistrict, cloneRuntimeValue(calculationState.pendingSchoolDistrict));
    state.schoolDistrictDirty = true;
  }
}

function applySnapshotManualState(prepared) {
  const calculationState = prepared.calculationState;
  if (!calculationState?.manualMode) {
    state.manualMode = false;
    // Historical automatic snapshots may contain caps from the old 7.5 + 7.5
    // transport layout.  Automatic mode must always restore the current
    // canonical 10 + 5 split before recalculating.
    restoreAutomaticSubscoreCaps();
    return;
  }
  // Build a fresh manual baseline from the newly calculated values, then put
  // back only the fields the user explicitly changed in this record.
  state.manualMode = false;
  factors.forEach((factor) => {
    if (factor.subscores) {
      factor.subscores.forEach((subscore) => {
        const automatic = subscorePoints(factor, subscore);
        subscore.manualPoints = Number.isFinite(automatic) ? round1(automatic) : null;
        delete subscore.manualScoreEdited;
      });
      delete factor.manualPoints;
      delete factor.manualScoreEdited;
    } else {
      const automatic = factorPoints(factor);
      factor.manualPoints = Number.isFinite(automatic) ? round1(automatic) : null;
      delete factor.manualScoreEdited;
    }
  });
  state.manualMode = true;
  const savedById = prepared.savedById;
  // schema 1 及更早版本没有记录“最终分数是否被直接编辑”。为避免历史
  // 记录在更新时突然跳到另一套算法结果，旧人工快照中的显示分数全部按
  // 历史人工输入保留；新快照则只保留明确编辑过的最终分数。
  const preserveLegacyManualValues = calculationState.legacy || Number(calculationState.schemaVersion || 0) < 2;
  factors.forEach((factor) => {
    const saved = savedById.get(factor.id);
    if (!saved) return;
    if ((saved.manualScoreEdited || (preserveLegacyManualValues && calculationState.manualMode)) && snapshotFinite(saved.manualPoints)) {
      factor.manualPoints = Number(saved.manualPoints);
      factor.manualScoreEdited = true;
    }
    factor.subscores?.forEach((subscore) => {
      const savedSubscore = saved.subscores?.find((item) => item.id === subscore.id);
      if (savedSubscore && (savedSubscore.manualScoreEdited || (preserveLegacyManualValues && calculationState.manualMode)) && snapshotFinite(savedSubscore.manualPoints)) {
        subscore.manualPoints = Number(savedSubscore.manualPoints);
        subscore.manualScoreEdited = true;
      }
    });
  });
}

function createSnapshot() {
  const coverage = scoreCoverage();
  const total = weightedTotal();
  const property = state.property || $('#propertyTitle')?.textContent || '';
  if (!Number.isFinite(total) || !coverage.availableWeight || !String(property).trim() || property === '请选择小区') return null;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cityId: state.cityId,
    cityName: cityMeta().name,
    property: String(property).trim(),
    total: round1(total),
    totalMax: coverage.availableWeight,
    completedDimensions: coverage.completedCount,
    totalDimensions: coverage.totalCount,
    partial: coverage.availableWeight < coverage.totalWeight,
    mode: state.manualMode ? '人工修正' : '自动计算',
    algorithmVersion: SCORE_MODEL_VERSION,
    savedAt: new Date().toISOString(),
    calculationState: captureSnapshotCalculationState(),
    factors: factors.map((factor) => ({
      id: factor.id,
      name: factor.name,
      points: factorPoints(factor),
      max: factor.weight,
      subscores: factor.subscores?.map((subscore) => {
        const display = displaySubscore(factor, subscore);
        return { id: subscore.id, name: subscore.name, points: display.score, max: display.max };
      }) || []
    }))
  };
}

function cloneRuntimeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function captureRefreshRuntime() {
  return {
    cityId: state.cityId,
    property: state.property,
    manualMode: state.manualMode,
    amenityLookup: cloneRuntimeValue(state.amenityLookup),
    schoolLookup: cloneRuntimeValue(state.schoolLookup),
    factors: cloneRuntimeValue(factors),
    schoolDistrict: cloneRuntimeValue(schoolDistrict),
    transportOverrideDrafts: cloneRuntimeValue(state.transportOverrideDrafts || {}),
    rawInputDrafts: cloneRuntimeValue(state.rawInputDrafts || {}),
    refreshingSnapshotContext: cloneRuntimeValue(state.refreshingSnapshotContext),
    schoolDistrictDirty: Boolean(state.schoolDistrictDirty)
  };
}

function restoreRefreshRuntime(runtime) {
  state.cityId = runtime.cityId;
  state.property = runtime.property;
  state.manualMode = runtime.manualMode;
  state.amenityLookup = runtime.amenityLookup;
  state.schoolLookup = runtime.schoolLookup;
  factors.splice(0, factors.length, ...runtime.factors);
  Object.keys(schoolDistrict).forEach((key) => delete schoolDistrict[key]);
  Object.assign(schoolDistrict, runtime.schoolDistrict);
  state.transportOverrideDrafts = runtime.transportOverrideDrafts || {};
  state.rawInputDrafts = runtime.rawInputDrafts || {};
  state.refreshingSnapshotContext = runtime.refreshingSnapshotContext;
  state.schoolDistrictDirty = Boolean(runtime.schoolDistrictDirty);
}

function refreshSavedSnapshot(item) {
  const cityId = item.cityId || state.cityId;
  if (cityId !== state.cityId) return { snapshot: null, reason: 'city' };
  const runtime = captureRefreshRuntime();
  try {
    state.cityId = cityId;
    state.property = item.property;
    state.refreshingSnapshotId = item.id;
    state.manualMode = false;
    const prepared = prepareSnapshotCalculationState(item);
    factors.forEach((factor) => {
      delete factor.manualPoints;
      factor.subscores?.forEach((subscore) => delete subscore.manualPoints);
    });
    applyTransportLookup(item.property);
    applyLifeLookup(item.property);
    applyCenterLookup(item.property);
    applyOfflineScoreLookup(item.property);
    if (state.schoolDistrictData?.search) applySchoolLookup(item.property);
    restoreSnapshotRuntimeInputs(item, prepared);
    // applyOfflineScoreLookup clears the derived future-potential values while
    // rebuilding quality data. Rebuild them before taking the refreshed
    // snapshot, otherwise weightedTotal() sees an incomplete future factor and
    // the workspace item is left unchanged as a skipped refresh.
    applyDerivedFutureScores(item.property);
    applySnapshotManualState(prepared);
    const refreshed = createSnapshot();
    if (!refreshed) {
      const missing = factors.filter((factor) => !Number.isFinite(factorScore(factor))).map((factor) => factor.name);
      return { snapshot: null, reason: 'data', missing };
    }
    return {
      snapshot: {
        ...refreshed,
        id: item.id,
        savedAt: item.savedAt,
        scoreUpdatedAt: new Date().toISOString()
      },
      reason: ''
    };
  } finally {
    delete state.refreshingSnapshotId;
    state.refreshingSnapshotContext = null;
    restoreRefreshRuntime(runtime);
  }
}

let pendingHistoryWeightLoad = null;

function closeHistoryWeightModal() {
  const modal = $('#historyWeightModal');
  if (modal) modal.hidden = true;
  pendingHistoryWeightLoad = null;
}

function openHistoryWeightModal(item, scope, historyWeights, latestWeights) {
  const modal = $('#historyWeightModal');
  if (!modal) return;
  pendingHistoryWeightLoad = { item, scope, historyWeights, latestWeights };
  const sourceLabel = scope === 'compare' ? '对比记录' : '保存记录';
  const latestLabel = weightProfileForCity(item.cityId || state.cityId) ? '当前已保存权重' : '当前默认权重';
  const description = $('#historyWeightDescription');
  const preview = $('#historyWeightPreview');
  if (description) {
    description.textContent = `这条${sourceLabel}「${item.property}」保存时使用的权重，与${latestLabel}模板不同。请选择本次加载方式；该选择不会自动修改全局权重模板。`;
  }
  if (preview) {
    preview.innerHTML = `<div><strong>历史记录权重</strong>　${escapeHtml(formatWeightProfile(historyWeights))}</div><div><strong>${latestLabel}</strong>　${escapeHtml(formatWeightProfile(latestWeights))}</div>`;
  }
  modal.hidden = false;
  $('#useLatestHistoryWeight')?.focus();
}

function chooseHistoryWeightMode(mode) {
  const pending = pendingHistoryWeightLoad;
  closeHistoryWeightModal();
  if (!pending?.item) return;
  performLoadSnapshotForEditing(pending.item, pending.scope, {
    weightMode: mode,
    latestWeights: pending.latestWeights
  });
}

function loadSnapshotForEditing(item, scope = 'saved') {
  if (!item || !String(item.property || '').trim()) return;
  const cityId = item.cityId || state.cityId;
  if (cityId !== state.cityId) {
    showToast(`该历史记录属于${item.cityName || cityMeta(cityId).name}，请先切换到对应城市`);
    return;
  }
  const historyWeights = snapshotWeightProfile(item);
  const latestWeights = latestWeightProfileForCity(cityId);
  if (!weightVectorsEqual(historyWeights, latestWeights)) {
    openHistoryWeightModal(item, scope, historyWeights, latestWeights);
    return;
  }
  performLoadSnapshotForEditing(item, scope, { weightMode: 'history', temporaryHistory: false, latestWeights });
}

async function performLoadSnapshotForEditing(item, scope = 'saved', options = {}) {
  if (!item || !String(item.property || '').trim()) return;
  const cityId = item.cityId || state.cityId;
  if (cityId !== state.cityId) {
    showToast(`该历史记录属于${item.cityName || cityMeta(cityId).name}，请先切换到对应城市`);
    return;
  }
  // 编辑历史记录也必须先检查城市数据包。否则页面启动时仍在内存中的旧
  // 交通/配套缓存会直接被带入编辑界面，看起来像是历史数据无法更新。
  // 失败时继续使用当前可用数据，避免离线环境无法打开历史记录。
  try {
    await refreshSingleCityData(cityId);
  } catch (error) {
    console.warn('加载历史记录前刷新城市数据失败，继续使用当前可用数据：', error);
  }
  closeMissingDataModal();
  hideCommunitySuggestions();
  const loadedPropertyKey = typeof communityCanonicalName === 'function' ? communityCanonicalName(item.property) : item.property;
  (typeof communityRawOverrideKeys === 'function' ? communityRawOverrideKeys(item.property) : [loadedPropertyKey])
    .forEach((key) => { if (state.rawInputDrafts?.[cityId]) delete state.rawInputDrafts[cityId][key]; });
  const loadedTransportPrefix = `${cityId}:${transportPropertyKey(item.property)}:`;
  Object.keys(state.transportOverrideDrafts || {}).forEach((key) => {
    if (key.startsWith(loadedTransportPrefix)) delete state.transportOverrideDrafts[key];
  });
  state.schoolDistrictDirty = false;
  state.property = String(item.property).trim();
  persistActiveView();
  state.missingPromptProperty = '';
  state.editingSnapshotContext = { scope, id: item.id || '' };
  state.refreshingSnapshotId = item.id || '';
  state.manualMode = false;
  const useSnapshotWeights = options.weightMode !== 'latest';
  const prepared = prepareSnapshotCalculationState(item, { useSnapshotWeights });
  if (!useSnapshotWeights) {
    const latestWeights = options.latestWeights || latestWeightProfileForCity(cityId);
    setFactorWeights(latestWeights);
    scaleSnapshotConfiguredCaps(snapshotWeightProfile(item), latestWeights);
  }
  factors.forEach((factor) => {
    delete factor.manualPoints;
    delete factor.manualScoreEdited;
    factor.subscores?.forEach((subscore) => {
      delete subscore.manualPoints;
      delete subscore.manualScoreEdited;
    });
  });
  applyTransportLookup(state.property);
  applyLifeLookup(state.property);
  applyCenterLookup(state.property);
  applyOfflineScoreLookup(state.property);
  if (state.schoolDistrictData?.search) applySchoolLookup(state.property);
  // Lookup functions intentionally use the snapshot context for isolated raw
  // overrides. Restore route/school objects after lookup so their user edits
  // are not replaced by the current public lookup result.
  restoreSnapshotRuntimeInputs(item, prepared);
  applyDerivedFutureScores(state.property);
  applySnapshotManualState(prepared);
  if (!useSnapshotWeights && prepared.calculationState?.manualMode) {
    scaleSnapshotManualScores(item, snapshotWeightProfile(item), options.latestWeights || latestWeightProfileForCity(cityId));
  }
  const input = $('#propertyInput');
  const title = $('#propertyTitle');
  const notice = $('#communityMatchNotice');
  if (input) input.value = state.property;
  if (title) title.textContent = state.property;
  if (notice) {
    notice.hidden = true;
    notice.textContent = '';
  }
  state.historyWeightOverride = useSnapshotWeights && options.temporaryHistory !== false
    ? { cityId: state.cityId, property: state.property, weights: snapshotWeightProfile(item) }
    : null;
  renderWeights();
  // Keep the isolated snapshot context through renderScore so derived future
  // values read the historical raw overrides as well.
  renderScore();
  state.refreshingSnapshotContext = null;
  delete state.refreshingSnapshotId;
  document.querySelector('.result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const sourceLabel = scope === 'compare' ? '对比记录' : '保存记录';
  showToast(`已加载${sourceLabel}「${state.property}」，修改后点击“保存结果”即可更新`);
}

let pendingRefreshScope = '';
let pendingSaveConflict = null;
let pendingOfflineSync = null;

function closeOfflineSyncModal({ silent = false } = {}) {
  const modal = $('#offlineSyncModal');
  if (modal) modal.hidden = true;
  const pending = pendingOfflineSync;
  pendingOfflineSync = null;
  if (!silent && pending?.snapshot) showToast('本次人工数据仅保留在当前结果记录中，未写入本机离线覆盖层');
}

function openOfflineSyncModal(snapshot, operationLabel = '保存结果') {
  if (!snapshot || pendingOfflineOverrideCount(snapshot) <= 0) return false;
  const modal = $('#offlineSyncModal');
  if (!modal) return false;
  pendingOfflineSync = { snapshot, operationLabel };
  const description = $('#offlineSyncDescription');
  const count = pendingOfflineOverrideCount(snapshot);
  if (description) {
    description.textContent = `「${snapshot.property}」的${count}项人工原始数据已${operationLabel}。是否把它们同步到本机离线覆盖层？同步后下次打开仍会加载；这不会修改项目发布的 data/*.json 文件。`;
  }
  modal.hidden = false;
  $('#confirmOfflineSyncBtn')?.focus();
  return true;
}

function resolveOfflineSync(shouldSync) {
  const pending = pendingOfflineSync;
  closeOfflineSyncModal({ silent: true });
  if (!pending?.snapshot) return;
  if (shouldSync) {
    if (syncPendingUserOverrides(pending.snapshot)) showToast('已同步到本机离线覆盖层，下次搜索会优先使用已确认数据');
    else showToast('同步失败，人工数据仍保留在本次结果记录中');
  } else {
    showToast('已保存结果；人工数据未同步到本机离线覆盖层');
  }
}

function promptOfflineSyncAfterCommit(snapshot, operationLabel) {
  openOfflineSyncModal(snapshot, operationLabel);
}

function refreshResultKey(scope, item, index) {
  return `${scope}:${item.id || `legacy-${index}`}`;
}

function snapshotRawOverrideSummary(item) {
  const raw = normalizedSnapshotRawOverrides(item?.calculationState);
  if (!raw || typeof raw !== 'object') return '';
  const labels = [];
  if (Object.prototype.hasOwnProperty.call(raw, 'centerDistanceKm')) labels.push(`CBD ${formatNumber(raw.centerDistanceKm)}km`);
  if (Object.prototype.hasOwnProperty.call(raw, 'centerTransitMinutes')) labels.push(`通勤 ${formatNumber(raw.centerTransitMinutes)}分钟`);
  if (Object.prototype.hasOwnProperty.call(raw, 'pricePerSqm')) labels.push(`单价 ${formatNumber(raw.pricePerSqm)}元/㎡`);
  return labels.length ? ` · 保留人工原始值：${labels.join('、')}` : '';
}

function closeRefreshResultsModal() {
  const modal = $('#refreshResultsModal');
  if (modal) modal.hidden = true;
  pendingRefreshScope = '';
}

function openRefreshResultsModal(scope) {
  const source = scope === 'saved' ? state.savedResults : state.compareResults;
  if (!source.length) {
    showToast(scope === 'saved' ? '还没有可更新的保存结果' : '还没有可更新的对比结果');
    return;
  }
  const modal = $('#refreshResultsModal');
  const list = $('#refreshResultsList');
  if (!modal || !list) return;
  pendingRefreshScope = scope;
  list.innerHTML = source.map((item, index) => {
    const key = refreshResultKey(scope, item, index);
    const name = `${item.cityName || cityMeta(item.cityId).name} · ${item.property}`;
    const updated = formatSavedTime(item.scoreUpdatedAt || item.savedAt);
    return `<label class="refresh-result-option"><input type="checkbox" data-refresh-id="${escapeHtml(key)}" checked /><span><strong class="refresh-result-name">${escapeHtml(name)}</strong><small class="refresh-result-meta">${escapeHtml(item.mode || '自动计算')} · ${escapeHtml(updated)}${item.calculationState ? ' · 保留人工配置' : ' · 旧记录'}${escapeHtml(snapshotRawOverrideSummary(item))}</small></span><strong class="refresh-result-score">${Number.isFinite(Number(item.total)) ? `${formatNumber(item.total)} / ${formatNumber(item.totalMax || 100)}` : '待补充'}</strong></label>`;
  }).join('');
  modal.hidden = false;
}

async function confirmRefreshResults() {
  const modal = $('#refreshResultsModal');
  if (!modal || !pendingRefreshScope) return;
  const selectedIds = [...modal.querySelectorAll('input[data-refresh-id]:checked')].map((input) => input.dataset.refreshId);
  const scope = pendingRefreshScope;
  closeRefreshResultsModal();
  if (!selectedIds.length) {
    showToast('未选择需要更新的记录，原结果已保留');
    return;
  }
  // “更新分数”必须先检查当前记录所属城市的数据包。否则页面启动时
  // 载入的旧离线缓存会继续参与重算，用户看不到最新坐标或 CBD 锚点。
  const source = scope === 'saved' ? state.savedResults : state.compareResults;
  const selected = new Set(selectedIds);
  const cityIds = [...new Set(source
    .map((item, index) => ({ item, key: refreshResultKey(scope, item, index) }))
    .filter(({ key }) => selected.has(key))
    .map(({ item }) => item.cityId || state.cityId))];
  const refreshButton = $('#confirmRefreshResults');
  if (refreshButton) refreshButton.disabled = true;
  try {
    const dataResults = await Promise.all(cityIds.map((cityId) => refreshSingleCityData(cityId)));
    const dataErrors = dataResults.flatMap((result) => result.errors || []);
    const dataWarnings = dataResults.flatMap((result) => result.warnings || []);
    refreshWorkspaceResults(scope, selectedIds);
    if (dataErrors.length) showToast(`已更新评分；部分数据源检查失败：${dataErrors.join('；')}`);
    else if (dataWarnings.length) showToast(`已用当前离线包更新评分；远端更新检查失败：${dataWarnings.join('；')}`);
  } catch (error) {
    // 即使网络检查失败，也继续用当前可用数据重算，避免更新按钮失效。
    refreshWorkspaceResults(scope, selectedIds);
    showToast(`已用当前离线数据更新评分：${error.message}`);
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

function setRefreshSelection(checked) {
  $('#refreshResultsList')?.querySelectorAll('input[data-refresh-id]').forEach((input) => { input.checked = checked; });
}

function refreshWorkspaceResults(scope, selectedIds = null) {
  const source = scope === 'saved' ? state.savedResults : state.compareResults;
  if (!source.length) {
    showToast(scope === 'saved' ? '还没有可更新的保存结果' : '还没有可更新的对比结果');
    return;
  }
  const selected = selectedIds ? new Set(selectedIds) : null;
  const candidates = source.map((item, index) => ({ item, index, key: refreshResultKey(scope, item, index) }))
    .filter(({ key }) => !selected || selected.has(key));
  if (!candidates.length) {
    showToast('未选择需要更新的记录，原结果已保留');
    return;
  }
  const refreshedByKey = new Map();
  let refreshedCount = 0;
  let preservedRawOverrideCount = 0;
  let citySkipped = 0;
  let dataSkipped = 0;
  const missingData = new Set();
  candidates.forEach(({ item, key }) => {
    const result = refreshSavedSnapshot(item);
    if (result.snapshot) {
      refreshedByKey.set(key, result.snapshot);
      refreshedCount += 1;
      if (snapshotRawOverrideSummary(item)) preservedRawOverrideCount += 1;
    } else if (result.reason === 'city') {
      citySkipped += 1;
    } else {
      dataSkipped += 1;
      (result.missing || []).forEach((name) => missingData.add(name));
    }
  });
  const replaceCollection = (collection) => collection.map((item, index) => {
    const key = refreshResultKey(scope, item, index);
    const refreshed = refreshedByKey.get(key);
    return refreshed ? { ...refreshed, id: item.id, savedAt: item.savedAt } : item;
  });
  if (scope === 'saved') state.savedResults = replaceCollection(state.savedResults);
  else state.compareResults = replaceCollection(state.compareResults);
  persistResults();
  renderWorkspace();
  const skipped = citySkipped + dataSkipped;
  if (!skipped) {
    const preservedText = preservedRawOverrideCount
      ? `；${preservedRawOverrideCount} 条保留了历史/人工原始值（可在上方清空后恢复数据库值）`
      : '';
    showToast(`已按当前算法更新 ${refreshedCount} 条结果${preservedText}`);
    return;
  }
  const missingText = missingData.size ? `；缺少${[...missingData].slice(0, 3).join('、')}${missingData.size > 3 ? '等数据' : ''}` : '';
  showToast(`已更新 ${refreshedCount} 条，${skipped} 条暂缺对应城市或基础数据${missingText}`);
}

function sameHistoryResult(left, right) {
  const leftCity = left?.cityId || state.cityId;
  const rightCity = right?.cityId || state.cityId;
  return leftCity === rightCity
    && normalizePlaceName(left?.property || '') === normalizePlaceName(right?.property || '');
}

function findSaveConflict(snapshot) {
  const editing = state.editingSnapshotContext;
  if (editing?.id) {
    const collection = editing.scope === 'compare' ? state.compareResults : state.savedResults;
    const target = collection.find((item) => item.id === editing.id);
    if (target) return { reason: 'editing', scope: editing.scope, target };
    // The source record may have been removed in another tab. Treat this as
    // a fresh save instead of silently writing to an unrelated record.
    state.editingSnapshotContext = null;
  }
  const savedTarget = state.savedResults.find((item) => sameHistoryResult(item, snapshot));
  if (savedTarget) return { reason: 'duplicate', scope: 'saved', target: savedTarget };
  const compareTarget = state.compareResults.find((item) => sameHistoryResult(item, snapshot));
  return compareTarget ? { reason: 'duplicate', scope: 'compare', target: compareTarget } : null;
}

function closeSaveConflictModal() {
  const modal = $('#saveConflictModal');
  if (modal) modal.hidden = true;
  pendingSaveConflict = null;
}

function openSaveConflictModal(conflict, snapshot, operation = 'save') {
  const modal = $('#saveConflictModal');
  if (!modal) return;
  pendingSaveConflict = { ...conflict, snapshot, operation };
  const isEditing = conflict.reason === 'editing';
  const isCompareAdd = operation === 'compare-add';
  const sourceLabel = conflict.scope === 'compare' ? '对比记录' : '保存记录';
  const eyebrow = $('#saveConflictEyebrow');
  const title = $('#saveConflictTitle');
  const description = $('#saveConflictDescription');
  const preview = $('#saveConflictPreview');
  if (eyebrow) eyebrow.textContent = isCompareAdd ? 'ADD TO COMPARE' : 'SAVE RESULT';
  if (title) title.textContent = isEditing ? `正在编辑${sourceLabel}` : (isCompareAdd ? '对比中已有同名结果' : '发现同名历史结果');
  if (description) {
    description.textContent = isEditing
      ? `当前结果来自一条${sourceLabel}「${conflict.target.property}」。可以替换原记录，也可以保留原记录并另存一份。`
      : `${sourceLabel}中已有同名小区「${conflict.target.property}」。可以替换现有记录，也可以保留两份${isCompareAdd ? '对比结果' : '历史结果'}。`;
  }
  if (preview) {
    preview.innerHTML = `<div><strong>原记录</strong>　${escapeHtml(formatNumber(conflict.target.total))} / ${escapeHtml(formatNumber(conflict.target.totalMax || 100))}　·　${escapeHtml(formatSavedTime(conflict.target.scoreUpdatedAt || conflict.target.savedAt))}</div><div><strong>当前结果</strong>　${escapeHtml(formatNumber(snapshot.total))} / ${escapeHtml(formatNumber(snapshot.totalMax || 100))}　·　${escapeHtml(snapshot.mode || '自动计算')}</div>`;
  }
  const saveAsNewButton = $('#saveAsNewBtn');
  if (saveAsNewButton) saveAsNewButton.textContent = isCompareAdd ? '另存一份对比' : '另存一份';
  modal.hidden = false;
  $('#replaceSaveConflictBtn')?.focus();
}

function resultNameExists(property, cityId = state.cityId, collection = state.savedResults) {
  return collection.some((item) => (item.cityId || state.cityId) === cityId
    && normalizePlaceName(item.property || '') === normalizePlaceName(property || ''));
}

function nextCopyPropertyName(property, cityId = state.cityId, collection = state.savedResults) {
  const base = String(property || '').trim() || '未命名小区';
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (resultNameExists(candidate, cityId, collection)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

function snapshotForCopy(snapshot, collection = state.savedResults) {
  return {
    ...snapshot,
    offlineOverrideProperty: snapshot.offlineOverrideProperty || snapshot.property,
    property: nextCopyPropertyName(snapshot.property, snapshot.cityId || state.cityId, collection)
  };
}

function commitSnapshotAsNew(snapshot, { asCopy = false } = {}) {
  const result = asCopy ? snapshotForCopy(snapshot, state.savedResults) : snapshot;
  state.savedResults = [result, ...state.savedResults].slice(0, MAX_SAVED_RESULTS);
  state.editingSnapshotContext = null;
  persistResults();
  renderWorkspace();
  showToast(`${asCopy ? '已另存' : '已保存'}「${result.property}」的评分结果`);
  promptOfflineSyncAfterCommit(result, asCopy ? '另存结果' : '保存结果');
}

function replaceSaveConflict() {
  const pending = pendingSaveConflict;
  closeSaveConflictModal();
  if (!pending?.snapshot || !pending.target) return;
  const collection = pending.scope === 'compare' ? state.compareResults : state.savedResults;
  const index = collection.findIndex((item) => item.id === pending.target.id);
  if (index < 0) {
    if (pending.operation === 'compare-add') commitCompareSnapshotAsNew(pending.snapshot, { asCopy: true });
    else commitSnapshotAsNew(pending.snapshot, { asCopy: true });
    return;
  }
  const previous = collection[index];
  collection[index] = {
    ...pending.snapshot,
    id: previous.id,
    savedAt: previous.savedAt || pending.snapshot.savedAt,
    scoreUpdatedAt: new Date().toISOString()
  };
  if (pending.operation !== 'compare-add'
    || (state.editingSnapshotContext?.scope === 'compare' && state.editingSnapshotContext.id === previous.id)) {
    state.editingSnapshotContext = null;
  }
  persistResults();
  renderWorkspace();
  showToast(`已替换${pending.scope === 'compare' ? '对比' : '保存'}记录「${pending.snapshot.property}」`);
  promptOfflineSyncAfterCommit(collection[index], '替换结果');
}

function saveCurrentResult() {
  const inputValue = $('#propertyInput')?.value.trim();
  if (inputValue && inputValue !== state.property && !evaluate(inputValue)) {
    showToast('请先确认小区名称并完成评估，再保存结果');
    return;
  }
  const snapshot = createSnapshot();
  if (!snapshot) {
    showToast('当前还没有可保存的评分，请先填写至少一项原始数据');
    return;
  }
  const conflict = findSaveConflict(snapshot);
  if (conflict) {
    openSaveConflictModal(conflict, snapshot);
    return;
  }
  commitSnapshotAsNew(snapshot);
}

function addCurrentToCompare() {
  const inputValue = $('#propertyInput')?.value.trim();
  if (inputValue && inputValue !== state.property && !evaluate(inputValue)) {
    showToast('请先确认小区名称并完成评估，再加入对比');
    return;
  }
  const snapshot = createSnapshot();
  if (!snapshot) {
    showToast('当前还没有可对比的评分，请先填写至少一项原始数据');
    return;
  }
  addSnapshotToCompare(snapshot);
}

function addSnapshotToCompare(snapshot) {
  const existing = state.compareResults.find((item) => sameHistoryResult(item, snapshot));
  if (existing) {
    openSaveConflictModal({ reason: 'duplicate', scope: 'compare', target: existing }, snapshot, 'compare-add');
    return;
  }
  if (state.compareResults.length >= MAX_COMPARE_RESULTS) {
    showToast(`最多同时对比 ${MAX_COMPARE_RESULTS} 个小区`);
    return;
  }
  commitCompareSnapshotAsNew(snapshot);
}

function commitCompareSnapshotAsNew(snapshot, { asCopy = false } = {}) {
  if (state.compareResults.length >= MAX_COMPARE_RESULTS) {
    showToast(`最多同时对比 ${MAX_COMPARE_RESULTS} 个小区，无法另存更多对比结果`);
    return;
  }
  const result = asCopy ? snapshotForCopy(snapshot, state.compareResults) : snapshot;
  const compareSnapshot = {
    ...result,
    id: `compare-${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
  state.compareResults = [...state.compareResults, compareSnapshot];
  persistResults();
  renderWorkspace();
  showToast(`${asCopy ? '已另存对比' : '已加入对比'}「${compareSnapshot.property}」`);
  promptOfflineSyncAfterCommit(compareSnapshot, asCopy ? '另存对比' : '加入对比');
}

function formatSavedTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '刚刚保存' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function clearCompareDragState(table = $('#compareTable')) {
  activeCompareDragId = '';
  table?.querySelectorAll('.compare-result-header.is-dragging, .compare-result-header.drop-before, .compare-result-header.drop-after').forEach((header) => {
    header.classList.remove('is-dragging', 'drop-before', 'drop-after');
  });
}

function moveCompareResult(sourceId, targetId, placeAfter = false) {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const sourceIndex = state.compareResults.findIndex((item) => item.id === sourceId);
  if (sourceIndex < 0) return false;
  const [moved] = state.compareResults.splice(sourceIndex, 1);
  let targetIndex = state.compareResults.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) {
    state.compareResults.splice(sourceIndex, 0, moved);
    return false;
  }
  if (placeAfter) targetIndex += 1;
  state.compareResults.splice(targetIndex, 0, moved);
  return true;
}

function moveCompareResultByOffset(id, offset) {
  const index = state.compareResults.findIndex((item) => item.id === id);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= state.compareResults.length) return;
  const [moved] = state.compareResults.splice(index, 1);
  state.compareResults.splice(targetIndex, 0, moved);
  persistResults();
  renderWorkspace();
  const header = [...document.querySelectorAll('.compare-result-header')].find((item) => item.dataset.compareId === id);
  header?.focus();
}

function bindCompareColumnDrag(table) {
  table.querySelectorAll('.compare-result-header').forEach((header) => {
    header.addEventListener('dragstart', (event) => {
      if (event.target.closest('button')) {
        event.preventDefault();
        return;
      }
      activeCompareDragId = header.dataset.compareId || '';
      if (!activeCompareDragId) return;
      header.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', activeCompareDragId);
    });
    header.addEventListener('dragover', (event) => {
      if (!activeCompareDragId || header.dataset.compareId === activeCompareDragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = header.getBoundingClientRect();
      const placeAfter = event.clientX >= rect.left + rect.width / 2;
      header.classList.toggle('drop-before', !placeAfter);
      header.classList.toggle('drop-after', placeAfter);
    });
    header.addEventListener('dragleave', (event) => {
      if (event.relatedTarget && event.relatedTarget.nodeType && header.contains(event.relatedTarget)) return;
      header.classList.remove('drop-before', 'drop-after');
    });
    header.addEventListener('drop', (event) => {
      event.preventDefault();
      const sourceId = activeCompareDragId || event.dataTransfer.getData('text/plain');
      const rect = header.getBoundingClientRect();
      const placeAfter = event.clientX >= rect.left + rect.width / 2;
      const targetId = header.dataset.compareId || '';
      const scrollLeft = table.scrollLeft;
      const moved = moveCompareResult(sourceId, targetId, placeAfter);
      clearCompareDragState(table);
      if (!moved) return;
      persistResults();
      renderWorkspace();
      const refreshedTable = $('#compareTable');
      if (refreshedTable) refreshedTable.scrollLeft = scrollLeft;
      showToast('已调整对比小区顺序');
    });
    header.addEventListener('dragend', () => clearCompareDragState(table));
    header.addEventListener('keydown', (event) => {
      if (event.target.closest('button')) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      moveCompareResultByOffset(header.dataset.compareId, event.key === 'ArrowLeft' ? -1 : 1);
    });
  });
}

function renderCompareTable() {
  const table = $('#compareTable');
  if (!table) return;
  if (!state.compareResults.length) {
    table.innerHTML = '<div class="compare-empty">输入另一个小区并评估后，点击“加入对比”，这里会并排显示七大维度和综合总分。</div>';
    return;
  }
  const rows = [{ id: 'total', name: '综合总分', total: true }, ...factors.map((factor) => ({ id: factor.id, name: factor.name }))];
  const cells = [`<div class="compare-cell header">评分维度</div>`];
  state.compareResults.forEach((item, index) => cells.push(`<div class="compare-cell header compare-result-header" draggable="true" tabindex="0" data-compare-id="${escapeHtml(item.id)}" title="拖拽此列调整顺序，也可使用键盘左右方向键"><div class="compare-header-main"><strong>${escapeHtml(item.cityName || cityMeta(item.cityId).name)} · ${escapeHtml(item.property)}</strong><span class="compare-header-actions"><button class="compare-edit-button" type="button" data-compare-id="${escapeHtml(item.id)}" aria-label="编辑并加载 ${escapeHtml(item.property)}">编辑</button><button class="compare-remove-button" type="button" data-compare-id="${escapeHtml(item.id)}" data-compare-index="${index}" aria-label="移除 ${escapeHtml(item.property)}">移除</button></span></div><small><span class="compare-drag-hint" aria-hidden="true">拖动排序</span>${item.partial ? '阶段评分 · ' : ''}${item.mode} · ${formatSavedTime(item.scoreUpdatedAt || item.savedAt)}${item.algorithmVersion !== SCORE_MODEL_VERSION ? ' · 待更新' : ''}</small></div>`));
  rows.forEach((row) => {
    cells.push(`<div class="compare-cell label">${row.name}</div>`);
    state.compareResults.forEach((item) => {
      const factorSnapshot = item.factors?.find((factor) => factor.id === row.id);
      const value = row.total ? item.total : factorSnapshot?.points;
      const max = row.total ? (item.totalMax || 100) : factorSnapshot?.max;
      cells.push(`<div class="compare-cell value${row.total ? ' total' : ''}">${Number.isFinite(value) ? `${formatNumber(value)}<small> / ${formatNumber(max)}</small>` : '—'}</div>`);
    });
  });
  table.innerHTML = `<div class="compare-grid" style="--compare-count:${state.compareResults.length}">${cells.join('')}</div>`;
  bindCompareColumnDrag(table);
  table.querySelectorAll('.compare-edit-button').forEach((button) => button.addEventListener('click', () => {
    const item = state.compareResults.find((result) => result.id === button.dataset.compareId);
    if (item) loadSnapshotForEditing(item, 'compare');
  }));
  table.querySelectorAll('.compare-remove-button').forEach((button) => button.addEventListener('click', () => {
    removeCompareResult(button.dataset.compareId, Number(button.dataset.compareIndex));
  }));
}

function removeCompareResult(id, fallbackIndex) {
  const index = id ? state.compareResults.findIndex((item) => item.id === id) : fallbackIndex;
  if (index < 0) return;
  const [removed] = state.compareResults.splice(index, 1);
  if (state.editingSnapshotContext?.scope === 'compare' && state.editingSnapshotContext.id === removed.id) state.editingSnapshotContext = null;
  persistResults();
  renderWorkspace();
  showToast(`已移除「${removed.property || '该小区'}」的对比`);
}

function renderWorkspace() {
  const section = $('#workspaceSection');
  const list = $('#savedResultsList');
  const favoriteList = $('#favoriteResultsList');
  const count = $('#workspaceCount');
  if (!section || !list || !count) return;
  // Keep the workspace visible even when empty so mobile users can discover
  // saving, comparison, and favorites before creating their first record.
  section.hidden = false;
  count.textContent = `${state.favoriteResults.length} 条收藏 · ${state.savedResults.length} 条保存 · ${state.compareResults.length} 个对比`;
  if (favoriteList) {
    favoriteList.innerHTML = state.favoriteResults.length
      ? state.favoriteResults.map((item) => `<div class="favorite-result-row">
        <div><div class="favorite-result-name">${escapeHtml(item.cityName || cityMeta(item.cityId).name)} · ${escapeHtml(item.property)}</div><span class="favorite-result-meta">收藏于 ${escapeHtml(formatSavedTime(item.addedAt))}</span><div class="favorite-result-actions"><button class="favorite-result-action load-favorite-result" type="button" data-id="${escapeHtml(item.id)}">加载评估</button><button class="favorite-result-action delete delete-favorite-result" type="button" data-id="${escapeHtml(item.id)}">取消收藏</button></div></div>
        <div class="favorite-result-score">${Number.isFinite(Number(item.total)) ? formatNumber(item.total) : '—'}<small> / ${formatNumber(item.totalMax || 100)}</small></div>
      </div>`).join('')
      : '<div class="favorite-empty">点击评分卡片右上角的☆，即可把当前小区加入本机收藏。</div>';
    favoriteList.querySelectorAll('.load-favorite-result').forEach((button) => button.addEventListener('click', () => {
      const item = state.favoriteResults.find((favorite) => favorite.id === button.dataset.id);
      if (item) loadFavoriteResult(item);
    }));
    favoriteList.querySelectorAll('.delete-favorite-result').forEach((button) => button.addEventListener('click', () => removeFavoriteResult(button.dataset.id)));
  }
  list.innerHTML = state.savedResults.length ? state.savedResults.map((item) => `<div class="saved-result-row">
    <div><div class="saved-result-name">${escapeHtml(item.cityName || cityMeta(item.cityId).name)} · ${escapeHtml(item.property)}${item.algorithmVersion !== SCORE_MODEL_VERSION ? '<em class="saved-result-stale">待更新</em>' : ''}</div><span class="saved-result-meta">${item.partial ? '阶段评分 · ' : ''}${item.mode} · ${formatSavedTime(item.scoreUpdatedAt || item.savedAt)}</span><div class="saved-result-actions"><button class="saved-result-action edit-saved-result" type="button" data-id="${item.id}">编辑并加载</button><button class="saved-result-action add-saved-compare" type="button" data-id="${item.id}">加入对比</button><button class="saved-result-action delete delete-saved-result" type="button" data-id="${item.id}">删除</button></div></div>
    <div class="saved-result-score">${formatNumber(item.total)}<small> / ${formatNumber(item.totalMax || 100)}</small></div>
  </div>`).join('') : '<div class="saved-empty">还没有手动保存的结果。完成一次评估后，点击上方“保存结果”。</div>';
  renderCompareTable();
  document.querySelectorAll('.edit-saved-result').forEach((button) => button.addEventListener('click', () => {
    const item = state.savedResults.find((result) => result.id === button.dataset.id);
    if (item) loadSnapshotForEditing(item, 'saved');
  }));
  document.querySelectorAll('.add-saved-compare').forEach((button) => button.addEventListener('click', () => {
    const item = state.savedResults.find((result) => result.id === button.dataset.id);
    if (!item) return;
    addSnapshotToCompare(item);
  }));
  document.querySelectorAll('.delete-saved-result').forEach((button) => button.addEventListener('click', () => {
    if (state.editingSnapshotContext?.scope === 'saved' && state.editingSnapshotContext.id === button.dataset.id) state.editingSnapshotContext = null;
    state.savedResults = state.savedResults.filter((result) => result.id !== button.dataset.id);
    persistResults();
    renderWorkspace();
    showToast('已删除保存结果');
  }));
}

function bindSchoolEditor() {
  document.querySelectorAll('.school-data-input').forEach((input) => input.addEventListener('change', (event) => {
    const level = schoolDistrict[event.target.dataset.level];
    const school = level?.schools?.[Number(event.target.dataset.index)];
    if (!school) return;
    const field = event.target.dataset.field;
    const value = event.target.value.trim();
    school[field] = field === 'name' ? value : (value === '' ? null : Number(value));
    if (field === 'rank' || field === 'totalSchools') school.rankingSource = 'user';
    state.schoolDistrictDirty = true;
    syncManualScoresFromRaw(factors.find((item) => item.id === 'school'));
    renderScore();
  }));
  document.querySelectorAll('.school-mode-select').forEach((select) => select.addEventListener('change', (event) => {
    const level = schoolDistrict[event.target.dataset.level];
    if (!level) return;
    level.mode = event.target.value;
    if (level.mode === 'fixed') {
      level.schools = [level.schools[0] || { name: '', rank: null, totalSchools: null, probability: 1 }];
      level.schools[0].probability = 1;
    } else if (!level.schools.length) {
      level.schools = [{ name: '', rank: null, totalSchools: null, probability: null }];
    }
    state.schoolDistrictDirty = true;
    syncManualScoresFromRaw(factors.find((item) => item.id === 'school'));
    renderScore();
  }));
  document.querySelectorAll('.school-nine-year-select').forEach((select) => select.addEventListener('change', (event) => {
    schoolDistrict.nineYearContinuity = event.target.value === '' ? null : event.target.value === 'true';
    state.schoolDistrictDirty = true;
    syncManualScoresFromRaw(factors.find((item) => item.id === 'school'));
    renderScore();
  }));
  document.querySelectorAll('.add-lottery-school').forEach((button) => button.addEventListener('click', (event) => {
    const level = schoolDistrict[event.target.dataset.level];
    if (!level || level.mode !== 'lottery') return;
    level.schools.push({ name: '', rank: null, totalSchools: null, probability: null });
    state.schoolDistrictDirty = true;
    syncManualScoresFromRaw(factors.find((item) => item.id === 'school'));
    renderScore();
  }));
  document.querySelectorAll('.remove-school').forEach((button) => button.addEventListener('click', (event) => {
    const level = schoolDistrict[event.target.dataset.level];
    const index = Number(event.target.dataset.index);
    if (!level || !Number.isInteger(index) || !level.schools[index]) return;
    if (level.schools.length === 1) {
      level.schools[0] = { name: '', rank: null, totalSchools: null, probability: level.mode === 'fixed' ? 1 : null };
    } else {
      level.schools.splice(index, 1);
    }
    state.schoolDistrictDirty = true;
    syncManualScoresFromRaw(factors.find((item) => item.id === 'school'));
    renderScore();
    showToast(`已删除${level.label}学校，可继续补录正确学校`);
  }));
}

function missingRawDataItems() {
  const items = [];
  const price = factors.find((factor) => factor.id === 'price');
  if (price && !Number.isFinite(Number(price.pricePerSqm))) items.push({ factorId: 'price', label: '小区平均单价', detail: '请输入元/㎡的平均价格', selector: '#raw-price-per-sqm' });
  const quality = factors.find((factor) => factor.id === 'quality');
  const raw = quality?.rawInputs || {};
  const rawFields = {
    age: ['buildYear', '建成年份', '例如 2018'], greenery: ['greenRate', '绿化率', '例如 35%'],
    'elevator-household': ['ladderHouseholdRatio', '梯户比', '例如 50 户/梯'], noise: ['noiseDb', '噪音实测值', '例如 55 dB'],
    'max-floor': ['maxFloor', '最高层数', '例如 32 层'], 'floorplan-quality': ['layoutQuality', '房型质量', '默认 1 分；有公开吐槽填 0 分'],
    'floor-height': ['floorHeight', '住宅层高', '例如 2.9 米'], developer: ['developer', '开发企业', '例如 保利地产']
  };
  quality?.subscores?.forEach((subscore) => {
    const field = rawFields[subscore.id];
    if (!field || subscorePoints(quality, subscore) !== null) return;
    const rawValue = raw[field[0]];
    if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '') return;
    items.push({ factorId: 'quality', subscoreId: subscore.id, label: field[1], detail: `请输入原始值（${field[2]}）`, selector: `#qualityRawPanel input[data-raw-field="${field[0]}"]` });
  });
  const center = factors.find((factor) => factor.id === 'center');
  const centerFields = [['distanceKm', '到 CBD 直线距离', '请输入距离（km）', '#raw-center-distance-km'], ['peakTransitMinutes', '高峰公共交通时间', '请输入时间（分钟）', '#raw-center-transit-minutes']];
  centerFields.forEach(([field, label, detail, selector]) => {
    if (center && !Number.isFinite(rawNumber(center[field]))) items.push({ factorId: 'center', label, detail, selector });
  });
  const life = factors.find((factor) => factor.id === 'life');
  const lifeFields = [['commercialCount', '2km 商业店铺数量', '请输入店铺数量', '#lifeRawPanel input[data-life-field="commercialCount"]'], ['diningCount', '2km 餐饮店铺数量', '请输入店铺数量', '#lifeRawPanel input[data-life-field="diningCount"]'], ['matureMallCount', '大型成熟商场数量', '请输入商场数量', '#lifeRawPanel input[data-life-field="matureMallCount"]'], ['tertiaryDistanceKm', '最近三级医院距离', '请输入距离（km）', '#lifeRawPanel input[data-life-field="tertiaryDistanceKm"]'], ['localMedicalDistanceKm', '最近基层医疗距离', '请输入距离（km）', '#lifeRawPanel input[data-life-field="localMedicalDistanceKm"]'], ['parkDistanceKm', '最近公园距离', '请输入距离（km）', '#lifeRawPanel input[data-life-field="parkDistanceKm"]']];
  lifeFields.forEach(([field, label, detail, selector]) => {
    if (life && !Number.isFinite(rawNumber(life.rawInputs?.[field]))) items.push({ factorId: 'life', label, detail, selector });
  });
  factors.filter((factor) => !['price', 'quality', 'center', 'life'].includes(factor.id) && !Number.isFinite(factorScore(factor))).forEach((factor) => {
    const target = factor.id === 'transport' ? '.transport-distance-input' : factor.id === 'center' ? '#raw-center-distance-km' : factor.id === 'life' ? '#lifeRawPanel input' : factor.id === 'school' ? '.school-data-input.is-missing' : `#rulesList .rule-card[data-factor-id="${factor.id}"]`;
    items.push({ factorId: factor.id, label: factor.name, detail: '当前没有足够的原始数据，填写后才能计算', selector: target });
  });
  return items;
}

function closeMissingDataModal() {
  const modal = $('#missingDataModal');
  if (modal) modal.hidden = true;
}

function openMissingDataModal() {
  const items = missingRawDataItems();
  if (!items.length) return;
  const modal = $('#missingDataModal');
  const list = $('#missingDataList');
  if (!modal || !list) return;
  list.innerHTML = items.map((item) => `<div class="missing-data-item"><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></span></div>`).join('');
  modal.hidden = false;
  state.missingPromptProperty = state.property;
}

function confirmMissingData() {
  const items = missingRawDataItems();
  closeMissingDataModal();
  const first = items[0];
  if (!first) return;
  window.setTimeout(() => {
    const target = document.querySelector(first.selector) || document.querySelector(`#rulesList .rule-card[data-factor-id="${first.factorId}"]`);
    if (!target) return;
    const focusTarget = target.matches?.('input,textarea,select') ? target : target.querySelector?.('input,textarea,select') || target;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusTarget.classList?.add('missing-data-focus');
    if (typeof focusTarget.focus === 'function') focusTarget.focus();
  }, 80);
  // 缺失数据确认只进入原始数据填写，不自动开启“最终评分人工修正”。
  // 原始值填入后继续走自动评分；如需直接改最终分数，再由用户主动开启人工修正。
  showToast('已定位到缺失原始数据，请填写后重新计算');
}

function promptMissingDataIfNeeded() {
  if (state.manualMode || !String(state.property || '').trim()) return;
  const modal = $('#missingDataModal');
  if (modal && !modal.hidden) return;
  if (scoreCoverage().completedCount < factors.length && missingRawDataItems().length) openMissingDataModal();
}

function evaluate(valueOverride = null, options = {}) {
  const input = $('#propertyInput');
  const value = String(valueOverride ?? input?.value ?? '').trim();
  if (!value) return false;
  if (state.historyWeightOverride) {
    // A historical weight choice is scoped to the currently loaded record.
    // Starting any new evaluation returns to the saved city template.
    state.historyWeightOverride = null;
    applyWeightPreferenceForCity(state.cityId);
    renderWeights();
    state.editingSnapshotContext = null;
  }
  const resolution = resolveCommunityQuery(value);
  if (!options.selected && resolution.requiresChoice) {
    renderCommunitySuggestions(value, { force: true, notice: `“${value}”对应多个小区或分期，请先选择具体名称后再评估。` });
    const title = $('#propertyTitle');
    const summary = $('#scoreSummary');
    if (title) title.textContent = value;
    if (summary) summary.textContent = '检测到多个可能的小区或分期，请在搜索框下方选择具体名称。';
    showToast('匹配到多个小区或分期，请选择具体名称');
    return false;
  }
  const matchedName = options.selected ? value : (resolution.best?.name || value);
  if (state.property !== matchedName) {
    state.missingPromptProperty = '';
    state.editingSnapshotContext = null;
    state.schoolDistrictDirty = false;
  }
  state.property = matchedName;
  // Remember the resolved name (rather than the raw alias typed by the user)
  // so a refresh reopens the same scorecard and keeps all alias-backed data
  // lookups consistent.
  persistActiveView();
  if (input && matchedName !== value) input.value = matchedName;
  hideCommunitySuggestions();
  const notice = $('#communityMatchNotice');
  const hasFuzzyNotice = notice && !notice.hidden && notice.textContent.includes('已按数据库名称匹配');
  if (notice) {
    if (matchedName !== value) {
      notice.textContent = `已按数据库名称匹配到“${matchedName}”，可以继续评估。`;
      notice.hidden = false;
    } else if (!hasFuzzyNotice) {
      notice.hidden = true;
      notice.textContent = '';
    }
  }
  applyTransportLookup(matchedName);
  applyLifeLookup(matchedName);
  applyCenterLookup(matchedName);
  applyOfflineScoreLookup(matchedName);
  $('#propertyTitle').textContent = matchedName;
  if (state.schoolDistrictData?.search) {
    applySchoolLookup(matchedName);
  }
  renderScore();
  promptMissingDataIfNeeded();
  const insights = [
    '“把通勤时间压进 45 分钟，它的综合分会更接近你的真实体感。”',
    '“预算不想被月供绑架的话，这套房的配套与价格比值得看。”',
    '“周边还在生长，适合愿意用一点时间换空间的长期主义者。”'
  ];
  $('#insightText').textContent = insights[matchedName.length % insights.length];
  return true;
}

function readCityDataState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CITY_DATA_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function loadCustomCities() {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_CITY_KEY) || '[]');
    if (!Array.isArray(stored)) return;
    stored.filter((city) => city && city.id && city.name).forEach((city) => {
      if (!CITY_CATALOG.some((item) => item.id === city.id)) CITY_CATALOG.push({ ...city, custom: true });
    });
  } catch (error) { /* 没有自定义城市时使用预置列表 */ }
}

function persistCustomCities() {
  try { localStorage.setItem(CUSTOM_CITY_KEY, JSON.stringify(CITY_CATALOG.filter((city) => city.custom))); } catch (error) { /* 本地存储不可用时仍可使用当前会话 */ }
}

function persistCityDataState() {
  try { localStorage.setItem(CITY_DATA_KEY, JSON.stringify(state.cityData)); } catch (error) { /* 离线演示仍可继续使用 */ }
}

function readActiveView() {
  try {
    const params = new URLSearchParams(window.location.search);
    const sharedProperty = String(params.get('resiscoreProperty') || '').trim();
    const sharedCityId = String(params.get('resiscoreCity') || '').trim();
    if (sharedProperty || sharedCityId) {
      const cityId = sharedCityId || 'guangzhou';
      const validCity = CITY_CATALOG.some((city) => city.id === cityId);
      if (validCity) return { cityId, property: sharedProperty };
    }
    const stored = JSON.parse(localStorage.getItem(ACTIVE_VIEW_KEY) || '{}');
    if (!stored || typeof stored !== 'object') return null;
    const cityId = String(stored.cityId || '').trim();
    const validCity = CITY_CATALOG.some((city) => city.id === cityId);
    const property = String(stored.property || '').trim();
    if (!validCity) return null;
    return { cityId, property };
  } catch (error) {
    return null;
  }
}

function persistActiveView() {
  const property = String(state.property || '').trim();
  if (property === '请选择小区' || !state.cityId) return;
  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, JSON.stringify({
      cityId: state.cityId,
      property,
      savedAt: new Date().toISOString()
    }));
    // A shared query is only the initial entry point. Once the user evaluates
    // another community, let the local active view become authoritative.
    const url = new URL(window.location.href);
    if (url.searchParams.has('resiscoreCity') || url.searchParams.has('resiscoreProperty')) {
      url.searchParams.delete('resiscoreCity');
      url.searchParams.delete('resiscoreProperty');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
  } catch (error) { /* 本地存储不可用时仍不影响当前会话 */ }
}

function cityMeta(cityId = state.cityId) {
  return CITY_CATALOG.find((city) => city.id === cityId) || CITY_CATALOG[0];
}

function cityDataReady(cityId) {
  return Boolean(state.cityData[cityId]?.ready);
}

function cityDataNeedsAutoRefresh(cityId, now = Date.now()) {
  const entry = state.cityData[cityId];
  if (!entry?.ready) return false;
  const lastChecked = Date.parse(entry.lastCheckedAt || '');
  return !Number.isFinite(lastChecked) || now - lastChecked >= CITY_DATA_AUTO_UPDATE_MS;
}

function downloadedCityIds() {
  return Object.keys(state.cityData).filter((cityId) => cityDataReady(cityId));
}

function markCityDataReady(cityId, source = 'downloaded', details = {}) {
  const previous = state.cityData[cityId] || {};
  const now = new Date().toISOString();
  const updated = Boolean(details.updated);
  state.cityData[cityId] = {
    ...previous,
    ready: true,
    source: source === 'local' ? (previous.source || 'downloaded') : source,
    version: details.version || previous.version || 'v1.0',
    downloadedAt: previous.downloadedAt || details.downloadedAt || now,
    lastCheckedAt: details.checkedAt || previous.lastCheckedAt || null,
    lastUpdatedAt: updated ? (details.updatedAt || now) : (previous.lastUpdatedAt || null),
    packs: [...CITY_DATA_PACKS]
  };
  persistCityDataState();
}

function recordCityDataResult(cityId, result) {
  if (!result) return;
  markCityDataReady(cityId, result.source, {
    version: result.version,
    checkedAt: result.checkedAt,
    updated: result.updated,
    updatedAt: result.updatedAt
  });
}

function renderCityOptions() {
  const list = $('#cityOptions');
  if (!list) return;
  list.innerHTML = CITY_CATALOG.map((city) => {
    const ready = cityDataReady(city.id);
    return `<button class="city-option${city.id === state.cityId ? ' active' : ''}" type="button" data-city-id="${city.id}">
      <span><strong>${city.name} · 2026</strong><small>${ready ? '数据已就绪，可直接评估' : city.subtitle}</small></span><span class="city-option-status${ready ? '' : ' pending'}">${city.id === state.cityId ? '当前' : ready ? '已就绪' : '下载'}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.city-option').forEach((button) => button.addEventListener('click', () => selectCity(button.dataset.cityId)));
}

function closeCityMenu() {
  const menu = $('#cityMenu');
  const switcher = $('#citySwitcher');
  if (menu) menu.hidden = true;
  if (switcher) switcher.setAttribute('aria-expanded', 'false');
}

function openCityMenu() {
  renderCityOptions();
  const menu = $('#cityMenu');
  const switcher = $('#citySwitcher');
  if (menu) menu.hidden = false;
  if (switcher) switcher.setAttribute('aria-expanded', 'true');
}

function applyCity(cityId) {
  const city = cityMeta(cityId);
  // A loaded history record belongs to the previous city. Do not let a later
  // save action use that record as the replacement target after switching.
  state.editingSnapshotContext = null;
  state.historyWeightOverride = null;
  closeHistoryWeightModal();
  closeSaveConflictModal();
  closeOfflineSyncModal({ silent: true });
  state.cityId = city.id;
  state.schoolDistrictDirty = false;
  const loadToken = ++state.dataLoadToken;
  applyWeightPreferenceForCity(state.cityId);
  state.priceData = city.id === 'guangzhou' ? state.priceData : null;
  state.communityQualityData = city.id === 'guangzhou' ? state.communityQualityData : null;
  state.futureData = city.id === 'guangzhou' ? state.futureData : null;
  state.multiSourceData = city.id === 'guangzhou' ? state.multiSourceData : null;
  state.property = city.id === 'guangzhou' ? '大壮名城' : '';
  persistActiveView();
  const transportFactor = factors.find((item) => item.id === 'transport');
  if (transportFactor) {
    delete transportFactor.transportRoutes;
    delete transportFactor.transportLookup;
    transportFactor.subscores?.forEach((subscore) => {
      subscore.points = null;
      subscore.current = city.id === 'guangzhou' ? '正在加载广州交通数据' : '待补充当前城市交通数据';
    });
  }
  const centerFactor = factors.find((item) => item.id === 'center');
  if (centerFactor) {
    centerFactor.distanceKm = null;
    centerFactor.peakTransitMinutes = null;
    delete centerFactor.centerLookup;
  }
  clearOfflineScoreFields();
  const label = $('#cityNameLabel');
  const signal = $('#citySignalName');
  const propertyInput = $('#propertyInput');
  const propertyTitle = $('#propertyTitle');
  const totalScore = $('#totalScore');
  const scoreSummary = $('#scoreSummary');
  const insight = $('#insightText');
  if (label) label.textContent = city.name;
  if (signal) signal.textContent = '大壮名城';
  if (propertyInput) propertyInput.value = state.property;
  if (propertyTitle) propertyTitle.textContent = state.property || '请选择小区';
  if (totalScore) totalScore.textContent = '—';
  if (scoreSummary) scoreSummary.textContent = state.property
    ? `正在加载${city.name}「${state.property}」的离线数据。`
    : `${city.name}数据已就绪，请输入小区开始评估。`;
  if (insight) insight.textContent = '“先输入一个小区，再用现场感受校准数据评分。”';
  const status = $('#rulesStatus');
  if (status) status.innerHTML = `<i></i> ${city.name}多维数据已就绪`;
  closeCityMenu();
  renderWeights();
  if (city.id === 'guangzhou' && !state.priceData) loadCommunityPriceData({ loadToken });
  if (city.id === 'guangzhou' && !state.communityQualityData) loadCommunityQualityData({ loadToken });
  if (city.id === 'guangzhou' && !state.futureData) loadCommunityFutureData({ loadToken });
  if (city.id === 'guangzhou' && !state.multiSourceData) loadCommunityEvidenceData({ loadToken });
  if (state.property && city.id === 'guangzhou') {
    applyTransportLookup(state.property);
    applyLifeLookup(state.property);
    applyCenterLookup(state.property);
    applyOfflineScoreLookup(state.property);
    applySchoolLookup(state.property);
    renderScore();
  }
  showToast(`已切换到${city.name}，可以开始评估`);
}

function openCityDataModal(cityId) {
  state.pendingCityId = cityId;
  const city = cityMeta(cityId);
  const modal = $('#cityDataModal');
  const description = $('#cityModalDescription');
  const packs = $('#cityDataPacks');
  const progress = $('#cityDownloadProgressBar');
  const percent = $('#cityDownloadPercent');
  const status = $('#cityDownloadStatus');
  const button = $('#downloadCityDataBtn');
  if (!modal || !description || !packs || !progress || !percent || !status || !button) return;
  description.textContent = `你选择了${city.name}。该城市尚未在本机准备数据，需先下载用于评分的公共基础数据，下载后才会开始计算该城市的小区分数。`;
  packs.innerHTML = CITY_DATA_PACKS.map((pack) => `<div class="city-data-pack"><i></i><span>${pack}</span></div>`).join('');
  progress.style.width = '0%';
  percent.textContent = '0%';
  status.textContent = `共 ${CITY_DATA_PACKS.length} 类基础数据`;
  button.disabled = false;
  button.textContent = '下载该城市多维数据 ↓';
  modal.hidden = false;
}

function openCustomCityModal() {
  closeCityMenu();
  const modal = $('#customCityModal');
  const input = $('#customCityInput');
  if (!modal || !input) return;
  input.value = '';
  modal.hidden = false;
  window.setTimeout(() => input.focus(), 0);
}

function closeCustomCityModal() {
  const modal = $('#customCityModal');
  if (modal) modal.hidden = true;
}

function confirmCustomCity() {
  const input = $('#customCityInput');
  const name = input?.value.trim();
  if (!name) {
    showToast('请先输入城市名称');
    return;
  }
  const existing = CITY_CATALOG.find((city) => city.name === name);
  if (existing) {
    closeCustomCityModal();
    selectCity(existing.id);
    return;
  }
  const city = { id: `custom-${Date.now()}`, name, subtitle: '自定义城市 · 需要下载数据', custom: true };
  CITY_CATALOG.push(city);
  persistCustomCities();
  closeCustomCityModal();
  openCityDataModal(city.id);
}

function closeCityDataModal() {
  const modal = $('#cityDataModal');
  if (modal) modal.hidden = true;
  state.pendingCityId = null;
}

function downloadPendingCityData() {
  const cityId = state.pendingCityId;
  const city = cityMeta(cityId);
  const modal = $('#cityDataModal');
  const button = $('#downloadCityDataBtn');
  const progress = $('#cityDownloadProgressBar');
  const percent = $('#cityDownloadPercent');
  const status = $('#cityDownloadStatus');
  const packs = [...document.querySelectorAll('.city-data-pack')];
  if (!cityId || !button || !progress || !percent || !status || button.disabled) return;
  button.disabled = true;
  button.textContent = '正在下载…';
  packs.forEach((pack) => pack.classList.remove('done'));
  let completed = 0;
  const tick = () => {
    completed += 1;
    if (packs[completed - 1]) packs[completed - 1].classList.add('done');
    const progressValue = Math.round(completed / packs.length * 100);
    progress.style.width = `${progressValue}%`;
    percent.textContent = `${progressValue}%`;
    status.textContent = completed < packs.length ? `正在准备：${CITY_DATA_PACKS[completed - 1]}` : '数据已准备完成';
    if (completed < packs.length) window.setTimeout(tick, 180);
    else {
      markCityDataReady(cityId);
      if (modal) modal.hidden = true;
      applyCity(cityId);
      showToast(`${city.name}多维数据已下载到本机`);
    }
  };
  window.setTimeout(tick, 220);
}

function selectCity(cityId) {
  if (cityId === state.cityId) {
    closeCityMenu();
    return;
  }
  if (!cityDataReady(cityId)) {
    closeCityMenu();
    openCityDataModal(cityId);
    return;
  }
  applyCity(cityId);
}

async function loadSchoolDistrictData() {
  if (typeof SchoolDistrictDataStore === 'undefined') return;
  try {
    state.schoolDistrictData = await SchoolDistrictDataStore.load(state.schoolDistrictId);
    state.schoolDistrictManifest = state.schoolDistrictData.manifest || null;
    state.schoolDistrictPackages = typeof SchoolDistrictDataStore.loadAllNormalized === 'function'
      ? await SchoolDistrictDataStore.loadAllNormalized()
      : {};
    // 确保当前包也在自动匹配列表中，即使它来自内置回退数据。
    if (state.schoolDistrictData?.data && !state.schoolDistrictPackages[state.schoolDistrictId]) {
      state.schoolDistrictPackages[state.schoolDistrictId] = state.schoolDistrictData;
    }
    applySchoolLookup(state.property);
    renderScore();
    const status = $('#rulesStatus');
    if (status && !state.amenityData && !state.amenityLookup.error) {
      const district = state.schoolDistrictData.district;
      const count = state.schoolDistrictData.data?.elementaryZones?.length;
      const normalizedCount = Object.keys(state.schoolDistrictPackages).length;
      const pendingCount = (state.schoolDistrictManifest?.districts || []).filter((item) => !item.normalizedData).length;
      const provisionalCount = Number(state.schoolDistrictData.supplement?.stats?.recordCount) || 0;
      status.innerHTML = count
        ? `<i></i> ${escapeHtml(district?.name || '黄埔区')} 2026 学区数据已加载 · ${count} 条小学地段 · 已接入 ${normalizedCount} 个行政区离线包${provisionalCount ? ` · 待确认候选 ${provisionalCount} 条` : ''}${pendingCount ? ` · ${pendingCount} 区原始附件待转换` : ''}${state.schoolDistrictData.source === 'bundled' ? ' · 内置数据' : ''}`
        : `<i></i> 广州 11 区招生来源已登记 · 当前暂无可自动匹配的标准化离线包`;
    }
  } catch (error) {
    state.schoolLookup.error = error.message;
    const status = $('#rulesStatus');
    if (status) status.innerHTML = `<i></i> 黄埔区学区数据加载失败：${escapeHtml(error.message)}，请检查数据文件或刷新重试`;
    console.warn('黄埔区学区数据加载失败，继续等待用户补录：', error);
  }
}
async function loadTransportData(options = {}) {
  if (typeof TransportDataStore === 'undefined') return;
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  const checkUpdates = options.checkUpdates ?? cityDataNeedsAutoRefresh(cityId);
  try {
    const result = await TransportDataStore.loadCity(cityId, { checkUpdates });
    if (!activeDataLoad(token, cityId)) return result;
    state.transportData = result.data;
    recordCityDataResult(cityId, result);
    if (state.property) {
      applyTransportLookup(state.property);
      applyCenterLookup(state.property);
      applyOfflineScoreLookup(state.property);
      // 交通数据可能晚于学区/配套数据到达；重新渲染，避免页面仍停留在
      // 初始的“待补充”状态，而内存里的评分已经完成计算。
      renderScore();
    }
    const status = $('#rulesStatus');
    if (status && !state.amenityData && !state.amenityLookup.error) status.innerHTML = `<i></i> ${cityMeta().name}交通数据 · ${result.data.stats?.stationCount || 0} 个站点 · ${result.version}`;
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    const factor = factors.find((item) => item.id === 'transport');
    if (factor) {
      factor.transportRoutes = [];
      factor.transportLookup = { query: state.property, match: null, error: error.message };
      factor.subscores?.forEach((subscore) => {
        subscore.points = null;
        subscore.current = '广州交通数据加载失败，请检查数据域名';
      });
      renderScore();
    }
    const status = $('#rulesStatus');
    if (status) status.innerHTML = '<i></i> 广州交通数据加载失败，请检查数据域名或网络';
    console.warn('广州交通数据加载失败，已停止显示演示交通分：', error);
  }
}

async function loadAmenityData(options = {}) {
  if (typeof AmenityDataStore === 'undefined') return;
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  const checkUpdates = options.checkUpdates ?? cityDataNeedsAutoRefresh(cityId);
  try {
    const result = await AmenityDataStore.loadCity(cityId, { checkUpdates });
    if (!activeDataLoad(token, cityId)) return result;
    state.amenityData = result.data;
    recordCityDataResult(cityId, result);
    applyLifeLookup(state.property);
    applyCenterLookup(state.property);
    applyOfflineScoreLookup(state.property);
    renderScore();
    const status = $('#rulesStatus');
    if (status) status.innerHTML = `<i></i> ${cityMeta().name}生活配套数据 · ${result.data.stats.residentialCount} 个小区 · ${result.source === 'bundled' ? '内置数据' : result.version}`;
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    state.amenityLookup.error = error.message;
    const status = $('#rulesStatus');
    if (status) status.innerHTML = `<i></i> ${cityMeta().name}生活配套数据加载失败：${escapeHtml(error.message)}，请检查数据文件或刷新重试`;
    renderScore();
    console.warn(`${cityMeta().name}生活配套数据加载失败，继续等待数据包：`, error);
  }
}

async function loadCommunityPriceData(options = {}) {
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  if (cityId !== 'guangzhou') return;
  try {
    const data = await requestAppJson('data/guangzhou-community-price-2026.json');
    if (!activeDataLoad(token, cityId)) return;
    state.priceData = data;
    if (state.property) {
      applyOfflineScoreLookup(state.property);
      renderScore();
    }
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    const bundled = globalThis.RESISCORE_BUNDLED_PRICE_DATA;
    if (bundled) {
      state.priceData = bundled;
      if (state.property) {
        applyOfflineScoreLookup(state.property);
        renderScore();
      }
      console.warn('广州公开小区均价远端文件不可用，已使用随版本发布的内置价格包：', error);
      return;
    }
    state.priceData = null;
    console.warn('广州公开小区均价数据加载失败，继续等待人工输入：', error);
  }
}

async function loadCommunityEvidenceData(options = {}) {
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  if (cityId !== 'guangzhou') return;
  try {
    const data = await requestAppJson('data/guangzhou-community-evidence-2026.json');
    if (!activeDataLoad(token, cityId)) return;
    state.multiSourceData = data;
    if (state.property) {
      applyOfflineScoreLookup(state.property);
      // 生活配套评分会优先采用证据包中的多源聚合值；证据包异步到达后需要重新计算一次。
      applyLifeLookup(state.property);
      renderScore();
    }
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    const bundled = globalThis.RESISCORE_BUNDLED_EVIDENCE_DATA;
    if (bundled) {
      state.multiSourceData = bundled;
      if (state.property) {
        applyOfflineScoreLookup(state.property);
        applyLifeLookup(state.property);
        renderScore();
      }
      console.warn('广州多来源证据远端文件不可用，已使用随版本发布的内置证据包：', error);
      return;
    }
    state.multiSourceData = null;
    console.warn('广州多来源证据包不可用，继续使用单源字段并标记待确认：', error);
    if (state.property) renderScore();
  }
}

async function loadCommunityQualityData(options = {}) {
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  if (cityId !== 'guangzhou') return;
  try {
    const data = await requestAppJson('data/guangzhou-community-quality-2026.json');
    if (!activeDataLoad(token, cityId)) return;
    state.communityQualityData = data;
    if (state.property) {
      applyOfflineScoreLookup(state.property);
      applyLifeLookup(state.property);
      applyCenterLookup(state.property);
      applyTransportLookup(state.property);
      renderScore();
    }
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    const bundled = globalThis.RESISCORE_BUNDLED_QUALITY_DATA;
    if (bundled) {
      state.communityQualityData = bundled;
      if (state.property) {
        applyOfflineScoreLookup(state.property);
        applyLifeLookup(state.property);
        applyCenterLookup(state.property);
        applyTransportLookup(state.property);
        renderScore();
      }
      console.warn('广州小区品质远端文件不可用，已使用随版本发布的内置公开字段包：', error);
      return;
    }
    state.communityQualityData = null;
    console.warn('广州小区品质公开字段包加载失败，继续使用人工修正：', error);
  }
}

async function loadCommunityFutureData(options = {}) {
  const cityId = state.cityId;
  const token = options.loadToken ?? state.dataLoadToken;
  if (cityId !== 'guangzhou') return;
  try {
    const data = await requestAppJson('data/guangzhou-future-potential-2026.json');
    if (!activeDataLoad(token, cityId)) return;
    state.futureData = data;
    if (state.property) renderScore();
  } catch (error) {
    if (!activeDataLoad(token, cityId)) return;
    const bundled = globalThis.RESISCORE_BUNDLED_FUTURE_DATA;
    if (bundled) {
      state.futureData = bundled;
      if (state.property) renderScore();
      console.warn('广州未来潜力远端文件不可用，已使用随版本发布的内置公开证据包：', error);
      return;
    }
    state.futureData = null;
    console.warn('广州未来潜力公开证据包加载失败，当前只显示待补充：', error);
  }
}

async function refreshSingleCityData(cityId) {
  const results = [];
  const errors = [];
  const warnings = [];
  if (typeof TransportDataStore !== 'undefined') {
    try {
      results.push({ kind: 'transport', result: await TransportDataStore.loadCity(cityId, { checkUpdates: true }) });
    } catch (error) {
      errors.push(`交通：${error.message}`);
    }
  }
  if (typeof AmenityDataStore !== 'undefined') {
    try {
      results.push({ kind: 'amenity', result: await AmenityDataStore.loadCity(cityId, { checkUpdates: true }) });
    } catch (error) {
      errors.push(`配套：${error.message}`);
    }
  }
  if (!results.length) {
    if (errors.length && errors.every((error) => /暂未提供/.test(error))) {
      return { cityId, updated: false, checked: false, errors, unavailable: true };
    }
    throw new Error(errors.join('；') || '当前没有可更新的数据源');
  }

  results.forEach(({ result }) => {
    recordCityDataResult(cityId, result);
    // A checkError means the optional remote manifest/package probe failed.
    // The loader has already returned a valid local/bundled data object, so it
    // is a warning rather than a scoring failure. Only thrown load errors above
    // belong in the blocking errors list.
    if (result.checkError) warnings.push(result.checkError);
  });
  if (cityId === state.cityId) {
    const transport = results.find((item) => item.kind === 'transport')?.result;
    const amenity = results.find((item) => item.kind === 'amenity')?.result;
    if (transport) state.transportData = transport.data;
    if (amenity) state.amenityData = amenity.data;
    if (state.property) {
      applyTransportLookup(state.property);
      applyLifeLookup(state.property);
      applyCenterLookup(state.property);
      applyOfflineScoreLookup(state.property);
      applySchoolLookup(state.property);
    }
    renderScore();
  }
  const unavailable = errors.length > 0 && errors.every((error) => /暂未提供/.test(error));
  return {
    cityId,
    updated: results.some(({ result }) => result.updated),
    checked: results.some(({ result }) => result.checkedAt),
    errors,
    warnings,
    unavailable
  };
}

async function refreshDownloadedCityData({ manual = false } = {}) {
  if (cityDataRefreshPromise) return cityDataRefreshPromise;
  const targets = downloadedCityIds().filter((cityId) => manual || cityDataNeedsAutoRefresh(cityId));
  if (!targets.length) return { targets: [], updatedCount: 0, failedCount: 0, skipped: true };

  cityDataRefreshPromise = (async () => {
    const results = [];
    for (const cityId of targets) {
      try {
        results.push(await refreshSingleCityData(cityId));
      } catch (error) {
        results.push({ cityId, updated: false, checked: false, errors: [error.message] });
      }
    }
    renderCityOptions();
    return {
      targets,
      updatedCount: results.filter((result) => result.updated).length,
      checkedCount: results.filter((result) => result.checked).length,
      failedCount: results.filter((result) => result.errors?.length).length,
      unavailableCount: results.filter((result) => result.unavailable).length,
      results
    };
  })();
  try {
    return await cityDataRefreshPromise;
  } finally {
    cityDataRefreshPromise = null;
  }
}

function scheduleAutomaticCityDataRefresh() {
  window.setTimeout(async () => {
    try {
      const result = await refreshDownloadedCityData();
      if (result.updatedCount) showToast(`已自动更新 ${result.updatedCount} 个城市的离线数据`);
    } catch (error) {
      console.warn('城市离线数据自动更新失败：', error);
    }
  }, 800);
}

async function handleManualCityDataRefresh() {
  const button = $('#refreshCityDataBtn');
  if (!button || button.disabled) return;
  button.disabled = true;
  button.textContent = '更新中…';
  try {
    const result = await refreshDownloadedCityData({ manual: true });
    if (result.skipped) {
      showToast('当前还没有已下载的城市数据');
    } else if (result.unavailableCount === result.targets.length) {
      showToast('已检查，但当前城市暂无可更新的数据包');
    } else if (result.failedCount === result.targets.length) {
      const detail = result.results
        .filter((item) => item.errors?.length)
        .map((item) => `${cityMeta(item.cityId).name}：${item.errors.join('；')}`)
        .join(' | ');
      showToast(detail ? `离线数据更新失败：${detail}` : '离线数据更新失败，请检查网络后重试');
    } else if (result.failedCount) {
      showToast(`已完成检查，但有 ${result.failedCount} 个城市数据源暂时无法更新`);
    } else if (result.updatedCount) {
      showToast(`已更新 ${result.updatedCount} 个城市的离线数据`);
    } else {
      showToast('已检查，当前已是最新数据');
    }
  } finally {
    button.disabled = false;
    button.textContent = '更新离线数据';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Values written by builds before the consent prompt were implicit test
  // overrides. Drop them once so a fresh page starts from the published data
  // package; only the new confirmed layer can survive a browser restart.
  clearLegacyOfflineOverrideStores();
  migrateConfirmedOfflineOverrideStore();
  loadCustomCities();
  const activeView = readActiveView();
  if (activeView) {
    state.cityId = activeView.cityId;
    state.property = activeView.property;
    const propertyInput = $('#propertyInput');
    const propertyTitle = $('#propertyTitle');
    const cityLabel = $('#cityNameLabel');
    const citySignal = $('#citySignalName');
    if (propertyInput) propertyInput.value = state.property;
    if (propertyTitle) propertyTitle.textContent = state.property;
    if (cityLabel) cityLabel.textContent = cityMeta().name;
    if (citySignal) citySignal.textContent = state.property;
  }
  state.cityData = readCityDataState();
  if (!state.cityData.guangzhou) markCityDataReady('guangzhou', 'bundled');
  state.savedResults = readStoredResults(SAVED_RESULTS_KEY).slice(0, MAX_SAVED_RESULTS);
  state.compareResults = readStoredResults(COMPARE_RESULTS_KEY).slice(-MAX_COMPARE_RESULTS);
  state.favoriteResults = readStoredFavorites();
  applyWeightPreferenceForCity(state.cityId);
  renderWeights();
  renderScore();
  renderCityOptions();
  const loadToken = ++state.dataLoadToken;
  Promise.allSettled([
    loadSchoolDistrictData(),
    loadTransportData({ loadToken }),
    loadAmenityData({ loadToken }),
    loadCommunityPriceData({ loadToken }),
    loadCommunityQualityData({ loadToken }),
    loadCommunityFutureData({ loadToken }),
    loadCommunityEvidenceData({ loadToken })
  ]).then(scheduleAutomaticCityDataRefresh);
  $('#citySwitcher').addEventListener('click', () => {
    const menu = $('#cityMenu');
    menu.hidden ? openCityMenu() : closeCityMenu();
  });
  $('#closeCityModal').addEventListener('click', closeCityDataModal);
  document.querySelector('[data-close-city-modal]').addEventListener('click', closeCityDataModal);
  $('#downloadCityDataBtn').addEventListener('click', downloadPendingCityData);
  $('#addCustomCityBtn').addEventListener('click', openCustomCityModal);
  $('#closeCustomCityModal').addEventListener('click', closeCustomCityModal);
  document.querySelector('[data-close-custom-city]').addEventListener('click', closeCustomCityModal);
  $('#confirmCustomCityBtn').addEventListener('click', confirmCustomCity);
  $('#closeMissingDataModal').addEventListener('click', closeMissingDataModal);
  document.querySelector('[data-close-missing-data]').addEventListener('click', closeMissingDataModal);
  $('#fillMissingDataBtn').addEventListener('click', confirmMissingData);
  $('#closeRefreshResultsModal').addEventListener('click', closeRefreshResultsModal);
  document.querySelector('[data-close-refresh-results]').addEventListener('click', closeRefreshResultsModal);
  $('#cancelRefreshResults').addEventListener('click', closeRefreshResultsModal);
  $('#confirmRefreshResults').addEventListener('click', confirmRefreshResults);
  $('#selectAllRefreshResults').addEventListener('click', () => setRefreshSelection(true));
  $('#clearRefreshResults').addEventListener('click', () => setRefreshSelection(false));
  $('#closeSaveConflictModal').addEventListener('click', closeSaveConflictModal);
  document.querySelector('[data-close-save-conflict]').addEventListener('click', closeSaveConflictModal);
  $('#cancelSaveConflict').addEventListener('click', closeSaveConflictModal);
  $('#closeHistoryWeightModal').addEventListener('click', closeHistoryWeightModal);
  document.querySelector('[data-close-history-weight]').addEventListener('click', closeHistoryWeightModal);
  $('#cancelHistoryWeight').addEventListener('click', closeHistoryWeightModal);
  $('#useHistoryWeight').addEventListener('click', () => chooseHistoryWeightMode('history'));
  $('#useLatestHistoryWeight').addEventListener('click', () => chooseHistoryWeightMode('latest'));
  $('#closeOfflineSyncModal').addEventListener('click', () => closeOfflineSyncModal());
  document.querySelector('[data-close-offline-sync]').addEventListener('click', () => closeOfflineSyncModal());
  $('#skipOfflineSyncBtn').addEventListener('click', () => resolveOfflineSync(false));
  $('#confirmOfflineSyncBtn').addEventListener('click', () => resolveOfflineSync(true));
  $('#replaceSaveConflictBtn').addEventListener('click', replaceSaveConflict);
  $('#saveAsNewBtn').addEventListener('click', () => {
    const pending = pendingSaveConflict;
    closeSaveConflictModal();
    if (!pending?.snapshot) return;
    if (pending.operation === 'compare-add') commitCompareSnapshotAsNew(pending.snapshot, { asCopy: true });
    else commitSnapshotAsNew(pending.snapshot, { asCopy: true });
  });
  $('#customCityInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') confirmCustomCity(); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#cityMenu') && !event.target.closest('#citySwitcher')) closeCityMenu();
    if (!event.target.closest('.community-search')) hideCommunitySuggestions();
  });
  $('#evaluateBtn').addEventListener('click', () => evaluate());
  $('#propertyInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') evaluate(); });
  $('#propertyInput').addEventListener('input', () => {
    renderCommunitySuggestions($('#propertyInput').value);
  });
  $('#propertyInput').addEventListener('change', () => evaluate());
  $('#propertyInput').addEventListener('blur', () => {
    // 鼠标点击“开始评估”时，blur 会先于 click 触发；延后一拍，避免同一次输入被评估两次。
    window.setTimeout(() => {
      const value = $('#propertyInput').value.trim();
      if (value && value !== state.property) evaluate();
    }, 0);
  });
  $('#normalizeBtn').addEventListener('click', normalize);
  $('#saveWeightsBtn').addEventListener('click', saveWeightPreference);
  $('#resetWeightsBtn').addEventListener('click', resetWeightPreference);
  $('#manualToggleBtn').addEventListener('click', () => state.manualMode ? stopManualMode() : startManualMode());
  $('#manualResetBtn').addEventListener('click', startManualMode);
  $('#saveResultBtn').addEventListener('click', saveCurrentResult);
  $('#addCompareBtn').addEventListener('click', addCurrentToCompare);
  $('#openDetailsBtn').addEventListener('click', () => {
    $('#rulesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#fillMissingBtn').addEventListener('click', () => {
    const items = missingRawDataItems();
    if (items.length) openMissingDataModal();
    else {
      $('#rulesSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('当前没有待补充的原始数据');
    }
  });
  $('#refreshSavedBtn').addEventListener('click', () => openRefreshResultsModal('saved'));
  $('#refreshCompareBtn').addEventListener('click', () => openRefreshResultsModal('compare'));
  $('#refreshCityDataBtn').addEventListener('click', handleManualCityDataRefresh);
  $('#shareResultBtn').addEventListener('click', shareCurrentResult);
  $('#favoriteResultBtn').addEventListener('click', toggleFavoriteResult);
  $('#clearCompareBtn').addEventListener('click', () => {
    state.compareResults = [];
    persistResults();
    renderWorkspace();
    showToast('已清空对比列表');
  });
  document.querySelectorAll('.hint-chip').forEach((chip) => chip.addEventListener('click', () => {
    $('#propertyInput').value = chip.dataset.name;
    evaluate();
  }));
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    const target = document.getElementById(item.dataset.navTarget || 'resultSection');
    if (target?.hidden) {
      if (item.dataset.navTarget === 'workspaceSection' && !state.favoriteResults.length && !state.savedResults.length && !state.compareResults.length) {
        showToast('还没有保存或对比记录，先完成一次评估');
        return;
      }
      renderWorkspace();
    }
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $('#favoriteNavBtn').addEventListener('click', () => {
    if (!state.favoriteResults.length) {
      showToast('还没有收藏的小区，先点击评分卡片右上角的☆');
      return;
    }
    renderWorkspace();
    $('#workspaceSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

