// ============================================================
//  批量清理板块工具
//  直接从内存读取，提供 immediate 参数控制是否立即落盘
//  过滤和写入均打印耗时日志
// ============================================================

(function () {
    'use strict';

    /**
     * 批量删除指定板块（精确匹配）
     * 从内存读取 → 过滤 → 同步回内存，可选立即写入 localStorage。
     *
     * @param {string[]} sectorNames - 要删除的板块名称列表（精确匹配）
     * @param {boolean} [immediate=true] - true 立即写入 localStorage，false 只更新内存（靠定时保存）
     * @returns {{ affected: number, removedCount: number }} 受影响的个股数、删除的板块总数
     */
    function batchRemoveSectorByList(sectorNames, immediate) {
        if (!Array.isArray(sectorNames) || sectorNames.length === 0) {
            return { affected: 0, removedCount: 0 };
        }
        if (immediate === undefined) immediate = true;

        const removeSet = new Set(sectorNames);
        const cache = AppState.sectorCache;

        const t0 = performance.now();
        let affected = 0;
        let removedCount = 0;

        for (const code in cache) {
            const data = cache[code];
            if (!data || !Array.isArray(data.sectors) || data.sectors.length === 0) continue;

            const before = data.sectors.length;
            const kept = [];
            for (let i = 0; i < data.sectors.length; i++) {
                if (!removeSet.has(data.sectors[i].name)) {
                    kept.push(data.sectors[i]);
                } else {
                    removedCount++;
                }
            }
            if (kept.length !== before) {
                data.sectors = kept;
                affected++;
            }
        }

        const elapsed = ((performance.now() - t0) * 100) / 100;
        console.log(`[batchRemoveSectorByList] 过滤完成: 删除 ${removedCount} 个板块, 影响 ${affected} 只个股, 耗时 ${elapsed.toFixed(2)}ms`);

        if (immediate) {
            const tWrite = performance.now();
            StorageManager.saveAllSectors(cache);
            const writeElapsed = ((performance.now() - tWrite) * 100) / 100;
            console.log(`[batchRemoveSectorByList] 写入板块缓存: ${Object.keys(cache).length} 只个股, 耗时 ${writeElapsed.toFixed(2)}ms`);
        } else {
            console.log('[batchRemoveSectorByList] immediate=false，不落盘，依赖定时保存');
        }

        // 通知页面刷新列表
        try { EventBus.emit('sector:batch-cleaned'); } catch (e) {}

        return { affected, removedCount };
    }

    window.batchRemoveSectorByList = batchRemoveSectorByList;

})();
