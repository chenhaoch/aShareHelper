// ============================================================
//  本地存储模块 — 竞价数据持久化
//  页面刷新后竞价涨停/跌停数据不丢失
// ============================================================

(function () {
    'use strict';

    const STORAGE_KEYS = {
        AUCTION_DATA: 'ashare_auction_data',  // 竞价数据
    };

    /** 缓存有效期（24小时） */
    const CACHE_TTL = 24 * 60 * 60 * 1000;

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
     * 监听竞价数据变化并自动保存（每30秒检查一次）
     */
    function autoSaveAuction() {
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
        saveAuctionData,
        loadAuctionData,
        restoreAuctionData,
        autoSaveAuction,
    };

})();