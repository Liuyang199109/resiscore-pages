(function (global) {
  const DATA_URL = 'data/huangpu-school-district-2026.json';
  const MANIFEST_URL = 'data/guangzhou-school-district-manifest.json';
  const SUPPLEMENT_URL = 'data/guangzhou-school-district-supplement-2026.json';
  const compact = (value) => String(value || '').toLowerCase().replace(/[\s\u3000·,，、。；;:：'"“”‘’（）()【】\[\]《》<>]/g, '');
  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/[\s\u3000·,，、。；;:：'"“”‘’（）()【】\[\]《》<>]/g, '')
    .replace(/住宅小区|住宅项目|小区/g, '');

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

  // Address aliases are intentionally exact-key only.  They are used for
  // records whose offline name is a complete address (or a numbered
  // residential compound) while the official service-area table uses a
  // canonical property label.  A normal property/coverage hit always wins;
  // aliases are only consulted when that lookup is empty.
  const findAddressAlias = (data, query) => {
    const aliases = data.addressAliases || {};
    const raw = String(query || '').trim();
    if (!raw) return null;
    const entry = aliases[raw];
    if (!entry) return null;
    return typeof entry === 'string' ? { target: entry, status: 'provisional' } : { ...entry };
  };

  const search = (data, query, supplement = null) => {
    const rawQuery = String(query || '').trim();
    const addressAlias = findAddressAlias(data, rawQuery);
    const propertyAlias = data.propertyAliases?.[rawQuery];
    const resolvedQuery = propertyAlias || (addressAlias && (addressAlias.target || addressAlias.property || addressAlias.canonical)) || query;
    const needle = normalize(resolvedQuery);
    const strongNeedle = compact(resolvedQuery);
    if (!needle) return { elementary: [], middle: [], notices: [], confirmedMapping: null };
    const queryNeedles = [...new Set([strongNeedle, needle].filter((value) => value && value.length >= 2))];
    let usedAddressAlias = Boolean(addressAlias && !propertyAlias);
    let elementary = (data.elementaryZones || []).filter((row) => {
      const coverage = compact(row.coverage);
      const normalizedCoverage = normalize(row.coverage);
      return queryNeedles.some((value) => coverage.includes(value) || normalizedCoverage.includes(value));
    }).map((row) => ({ ...row, school: canonicalSchoolName(data, row.school) }));
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
    const exactGroups = allGroups.filter((group) => {
      const scope = compact(group.primaryScope);
      const normalizedScope = normalize(group.primaryScope);
      return queryNeedles.some((value) => scope.includes(value) || normalizedScope.includes(value));
    });
    const groupsToCheck = exactGroups.length ? exactGroups : allGroups;
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
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`广州各区学区索引请求失败：${response.status}`);
      return await response.json();
    } catch (error) {
      return { schemaVersion: 1, city: 'guangzhou', schoolYear: 2026, districts: [], error: error.message };
    }
  }

  async function loadSupplement() {
    const fallback = global.RESISCORE_SCHOOL_DISTRICT_SUPPLEMENT;
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
      try {
        const response = await fetch(district.normalizedData, { cache: 'no-store' });
        if (!response.ok) throw new Error(`学区数据请求失败：${response.status}`);
        const data = await response.json();
        return { data, search: (query) => search(data, query, supplement), source: 'json', district, manifest, supplement };
      } catch (error) {
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
        try {
          const response = await fetch(district.normalizedData, { cache: 'no-store' });
          if (!response.ok) return null;
          const data = await response.json();
          return [district.id, { data, district, manifest, source: 'json', supplement, search: (query) => search(data, query, supplement) }];
        } catch (error) {
          return null;
        }
      }));
    return Object.fromEntries(entries.filter(Boolean));
  }

  global.SchoolDistrictDataStore = { load, loadManifest, loadSupplement, loadAllNormalized, loadLegacy, search };
})(window);
