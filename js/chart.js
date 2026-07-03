// ============================================================
//  分时图绘制 (Canvas) — 支持午休时段压缩 & MACD
// ============================================================

/**
 * 计算 MACD 指标
 * @param {number[]} prices - 价格数组（按时间顺序）
 * @param {number} fast - 快线周期 (默认12)
 * @param {number} slow - 慢线周期 (默认26)
 * @param {number} signal - DEA 周期 (默认9)
 * @returns {Array} [{ dif, dea, macd }]
 */
function calcMACD(prices, fast = 12, slow = 26, signal = 9) {
    const result = [];
    if (!prices || prices.length < slow) return result;

    function calcEMA(data, period) {
        const k = 2 / (period + 1);
        const ema = [data[0]];
        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }
        return ema;
    }

    const emaFast = calcEMA(prices, fast);
    const emaSlow = calcEMA(prices, slow);
    const dif = emaFast.map((v, i) => v - emaSlow[i]);
    const dea = calcEMA(dif, signal);

    for (let i = 0; i < dif.length; i++) {
        result.push({ dif: dif[i], dea: dea[i], macd: 2 * (dif[i] - dea[i]) });
    }
    return result;
}

/**
 * 计算成交额每分钟差额（今日 vs 昨日同期）
 * @param {Array} todayCum - 今日累计数据 [{ time, cumAmount }]
 * @param {Array} yestCum - 昨日累计数据 [{ time, cumAmount }]
 * @returns {Array} [{ time, diff }] diff = 今日累计 - 昨日同期累计
 */
function calcAmountDiff(todayCum, yestCum) {
    const result = [];
    const yestMap = {};
    for (const p of yestCum) {
        yestMap[p.time] = p.cumAmount;
    }
    for (const p of todayCum) {
        const yestVal = yestMap[p.time];
        if (yestVal !== undefined) {
            result.push({ time: p.time, diff: p.cumAmount - yestVal });
        } else {
            // 今日有但昨日没有的时间点，diff 为 0
            result.push({ time: p.time, diff: 0 });
        }
    }
    return result;
}

/**
 * 绘制分时趋势图
 * @param {string} canvasId - Canvas 元素 ID
 * @param {Array|null} data - 趋势数据数组
 * @param {string} color - 线条颜色
 * @param {boolean} isAmount - 是否为成交额图表
 * @param {object|null} compareData - 对比数据 (成交额图表使用: { todayCumulative, yesterdayCumulative })
 * @param {boolean} showMACD - 是否在底部显示 MACD (仅对价格指数生效)
 * @param {number} prePrice - 昨日收盘价，用于显示涨幅（仅对价格指数生效）
 */
function drawTrendChart(canvasId, data, color, isAmount = false, compareData = null, showMACD = false, prePrice = 0) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || rect.width - 32 || 400;
    const h = canvas.clientHeight || 200;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 判断底部区域类型: MACD(价格指数) / diffBar(成交额) / 无
    const showMACDArea = showMACD && !isAmount;
    const showDiffArea = isAmount && compareData && compareData.todayCumulative && compareData.yesterdayCumulative;
    const hasBottomArea = showMACDArea || showDiffArea;

    const bottomRatio = showMACDArea ? 0.38 : (showDiffArea ? 0.28 : 0);
    const pricePad = { top: 6, bottom: 4, left: 6, right: 6 };
    const bottomPad = { top: 2, bottom: 12, left: 6, right: 6 };

    const priceH = hasBottomArea ? Math.round(h * (1 - bottomRatio)) : h;
    const bottomH = hasBottomArea ? h - priceH : 0;

    const priceChartH = priceH - pricePad.top - pricePad.bottom;
    const priceChartW = w - pricePad.left - pricePad.right;
    const bottomChartH = bottomH - bottomPad.top - bottomPad.bottom;
    const bottomChartW = w - bottomPad.left - bottomPad.right;

    ctx.clearRect(0, 0, w, h);

    // 准备数据点 (每个点 { time, value })
    let points = [];
    let avgPoints = [];
    let comparePoints = [];

    if (isAmount && compareData) {
        const today = compareData.todayCumulative || [];
        const yesterday = compareData.yesterdayCumulative || [];
        points = today
            .map(p => ({ time: p.time, value: p.cumAmount }))
            .filter(p => p.time && timeToTradingMinute(p.time) >= 0);
        comparePoints = yesterday
            .map(p => ({ time: p.time, value: p.cumAmount }))
            .filter(p => p.time && timeToTradingMinute(p.time) >= 0);
    } else {
        const list = Array.isArray(data) ? data : [];
        points = list
            .map(d => {
                const arr = d.split(',');
                const price = parseFloat(arr[4]) || 0;
                const avg = parseFloat(arr[7]) || 0; // 均价 = index 7
                const time = parseTrendTimeStr(d);
                return { time, value: price, avg };
            })
            .filter(p => p.time && timeToTradingMinute(p.time) >= 0);
        // 均价点
        avgPoints = points.filter(p => p.avg > 0).map(p => ({ time: p.time, value: p.avg }));
    }

    if (points.length === 0 && comparePoints.length === 0) {
        ctx.fillStyle = '#c9cdd4';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('等待数据...', w / 2, h / 2);
        return;
    }

    // ---- 价格区域 ----
    let allVals = points.map(p => p.value);
    if (isAmount && compareData) {
        allVals = allVals.concat(comparePoints.map(p => p.value));
    }
    // 均价也参与值域计算
    if (!isAmount) {
        allVals = allVals.concat(avgPoints.map(p => p.value));
    }
    if (allVals.length === 0) allVals = [0, 1];
    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);
    const range = maxVal - minVal || 1;
    const padding = range * 0.05;
    minVal -= padding;
    maxVal += padding;
    if (minVal < 0) minVal = 0;

    function getX(timeStr) {
        const tm = timeToTradingMinute(timeStr);
        if (tm < 0) return pricePad.left;
        const ratio = tm / 240;
        return pricePad.left + ratio * priceChartW;
    }

    function getPriceY(val) {
        const ratio = (val - minVal) / (maxVal - minVal);
        return pricePad.top + priceChartH - Math.max(0, Math.min(1, ratio)) * priceChartH;
    }

    // 价格区域网格
    ctx.strokeStyle = '#e8eaed';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);
    for (let i = 0; i <= 4; i++) {
        const y = pricePad.top + (priceChartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pricePad.left, y);
        ctx.lineTo(w - pricePad.right, y);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // 11:30 午间分隔虚线
    const noonX = pricePad.left + (120 / 240) * priceChartW;
    ctx.strokeStyle = '#a0a7b0';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(noonX, pricePad.top);
    ctx.lineTo(noonX, pricePad.top + priceChartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 绘制价格/成交额曲线
    function drawPriceLine(pts, strokeColor, lineWidth = 1.8) {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        let started = false;
        for (const p of pts) {
            const x = getX(p.time);
            const y = getPriceY(p.value);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    drawPriceLine(points, color, 2.0);

    // 绘制均价线（黄色细线）- 仅对普通指数
    if (!isAmount && avgPoints.length > 1) {
        drawPriceLine(avgPoints, '#fadb14', 1.2);
    }

    if (isAmount && compareData && comparePoints.length > 0) {
        drawPriceLine(comparePoints, '#2d9b4e', 1.6);
    }

    // 最新值标记（价格指数显示涨幅，成交额显示金额）
    if (points.length > 0) {
        const last = points[points.length - 1];
        const lx = getX(last.time);
        const ly = getPriceY(last.value);
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        let label;
        if (isAmount) {
            label = formatAmount(last.value);
        } else if (prePrice > 0) {
            const pct = ((last.value - prePrice) / prePrice * 100);
            const sign = pct > 0 ? '+' : '';
            label = `${sign}${pct.toFixed(2)}%`;
        } else {
            label = last.value.toFixed(2);
        }
        ctx.fillText(label, lx + 6, ly - 2);
    }

    if (isAmount && compareData && comparePoints.length > 0) {
        const lastC = comparePoints[comparePoints.length - 1];
        const cx = getX(lastC.time);
        const cy = getPriceY(lastC.value);
        ctx.fillStyle = '#2d9b4e';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        let label = formatAmount(lastC.value);
        ctx.fillText('昨 ' + label, cx - 4, cy - 2);
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#2d9b4e';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // ---- 底部区域: MACD(价格指数) 或 差额柱状图(成交额) ----
    if (showMACDArea && !isAmount && bottomChartH > 10 && points.length > 0) {
        // MACD 区域
        const macdPrice = points.map(p => p.value);
        // 使用更小的周期参数，让 MACD 在数据较少时就能开始计算
        const fastPeriod = Math.min(12, Math.floor(macdPrice.length / 3));
        const slowPeriod = Math.min(26, Math.floor(macdPrice.length / 2));
        const signalPeriod = Math.min(9, Math.floor(macdPrice.length / 4));
        const macdData = calcMACD(macdPrice, fastPeriod, slowPeriod, signalPeriod);
        if (macdData.length > 0) {
            const offset = points.length - macdData.length;
            const macdPoints = points.slice(offset).map((p, i) => ({
                time: p.time,
                dif: macdData[i].dif,
                dea: macdData[i].dea,
                macd: macdData[i].macd
            }));

            let macdAllVals = [];
            macdPoints.forEach(p => {
                macdAllVals.push(p.dif, p.dea, p.macd);
            });
            if (macdAllVals.length === 0) macdAllVals = [-1, 1];
            let macdMin = Math.min(...macdAllVals);
            let macdMax = Math.max(...macdAllVals);
            const macdRange = macdMax - macdMin || 1;
            const macdPadding = macdRange * 0.1;
            macdMin -= macdPadding;
            macdMax += macdPadding;

            function getMACDY(val) {
                const ratio = (val - macdMin) / (macdMax - macdMin);
                return bottomPad.top + priceH + bottomChartH - Math.max(0, Math.min(1, ratio)) * bottomChartH;
            }

            // MACD 零轴线
            const zeroY = getMACDY(0);
            ctx.strokeStyle = '#c9cdd4';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([1, 3]);
            ctx.beginPath();
            ctx.moveTo(bottomPad.left, zeroY);
            ctx.lineTo(w - bottomPad.right, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);

            // MACD 柱状图
            const barW = Math.max(1, Math.min(4, priceChartW / macdPoints.length * 0.6));
            for (const p of macdPoints) {
                const x = getX(p.time);
                const y0 = getMACDY(0);
                const y1 = getMACDY(p.macd);
                ctx.fillStyle = p.macd >= 0 ? '#e5474a' : '#2d9b4e';
                const top = Math.min(y0, y1);
                const bottom = Math.max(y0, y1);
                ctx.fillRect(x - barW / 2, top, barW, bottom - top);
            }

            // DIF 线
            if (macdPoints.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = '#1890ff';
                ctx.lineWidth = 1.2;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                let started = false;
                for (const p of macdPoints) {
                    const x = getX(p.time);
                    const y = getMACDY(p.dif);
                    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // DEA 线
            if (macdPoints.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = '#fa8c16';
                ctx.lineWidth = 1.2;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                let started = false;
                for (const p of macdPoints) {
                    const x = getX(p.time);
                    const y = getMACDY(p.dea);
                    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            // MACD 区域纵轴标签
            ctx.fillStyle = '#86909c';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const macdYTicks = [macdMin, 0, macdMax];
            for (const val of macdYTicks) {
                const y = getMACDY(val);
                let label = val.toFixed(1);
                ctx.fillText(label, bottomPad.left - 2, y);
            }
        }
    } else if (showDiffArea && bottomChartH > 10) {
        // 成交额差额柱状图
        const diffPoints = calcAmountDiff(compareData.todayCumulative, compareData.yesterdayCumulative)
            .filter(p => p.time && timeToTradingMinute(p.time) >= 0);

        if (diffPoints.length > 0) {
            // 计算差额值域
            const diffVals = diffPoints.map(p => p.diff);
            let diffMin = Math.min(...diffVals);
            let diffMax = Math.max(...diffVals);
            // 确保包含0
            if (diffMin > 0) diffMin = 0;
            if (diffMax < 0) diffMax = 0;
            const diffRange = diffMax - diffMin || 1;
            const diffPadding = diffRange * 0.1;
            diffMin -= diffPadding;
            diffMax += diffPadding;

            function getDiffY(val) {
                const ratio = (val - diffMin) / (diffMax - diffMin);
                return bottomPad.top + priceH + bottomChartH - Math.max(0, Math.min(1, ratio)) * bottomChartH;
            }

            // 零轴线
            const zeroY = getDiffY(0);
            ctx.strokeStyle = '#c9cdd4';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([1, 3]);
            ctx.beginPath();
            ctx.moveTo(bottomPad.left, zeroY);
            ctx.lineTo(w - bottomPad.right, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);

            // 柱状图
            const barW = Math.max(1, Math.min(4, priceChartW / diffPoints.length * 0.6));
            for (const p of diffPoints) {
                const x = getX(p.time);
                const y0 = getDiffY(0);
                const y1 = getDiffY(p.diff);
                ctx.fillStyle = p.diff >= 0 ? '#e5474a' : '#2d9b4e';
                const top = Math.min(y0, y1);
                const bottom2 = Math.max(y0, y1);
                ctx.fillRect(x - barW / 2, top, barW, bottom2 - top);
            }

            // 差额区域纵轴标签
            ctx.fillStyle = '#86909c';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const diffYTicks = [diffMin, 0, diffMax];
            for (const val of diffYTicks) {
                const y = getDiffY(val);
                let label = formatAmount(Math.abs(val));
                if (val < 0) label = '-' + label;
                else if (val > 0) label = '+' + label;
                ctx.fillText(label, bottomPad.left - 2, y);
            }
        }
    }
}