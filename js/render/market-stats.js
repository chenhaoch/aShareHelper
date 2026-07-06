// ============================================================
//  涨跌分布 & 涨跌停趋势 渲染模块
// ============================================================

(function () {
    'use strict';

    /** 涨跌停趋势缓存 */
    let _zdtCanvas = null;
    let _zdtCtx = null;
    let _lastZDTData = null;

    // ============================================================
    //  涨跌分布 — 水平条形图（所有柱向上）
    // ============================================================

    // ponytail: 只保留柱状图，不显示 X 轴标签

    function renderZDFB(data) {
        const container = document.getElementById('zdfbChart');
        if (!container) return;

        const titleEl = document.getElementById('zdfbTitle');
        if (titleEl && data.total > 0) {
            const pct = data.upRatio.toFixed(1);
            titleEl.innerHTML = `📊 涨跌分布 <span class="text-up">上涨比例(${pct}%)</span>`;
        }

        container.innerHTML = '';

        const w = container.clientWidth || 400;
        const h = 100;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        container.appendChild(canvas);

        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // ponytail: 移除 X 轴标签空间，柱状图撑满
        const padLeft = 0;
        const padRight = 0;
        const padBottom = 4;
        const chartW = w - padLeft - padRight;
        const chartH = h - padBottom;

        // 找最大值 + 计算各值
        const groups = [];
        let maxVal = 0;
        for (let i = -11; i <= 11; i++) {
            const val = data.fenbu[i] || 0;
            if (val > maxVal) maxVal = val;
            groups.push({ idx: i, val });
        }
        if (maxVal === 0) maxVal = 1;

        const barW = chartW / 23;

        // 基线
        const baseY = chartH;
        ctx.strokeStyle = '#e8eaed';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padLeft, baseY);
        ctx.lineTo(padLeft + chartW, baseY);
        ctx.stroke();

        for (let g of groups) {
            const x = padLeft + (g.idx + 11) * barW;
            const barH = (g.val / maxVal) * (chartH - 10);

            if (g.val > 0) {
                const color = g.idx < 0 ? '#2d9b4e' : (g.idx > 0 ? '#e5474a' : '#86909c');
                ctx.fillStyle = color;
                ctx.fillRect(x + 1, baseY - barH, barW - 2, barH);
            }

            // 数值
            if (g.val > 0) {
                ctx.fillStyle = '#4e5969';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(String(g.val), x + barW / 2, baseY - barH - 1);
            }
        }
    }

    // ============================================================
    //  涨跌停趋势 — Canvas 实现
    //  替换了 Lightweight Charts，使用固定 X 轴 9:30~15:00
    // ============================================================

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

    function _tsToTimeStr(ts) {
        const d = new Date(ts * 1000);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function initZDTChart() {
        const container = document.getElementById('zdtChart');
        if (!container) return;

        // 已经初始化过且大小没变，复用
        if (_zdtCanvas) {
            const rect = container.getBoundingClientRect();
            const w = Math.max(rect.width, 200);
            const h = Math.max(rect.height, 100);
            if (_zdtCanvas.width !== w || _zdtCanvas.height !== h) {
                // 尺寸变了，重建
                _zdtCanvas.remove();
                _zdtCanvas = null;
                _zdtCtx = null;
            } else {
                return;
            }
        }

        container.innerHTML = '';
        container.style.position = 'relative';

        const rect = container.getBoundingClientRect();
        const w = Math.max(rect.width, 200);
        const h = Math.max(rect.height, 100);

        const canvas = document.createElement('canvas');
        canvas.className = 'zdt-canvas';
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.height = 0; // reset
        canvas.style.cssText = 'display:block;width:' + w + 'px;height:' + h + 'px;';
        container.appendChild(canvas);
        canvas.width = w * dpr;
        canvas.height = h * dpr;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        _zdtCanvas = canvas;
        _zdtCtx = ctx;
    }

    function _drawZDT(ztPoints, dtPoints) {
        if (!_zdtCtx || !_zdtCanvas) return;
        const ctx = _zdtCtx;
        const w = _zdtCanvas.width / (window.devicePixelRatio || 1);
        const h = _zdtCanvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, w, h);

        const pad = { top: 6, bottom: 16, left: 6, right: 6 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        if (chartW <= 0 || chartH <= 0) return;

        // 找出所有值（zt + dt）决定 Y 轴范围
        let allVals = [];
        ztPoints.forEach(p => allVals.push(p.value));
        dtPoints.forEach(p => allVals.push(p.value));
        if (allVals.length === 0) allVals = [0, 1];
        let minVal = Math.min(...allVals);
        let maxVal = Math.max(...allVals);
        const range = maxVal - minVal || 1;
        const padding = range * 0.1;
        minVal = Math.max(0, minVal - padding);
        maxVal += padding;

        // 统一转换点为时间字符串
        const ztStr = ztPoints.map(p => ({ time: _tsToTimeStr(p.time), value: p.value }));
        const dtStr = dtPoints.map(p => ({ time: _tsToTimeStr(p.time), value: p.value }));

        function getX(timeStr) {
            const tm = timeToTradingMinute(timeStr);
            if (tm < 0) return pad.left;
            return pad.left + (tm / 240) * chartW;
        }

        function getY(val) {
            const ratio = (val - minVal) / (maxVal - minVal);
            return pad.top + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
        }

        // 网格线
        ctx.strokeStyle = '#e8eaed';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // 11:30 午间分隔虚线
        const noonX = pad.left + (120 / 240) * chartW;
        ctx.strokeStyle = '#a0a7b0';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(noonX, pad.top);
        ctx.lineTo(noonX, pad.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        // 绘制线
        function drawLine(pts, color) {
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            let started = false;
            for (const p of pts) {
                const x = getX(p.time);
                const y = getY(p.value);
                if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        drawLine(ztStr, '#e5474a');
        drawLine(dtStr, '#2d9b4e');

        // 最新值端点标记
        if (ztStr.length > 0) {
            const last = ztStr[ztStr.length - 1];
            const lx = getX(last.time);
            const ly = getY(last.value);
            ctx.beginPath();
            ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#e5474a';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        if (dtStr.length > 0) {
            const last = dtStr[dtStr.length - 1];
            const lx = getX(last.time);
            const ly = getY(last.value);
            ctx.beginPath();
            ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#2d9b4e';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    function renderZDT(data) {
        _lastZDTData = data;
        initZDTChart();
        if (!_zdtCtx) return;

        const sorted = (pts) => [...pts].sort((a, b) => a.time - b.time);
        const ztSorted = sorted(data.ztPoints || []);
        const dtSorted = sorted(data.dtPoints || []);

        _drawZDT(ztSorted, dtSorted);

        // 更新标题右侧最新值
        const titleEl = document.getElementById('zdtTitle');
        if (titleEl && ztSorted.length > 0) {
            const lastZt = ztSorted[ztSorted.length - 1].value;
            const lastDt = dtSorted.length > 0 ? dtSorted[dtSorted.length - 1].value : 0;
            titleEl.innerHTML = `📈 涨跌停趋势 <span class="badge"><span class="text-up">${lastZt}</span> : <span class="text-down">${lastDt}</span></span>`;
        }
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.MarketStatsRenderer = {
        renderZDFB,
        renderZDT,
        initZDTChart,
    };
})();