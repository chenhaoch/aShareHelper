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

        // 5. 启动指数 SSE 连接
        IndexDataLoader.startAll();

        // 6. 从本地存储恢复竞价数据
        StorageManager.restoreAuctionData();

        // 7. 启动异动轮询
        ChangeDataLoader.startPolling(5000);

        // 8. 自动保存竞价数据
        StorageManager.autoSaveAuction();

        // 9. 更新时间显示
        function updateClock() {
            const el = document.getElementById('headerTime');
            if (el) {
                el.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
            }
        }
        updateClock();
        setInterval(updateClock, 1000);

        console.log('[App] 初始化完成 ✓');
        console.log(`[App] Lightweight Charts ${LightweightCharts.version || '4.x'}`);
    }

    // 根据文档加载状态触发初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();