// ============================================================
//  图表渲染器 — 使用 Lightweight Charts
//  支持分时图、MACD 子图、成交额对比
// ============================================================

(function () {
    'use strict';

    /** 主图实例 { code: chart } */
    const _mainCharts = {};
    /** MACD/差额子图实例 { code: chart } */
    const _subCharts = {};
    /** Series 实例 { key: series } */
    const _series = {};

    // ---- 容器管理 ----
    function getContainer(code) {
        return document.getElementById('chart_' + code);
    }

    function getContainerRect(code) {
        const el = getContainer(code);
        if (!el) return { w: 200, h: 150 };
        const rect = el.getBoundingClientRect();
        return { w: Math.max(rect.width, 200), h: Math.max(rect.height, 150) };
    }

    // ---- MACD 计算 ----
    function calcMACD(prices, fast = 12, slow = 26, signal = 9) {
        if (!prices || prices.length < slow) return [];
        function ema(data, period) {
            const k = 2 / (period + 1);
            const r = [data[0]];
            for (let i = 1; i < data.length; i++) {
                r.push(data[i] * k + r[i - 1] * (1 - k));
            }
            return r;
        }
        const ef = ema(prices, fast);
        const es = ema(prices, slow);
        const dif = ef.map((v, i) => v - es[i]);
        const dea = ema(dif, signal);
        return dif.map((v, i) => ({ dif: v, dea: dea[i], macd: 2 * (v - dea[i]) }));
    }

    // ---- 生成交叉光标时间标签 ----
    function _createCrosshairLabel(chart, container) {
        const label = document.createElement('div');
        label.className = 'crosshair-time-label';
        label.style.cssText =
            'position:absolute;bottom:-1px;left:0;' +
            'background:#1d2129;color:#fff;font-size:10px;' +
            'padding:0 5px;line-height:16px;border-radius:3px;' +
            'pointer-events:none;z-index:20;display:none;' +
            'font-family:-apple-system,sans-serif;';
        container.appendChild(label);

        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point) {
                label.style.display = 'none';
                return;
            }
            const d = new Date(param.time * 1000);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            label.textContent = `${hh}:${mm}`;
            label.style.display = 'block';
            const px = Math.round(param.point.x);
            label.style.left = Math.max(0, px - 20) + 'px';
        });
    }

    // ---- 主图（价格/成交额） ----
    function createMainChart(code) {
        if (_mainCharts[code]) return _mainCharts[code];

        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        const cfg = INDEX_CONFIG[code];
        // 有子图时主图占65%，子图占33%（2px 间隔）
        const mainRatio = cfg.isAmount ? 1.0 : 0.65;
        const mainH = Math.round(h * mainRatio);

        const chart = LightweightCharts.createChart(container, {
            width: w,
            height: mainH,
            layout: {
                background: { type: 'solid', color: '#fafafa' },
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Magnet,
                vertLine: {
                    color: '#a0a7b0',
                    width: 0.5,
                    style: LightweightCharts.LineStyle.Dashed,
                    labelVisible: false,
                },
                horzLine: {
                    color: '#a0a7b0',
                    width: 0.5,
                    style: LightweightCharts.LineStyle.Dashed,
                    labelVisible: false,
                },
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

        _createCrosshairLabel(chart, container);

        _mainCharts[code] = chart;
        return chart;
    }

    // ---- 子图（MACD/差额） ----
    function ensureSubChart(code) {
        if (_subCharts[code]) return _subCharts[code];

        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        const mainH = Math.round(h * 0.65);
        const subH = h - mainH - 2;

        let subContainer = container.querySelector('.sub-chart');
        if (!subContainer) {
            subContainer = document.createElement('div');
            subContainer.className = 'sub-chart';
            subContainer.style.cssText = 'position:absolute;bottom:0;left:0;right:0;';
            container.style.position = 'relative';
            container.appendChild(subContainer);
        }
        subContainer.style.height = Math.max(subH, 35) + 'px';
        subContainer.style.width = w + 'px';

        const mainChart = _mainCharts[code];
        if (mainChart) mainChart.applyOptions({ height: mainH });

        const subChart = LightweightCharts.createChart(subContainer, {
            width: w,
            height: Math.max(subH, 35),
            layout: {
                background: { type: 'solid', color: '#fafafa' },
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed },
                horzLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed },
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

        _subCharts[code] = subChart;
        return subChart;
    }

    // ---- Series 工厂 ----
    function getPriceSeries(code) {
        const key = `price_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        const cfg = INDEX_CONFIG[code];
        _series[key] = chart.addLineSeries({
            color: cfg.color,
            lineWidth: 1.2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        return _series[key];
    }

    function getAvgSeries(code) {
        const key = `avg_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        _series[key] = chart.addLineSeries({
            color: '#fadb14',
            lineWidth: 0.8,
            crosshairMarkerVisible: false,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        return _series[key];
    }

    function getCompareSeries(code) {
        const key = `compare_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        _series[key] = chart.addLineSeries({
            color: '#2d9b4e',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        return _series[key];
    }

    function getMACDDifSeries(code) {
        const key = `sub_dif_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        _series[key] = chart.addLineSeries({
            color: '#1890ff',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        return _series[key];
    }

    function getMADCDeaSeries(code) {
        const key = `sub_dea_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        _series[key] = chart.addLineSeries({
            color: '#fa8c16',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        return _series[key];
    }

    function getMACDHistogramSeries(code) {
        const key = `sub_macd_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        _series[key] = chart.addHistogramSeries({
            priceLineVisible: false,
            lastValueVisible: false,
        });
        return _series[key];
    }

    function getDiffHistogramSeries(code) {
        const key = `sub_diff_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        _series[key] = chart.addHistogramSeries({
            priceLineVisible: false,
            lastValueVisible: false,
        });
        return _series[key];
    }

    // ---- 工具 ----
    function fit(code) {
        const main = _mainCharts[code];
        if (main) main.timeScale().fitContent();
        const sub = _subCharts[code];
        if (sub) sub.timeScale().fitContent();
        _updateNoonMarker(code);
    }

    // ---- 11:30 午休分隔虚线（通过 UTC 偏移适配 timeScale） ----
    function _getNoonTimestamp() {
        const now = new Date();
        return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 3, 30, 0) / 1000);
    }

    function _updateNoonMarker(code) {
        const chart = _mainCharts[code];
        if (!chart) return;
        const container = getContainer(code);
        if (!container) return;

        const old = container.querySelector('.noon-marker');
        if (old) old.remove();

        const x = chart.timeScale().timeToCoordinate(_getNoonTimestamp());
        if (x === null || x <= 0) return;

        const marker = document.createElement('div');
        marker.className = 'noon-marker';
        marker.style.cssText =
            'position:absolute;left:' + x + 'px;top:0;bottom:0;' +
            'width:0;border-left:1px dashed #c0c4cc;pointer-events:none;z-index:10;';
        container.appendChild(marker);
    }

    function scheduleNoonMarker(code) {
        setTimeout(() => _updateNoonMarker(code), 200);
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.ChartRenderer = {

        initAll() {
            INDEX_CODES.forEach(code => {
                const main = createMainChart(code);
                if (main) {
                    _mainCharts[code] = main;
                    if (!INDEX_CONFIG[code].isAmount) {
                        ensureSubChart(code);
                    }
                }
            });
            this._setupResize();
        },

        updatePriceSeries(code, dataPoints, options = {}) {
            const { showAvg = false, isAmount = false } = options;
            if (!dataPoints || dataPoints.length === 0) return;

            const series = getPriceSeries(code);
            if (!series) return;
            const sorted = [...dataPoints].sort((a, b) => a.time - b.time);
            series.setData(sorted);

            if (showAvg && !isAmount) {
                const avgData = sorted.filter(p => p.avg != null && p.avg > 0)
                    .map(p => ({ time: p.time, value: p.avg }));
                const avgSeries = getAvgSeries(code);
                if (avgSeries && avgData.length > 0) avgSeries.setData(avgData);
            }

            if (!isAmount && sorted.length > 10) {
                this._updateMACD(code, sorted);
            }

            fit(code);
            scheduleNoonMarker(code);
        },

        _updateMACD(code, sorted) {
            const chart = _subCharts[code];
            if (!chart) return;

            const prices = sorted.map(p => p.value);
            const macdData = calcMACD(prices);
            if (macdData.length === 0) return;

            const offset = sorted.length - macdData.length;
            const macdPoints = sorted.slice(offset).map((p, i) => ({
                time: p.time,
                dif: macdData[i].dif,
                dea: macdData[i].dea,
                macd: macdData[i].macd,
            }));

            const difSeries = getMACDDifSeries(code);
            if (difSeries) difSeries.setData(macdPoints.map(p => ({ time: p.time, value: p.dif })));

            const deaSeries = getMADCDeaSeries(code);
            if (deaSeries) deaSeries.setData(macdPoints.map(p => ({ time: p.time, value: p.dea })));

            const histSeries = getMACDHistogramSeries(code);
            if (histSeries) {
                histSeries.setData(macdPoints.map(p => ({
                    time: p.time,
                    value: p.macd,
                    color: p.macd >= 0 ? '#e5474a' : '#2d9b4e',
                })));
            }

            chart.timeScale().fitContent();
        },

        updateCompareSeries(code, dataPoints) {
            if (!dataPoints || dataPoints.length === 0) return;
            const series = getCompareSeries(code);
            if (!series) return;
            const sorted = [...dataPoints].sort((a, b) => a.time - b.time);
            series.setData(sorted);
            fit(code);
            scheduleNoonMarker(code);
        },

        updateDiffHistogram(code, diffPoints) {
            if (!diffPoints || diffPoints.length === 0) return;
            const chart = ensureSubChart(code);
            if (!chart) return;

            const histSeries = getDiffHistogramSeries(code);
            if (!histSeries) return;

            histSeries.setData(diffPoints.map(p => ({
                time: p.time,
                value: p.diff,
                color: p.diff >= 0 ? '#e5474a' : '#2d9b4e',
            })));

            chart.timeScale().fitContent();
        },

        resize(code, width, height) {
            const mainChart = _mainCharts[code];
            const cfg = INDEX_CONFIG[code];
            const mainRatio = cfg.isAmount ? 1.0 : 0.65;
            const mainH = Math.round(height * mainRatio);
            const subH = height - mainH - 2;

            if (mainChart) mainChart.applyOptions({ width, height: mainH });

            const subChart = _subCharts[code];
            if (subChart) {
                const container = getContainer(code);
                const subEl = container ? container.querySelector('.sub-chart') : null;
                if (subEl) {
                    subEl.style.width = width + 'px';
                    subEl.style.height = Math.max(subH, 35) + 'px';
                }
                subChart.applyOptions({ width, height: Math.max(subH, 35) });
            }
            _updateNoonMarker(code);
        },

        _setupResize() {
            let timer = null;
            window.addEventListener('resize', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    INDEX_CODES.forEach(code => {
                        const { w, h } = getContainerRect(code);
                        this.resize(code, w, h);
                        fit(code);
                    });
                }, 300);
            });
        },
    };
})();