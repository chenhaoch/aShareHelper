// ============================================================
//  涨跌分布 & 涨跌停趋势 渲染模块
// ============================================================

(function () {
    'use strict';

    /** 涨跌停趋势图实例 */
    let _zdtChart = null;
    let _ztSeries = null;
    let _dtSeries = null;
    let _lastZDTData = null;

    // ============================================================
    //  涨跌分布 — 水平条形图（所有柱向上）
    // ============================================================

    const FENBU_LABELS = {
        '-11': '跌停', '-10': '', '-9': '', '-8': '', '-7': '', '-6': '',
        '-5': '-5%', '-4': '', '-3': '', '-2': '', '-1': '',
        '0': '0',
        '1': '', '2': '', '3': '', '4': '', '5': '+5%',
        '6': '', '7': '', '8': '', '9': '', '10': '',
        '11': '涨停',
    };

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

        const padLeft = 44;
        const padRight = 44;
        const padBottom = 18;
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

            // 标签
            const label = FENBU_LABELS[String(g.idx)];
            if (label) {
                ctx.fillStyle = '#86909c';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(label, x + barW / 2, baseY + 2);
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
    //  涨跌停趋势 — Lightweight Charts + 光标标签 + 午休线
    // ============================================================

    function _getNoonTimestamp() {
        const now = new Date();
        return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30, 0).getTime() / 1000);
    }

    function _createCrosshairLabel(chart, container) {
        const label = document.createElement('div');
        label.className = 'zdt-crosshair-label';
        label.style.cssText =
            'position:absolute;bottom:-1px;left:0;' +
            'background:#1d2129;color:#fff;font-size:10px;' +
            'padding:0 5px;line-height:16px;border-radius:3px;' +
            'pointer-events:none;z-index:20;display:none;' +
            'white-space:nowrap;font-family:-apple-system,sans-serif;';
        container.appendChild(label);

        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !_lastZDTData) {
                label.style.display = 'none';
                return;
            }
            const d = new Date(param.time * 1000);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');

            // 找到最近的 zt/dtc 值
            const ts = param.time;
            let ztc = 0, dtc = 0;
            const allPts = _lastZDTData.ztPoints || [];
            for (let i = allPts.length - 1; i >= 0; i--) {
                if (allPts[i].time <= ts) {
                    ztc = allPts[i].value;
                    break;
                }
            }
            const allDtPts = _lastZDTData.dtPoints || [];
            for (let i = allDtPts.length - 1; i >= 0; i--) {
                if (allDtPts[i].time <= ts) {
                    dtc = allDtPts[i].value;
                    break;
                }
            }

            label.textContent = `${hh}:${mm} 涨${ztc} 跌${dtc}`;
            label.style.display = 'block';
            const px = Math.round(param.point.x);
            label.style.left = Math.max(0, Math.min(px - 40, container.clientWidth - 120)) + 'px';
        });
    }

    function _updateNoonMarker(chart, container) {
        if (!chart || !container) return;
        const old = container.querySelector('.zdt-noon-marker');
        if (old) old.remove();

        const x = chart.timeScale().timeToCoordinate(_getNoonTimestamp());
        if (x === null || x <= 0) return;

        const marker = document.createElement('div');
        marker.className = 'zdt-noon-marker';
        marker.style.cssText =
            'position:absolute;left:' + x + 'px;top:0;bottom:0;' +
            'width:0;border-left:1px dashed #c0c4cc;pointer-events:none;z-index:10;';
        container.appendChild(marker);
    }

    function initZDTChart() {
        if (_zdtChart) return;

        const container = document.getElementById('zdtChart');
        if (!container) return;

        container.style.position = 'relative';
        const rect = container.getBoundingClientRect();
        const w = Math.max(rect.width, 200);
        const h = Math.max(rect.height, 100);

        _zdtChart = LightweightCharts.createChart(container, {
            width: w,
            height: h,
            layout: {
                background: { type: 'solid', color: '#fafafa' },
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed, labelVisible: false },
                horzLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed, labelVisible: false },
            },
            timeScale: {
                visible: false,
                timeVisible: false,
            },
            rightPriceScale: {
                visible: false,
                borderVisible: false,
            },
            leftPriceScale: {
                visible: false,
            },
            handleScroll: false,
            handleScale: false,
        });

        _ztSeries = _zdtChart.addLineSeries({
            color: '#e5474a',
            lineWidth: 1.2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        _dtSeries = _zdtChart.addLineSeries({
            color: '#2d9b4e',
            lineWidth: 1.2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        _createCrosshairLabel(_zdtChart, container);
        _zdtChart.timeScale().fitContent();
        setTimeout(() => _updateNoonMarker(_zdtChart, container), 200);
    }

    function renderZDT(data) {
        _lastZDTData = data;
        if (!_zdtChart) initZDTChart();
        if (!_ztSeries || !_dtSeries) return;

        const sorted = (pts) => [...pts].sort((a, b) => a.time - b.time);
        const ztSorted = sorted(data.ztPoints);
        const dtSorted = sorted(data.dtPoints);

        _ztSeries.setData(ztSorted);
        _dtSeries.setData(dtSorted);

        if (_zdtChart) {
            _zdtChart.timeScale().fitContent();
            setTimeout(() => _updateNoonMarker(_zdtChart, document.getElementById('zdtChart')), 200);
        }

        // 更新标题右侧最新值
        const titleEl = document.getElementById('zdtTitle');
        if (titleEl && ztSorted.length > 0) {
            const lastZt = ztSorted[ztSorted.length - 1].value;
            const lastDt = dtSorted.length > 0 ? dtSorted[dtSorted.length - 1].value : 0;
            titleEl.innerHTML = `📈 涨跌停趋势 <span class="badge"><span class="text-up">${lastZt}</span>:<span class="text-down">${lastDt}</span></span>`;
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