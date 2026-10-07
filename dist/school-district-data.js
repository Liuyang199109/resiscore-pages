(function (global) {
  const DATA_URL = 'data/huangpu-school-district-2026.json';
  const MANIFEST_URL = 'data/guangzhou-school-district-manifest.json';
  const SUPPLEMENT_URL = 'data/guangzhou-school-district-supplement-2026.json';
  // Directly opening index.html uses the file:// protocol. Browsers block
  // fetch(file://...) for security reasons, so the standalone web folder
  // also publishes all normalized district packages as one JavaScript bundle.
  // HTTP deployments still prefer the JSON files and only use this bundle as
  // an offline fallback.
  const bundledManifest = () => global.RESISCORE_GUANGZHOU_SCHOOL_DISTRICT_MANIFEST || null;
  const bundledPackages = () => global.RESISCORE_GUANGZHOU_SCHOOL_DISTRICT_PACKAGES || {};
  const isFileProtocol = () => global.location?.protocol === 'file:';
  // Names in the source tables are not stable: punctuation, "小区" suffixes,
  // Chinese versus Arabic phase numerals and the optional "第" prefix all
  // vary between the property directory, official tables and user input.
  // Keep one canonical key for every lookup so a spelling variation cannot
  // turn a real mapping into a blank result.
  const parseChinesePhaseNumber = (raw) => {
    if (/^\d+$/.test(raw)) return Number(raw);
    const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (raw === '十') return 10;
    if (raw.startsWith('十')) return 10 + (digits[raw.slice(1)] || 0);
    if (raw.endsWith('十')) return (digits[raw.slice(0, -1)] || 0) * 10;
    const ten = raw.indexOf('十');
    if (ten > 0) return (digits[raw.slice(0, ten)] || 0) * 10 + (digits[raw.slice(ten + 1)] || 0);
    return digits[raw] || null;
  };
  const normalizePhaseNumerals = (value) => String(value || '')
    .replace(/第?([一二三四五六七八九十\d]+)期/g, (_, raw) => {
      const number = parseChinesePhaseNumber(raw);
      return Number.isFinite(number) ? `${number}期` : `${raw}期`;
    });
  const compact = (value) => normalizePhaseNumerals(value).toLowerCase().replace(/[\s\u3000·,，、。；;:：'"“”‘’（）()【】\[\]《》<>]/g, '');
  const normalize = (value) => normalizePhaseNumerals(value)
    .toLowerCase()
    .replace(/[\s\u3000·,，、。；;:：'"“”‘’（）()【】\[\]《》<>]/g, '')
    .replace(/住宅小区|住宅项目|小区/g, '');

  const lookupAlias = (table, rawKey) => {
    if (!table || typeof table !== 'object') return undefined;
    const raw = String(rawKey || '').trim();
    if (Object.prototype.hasOwnProperty.call(table, raw)) return table[raw];
    const target = normalize(raw);
    if (!target) return undefined;
    const entry = Object.entries(table).find(([key]) => normalize(key) === target);
    return entry ? entry[1] : undefined;
  };

  const splitSchools = (value) => String(value || '')
    .replace(/（初中部）|（初中）|（西校区）|（东校区）|（北校区）|（南校区）/g, '')
    .split(/[、,，；;]+/)
    .map((name) => name.replace(/及其服务地段范围内.*$/g, '').trim())
    .filter(Boolean);

  const canonicalSchoolName = (data, name) => data.schoolNameAliases?.[String(name || '').trim()] || String(name || '').trim();
  const findConfirmedMapping = (data, query) => {
    const mappings = data.confirmedPropertyMappings || {};
    const normalizedQuery = normalize(query);
    const entry = Object.entries(mappings).find(([name]) => normalize(name) === normalizedQuery);
    return entry ? entry[1] : null;
  };

  const findProvisionalMapping = (data, supplement, query) => {
    const records = supplement?.records || data?.provisionalPropertyMappings || [];
    const raw = String(query || '').trim();
    const needle = normalize(raw);
    if (!needle) return null;
    return records.find((record) => {
      const names = [record.property, ...(record.aliases || [])].filter(Boolean);
      return names.some((name) => normalize(name) === needle);
    }) || null;
  };

  // Address aliases are preferred exact matches after canonical
  // normalization. They are used for records whose offline name is a
  // complete address (or a numbered residential compound) while the official
  // service-area table uses a canonical property label. A normal
  // property/coverage hit always wins; aliases are only consulted when that
  // lookup is empty.
  const findAddressAlias = (data, query) => {
    const aliases = data.addressAliases || {};
    const raw = String(query || '').trim();
    if (!raw) return null;
    const value = lookupAlias(aliases, raw);
    if (!value) return null;
    const entry = typeof value === 'string' ? { target: value, status: 'provisional' } : value;
    return { ...entry };
  };

  const search = (data, query, supplement = null) => {
    const rawQuery = String(query || '').trim();
    const addressAlias = findAddressAlias(data, rawQuery);
    const propertyAlias = lookupAlias(data.propertyAliases, rawQuery);
    const resolvedQuery = propertyAlias || (addressAlias && (addressAlias.target || addressAlias.property || addressAlias.canonical)) || query;
    const needle = normalize(resolvedQuery);
    const strongNeedle = compact(resolvedQuery);
    if (!needle) return { elementary: [], middle: [], notices: [], confirmedMapping: null };
    const queryNeedles = [...new Set([strongNeedle, needle].filter((value) => value && value.length >= 2))];
    // Very short building labels (for example “1”, “10栋”, “A座”) are common
    // map/building candidates rather than official community names. A broad
    // substring search would incorrectly match house numbers and telephone
    // numbers embedded in service-area prose. Only explicit aliases may
    // bypass this guard; otherwise let the coordinate/district fallback pick
    // a provisional school candidate.
    const weakCommunityQuery = !propertyAlias && !addressAlias
      && (needle.length < 4 || /^(?:\d{1,5}|\d{1,5}栋|\d{1,5}号楼|\d{1,5}座|[a-z]\d{1,4}栋)$/i.test(rawQuery));
    const allowTextCoverageMatch = !weakCommunityQuery;
    let usedAddressAlias = Boolean(addressAlias && !propertyAlias);
    let elementary = allowTextCoverageMatch ? (data.elementaryZones || []).filter((row) => {
      const coverage = compact(row.coverage);
      const normalizedCoverage = normalize(row.coverage);
      return queryNeedles.some((value) => coverage.includes(value) || normalizedCoverage.includes(value));
    }).map((row) => ({ ...row, school: canonicalSchoolName(data, row.school) })) : [];
    // Do not override an ordinary coverage match.  For an exact address alias,
    // select the explicitly named official school row(s), or use its canonical
    // target to run the regular coverage matcher above.
    if (!elementary.length && addressAlias) {
      const names = new Set((addressAlias.elementary || addressAlias.schools || (addressAlias.school ? [addressAlias.school] : [])).map((name) => canonicalSchoolName(data, name)));
      if (names.size) {
        elementary = (data.elementaryZones || [])
          .filter((row) => names.has(canonicalSchoolName(data, row.school)))
          .map((row) => ({ ...row, school: canonicalSchoolName(data, row.school), addressAlias: true }));
      }
      if (!elementary.length && addressAlias.coverage) {
        const aliasCoverage = normalize(addressAlias.coverage);
        elementary = (data.elementaryZones || [])
          .filter((row) => normalize(row.coverage).includes(aliasCoverage) || aliasCoverage.includes(normalize(row.coverage)))
          .map((row) => ({ ...row, school: canonicalSchoolName(data, row.school), addressAlias: true }));
      }
    }
    const primaryNames = elementary.map((row) => row.school);
    const middle = [];
    const seen = new Set();
    const allGroups = ['direct', 'lottery'].flatMap((mode) => (data.middleGroups?.[mode] || []).map((group) => ({ ...group, mode })));
    const exactGroups = allowTextCoverageMatch ? allGroups.filter((group) => {
      const scope = compact(group.primaryScope);
      const normalizedScope = normalize(group.primaryScope);
      return queryNeedles.some((value) => scope.includes(value) || normalizedScope.includes(value));
    }) : [];
    const groupsToCheck = allowTextCoverageMatch
      ? (exactGroups.length ? exactGroups : allGroups)
      : [];
    groupsToCheck.forEach((group) => {
        const matched = exactGroups.length
          ? true
          : primaryNames.some((name) => normalize(group.primaryScope).includes(normalize(name))) || normalize(group.primaryScope).includes(needle);
        if (!matched) return;
        const key = `${group.mode}:${group.group}:${group.middleSchools}`;
        if (seen.has(key)) return;
        seen.add(key);
        middle.push({ ...group, schools: splitSchools(group.middleSchools).map((name) => canonicalSchoolName(data, name)) });
    });
    const notices = [];
    elementary.forEach((row) => {
      if (/联合划片|电脑随机派位|统筹|备选|有条件选择|学位有富余/.test(row.coverage)) notices.push(`${row.school}：该地段包含联合划片、备选或统筹安排，请按当年细则确认。`);
    });
    middle.forEach((group) => {
      if (group.mode === 'lottery') notices.push(`${group.group}：初中采用电脑派位；未取得报名人数和计划数时，评分按组内学校等概率估算。`);
    });
    const confirmedMapping = findConfirmedMapping(data, query) || findConfirmedMapping(data, resolvedQuery);
    const provisionalMapping = findProvisionalMapping(data, supplement, query)
      || findProvisionalMapping(data, supplement, resolvedQuery);
    if (confirmedMapping?.sourceNote) notices.unshift(`已采用确认学区映射：${confirmedMapping.sourceNote}`);
    if (addressAlias && elementary.length && usedAddressAlias) {
      const note = addressAlias.sourceNote || addressAlias.note || '按官方招生地段完整地址精确映射';
      notices.unshift(`地址精确匹配（待年度核验）：${note}`);
    }
    return { elementary, middle, notices, confirmedMapping, provisionalMapping,
      addressAlias: addressAlias && elementary.length && usedAddressAlias ? addressAlias : null };
  };

  async function loadManifest() {
    if (isFileProtocol() && bundledManifest()) return bundledManifest();
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`广州各区学区索引请求失败：${response.status}`);
      return await response.json();
    } catch (error) {
      const fallback = bundledManifest();
      if (fallback) return fallback;
      return { schemaVersion: 1, city: 'guangzhou', schoolYear: 2026, districts: [], error: error.message };
    }
  }

  async function loadSupplement() {
    const fallback = global.RESISCORE_SCHOOL_DISTRICT_SUPPLEMENT;
    if (isFileProtocol() && fallback) return fallback;
    try {
      const response = await fetch(SUPPLEMENT_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`第三方学区候选数据请求失败：${response.status}`);
      return await response.json();
    } catch (error) {
      return fallback || { schemaVersion: 1, records: [], status: 'unavailable', error: error.message };
    }
  }

  async function load(districtId = 'huangpu') {
    const manifest = await loadManifest();
    const supplement = await loadSupplement();
    const district = (manifest.districts || []).find((item) => item.id === districtId) || (manifest.districts || []).find((item) => item.id === 'huangpu');
    if (district?.normalizedData) {
      const bundled = bundledPackages()[district.id];
      if (isFileProtocol() && bundled) return { data: bundled, search: (query) => search(bundled, query, supplement), source: 'bundled', district, manifest, supplement };
      try {
        const response = await fetch(district.normalizedData, { cache: 'no-store' });
        if (!response.ok) throw new Error(`学区数据请求失败：${response.status}`);
        const data = await response.json();
        return { data, search: (query) => search(data, query, supplement), source: 'json', district, manifest, supplement };
      } catch (error) {
        if (bundled) return { data: bundled, search: (query) => search(bundled, query, supplement), source: 'bundled', district, manifest, supplement };
        const fallback = global.HUANGPU_SCHOOL_DISTRICT_DATA;
        if (fallback && district.id === 'huangpu') return { data: fallback, search: (query) => search(fallback, query, supplement), source: 'bundled', district, manifest, supplement };
        throw error;
      }
    }
    // manifest 或标准化 JSON 暂时不可访问时，黄埔仍可使用随包发布的
    // 内置数据，避免网络失败把已有学区评分降级成空白。
    const fallback = global.HUANGPU_SCHOOL_DISTRICT_DATA;
    if (fallback && (!district || district.id === 'huangpu') && districtId === 'huangpu') {
      return { data: fallback, search: (query) => search(fallback, query, supplement), source: 'bundled', district, manifest, supplement };
    }
    return {
      data: null,
      district,
      manifest,
      supplement,
      source: 'source-indexed',
      search: () => ({ elementary: [], middle: [], notices: [], confirmedMapping: null, packageUnavailable: true })
    };
  }

  async function loadLegacy() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`学区数据请求失败：${response.status}`);
      const data = await response.json();
      const supplement = await loadSupplement();
      return { data, search: (query) => search(data, query, supplement), source: 'json', supplement };
    } catch (error) {
      const fallback = global.HUANGPU_SCHOOL_DISTRICT_DATA;
      if (fallback) {
        const supplement = await loadSupplement();
        return { data: fallback, search: (query) => search(fallback, query, supplement), source: 'bundled', supplement };
      }
      throw error;
    }
  }

  async function loadAllNormalized() {
    const [manifest, supplement] = await Promise.all([loadManifest(), loadSupplement()]);
    const entries = await Promise.all((manifest.districts || [])
      .filter((district) => district.normalizedData)
      .map(async (district) => {
        const bundled = bundledPackages()[district.id];
        if (isFileProtocol() && bundled) {
          return [district.id, { data: bundled, district, manifest, source: 'bundled', supplement, search: (query) => search(bundled, query, supplement) }];
        }
        try {
          const response = await fetch(district.normalizedData, { cache: 'no-store' });
          if (!response.ok) return null;
          const data = await response.json();
          return [district.id, { data, district, manifest, source: 'json', supplement, search: (query) => search(data, query, supplement) }];
        } catch (error) {
          return bundled
            ? [district.id, { data: bundled, district, manifest, source: 'bundled', supplement, search: (query) => search(bundled, query, supplement) }]
            : null;
        }
      }));
    return Object.fromEntries(entries.filter(Boolean));
  }

  global.SchoolDistrictDataStore = { load, loadManifest, loadSupplement, loadAllNormalized, loadLegacy, search };
})(window);
