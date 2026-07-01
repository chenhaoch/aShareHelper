// ============================================================
//  启动入口 & 定时器
// ============================================================

/**
 * 应用初始化
 */
function init() {
    if (STATE.initialized) return;
    STATE.initialized = true;

    // 加载大盘指数
    loadIndexDateTrends();

    // 启动异动轮询
    startChangePolling(5000);

    // 更新时间显示
    setInterval(() => {
        document.getElementById('headerTime').textContent = getNowStr();
    }, 1000);
    document.getElementById('headerTime').textContent = getNowStr();

    // 窗口大小变化时重绘图表
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            for (const code of ['000001', '399006', '000688', '800004']) {
                const chart = STATE.charts[code];
                if (!chart) continue;
                if (code === '800004') {
                    drawTrendChart('chart_800004', null, chart.color, true, {
                        todayCumulative: chart.todayCumulative || [],
                        yesterdayCumulative: chart.yesterdayCumulative || []
                    });
                } else {
                    drawTrendChart(`chart_${code}`, chart.data, chart.color, false);
                }
            }
        }, 300);
    });

    console.log('[A股盯盘] 初始化完成 ✓');
}

// 根据文档加载状态触发初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}