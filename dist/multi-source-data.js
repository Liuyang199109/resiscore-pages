/*
 * 多来源证据聚合器。
 *
 * 规则与数据包保持一致：
 * - 3 个及以上来源且最大/最小值相对中位数差异不超过 10%，取最接近中位数的 3 个值平均；
 * - 数据差异超过 10% 时，至少需要 5 个来源，取最接近中位数的 5 个值平均；
 * - 少于所需来源数时仍给出临时平均，但必须标记 needsConfirmation=true；
 * - 来源按 sourceId 去重，避免同一网页的不同链接被误当成独立来源。
 */
(function (global) {
  const DEFAULT_SIMILARITY = 0.10;

  function numericValues(values) {
    return (Array.isArray(values) ? values : [])
      .map((item, index) => {
        if (item && typeof item === 'object') {
          const value = Number(item.value);
          return Number.isFinite(value) ? { ...item, value } : null;
        }
        const value = Number(item);
        return Number.isFinite(value) ? { value, sourceId: `value-${index}` } : null;
      })
      .filter(Boolean);
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a.value - b.value);
    if (!sorted.length) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid].value : (sorted[mid - 1].value + sorted[mid].value) / 2;
  }

  function uniqueBySource(values) {
    const seen = new Set();
    return values.filter((item, index) => {
      const key = String(item.sourceId || item.source || `value-${index}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function aggregate(values, options = {}) {
    const candidates = uniqueBySource(numericValues(values));
    if (!candidates.length) {
      return {
        value: null, sourceCount: 0, usedSourceCount: 0, status: 'missing', needsConfirmation: true,
        similarity: null, relativeSpread: null, values: []
      };
    }
    const similarityThreshold = Number.isFinite(Number(options.similarityThreshold))
      ? Number(options.similarityThreshold) : DEFAULT_SIMILARITY;
    const center = median(candidates);
    const distance = (item) => Math.abs(item.value - center);
    const ordered = candidates.slice().sort((a, b) => distance(a) - distance(b));
    const min = Math.min(...candidates.map((item) => item.value));
    const max = Math.max(...candidates.map((item) => item.value));
    const denominator = Math.max(Math.abs(center), 1e-9);
    const relativeSpread = (max - min) / denominator;
    const similar = relativeSpread <= similarityThreshold;
    const requiredCount = similar ? 3 : 5;
    const used = ordered.slice(0, Math.min(requiredCount, ordered.length));
    const value = used.reduce((sum, item) => sum + item.value, 0) / used.length;
    const enoughSources = candidates.length >= requiredCount;
    return {
      value,
      sourceCount: candidates.length,
      usedSourceCount: used.length,
      requiredSourceCount: requiredCount,
      status: enoughSources ? (similar ? 'verified-similar' : 'verified-divergent') : 'provisional',
      needsConfirmation: !enoughSources,
      similarity: similar,
      relativeSpread,
      values: candidates,
      usedValues: used
    };
  }

  function label(aggregateResult, noun = '数据') {
    if (!aggregateResult || aggregateResult.status === 'missing') return `${noun}待补充`;
    const count = Number(aggregateResult.sourceCount) || 0;
    const used = Number(aggregateResult.usedSourceCount) || count;
    if (aggregateResult.needsConfirmation) return `${noun}${count}个来源，需进一步确认`;
    return `${noun}${used}个来源平均`;
  }

  global.ResiScoreMultiSource = { aggregate, label, median };
}(typeof globalThis !== 'undefined' ? globalThis : this));
