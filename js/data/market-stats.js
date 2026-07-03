// ============================================================
//  涨跌分布 & 涨跌停趋势 数据模块
//  使用 JSONP 获取，通过事件总线通知渲染层
// ============================================================

(function () {
    'use strict';

    /** 轮询标志 */
    let _isPolling = false;
    let _firstRequest = true;

    function isTradingTime() {
        const now = new Date();
        if (now.getDay() === 0 || now.getDay() === 6) return false;
        const t = now.getHours() * 100 + now.getMinutes();
        return (t >= 915 && t <= 1135) || (t >= 1255 && t <= 1505);
    }

    async function fetchJSONP(url) {
        const res = await fetch(url);
        const text = await res.text();
        const firstParen = text.indexOf('(');
        const lastParen = text.lastIndexOf(')');
        if (firstParen === -1 || lastParen === -1 || lastParen < firstParen) {
            throw new Error('返回内容不是标准 JSONP 格式');
        }
        return JSON.parse(text.substring(firstParen + 1, lastParen));
    }

    async function loadZDFB() {
        if (!_firstRequest && !isTradingTime()) return;
        const t = Date.now();
        const cb = `cb_zdfb_${t}`;
        const url = `${ZDFB_API.baseUrl}?cb=${cb}&ut=${ZDFB_API.ut}&dpt=${ZDFB_API.dpt}&_=${t}`;
        try {
            const result = await fetchJSONP(url);
            const fenbu = result?.data?.fenbu;
            if (!fenbu || !Array.isArray(fenbu)) return;

            // 解析分布数据: fenbu 从 -11 到 11
            // -11=跌停, 0=平盘, 11=涨停
            // [{ "-11": xx }, { "-10": xx }, ..., { "11": xx }]
            const counts = {};
            let total = 0;
            for (const item of fenbu) {
                const key = Object.keys(item)[0];
                const val = Number(item[key]) || 0;
                counts[Number(key)] = val;
                total += val;
            }

            // 上涨: key 1~11
            let upCount = 0;
            for (let i = 1; i <= 11; i++) upCount += counts[i] || 0;
            // 下跌: key -11~-1
            let downCount = 0;
            for (let i = -11; i <= -1; i++) downCount += counts[i] || 0;
            // 平盘: key 0
            const flatCount = counts[0] || 0;

            const upRatio = total > 0 ? (upCount / total * 100) : 0;

            EventBus.emit('zdfb:update', {
                counts,
                upCount,
                downCount,
                flatCount,
                total,
                upRatio,
                fenbu: counts,
            });
        } catch (e) {
            console.error('[MarketStats] 涨跌分布加载失败:', e);
        }
    }

    async function loadZDT() {
        if (!_firstRequest && !isTradingTime()) return;
        const t = Date.now();
        const cb = `cb_zdt_${t}`;
        const url = `${ZDT_API.baseUrl}?cb=${cb}&ut=${ZDT_API.ut}&dpt=${ZDT_API.dpt}&time=0&_=${t}`;
        try {
            const result = await fetchJSONP(url);
            const list = result?.data?.zdtcount;
            if (!list || !Array.isArray(list) || list.length === 0) return;

            // 转换为时间戳数据点
            const today = new Date();
            const y = today.getFullYear();
            const m = today.getMonth();
            const d = today.getDate();

            const ztPoints = [];
            const dtPoints = [];
            for (const item of list) {
                const tm = item.t; // 930 ~ 1500
                if (tm == null) continue;
                const hh = Math.floor(tm / 100);
                const mm = tm % 100;
                const ts = Math.floor(new Date(y, m, d, hh, mm, 0).getTime() / 1000);
                ztPoints.push({ time: ts, value: item.ztc || 0 });
                dtPoints.push({ time: ts, value: item.dtc || 0 });
            }

            EventBus.emit('zdt:update', { ztPoints, dtPoints });
        } catch (e) {
            console.error('[MarketStats] 涨跌停趋势加载失败:', e);
        }
    }

    async function loadAll() {
        if (_isPolling) return;
        _isPolling = true;
        await Promise.all([loadZDFB(), loadZDT()]);
        _isPolling = false;
        _firstRequest = false;
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.MarketStatsData = {
        startPolling(interval) {
            loadAll();
            if (AppState.marketStatsTimer) clearInterval(AppState.marketStatsTimer);
            AppState.marketStatsTimer = setInterval(() => loadAll(), interval || 5000);
        },
        stopPolling() {
            if (AppState.marketStatsTimer) {
                clearInterval(AppState.marketStatsTimer);
                AppState.marketStatsTimer = null;
            }
        },
        loadOnce: loadAll,
    };
})();