// ============================================================
//  板块数据模块
//  统一管理同花顺、韭研公社、手动录入三个来源的板块数据
//  内存缓存为主，localStorage 仅在合适时机持久化
// ============================================================

(function () {
    'use strict';

    /** 同花顺板块缓存 TTL（7天） */
    const THS_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

    /** 最大显示板块数 */
    const MAX_SECTOR_DISPLAY = 6;

    /** 来源显示名 */
    const SOURCE_LABEL = {
        manual: '手动',
        jiuyan: '韭研',
        tonghuashun: '同花顺',
    };

    // ============================================================
    //  工具函数
    // ============================================================

    /**
     * 根据股票 code 推断同花顺 marketId
     */
    function _getMarketId(code) {
        const clean = code.replace(/^(sh|sz|bj)/i, '');
        if (clean.startsWith('60')) return 17;
        if (clean.startsWith('688')) return 16;
        if (clean.startsWith('00') || clean.startsWith('30')) return 32;
        if (clean.startsWith('8') || clean.startsWith('4')) return 16;
        return 32;
    }

    /**
     * 清洗股票 code：去除 sh/sz/bj 前缀
     */
    function _normalizeCode(code) {
        return code.replace(/^(sh|sz|bj)/i, '');
    }

    /**
     * weight 排序：高 → 低（同花顺=0, 韭研=99, 手动=999）
     */
    function _sortByWeight(a, b) {
        return (b.weight || 0) - (a.weight || 0);
    }

    /**
     * 解析同花顺接口返回的板块列表
     * @param {Array} data - res.data 数组
     * @returns {Array} [{ name, source: 'tonghuashun', weight }]
     */
    function _parseTHSResponse(data) {
        if (!Array.isArray(data)) return [];
        return data.map(item => ({
            name: item.name || '',
            source: 'tonghuashun',
            weight: item.weight || 0,  // ponytail: 无 weight 默认为 0
        })).filter(item => item.name && !SECTOR_ALLOW_SET.has(item.name));
    }

    /**
     * 三源合并去重，按 weight 降序排序
     * @param {Array} existing - 当前内存中的板块列表
     * @param {Array} newItems - 新数据 [{ name, source, weight }]
     * @returns {Array} 合并后的板块列表（已排序）
     */
    function _mergeSectors(existing, newItems) {
        const seen = new Set();
        const merged = [];
        for (const s of existing) {
            const key = s.name;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(s);
            }
        }
        for (const s of newItems) {
            const key = s.name;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(s);
            }
        }
        merged.sort(_sortByWeight);
        return merged;
    }

    /**
     * 限制板块显示数量（不添加 +N 标签）
     */
    function _truncateSectors(sectors) {
        if (!sectors) return [];
        return sectors.slice(0, MAX_SECTOR_DISPLAY);
    }

    // ============================================================
    //  同花顺接口
    // ============================================================

    /**
     * 从同花顺获取个股的板块列表
     * @param {string} code - 原始 code（可能带 sh/sz 前缀）
     * @returns {Promise<Array>} [{ name, source, weight }]
     */
    async function _fetchFromTongHuaShun(code) {
        const cleanCode = _normalizeCode(code);
        const marketId = _getMarketId(cleanCode);
        const url = `https://basic.10jqka.com.cn/fuyao/f10_stock_index/concept/v1/stock_concept_list?simple=1&market_id=${marketId}&code=${cleanCode}`;

        try {
            const res = await fetch(url);
            const text = await res.text();
            const result = JSON.parse(text);
            if (result && result.data) {
                return _parseTHSResponse(result.data);
            }
            return [];
        } catch (err) {
            console.warn(`[SectorData] 同花顺接口获取失败 [${code}]:`, err);
            return [];
        }
    }

    // ============================================================
    //  核心 API
    // ============================================================

    /**
     * 获取个股板块信息
     * @param {string} code - 个股代码（可能带 sh/sz 前缀）
     * @returns {{ sectors: Array|null, loading: boolean }}
     */
    function getSectors(code) {
        const cleanCode = _normalizeCode(code);

        const cached = AppState.getSectorCache(cleanCode);
        if (cached && cached.sectors && cached.sectors.length > 0) {
            const display = _truncateSectors(cached.sectors);
            return { sectors: display, loading: false };
        }

        const pending = AppState.pendingSectorFetches[cleanCode];
        if (pending) {
            return { sectors: null, loading: true };
        }

        const promise = _fetchFromTongHuaShun(code).then(newSectors => {
            const existing = AppState.getSectorCache(cleanCode);
            const existingSectors = existing ? existing.sectors : [];
            const existingStockName = existing ? (existing.stockName || '') : '';
            const merged = _mergeSectors(existingSectors, newSectors);

            const cacheData = {
                sectors: merged,
                stockName: existingStockName,
                updatedAt: Date.now(),
            };
            AppState.setSectorCache(cleanCode, cacheData);
            StorageManager.saveSingleSector(cleanCode, cacheData);
            delete AppState.pendingSectorFetches[cleanCode];
            EventBus.emit('sector:updated', { code: cleanCode });
            return merged;
        }).catch(err => {
            delete AppState.pendingSectorFetches[cleanCode];
            console.warn(`[SectorData] 板块获取失败 [${cleanCode}]:`, err);
            return [];
        });

        AppState.pendingSectorFetches[cleanCode] = promise;
        return { sectors: null, loading: true };
    }

    /**
     * 合并韭研公社数据到缓存（weight=99）
     */
    function mergeJiuyanSector(code, sectorName, stockName) {
        if (!code || !sectorName) return;
        const cleanCode = _normalizeCode(code);
        const existing = AppState.getSectorCache(cleanCode);
        const existingSectors = existing ? existing.sectors : [];
        const existingName = existing ? existing.stockName : '';

        const merged = _mergeSectors(existingSectors, [
            { name: sectorName, source: 'jiuyan', weight: 99 },
        ]);

        const cacheData = {
            sectors: merged,
            stockName: stockName || existingName || '',
            updatedAt: Date.now(),
        };
        AppState.setSectorCache(cleanCode, cacheData);
    }

    /**
     * 合并手动录入板块到缓存（weight=999）
     */
    function mergeManualSectors(code, sectorNames, stockName) {
        if (!code || !Array.isArray(sectorNames) || sectorNames.length === 0) return;
        const cleanCode = _normalizeCode(code);
        const existing = AppState.getSectorCache(cleanCode);
        const existingSectors = existing ? existing.sectors : [];
        const existingName = existing ? existing.stockName : '';

        const newItems = sectorNames.map(name => ({
            name,
            source: 'manual',
            weight: 999,
        }));

        const merged = _mergeSectors(existingSectors, newItems);

        const cacheData = {
            sectors: merged,
            stockName: stockName || existingName || '',
            updatedAt: Date.now(),
        };
        AppState.setSectorCache(cleanCode, cacheData);
    }

    /**
     * 替换某个股的完整板块列表（编辑页使用，保留来源信息）
     * 输入逗号分隔的板块名，已存在的保留来源和 weight，新增的标为 manual/999
     * @param {string} code
     * @param {string[]} sectorNames
     * @param {string} [stockName]
     */
    function replaceSectors(code, sectorNames, stockName) {
        if (!code) return;
        const cleanCode = _normalizeCode(code);
        const existing = AppState.getSectorCache(cleanCode);
        const existingSectors = existing ? existing.sectors : [];
        const existingName = existing ? existing.stockName : '';

        const nameToOld = {};
        for (const s of existingSectors) {
            nameToOld[s.name] = s;
        }

        const newSectors = sectorNames.map(name => {
            const old = nameToOld[name];
            if (old) {
                return { name: old.name, source: old.source, weight: old.weight };
            }
            return { name, source: 'manual', weight: 999 };
        });

        newSectors.sort(_sortByWeight);

        const cacheData = {
            sectors: newSectors,
            stockName: stockName || existingName || '',
            updatedAt: Date.now(),
        };
        AppState.setSectorCache(cleanCode, cacheData);
        StorageManager.saveSingleSector(cleanCode, cacheData);
    }

    /**
     * 批量移除匹配关键词的板块：遍历所有缓存个股，从每个个股的板块列表中删除所有模糊匹配的板块
     * @param {string} keyword - 板块关键词（模糊匹配，大小写不敏感）
     * @returns {{ affected: number, removed: string[] }} 受影响的个股数量和删除的板块名称列表
     */
    function batchRemoveSector(keyword) {
        if (!keyword) return { affected: 0, removed: [] };
        const kw = keyword.toLowerCase();
        const cache = AppState.sectorCache;
        let affected = 0;
        const removedSet = new Set();
        for (const code in cache) {
            const data = cache[code];
            if (!data || !Array.isArray(data.sectors) || data.sectors.length === 0) continue;
            const before = data.sectors.length;
            var newSectors = [];
            for (var j = 0; j < data.sectors.length; j++) {
                if (data.sectors[j].name.toLowerCase().indexOf(kw) !== -1) {
                    removedSet.add(data.sectors[j].name);
                } else {
                    newSectors.push(data.sectors[j]);
                }
            }
            data.sectors = newSectors;
            if (data.sectors.length !== before) {
                affected++;
                StorageManager.saveSingleSector(code, data);
            }
        }
        return { affected: affected, removed: Array.from(removedSet) };
    }

    /**
     * 模糊查找包含指定板块的所有个股
     * @param {string} keyword - 板块名称关键词（模糊匹配，大小写不敏感）
     * @returns {Array<{code: string, stockName: string, matchedSector: string}>}
     */
    function findStocksBySector(keyword) {
        if (!keyword) return [];
        const kw = keyword.toLowerCase();
        const cache = AppState.sectorCache;
        const result = [];
        for (const code in cache) {
            const data = cache[code];
            if (!data || !Array.isArray(data.sectors)) continue;
            for (var j = 0; j < data.sectors.length; j++) {
                if (data.sectors[j].name.toLowerCase().indexOf(kw) !== -1) {
                    result.push({ code: code, stockName: data.stockName || '--', matchedSector: data.sectors[j].name });
                    break;  // ponytail: 一个股只记录一次
                }
            }
        }
        return result;
    }

    /**
     * 初始化：从 localStorage 恢复板块缓存到内存
     */
    function initSectorData() {
        StorageManager.restoreSectorCache();
    }

    function getSourceLabel(source) {
        return SOURCE_LABEL[source] || source;
    }

    function getAllCachedCodes() {
        const cache = AppState.sectorCache;
        return Object.keys(cache).filter(code => {
            const data = cache[code];
            return data && data.sectors && data.sectors.length > 0;
        });
    }

    function removeSectorCache(code) {
        const cleanCode = _normalizeCode(code);
        const cache = AppState.sectorCache;
        if (cache[cleanCode]) {
            delete cache[cleanCode];
            StorageManager.saveAllSectors(cache);
        }
    }

    function ensureStockName(code, stockName) {
        if (!code || !stockName) return;
        const cleanCode = _normalizeCode(code);
        const cached = AppState.getSectorCache(cleanCode);
        if (cached && !cached.stockName) {
            cached.stockName = stockName;
        } else if (!cached) {
            AppState.setSectorCache(cleanCode, {
                sectors: [],
                stockName: stockName,
                updatedAt: Date.now(),
            });
        }
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.SectorData = {
        getSectors,
        mergeJiuyanSector,
        mergeManualSectors,
        replaceSectors,
        batchRemoveSector,
        findStocksBySector,
        initSectorData,
        getSourceLabel,
        getAllCachedCodes,
        removeSectorCache,
        ensureStockName,
        MAX_SECTOR_DISPLAY,
    };

})();
