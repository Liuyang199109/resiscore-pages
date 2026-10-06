(function (global) {
  // Keep the cache namespace aligned with the current coordinate/phase data.
  // v5 invalidates v4 snapshots, which could contain older hospital/park
  // coordinates and point samples.  The generation check below also prevents
  // a stale v5 snapshot from winning over the bundled package when the app is
  // opened offline or from file://.
  const CACHE_KEY = 'resiscore.amenities.cache.v5';
  const LEGACY_CACHE_PREFIXES = ['resiscore.amenities.cache', 'resiscore.amenities.cache.v1', 'resiscore.amenities.cache.v2', 'resiscore.amenities.cache.v3', 'resiscore.amenities.cache.v4'];
  const DATA_BASE_URL = global.RESISCORE_DATA_BASE_URL || '';
  const isMiniProgram = typeof wx !== 'undefined' && typeof wx.request === 'function';
  const joinUrl = (url) => {
    if (/^https?:\/\//i.test(url)) return url;
    if (!DATA_BASE_URL) return url;
    return `${DATA_BASE_URL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  };
  const requestJson = async (url) => {
    const target = joinUrl(url);
    if (isMiniProgram) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: target,
          method: 'GET',
          dataType: 'json',
          success: (response) => {
            if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data);
            else reject(new Error(`数据请求失败：${response.statusCode}`));
          },
          fail: reject
        });
      });
    }
    const response = await fetch(target, { cache: 'no-store' });
    if (!response.ok) throw new Error(`数据请求失败：${response.status}`);
    return response.json();
  };
  const readLocal = (name) => {
    try {
      const raw = isMiniProgram ? wx.getStorageSync(`${CACHE_KEY}.${name}`) : localStorage.getItem(`${CACHE_KEY}.${name}`);
      return typeof raw === 'string' ? JSON.parse(raw) : raw || null;
    } catch (error) { return null; }
  };
  const generatedAtMs = (value) => {
    const timestamp = Date.parse(String(value?.generatedAt || ''));
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const localOlderThanBundled = (localCity, bundled) => Boolean(
    localCity && bundled
    && generatedAtMs(bundled) > 0
    && generatedAtMs(localCity) < generatedAtMs(bundled)
  );
  const writeLocal = (name, value) => {
    try {
      const content = JSON.stringify(value);
      if (isMiniProgram) wx.setStorageSync(`${CACHE_KEY}.${name}`, content);
      else localStorage.setItem(`${CACHE_KEY}.${name}`, content);
    } catch (error) { /* 缓存不足时继续在线使用 */ }
  };
  let legacyCacheCleaned = false;
  const clearLegacyCache = () => {
    if (legacyCacheCleaned) return;
    legacyCacheCleaned = true;
    try {
      const keys = isMiniProgram && typeof wx.getStorageInfoSync === 'function'
        ? (wx.getStorageInfoSync().keys || [])
        : Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean);
      keys.forEach((key) => {
        if (LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(`${prefix}.`)) && !key.startsWith(`${CACHE_KEY}.`)) {
          if (isMiniProgram) wx.removeStorageSync(key);
          else localStorage.removeItem(key);
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
    const localManifest = remoteAllowed ? readLocal('manifest') : null;
    const localCity = remoteAllowed ? readLocal(`city-${cityId}`) : null;
    let remoteManifest = null;
    let checkedAt = null;
    let checkError = null;
    if (checkUpdates) {
      try {
        remoteManifest = await requestJson('data/amenities/manifest.json');
        checkedAt = new Date().toISOString();
      } catch (error) { checkError = error; /* 离线时使用本地版本或内置数据 */ }
    }
    if ((!localManifest || !localCity) && remoteAllowed) {
      try {
        remoteManifest = remoteManifest || await requestJson('data/amenities/manifest.json');
        checkedAt = checkedAt || new Date().toISOString();
        checkError = null;
      } catch (error) { checkError = checkError || error; /* 离线时使用本地版本或内置数据 */ }
    }
    const manifest = remoteManifest || localManifest;
    const bundled = global.RESISCORE_BUNDLED_AMENITIES?.[cityId];
    const cityMeta = manifest?.cities?.[cityId];
    if (!cityMeta && bundled) {
      return { data: bundled, source: 'bundled', version: bundled.generatedAt?.slice(0, 7) || 'bundled', updatedAt: bundled.generatedAt, checkedAt, checkError: checkError?.message || '', updated: false };
    }
    if (!cityMeta) throw new Error(`暂未提供 ${cityId} 的生活配套数据`);
    const localVersion = localManifest?.cities?.[cityId]?.version;
    const localIsStale = localOlderThanBundled(localCity, bundled);
    const usableLocalCity = localCity && !localIsStale ? localCity : null;
    const shouldUpdate = !usableLocalCity || (remoteManifest && localVersion !== cityMeta.version);
    let data = usableLocalCity;
    let source = usableLocalCity ? 'local' : 'bundled';
    if (shouldUpdate && remoteManifest) {
      try {
        data = await requestJson(cityMeta.url);
        writeLocal(`city-${cityId}`, data);
        writeLocal('manifest', remoteManifest);
        source = 'updated';
      } catch (error) {
        // 远端清单能访问但城市文件未同步时，保留可用的本地/内置快照。
        checkError = checkError || error;
        data = usableLocalCity || bundled || null;
        source = usableLocalCity ? 'local' : bundled ? 'bundled' : source;
      }
    } else if (!localManifest && remoteManifest) {
      writeLocal('manifest', remoteManifest);
    }
    if (!data && bundled) {
      data = bundled;
      source = 'bundled';
    }
    if (!data) throw new Error('城市生活配套数据不可用');
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
  global.AmenityDataStore = { loadCity };
}(typeof globalThis !== 'undefined' ? globalThis : this));
