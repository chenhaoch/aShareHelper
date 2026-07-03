// ============================================================
//  本地存储模块 — 缓存昨日数据、竞价数据
//  使用 localStorage 减少重复请求
// ============================================================

(function () {
    'use strict';

    const STORAGE_KEYS = {
        YESTERDAY_AMOUNT: 'ashare_yesterday_amount',  // 昨日成交额累计数据
        AUCTION_DATA: 'ashare_auction_data',           // 竞价数据
        CACHE_TIME: 'ashare_cache_time',               // 缓存时间戳
    };

    /** 缓存有效期（24小时） */
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    /**
     * 存储昨日成交额数据
     * @param {Array} yesterdayCumulative - [{ time, cumAmount }]
     */
    function saveYesterdayAmount(yesterdayCumulative) {
        try {
            const payload = {
                data: yesterdayCumulative,
                savedAt: Date.now(),
                date: new Date().toISOString().slice(0, 10),
            };
            localStorage.setItem(STORAGE_KEYS.YESTERDAY_AMOUNT, JSON.stringify(payload));
        } catch (e) {
            console.warn('[Storage] 保存昨日成交额失败:', e);
        }
    }

    /**
     * 读取缓存的昨日成交额数据
     * @returns {Array|null} 如果缓存有效返回数据，否则返回 null
     */
    function loadYesterdayAmount() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.YESTERDAY_AMOUNT);
            if (!raw) return null;

            const payload = JSON.parse(raw);
            const age = Date.now() - (payload.savedAt || 0);

            // 检查是否过期（24小时）
            if (age > CACHE_TTL) {
                localStorage.removeItem(STORAGE_KEYS.YESTERDAY_AMOUNT);
                return null;
            }

            // 检查是否同一天（如果已经跨天，缓存无效）
            const today = new Date().toISOString().slice(0, 10);
            if (payload.date !== today) {
                // 如果缓存是昨天的数据，仍然可以使用（今天还没请求到昨日数据时）
                // 不过需要标记是历史数据
                return payload.data;
            }

            return payload.data;
        } catch (e) {
            console.warn('[Storage] 读取昨日成交额失败:', e);
            return null;
        }
    }

    /**
     * 是否有有效的昨日成交额缓存
     * @returns {boolean}
     */
    function hasYesterdayAmount() {
        return loadYesterdayAmount() !== null;
    }

    /**
     * 存储竞价涨停数据（持久化，页面刷新后保留）
     */
    function saveAuctionData(items) {
        try {
            // 只保存竞价相关的数据（封涨停/封跌停）
            const auctionItems = items.filter(item => {
                const tm = item.tm || 0;
                const t = item.t || 0;
                const isAuctionTime = (() => {
                    const s = String(tm).padStart(6, '0');
                    const h = parseInt(s.slice(0, 2), 10);
                    const m = parseInt(s.slice(2, 4), 10);
                    return h === 9 && m <= 25;
                })();
                return isAuctionTime && (t === 4 || t === 8);
            });

            if (auctionItems.length === 0) return;

            const payload = {
                data: auctionItems,
                savedAt: Date.now(),
                date: new Date().toISOString().slice(0, 10),
            };
            localStorage.setItem(STORAGE_KEYS.AUCTION_DATA, JSON.stringify(payload));
        } catch (e) {
            console.warn('[Storage] 保存竞价数据失败:', e);
        }
    }

    /**
     * 读取缓存的竞价数据
     * @returns {Array} 竞价数据数组，无缓存返回空数组
     */
    function loadAuctionData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.AUCTION_DATA);
            if (!raw) return [];

            const payload = JSON.parse(raw);
            const age = Date.now() - (payload.savedAt || 0);

            // 竞价数据只保留当天
            const today = new Date().toISOString().slice(0, 10);
            if (payload.date !== today || age > CACHE_TTL) {
                localStorage.removeItem(STORAGE_KEYS.AUCTION_DATA);
                return [];
            }

            return payload.data || [];
        } catch (e) {
            console.warn('[Storage] 读取竞价数据失败:', e);
            return [];
        }
    }

    /**
     * 从本地存储恢复竞价数据到 AppState
     */
    function restoreAuctionData() {
        const auctionData = loadAuctionData();
        if (auctionData.length > 0) {
            // 去重后加入 persistentAuction
            const existing = new Set();
            for (const item of AppState.persistentAuction) {
                const key = `${item.c || ''}_${item.tm || ''}`;
                existing.add(key);
            }
            for (const item of auctionData) {
                const key = `${item.c || ''}_${item.tm || ''}`;
                if (!existing.has(key)) {
                    AppState.auctionSet.add(key);
                    AppState.persistentAuction.push(item);
                    existing.add(key);
                }
            }
        }
    }

    /**
     * 监听竞价数据变化并自动保存
     */
    function autoSaveAuction() {
        // 每 30 秒检查一次竞价数据长度是否有变化，有则保存
        let lastLength = AppState.persistentAuction.length;
        setInterval(() => {
            const currentLength = AppState.persistentAuction.length;
            if (currentLength > lastLength) {
                saveAuctionData(AppState.persistentAuction);
                lastLength = currentLength;
            }
        }, 30000);
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.StorageManager = {
        saveYesterdayAmount,
        loadYesterdayAmount,
        hasYesterdayAmount,

        saveAuctionData,
        loadAuctionData,
        restoreAuctionData,
        autoSaveAuction,
    };

})();