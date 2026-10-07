(function (global) {
  // Bump the namespace when the offline package schema/coordinates change.
  // v8 invalidates v5-v7 snapshots, which could contain the previous max-based
  // walking estimate rule. The generation check below also prevents a stale v7
  // snapshot from winning over the bundled package while offline/from
  // file://.
  const CACHE_KEY = 'resiscore.transport.cache.v8';
  const LEGACY_CACHE_PREFIXES = ['resiscore.transport.cache', 'resiscore.transport.cache.v1', 'resiscore.transport.cache.v2', 'resiscore.transport.cache.v3', 'resiscore.transport.cache.v4', 'resiscore.transport.cache.v5', 'resiscore.transport.cache.v6', 'resiscore.transport.cache.v7'];
  const DATA_BASE_URL = global.RESISCORE_DATA_BASE_URL || '';
  const isMiniProgram = typeof wx !== 'undefined' && typeof wx.getFileSystemManager === 'function';
  const fs = isMiniProgram ? wx.getFileSystemManager() : null;
  const rootPath = isMiniProgram ? `${wx.env.USER_DATA_PATH}/resiscore-transport` : '';
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const joinUrl = (url) => {
    if (/^https?:\/\//i.test(url)) return url;
    if (!DATA_BASE_URL) return url;
    return `${DATA_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  };
  const callWx = (method, options) => new Promise((resolve, reject) => {
    wx[method]({ ...options, success: resolve, fail: reject });
  });
  const readFile = (filePath) => new Promise((resolve, reject) => {
    fs.readFile({ filePath, encoding: 'utf8', success: (res) => resolve(res.data), fail: reject });
  });
  const writeFile = (filePath, content) => new Promise((resolve, reject) => {
    fs.writeFile({ filePath, data: content, encoding: 'utf8', success: resolve, fail: reject });
  });
  const ensureDirectory = () => new Promise((resolve) => {
    if (!isMiniProgram) return resolve();
    fs.mkdir({ dirPath: rootPath, recursive: true, success: resolve, fail: resolve });
  });
  const requestJson = async (url) => {
    const target = joinUrl(url);
    if (isMiniProgram) {
      const response = await callWx('request', { url: target, method: 'GET', dataType: 'json' });
      if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`数据请求失败：${response.statusCode}`);
      return response.data;
    }
    const response = await fetch(target, { cache: 'no-store' });
    if (!response.ok) throw new Error(`数据请求失败：${response.status}`);
    return response.json();
  };
  const readLocal = async (name) => {
    try {
      if (isMiniProgram) return JSON.parse(await readFile(`${rootPath}/${name}.json`));
      return JSON.parse(localStorage.getItem(`${CACHE_KEY}.${name}`));
    } catch (error) {
      return null;
    }
  };
  const generatedAtMs = (value) => {
    const timestamp = Date.parse(String(value?.generatedAt || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  // 规则版本必须参与缓存淘汰。仅比较 generatedAt 会放过“同一天生成、但
  // 估算系数已经改变”的旧包，导致设备继续显示旧的步行距离和估算说明。
  const routeRuleVersionOf = (value) => String(
    value?.routeRuleVersion
    || value?.communityRouteSchema?.routeRuleVersion
    || value?.scoring?.routeEstimation?.ruleVersion
    || ''
  );
  const localOlderThanBundled = (localCity, bundled) => Boolean(
    localCity && bundled
    && generatedAtMs(bundled) > 0
    && generatedAtMs(localCity) < generatedAtMs(bundled)
  );
  const writeLocal = async (name, value) => {
    const content = JSON.stringify(value);
    if (isMiniProgram) {
      await ensureDirectory();
      return writeFile(`${rootPath}/${name}.json`, content);
    }
    try { localStorage.setItem(`${CACHE_KEY}.${name}`, content); } catch (error) { /* 缓存空间不足时仍可在线使用 */ }
  };

  let legacyCacheCleaned = false;
  const clearLegacyCache = () => {
    if (legacyCacheCleaned || isMiniProgram) return;
    legacyCacheCleaned = true;
    try {
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
      keys.forEach((key) => {
        if (LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(`${prefix}.`)) && !key.startsWith(`${CACHE_KEY}.`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) { /* 清理失败不影响当前数据包读取 */ }
  };
  const clearBundledBuildCache = (remoteAllowed) => {
    if (remoteAllowed || isMiniProgram) return;
    try {
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
      keys.forEach((key) => { if (key.startsWith(`${CACHE_KEY}.`)) localStorage.removeItem(key); });
    } catch (error) { /* 清理失败不影响内置包读取 */ }
  };

  async function loadCity(cityId, options = {}) {
    clearLegacyCache();
    // A file:// build cannot fetch a relative manifest (the browser reports
    // “Failed to fetch” even though the bundled city package is valid). Skip
    // the optional probe in that mode and use the bundled/local package.
    const remoteAllowed = !(typeof location !== 'undefined' && location.protocol === 'file:');
    const checkUpdates = options.checkUpdates !== false && remoteAllowed;
    // The file build is the shipped offline package. Do not let a browser
    // cache become a second, invisible source of automatic scoring values.
    clearBundledBuildCache(remoteAllowed);
    const localManifest = remoteAllowed ? await readLocal('manifest') : null;
    const localCity = remoteAllowed ? await readLocal(`city-${cityId}`) : null;
    let remoteManifest = null;
    let checkedAt = null;
    let checkError = null;
    if (checkUpdates) {
      try {
        remoteManifest = await requestJson('data/transport/manifest.json');
        checkedAt = new Date().toISOString();
      } catch (error) { checkError = error; /* 离线时使用本地版本 */ }
    }
    if ((!localManifest || !localCity) && remoteAllowed) {
      try {
        remoteManifest = remoteManifest || await requestJson('data/transport/manifest.json');
        checkedAt = checkedAt || new Date().toISOString();
        checkError = null;
      } catch (error) { checkError = checkError || error; /* 离线时使用本地版本 */ }
    }
    const manifest = remoteManifest || localManifest;
    const bundled = global.RESISCORE_BUNDLED_TRANSPORT?.[cityId];
    const cityMeta = manifest?.cities?.[cityId] || (bundled ? {
      cityName: bundled.cityName || cityId,
      version: `${String(bundled.generatedAt || 'bundled').slice(0, 10)}-bundled`,
      url: ''
    } : null);
    if (!cityMeta) throw new Error(`暂未提供 ${cityId} 的交通数据`);

    const localVersion = localManifest?.cities?.[cityId]?.version;
    const bundledRuleVersion = routeRuleVersionOf(bundled);
    const expectedRuleVersion = remoteManifest?.cities?.[cityId]?.routeRuleVersion
      || bundledRuleVersion
      || cityMeta.routeRuleVersion
      || '';
    const localIsStale = localOlderThanBundled(localCity, bundled);
    const localRuleIsStale = Boolean(expectedRuleVersion && routeRuleVersionOf(localCity) !== expectedRuleVersion);
    const usableLocalCity = localCity && !localIsStale && !localRuleIsStale ? localCity : null;
    const shouldUpdate = !usableLocalCity || (remoteManifest && localVersion !== cityMeta.version);
    let data = usableLocalCity;
    let source = usableLocalCity ? 'local' : 'bundled';
    if (shouldUpdate && remoteManifest) {
      try {
        data = await requestJson(cityMeta.url);
        await writeLocal(`city-${cityId}`, data);
        await writeLocal('manifest', remoteManifest);
        source = 'updated';
      } catch (error) {
        // 服务器文件未同步或当前设备离线时，必须退回随版本发布的广州包，
        // 不能把“有内置数据”误判成“交通数据不可用”。
        checkError = checkError || error;
        data = usableLocalCity || bundled || null;
        source = usableLocalCity ? 'local' : bundled ? 'bundled' : source;
      }
    } else if (!localManifest && remoteManifest) {
      await writeLocal('manifest', remoteManifest);
    }
    if (!data && bundled) {
      data = bundled;
      source = 'bundled';
    }
    if (!data) throw new Error('城市交通数据不可用');
    return {
      data,
      source,
      version: cityMeta.version,
      updatedAt: data.generatedAt,
      checkedAt,
      checkError: checkError?.message || '',
      updated: source === 'updated'
    };
  }

  function distanceToCbd(cityData, latitude, longitude) {
    const anchors = cityData?.cbd?.anchors || [];
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!anchors.length || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const nearest = anchors.map((anchor) => ({
      ...anchor,
      distanceKm: haversineKm(lat, lon, anchor.latitude, anchor.longitude)
    })).sort((a, b) => a.distanceKm - b.distanceKm)[0];
    return { distanceKm: Math.round(nearest.distanceKm * 10) / 10, anchor: nearest };
  }

  // 交通位置评分使用小区主要出入口到地铁可用出入口的步行距离。
  // 这里保留原始 50 分制，供界面把距离折算到 10 分、站点等级折算到 5 分。
  const WALK_DISTANCE_POINTS = [
    [0, 50],
    [300, 46],
    [500, 42],
    [800, 35],
    [1200, 25],
    [2000, 0]
  ];
  const TRANSPORT_RADIUS_M = 1500;

  function normalizePlaceName(value) {
    return String(value || '').replace(/[\s（）()、，,·\-—]/g, '').toLowerCase();
  }

  // 统一口径：公开的“最近人行道出入口→地铁可用出口”步行距离优先，
  // 有公开步行距离时不再与直线距离比较取最大值。只有没有公开步行距离
  // 时，才按直线距离×1.35估算；中心点路线只能作为缺数据时的标记估算，
  // 不能冒充最近人行道出入口路线。
  function estimateWalkingDistanceM({
    straightDistanceM,
    publishedDistanceM,
    centerWalkingDistanceM,
    originOffsetM = 0,
    stationOffsetM = 0,
    publishedInflation = 1,
    centerRouteWeight = 1,
    completeRoute = false
  } = {}) {
    const straight = straightDistanceM === null || straightDistanceM === undefined || straightDistanceM === '' ? NaN : Number(straightDistanceM);
    const published = publishedDistanceM === null || publishedDistanceM === undefined || publishedDistanceM === '' ? NaN : Number(publishedDistanceM);
    const centerRoute = centerWalkingDistanceM === null || centerWalkingDistanceM === undefined || centerWalkingDistanceM === '' ? NaN : Number(centerWalkingDistanceM);
    if (Number.isFinite(published) && published >= 0) return Math.round(published);
    if (completeRoute && Number.isFinite(centerRoute) && centerRoute >= 0) {
      const offsetRoute = (centerRoute - Math.max(0, Number(originOffsetM) || 0) - Math.max(0, Number(stationOffsetM) || 0)) * Math.max(0, Number(centerRouteWeight) || 0);
      return Math.max(0, Math.round(offsetRoute / 10) * 10);
    }
    if (Number.isFinite(straight) && straight >= 0) return Math.round(straight * 1.35);
    if (Number.isFinite(centerRoute) && centerRoute >= 0) {
      const offsetRoute = centerRoute - Math.max(0, Number(originOffsetM) || 0) - Math.max(0, Number(stationOffsetM) || 0);
      return Math.max(0, Math.round(offsetRoute / 10) * 10);
    }
    return null;
  }

  function findCommunityRoutes(cityData, query) {
    const needle = normalizePlaceName(query);
    if (!needle || !Array.isArray(cityData?.communityRoutes)) return null;
    const phasePattern = /(?:一期|二期|三期|四期|五期|六期|七期|八期|九期|十期|[1-9]\d*期)/;
    const queryHasPhase = phasePattern.test(needle);
    const routeNames = (item) => [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .map(normalizePlaceName).filter(Boolean);
    // 先精确匹配，再做受限模糊匹配。父项目名不能通过“包含关系”命中某一期路线。
    const exact = cityData.communityRoutes.find((item) => routeNames(item).includes(needle));
    const match = exact || cityData.communityRoutes.find((item) => {
      const names = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]
        .map(normalizePlaceName).filter(Boolean);
      if (names.includes(needle)) return true;
      if (queryHasPhase) return false;
      const hasPhaseName = names.some((name) => phasePattern.test(name));
      // 允许直接输入“峻森园”这种期名，但禁止“科城山庄”这类父名
      // 因为前缀包含关系误命中分期路线。
      if (hasPhaseName && !names.some((name) => name === needle)) return false;
      return names.some((name) => name.includes(needle) || needle.includes(name));
    });
    const stationByName = new Map((Array.isArray(cityData?.stations) ? cityData.stations : []).map((station) => [normalizePlaceName(station.name), station]));
    return match ? {
      ...match,
      routes: Array.isArray(match.routes) ? match.routes.map((route) => {
        const copy = { ...route };
        const station = stationByName.get(normalizePlaceName(copy.stationName || copy.station || ''));
        if (station) {
          copy.stationLevelScore = Number(station.score);
          copy.stationLevel = station.level;
          copy.stationLines = station.lines;
          copy.stationCenterDistanceKm = station.centerDistanceKm;
        }
        if (copy.distanceQuality === 'estimated') {
           const estimate = estimateWalkingDistanceM({ ...copy, completeRoute: copy.routeType === 'complete-walking-route' || copy.distanceQuality === 'walking-route' });
          if (Number.isFinite(estimate)) copy.walkDistanceM = estimate;
        }
        return copy;
      }) : []
    } : null;
  }

  // 社区路线包没有逐一登记时，使用广州住宅坐标与地铁站坐标生成可解释的候选路线。
  // 这是坐标估算，不冒充地图步行轨迹；用户补充实测入口后，现有覆盖记录仍优先使用。
  const estimatedRouteCache = new Map();
  function findEstimatedCommunityRoutes(cityData, community, options = {}) {
    const latitude = Number(community?.latitude);
    const longitude = Number(community?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const radiusM = Number.isFinite(Number(options.radiusM)) ? Number(options.radiusM) : TRANSPORT_RADIUS_M;
    const cacheKey = `${cityData?.city || 'city'},${cityData?.generatedAt || ''},${latitude.toFixed(6)},${longitude.toFixed(6)},${radiusM}`;
    const cached = estimatedRouteCache.get(cacheKey);
    if (cached) return cached.map((route) => ({ ...route }));
    const generatedAt = String(cityData?.generatedAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const allCandidates = (Array.isArray(cityData?.stations) ? cityData.stations : [])
      .map((station) => {
        const stationLatitude = Number(station.latitude);
        const stationLongitude = Number(station.longitude);
        if (!Number.isFinite(stationLatitude) || !Number.isFinite(stationLongitude)) return null;
        const straightDistanceM = haversineKm(latitude, longitude, stationLatitude, stationLongitude) * 1000;
        const walkDistanceM = Math.round(straightDistanceM * 1.35);
        return {
          stationName: station.name,
          stationLevelScore: Number(station.score),
          stationLevel: station.level,
          stationLines: station.lines,
          walkDistanceM,
          straightDistanceM: Math.round(straightDistanceM),
          originEntrance: '小区中心坐标（估算）',
          stationExit: '地铁站中心（估算）',
          distanceQuality: 'estimated',
          source: '广州小区坐标 + 地铁站坐标（统一绕行系数估算）',
          verifiedAt: generatedAt,
          estimateMethod: '无公开步行距离，按直线距离 × 1.35 估算；当前以小区中心坐标代替最近人行道出入口，未取得具体入口和站点出口轨迹'
        };
      })
      .filter((route) => route && Number.isFinite(route.stationLevelScore))
      .sort((a, b) => a.walkDistanceM - b.walkDistanceM)
    const inRange = allCandidates.filter((route) => route.walkDistanceM <= radiusM);
    const candidates = (inRange.length ? inRange.slice(0, 3) : allCandidates.slice(0, 1))
      .map((route) => ({ ...route, inScoringRadius: route.walkDistanceM <= radiusM }));
    estimatedRouteCache.set(cacheKey, candidates);
    return candidates.map((route) => ({ ...route }));
  }

  function distanceScoreFromWalkMeters(walkDistanceM) {
    const distance = Number(walkDistanceM);
    if (!Number.isFinite(distance) || distance < 0) return null;
    if (distance <= WALK_DISTANCE_POINTS[0][0]) return WALK_DISTANCE_POINTS[0][1];
    for (let index = 1; index < WALK_DISTANCE_POINTS.length; index += 1) {
      const [upperDistance, upperScore] = WALK_DISTANCE_POINTS[index];
      const [lowerDistance, lowerScore] = WALK_DISTANCE_POINTS[index - 1];
      if (distance <= upperDistance) {
        const ratio = (distance - lowerDistance) / (upperDistance - lowerDistance);
        return Math.round((lowerScore + (upperScore - lowerScore) * ratio) * 10) / 10;
      }
    }
    return 0;
  }

  function hasVerifiedWalkingRoute(route) {
    return Number.isFinite(Number(route?.walkDistanceM))
      && Number(route.walkDistanceM) >= 0
      && String(route?.originEntrance || '').trim()
      && String(route?.stationExit || '').trim()
      && String(route?.source || '').trim()
      && String(route?.verifiedAt || '').trim();
  }

  // 对每个维度执行“最高分 + 其余站点 × 0.5”。
  // 两个子维度各自封顶 50 分，界面再按 10 分与 5 分的配额折算。
  function aggregateStationDimension(routes, valueOf) {
    const scores = routes.map(valueOf).filter((score) => Number.isFinite(score)).sort((a, b) => b - a);
    if (!scores.length) return null;
    const combined = scores[0] + scores.slice(1).reduce((sum, score) => sum + score * 0.5, 0);
    return Math.min(50, Math.round(combined * 10) / 10);
  }

  function scoreTransportStationRoutes(routes, options = {}) {
    const radiusM = Number.isFinite(Number(options.radiusM)) ? Number(options.radiusM) : TRANSPORT_RADIUS_M;
    const prepared = (Array.isArray(routes) ? routes : [])
      .filter(hasVerifiedWalkingRoute)
      .map((route) => ({
        ...route,
        walkDistanceM: Number(route.walkDistanceM),
        inScoringRadius: Number(route.walkDistanceM) <= radiusM,
        distanceScore: Number(route.walkDistanceM) <= radiusM ? distanceScoreFromWalkMeters(route.walkDistanceM) : 0,
        stationLevelScore: Number(route.walkDistanceM) <= radiusM ? Number(route.stationLevelScore ?? route.station?.score) : 0
      }))
      .filter((route) => Number.isFinite(route.distanceScore) && Number.isFinite(route.stationLevelScore))
      .sort((a, b) => (b.distanceScore + b.stationLevelScore) - (a.distanceScore + a.stationLevelScore));
    const inRange = prepared.filter((route) => route.inScoringRadius);
    const candidates = inRange.length ? inRange : prepared.slice(0, 1);
    if (!candidates.length) return { ready: false, radiusM, candidates: [], distanceScore: null, stationLevelScore: null, totalPoints: null };
    const distanceScore = aggregateStationDimension(candidates, (route) => route.distanceScore);
    const stationLevelScore = aggregateStationDimension(candidates, (route) => route.stationLevelScore);
    return {
      ready: true,
      radiusM,
      candidates,
      distanceScore,
      stationLevelScore,
      estimatedCount: candidates.filter((route) => route.distanceQuality === 'estimated').length,
      totalPoints: Math.round((distanceScore / 50 * 10 + stationLevelScore / 50 * 5) * 10) / 10
    };
  }

  global.TransportDataStore = {
    loadCity,
    distanceToCbd,
    estimateWalkingDistanceM,
    findCommunityRoutes,
    findEstimatedCommunityRoutes,
    distanceScoreFromWalkMeters,
    scoreTransportStationRoutes,
    transportRadiusM: TRANSPORT_RADIUS_M
  };
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));

