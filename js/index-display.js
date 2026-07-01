// ============================================================
//  更新大盘数据 & 渲染图表
// ============================================================

/**
 * 更新指定大盘指数的数据显示和图表
 * @param {string} code - 指数代码
 * @param {object} data - SSE 数据对象 { trends, hisPrePrices }
 */
function updateIndexDisplay(code, data) {
    const chart = STATE.charts[code];
    if (!chart) return;

    const trendsData = data.trends;
    if (!Array.isArray(trendsData) || trendsData.length === 0) return;

    // 首次收到数据时，保存昨日收盘价
    if (chart.prePrice === 0 && Array.isArray(data.hisPrePrices) && data.hisPrePrices.length > 0) {
        chart.prePrice = data.hisPrePrices[0].prePrice || 0;
    }

    if (code === '800004') {
        // 全A: 分离今日/昨日，按时间合并（重复时间用最新数据覆盖）
        // 建立时间→数据映射
        const todayMap = {};
        for (const d of chart.data.today) {
            todayMap[parseTrendTimeStr(d)] = d;
        }
        const yesterdayMap = {};
        for (const d of chart.data.yesterday) {
            yesterdayMap[parseTrendTimeStr(d)] = d;
        }

        for (const d of trendsData) {
            const t = parseTrendTimeStr(d);
            if (!t) continue;
            if (isTodayTrend(d)) {
                todayMap[t] = d; // 覆盖或新增
            } else {
                yesterdayMap[t] = d;
            }
        }

        // 转回数组并排序
        chart.data.today = Object.values(todayMap).sort((a, b) => parseTrendTimeStr(a).localeCompare(parseTrendTimeStr(b)));
        chart.data.yesterday = Object.values(yesterdayMap).sort((a, b) => parseTrendTimeStr(a).localeCompare(parseTrendTimeStr(b)));

        console.log(`[全A] 今日 ${chart.data.today.length} 条, 昨日 ${chart.data.yesterday.length} 条`);

        // 计算累计成交额 (只保留交易时段内的时间)
        function computeCumulative(rawArray) {
            let cum = 0;
            const result = [];
            for (const d of rawArray) {
                const arr = d.split(',');
                const amt = parseFloat(arr[6]) || 0;
                cum += amt;
                const time = parseTrendTimeStr(d);
                if (time && timeToTradingMinute(time) >= 0) {
                    result.push({ time, cumAmount: cum });
                }
            }
            return result;
        }

        const todayCum = computeCumulative(chart.data.today);
        const yesterdayCum = computeCumulative(chart.data.yesterday);

        chart.todayCumulative = todayCum;
        chart.yesterdayCumulative = yesterdayCum;

        // 更新最新累计值，以及相对昨天同一时间的差额
        const lastToday = todayCum.length > 0 ? todayCum[todayCum.length - 1] : null;
        const valEl = document.getElementById('val_800004');
        const subEl = document.getElementById('sub_800004');
        if (lastToday) {
            valEl.textContent = formatAmount(lastToday.cumAmount);
            // 查找昨天同一时间的累计值
            const yestMap = {};
            for (const p of yesterdayCum) {
                yestMap[p.time] = p.cumAmount;
            }
            const yestSameTime = yestMap[lastToday.time];
            if (yestSameTime !== undefined) {
                const diff = lastToday.cumAmount - yestSameTime;
                const sign = diff > 0 ? '+' : '';
                const cls = diff > 0 ? 'text-up' : (diff < 0 ? 'text-down' : 'text-flat');
                subEl.innerHTML = `<span class="${cls}">${sign}${(diff/1e8).toFixed(2)}亿</span>`;
            } else {
                subEl.textContent = '';
            }
        } else {
            valEl.textContent = '--';
            subEl.textContent = '';
        }

        drawTrendChart('chart_800004', null, chart.color, true, {
            todayCumulative: chart.todayCumulative,
            yesterdayCumulative: chart.yesterdayCumulative
        });

    } else {
        // 普通指数：按时间去重，增量合并
        const timeKeys = new Set(chart.data.map(d => parseTrendTimeStr(d)));
        let newAdded = 0;
        for (const d of trendsData) {
            const t = parseTrendTimeStr(d);
            if (!timeKeys.has(t)) {
                chart.data.push(d);
                timeKeys.add(t);
                newAdded++;
            }
        }

        // 按时间排序
        chart.data.sort((a, b) => parseTrendTimeStr(a).localeCompare(parseTrendTimeStr(b)));

        // 计算涨跌幅（基于昨日收盘价）
        const prePrice = chart.prePrice;
        const last = chart.data.length > 0 ? chart.data[chart.data.length - 1] : null;
        const valEl = document.getElementById(`val_${code}`);
        const subEl = document.getElementById(`sub_${code}`);
        if (last && prePrice > 0) {
            const arr = last.split(',');
            const price = parseFloat(arr[4]) || 0;
            valEl.textContent = price.toFixed(2);
            const diff = price - prePrice;
            const pct = (diff / prePrice * 100);
            const sign = diff > 0 ? '+' : '';
            const cls = diff > 0 ? 'text-up' : (diff < 0 ? 'text-down' : 'text-flat');
            subEl.innerHTML = `<span class="${cls}">${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)</span>`;
        } else if (last && prePrice <= 0) {
            // 无昨日收盘价时，显示当前价格但不显示涨跌幅
            const arr = last.split(',');
            const price = parseFloat(arr[4]) || 0;
            valEl.textContent = price.toFixed(2);
            subEl.textContent = '';
        } else {
            valEl.textContent = '--';
            subEl.textContent = '';
        }

        drawTrendChart(`chart_${code}`, chart.data, chart.color, false, null, true);
    }
}