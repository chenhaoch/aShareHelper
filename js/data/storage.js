// ============================================================
//  本地存储模块 — 竞价数据持久化
//  页面刷新后竞价涨停/跌停数据不丢失
// ============================================================

(function () {
    'use strict';

    const STORAGE_KEYS = {
        AUCTION_DATA: 'ashare_auction_data',  // 竞价数据
        SECTORS_DATA: 'ashare_sectors',        // 板块数据（单 key 存储所有个股）
    };

    /** 缓存有效期（24小时） */
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    /** 板块缓存是否有新数据 */
    let _sectorsDirty = false;

    // ============================================================
    //  竞价数据
    // ============================================================

    /**
     * 存储竞价涨停数据（持久化，页面刷新后保留）
     */
    function saveAuctionData(items) {
        try {
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
            console.log('[Storage] 写入竞价数据', auctionItems.length, '条');
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

            const today = new Date().toISOString().slice(0, 10);
            if (payload.date !== today || age > CACHE_TTL) {
                localStorage.removeItem(STORAGE_KEYS.AUCTION_DATA);
                console.log('[Storage] 竞价数据已过期，已清除');
                return [];
            }

            console.log('[Storage] 读取竞价数据', (payload.data || []).length, '条');
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

    // ponytail: 不再用定时器轮询保存竞价数据
    // 由 change-data.js 在首次收到盘中数据时触发一次性保存

    // ============================================================
    //  板块数据存储
    // ============================================================

    /**
     * 保存全部板块缓存到 localStorage
     * @param {Object} cache - { [code]: { sectors: [], updatedAt } }
     */
    function saveAllSectors(cache) {
        try {
            const payload = {
                data: cache,
                savedAt: Date.now(),
            };
            localStorage.setItem(STORAGE_KEYS.SECTORS_DATA, JSON.stringify(payload));
            const count = Object.keys(cache).length;
            console.log('[Storage] 写入板块缓存', count, '只个股');
        } catch (e) {
            console.warn('[Storage] 保存板块数据失败:', e);
        }
    }

    /**
     * 从 localStorage 加载全部板块缓存
     * @returns {Object} { [code]: { sectors: [], updatedAt } }
     */
    function loadAllSectors() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SECTORS_DATA);
            if (!raw) return {};
            const payload = JSON.parse(raw);
            const cache = payload.data || {};
            const count = Object.keys(cache).length;
            console.log('[Storage] 读取板块缓存', count, '只个股');
            return cache;
        } catch (e) {
            console.warn('[Storage] 读取板块数据失败:', e);
            return {};
        }
    }

    /**
     * 从 localStorage 加载板块缓存到内存（全局只调用一次）
     */
    function restoreSectorCache() {
        if (AppState.sectorCacheLoaded) return;
        const cache = loadAllSectors();
        AppState.setAllSectorCache(cache);
        AppState.sectorCacheLoaded = true;
        const count = Object.keys(cache).length;
        if (count > 0) {
            console.log(`[Storage] 已恢复 ${count} 只个股的板块缓存`);
        }
    }

    /**
     * 保存单个个股的板块数据（仅内存更新，标记脏标记）
     * @param {string} code
     * @param {Object} data - { sectors: [], updatedAt }
     */
    function saveSingleSector(code, data) {
        _sectorsDirty = true;
        console.log('[Storage] 板块数据已更新到内存 [code:' + code + '] sectors:' + (data.sectors ? data.sectors.length : 0));
    }

    /**
     * 自动保存板块缓存（每5分钟检查脏标记，有变化才写入）
     */
    function autoSaveSectors() {
        setInterval(() => {
            if (!_sectorsDirty) return;
            _sectorsDirty = false;
            const cache = AppState.sectorCache;
            if (cache && Object.keys(cache).length > 0) {
                saveAllSectors(cache);
            }
        }, 300000);
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.StorageManager = {
        saveAuctionData,
        loadAuctionData,
        restoreAuctionData,
        autoSaveSectors,
        saveAllSectors,
        loadAllSectors,
        restoreSectorCache,
        saveSingleSector,
    };

})();