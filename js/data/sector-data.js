// ============================================================
//  板块数据模块
//  统一管理同花顺、韭研公社、手动录入三个来源的板块数据
//  内存缓存为主，localStorage 仅在合适时机持久化
// ============================================================

(function () {
    'use strict';

    /** 同花顺板块缓存 TTL（7天） */
    const THS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

    /** 来源优先级（数字越小优先级越高） */
    const SOURCE_PRIORITY = {
        manual: 0,
        jiuyan: 1,
        tonghuashun: 2,
    };

    /** 来源显示名 */
    const SOURCE_LABEL = {
        manual: '手动',
        jiuyan: '韭研',
        tonghuashun: '同花顺',
    };

    /** 最大显示板块数 */
    const MAX_SECTOR_DISPLAY = 6;

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
        if (clean.startsWith('8') || clean.startsWith('4')) return 16; // 北交所
        return 32;
    }

    /**
     * 清洗股票 code：去除 sh/sz/bj 前缀
     */
    function _normalizeCode(code) {
        return code.replace(/^(sh|sz|bj)/i, '');
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
            weight: item.weight || 999,
        })).filter(item => item.name);
    }

    /**
     * 三源合并去重
     * @param {Array} existing - 当前内存中的板块列表
     * @param {Array} newItems - 新数据 [{ name, source, weight }]
     * @returns {Array} 合并后的板块列表（已排序）
     */
    function _mergeSectors(existing, newItems) {
        const seen = new Set();
        // 现有板块已有优先级排序，先添加现有的
        const merged = [];
        for (const s of existing) {
            const key = s.name;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(s);
            }
        }
        // 添加新的
        for (const s of newItems) {
            const key = s.name;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(s);
            }
        }
        // 按来源优先级排序
        merged.sort((a, b) => {
            const pa = SOURCE_PRIORITY[a.source] !== undefined ? SOURCE_PRIORITY[a.source] : 99;
            const pb = SOURCE_PRIORITY[b.source] !== undefined ? SOURCE_PRIORITY[b.source] : 99;
            if (pa !== pb) return pa - pb;
            // 同来源按 weight 排序
            return (a.weight || 999) - (b.weight || 999);
        });
        return merged;
    }

    /**
     * 限制板块显示数量
     */
    function _truncateSectors(sectors) {
        if (!sectors || sectors.length <= MAX_SECTOR_DISPLAY) return sectors || [];
        const displayed = sectors.slice(0, MAX_SECTOR_DISPLAY);
        displayed.push({
            name: `+${sectors.length - MAX_SECTOR_DISPLAY}`,
            source: 'more',
            weight: 999,
        });
        return displayed;
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
     *   sectors: 板块列表（数组）或 null（loading 中无法返回）
     *   loading: 是否正在加载中
     */
    function getSectors(code) {
        const cleanCode = _normalizeCode(code);

        // 1. 查内存缓存
        const cached = AppState.getSectorCache(cleanCode);
        if (cached && cached.sectors && cached.sectors.length > 0) {
            const display = _truncateSectors(cached.sectors);
            return { sectors: display, loading: false };
        }

        // 2. 检查是否已有进行中的请求
        const pending = AppState.pendingSectorFetches[cleanCode];
        if (pending) {
            return { sectors: null, loading: true };
        }

        // 3. 发起新请求
        const promise = _fetchFromTongHuaShun(code).then(newSectors => {
            // 请求完成：合并到内存缓存
            const existing = AppState.getSectorCache(cleanCode);
            const existingSectors = existing ? existing.sectors : [];
            const existingStockName = existing ? (existing.stockName || '') : '';
            const merged = _mergeSectors(existingSectors, newSectors);

            // 保留已有 stockName（由 ensureStockName 或历史数据提供）
            const cacheData = {
                sectors: merged,
                stockName: existingStockName,
                updatedAt: Date.now(),
            };
            AppState.setSectorCache(cleanCode, cacheData);

            // 持久化到 localStorage
            StorageManager.saveSingleSector(cleanCode, cacheData);

            // 从进行中队列删除
            delete AppState.pendingSectorFetches[cleanCode];

            // 通知渲染层更新
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
     * 合并韭研公社数据到缓存
     * @param {string} code - 个股代码（已标准化）
     * @param {string} sectorName - 板块名称
     * @param {string} [stockName] - 个股名称
     */
    function mergeJiuyanSector(code, sectorName, stockName) {
        if (!code || !sectorName) return;
        const cleanCode = _normalizeCode(code);
        const existing = AppState.getSectorCache(cleanCode);
        const existingSectors = existing ? existing.sectors : [];
        const existingName = existing ? existing.stockName : '';

        const merged = _mergeSectors(existingSectors, [
            { name: sectorName, source: 'jiuyan', weight: 1 },
        ]);

        const cacheData = {
            sectors: merged,
            stockName: stockName || existingName || '',
            updatedAt: Date.now(),
        };
        AppState.setSectorCache(cleanCode, cacheData);
    }

    /**
     * 合并手动录入板块到缓存
     * @param {string} code - 个股代码（已标准化）
     * @param {string[]} sectorNames - 板块名称数组
     * @param {string} [stockName] - 个股名称
     */
    function mergeManualSectors(code, sectorNames, stockName) {
        if (!code || !Array.isArray(sectorNames) || sectorNames.length === 0) return;
        const cleanCode = _normalizeCode(code);
        const existing = AppState.getSectorCache(cleanCode);
        const existingSectors = existing ? existing.sectors : [];
        const existingName = existing ? existing.stockName : '';

        const newItems = sectorNames.map((name, i) => ({
            name,
            source: 'manual',
            weight: i,
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
     * 初始化：从 localStorage 恢复板块缓存到内存
     */
    function initSectorData() {
        StorageManager.restoreSectorCache();
    }

    /**
     * 获取板块来源标签
     */
    function getSourceLabel(source) {
        return SOURCE_LABEL[source] || source;
    }

    /**
     * 获取所有已缓存板块的个股 code 列表（已标准化）
     * @returns {string[]}
     */
    function getAllCachedCodes() {
        const cache = AppState.sectorCache;
        return Object.keys(cache).filter(code => {
            const data = cache[code];
            return data && data.sectors && data.sectors.length > 0;
        });
    }

    /**
     * 删除某个股的板块缓存
     * @param {string} code
     */
    function removeSectorCache(code) {
        const cleanCode = _normalizeCode(code);
        const cache = AppState.sectorCache;
        if (cache[cleanCode]) {
            delete cache[cleanCode];
            // 同步到 localStorage
            StorageManager.saveAllSectors(cache);
        }
    }

    /**
     * 确保个股名称被保存到缓存（用于从异动数据中获取名称）
     * @param {string} code - 个股代码
     * @param {string} stockName - 个股名称
     */
    function ensureStockName(code, stockName) {
        if (!code || !stockName) return;
        const cleanCode = _normalizeCode(code);
        const cached = AppState.getSectorCache(cleanCode);
        if (cached && !cached.stockName) {
            cached.stockName = stockName;
            // 不需要立即持久化，后续保存时会带上
        } else if (!cached) {
            // 首次遇到，创建空记录（同花顺请求时会填充板块）
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
        initSectorData,
        getSourceLabel,
        getAllCachedCodes,
        removeSectorCache,
        ensureStockName,
        MAX_SECTOR_DISPLAY,
    };

})();