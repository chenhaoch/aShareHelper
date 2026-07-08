// ============================================================
//  应用入口 — 组装各模块，启动应用
// ============================================================

(function () {
    'use strict';

    /**
     * 应用初始化
     */
    function init() {
        if (AppState.initialized) return;
        AppState.initialized = true;

        // 1. 初始化图表
        ChartRenderer.initAll();

        // 2. 注册事件总线：图表更新
        EventBus.on('chart:update', (data) => {
            ChartRenderer.updatePriceSeries(data.code, data.dataPoints, data.options);
        });

        // 3. 注册事件总线：对比数据更新（成交额昨日线）
        EventBus.on('chart:compare', (data) => {
            ChartRenderer.updateCompareSeries(data.code, data.dataPoints);
        });

        // 4. 注册事件总线：成交额差额柱状图
        EventBus.on('chart:diff', (data) => {
            ChartRenderer.updateDiffHistogram(data.code, data.diffPoints);
        });

        // 5. 初始化板块缓存（从 localStorage 恢复到内存）
        SectorData.initSectorData();

        // 5b. 注册事件总线：板块数据更新后局部刷新异动项
        EventBus.on('sector:updated', (data) => {
            ChangeListRenderer.updateSingleStockSectors(data.code);
        });

        // 6. 启动指数 SSE 连接
        IndexDataLoader.startAll();

        // 7. 从本地存储恢复竞价数据
        StorageManager.restoreAuctionData();

        // 8. 注册事件总线：涨跌分布更新
        EventBus.on('zdfb:update', (data) => {
            MarketStatsRenderer.renderZDFB(data);
        });

        // 9. 注册事件总线：涨跌停趋势更新
        EventBus.on('zdt:update', (data) => {
            MarketStatsRenderer.renderZDT(data);
        });

        // 10. 启动涨跌分布 + 涨跌停趋势轮询
        MarketStatsData.startPolling(5000);

        // 11. 启动异动轮询
        ChangeDataLoader.startPolling(5000);

        // 12. 板块缓存自动持久化（5分钟检查一次，有变化才写入 localStorage）
        // 竞价数据由 change-data.js 在首次收到盘中数据时触发一次性保存
        StorageManager.autoSaveSectors();

        // 13. 更新时间显示
        function updateClock() {
            const el = document.getElementById('headerTime');
            if (el) {
                el.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
            }
        }
        updateClock();
        setInterval(updateClock, 1000);

        // 13. 异动开关绑定
        const toggleEl = document.getElementById('intradayToggle');
        if (toggleEl) {
            toggleEl.addEventListener('change', () => {
                ChangeDataLoader.setEnabled(toggleEl.checked);
            });
        }

        console.log('[App] 初始化完成 ✓');
    }

    // 根据文档加载状态触发初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();