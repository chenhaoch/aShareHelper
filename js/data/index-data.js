// ============================================================
//  指数数据模块
//  负责 SSE 连接、数据合并、通过事件总线通知渲染层
// ============================================================

(function () {
    'use strict';

    /** 存储所有 SSE 客户端引用 */
    const _sseClients = [];

    // ponytail: SSE 防抖 — 15秒内只处理一次数据
    const SSE_DEBOUNCE_MS = 15000;
    const _lastProcessedTime = {};

    /**
     * 解析趋势字符串中的时间 "HH:MM"
     */
    function parseTrendTimeStr(str) {
        const parts = str.split(',');
        if (parts.length < 8) return null;
        const t = parts[0].trim();
        const spaceIdx = t.indexOf(' ');
        if (spaceIdx === -1) return null;
        return t.substring(spaceIdx + 1);
    }

    /**
     * 判断是否为今日数据
     */
    function isTodayTrend(str) {
        const parts = str.split(',');
        if (parts.length < 8) return false;
        const datePart = parts[0].trim().split(' ')[0];
        if (!datePart) return false;
        const today = new Date().toISOString().slice(0, 10);
        return datePart === today;
    }

    /**
     * 将 "HH:MM" 转换为交易分钟数
     */
    function timeToTradingMinute(timeStr) {
        if (!timeStr) return -1;
        const parts = timeStr.split(':');
        if (parts.length < 2) return -1;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (h < 11 || (h === 11 && m <= 30)) {
            const mins = (h - 9) * 60 + (m - 30);
            return Math.max(0, Math.min(120, mins));
        }
        if (h >= 13 && h <= 15) {
            const mins = (h - 13) * 60 + m + 120;
            return Math.min(240, Math.max(121, mins));
        }
        return -1;
    }

    /**
     * 将 "HH:MM" 转换为当天秒级时间戳
     */
    function timeStrToTimestamp(timeStr) {
        const parts = timeStr.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        return Math.floor(d.getTime() / 1000);
    }

    /**
     * 将趋势数据点转换为 Lightweight Charts 格式
     */
    function trendToDataPoint(trendStr) {
        const arr = trendStr.split(',');
        const price = parseFloat(arr[4]) || 0;
        const avg = parseFloat(arr[7]) || 0;
        const time = parseTrendTimeStr(trendStr);
        if (!time || timeToTradingMinute(time) < 0) return null;
        return {
            time: timeStrToTimestamp(time),
            value: price,
            avg: avg > 0 ? avg : undefined,
        };
    }

    /**
     * 将成交额趋势转换为累计数据
     */
    function computeCumulative(rawArray) {
        let cum = 0;
        const result = [];
        for (const d of rawArray) {
            const arr = d.split(',');
            const amt = parseFloat(arr[6]) || 0;
            cum += amt;
            const time = parseTrendTimeStr(d);
            if (time && timeToTradingMinute(time) >= 0) {
                result.push({ time: timeStrToTimestamp(time), cumAmount: cum });
            }
        }
        return result;
    }

    /**
     * 处理普通指数数据
     */
    function handlePriceIndex(code, trendsData) {
        const store = AppState.getIndexData(code);
        let newCount = 0;

        for (const d of trendsData) {
            const t = parseTrendTimeStr(d);
            if (!t) continue;
            if (!store.has(t)) {
                store.set(t, d);
                newCount++;
            }
        }

        if (newCount === 0) return;

        // 转换为有序数据点
        const sorted = [...store.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([_, v]) => v);

        const dataPoints = sorted
            .map(trendToDataPoint)
            .filter(Boolean);

        if (dataPoints.length > 0) {
            const prePrice = AppState.getPrePrice(code);
            EventBus.emit('chart:update', {
                code,
                dataPoints,
                options: { showAvg: true, isAmount: false },
            });

            // 更新卡片信息
            const last = dataPoints[dataPoints.length - 1];
            const change = prePrice > 0 ? last.value - prePrice : 0;
            const changePct = prePrice > 0 ? (change / prePrice * 100) : 0;
            IndexCardsRenderer.updateCardSub(code, {
                price: last.value,
                change,
                changePct,
                prePrice,
            });
        }
    }

    /**
     * 从趋势数据中提取日期字符串 "YYYY-MM-DD"
     */
    function extractDateFromTrend(str) {
        const parts = str.split(',');
        if (parts.length < 8) return null;
        const datePart = parts[0].trim().split(' ')[0];
        return datePart || null;
    }

    /**
     * 处理成交额数据
     * "今天" = 数据中最新的交易日，"昨天" = 数据中较早的那天
     */
    function handleAmountIndex(code, trendsData) {
        const store = AppState.getIndexData(code);

        // 扫描所有数据，提取不重复日期，取最新日期作为"今天"
        const dates = new Set();
        for (const d of trendsData) {
            const date = extractDateFromTrend(d);
            if (date) dates.add(date);
        }
        const sortedDates = [...dates].sort();
        const latestDate = sortedDates[sortedDates.length - 1]; // 最新交易日
        const yesterdayDate = sortedDates.length > 1 ? sortedDates[0] : null;

        for (const d of trendsData) {
            const t = parseTrendTimeStr(d);
            if (!t) continue;
            const date = extractDateFromTrend(d);
            if (date === latestDate) {
                store.today.set(t, d);
            } else if (yesterdayDate && date === yesterdayDate) {
                store.yesterday.set(t, d);
            } else {
                // 既不是最新也不是前一天的，丢掉（不会发生）
            }
        }

        const todaySorted = [...store.today.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([_, v]) => v);
        const yesterdaySorted = [...store.yesterday.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([_, v]) => v);

        const todayCum = computeCumulative(todaySorted);
        const yesterdayCum = computeCumulative(yesterdaySorted);

        store.todayCumulative = todayCum;
        store.yesterdayCumulative = yesterdayCum;

        // 通知图表更新
        if (todayCum.length > 0) {
            EventBus.emit('chart:update', {
                code,
                dataPoints: todayCum.map(p => ({ time: p.time, value: p.cumAmount })),
                options: { showAvg: false, isAmount: true },
            });
        }

        if (yesterdayCum.length > 0) {
            EventBus.emit('chart:compare', {
                code,
                dataPoints: yesterdayCum.map(p => ({ time: p.time, value: p.cumAmount })),
            });
        }

        // 发送差额柱状图数据
        if (todayCum.length > 0 && yesterdayCum.length > 0) {
            const yestMap = {};
            for (const p of yesterdayCum) yestMap[p.time] = p.cumAmount;
            const diffPoints = todayCum
                .filter(p => yestMap[p.time] !== undefined)
                .map(p => ({ time: p.time, diff: p.cumAmount - yestMap[p.time] }));
            if (diffPoints.length > 0) {
                EventBus.emit('chart:diff', { code, diffPoints });
            }
        }

        // 更新卡片
        const lastToday = todayCum.length > 0 ? todayCum[todayCum.length - 1] : null;
        const lastYest = yesterdayCum.length > 0 ? yesterdayCum[yesterdayCum.length - 1] : null;
        if (lastToday && lastYest) {
            const yestMap = {};
            for (const p of yesterdayCum) yestMap[p.time] = p.cumAmount;
            const yestSameTime = yestMap[lastToday.time];
            const amountDiff = yestSameTime != null ? lastToday.cumAmount - yestSameTime : null;
            const estimatedTotal = lastYest.cumAmount + (amountDiff || 0);
            IndexCardsRenderer.updateCardSub(code, {
                amountDiff,
                estimatedTotal,
            });
        }
    }

    /**
     * 创建 SSE 连接
     */
    function createSSEConnection(code) {
        const cfg = INDEX_CONFIG[code];
        const ndays = cfg.ndays;
        const baseDomain = ndays > 1 ? SSE_BASE.push2his : SSE_BASE.push2;
        const url = `${baseDomain}${SSE_COMMON_PATH}&ndays=${ndays}&secid=${cfg.secId}`;

        // ponytail: 首次数据必须处理（用于初始化昨收价），之后 15s 防抖
        let _isFirstBatch = true;

        const eventSource = new EventSource(url);
        eventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                const data = parsed?.data;
                if (!data?.trends) return;

                // 首次数据到来时处理昨日收盘价
                const prePrice = AppState.getPrePrice(code);
                if (prePrice === 0 && Array.isArray(data.hisPrePrices) && data.hisPrePrices.length > 0) {
                    AppState.setPrePrice(code, data.hisPrePrices[0].prePrice || 0);
                }

                // ponytail: SSE 防抖 — 非首次数据 15 秒内跳过
                if (!_isFirstBatch) {
                    const now = Date.now();
                    const last = _lastProcessedTime[code] || 0;
                    if (now - last < SSE_DEBOUNCE_MS) return;
                }
                _isFirstBatch = false;
                _lastProcessedTime[code] = Date.now();

                if (cfg.isAmount) {
                    handleAmountIndex(code, data.trends);
                } else {
                    handlePriceIndex(code, data.trends);
                }
            } catch (e) {
                console.error(`[IndexData] 解析 SSE 数据失败 [${code}]:`, e);
            }
        };

        eventSource.onerror = () => {
            console.warn(`[IndexData] SSE 连接异常 [${code}]`);
        };

        const client = { code, source: eventSource, close: () => eventSource.close() };
        _sseClients.push(client);
        return client;
    }

    window.IndexDataLoader = {
        /** 启动所有指数 SSE 连接 */
        startAll() {
            INDEX_CODES.forEach(code => createSSEConnection(code));
        },

        /** 关闭所有连接 */
        closeAll() {
            _sseClients.forEach(c => c.close());
            _sseClients.length = 0;
        },

        /** 工具函数导出（方便测试） */
        parseTrendTimeStr,
        timeToTradingMinute,
        timeStrToTimestamp,
        trendToDataPoint,
        computeCumulative,
    };
})();