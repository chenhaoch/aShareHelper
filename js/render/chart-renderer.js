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
    /** 容器尺寸缓存 */
    const _sizes = {};

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

    // ---- 创建主图表（价格/成交额） ----
    function createMainChart(code) {
        if (_mainCharts[code]) return _mainCharts[code];

        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        // 主图占 70%，子图占 30%
        const mainH = Math.round(h * 0.7);
        const subH = Math.round(h * 0.3);

        const chart = LightweightCharts.createChart(container, {
            width: w,
            height: mainH,
            layout: {
                background: { type: 'solid', color: '#fafafa' },
                textColor: '#86909c',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#e8eaed', style: 2 },
                horzLines: { color: '#e8eaed', style: 2 },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#1d2129' },
                horzLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#1d2129' },
            },
            timeScale: {
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#e8eaed',
                tickMarkFormatter: (time) => {
                    const d = new Date(time * 1000);
                    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                },
            },
            rightPriceScale: {
                borderColor: '#e8eaed',
                scaleMargins: { top: 0.08, bottom: 0.08 },
            },
            handleScroll: false,
            handleScale: false,
        });

        _mainCharts[code] = chart;
        _sizes[code] = { mainH, subH };
        return chart;
    }

    // ---- 为价格指数创建子图（MACD/差额） ----
    function ensureSubChart(code) {
        if (_subCharts[code]) return _subCharts[code];

        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        const mainH = Math.round(h * 0.7);
        const subH = Math.round(h * 0.3);

        // 获取当前容器的高度，将子图定位在容器底部区域
        // Lightweight Charts 的 overlay API 不够完善，所以我们用第二个独立的 chart 实例叠加
        // 在同一个容器中叠加两个 chart 实例需要用定位处理
        // 更可靠的方式：创建一个 div 包裹主图和子图

        // 由于 Lightweight Charts 的设计限制（每个 chart 独占一个容器），
        // 更好的方案是在 chart-container 内创建两个子 div
        let subContainer = container.querySelector('.sub-chart');
        if (!subContainer) {
            subContainer = document.createElement('div');
            subContainer.className = 'sub-chart';
            subContainer.style.cssText = 'position:absolute;bottom:0;left:0;right:0;';
            container.style.position = 'relative';
            container.appendChild(subContainer);
        }
        subContainer.style.height = subH + 'px';
        subContainer.style.width = w + 'px';

        // 确保主图高度正确
        const mainChart = _mainCharts[code];
        if (mainChart) {
            mainChart.applyOptions({ height: mainH });
        }

        const subChart = LightweightCharts.createChart(subContainer, {
            width: w,
            height: subH,
            layout: {
                background: { type: 'solid', color: '#fafafa' },
                textColor: '#86909c',
                fontSize: 9,
            },
            grid: {
                vertLines: { color: '#e8eaed', style: 2 },
                horzLines: { color: '#e8eaed', style: 2 },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { color: '#a0a7b0', width: 0.5, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#1d2129' },
            },
            timeScale: {
                visible: false,
                timeVisible: false,
                borderColor: '#e8eaed',
            },
            rightPriceScale: {
                borderColor: '#e8eaed',
                scaleMargins: { top: 0.15, bottom: 0.15 },
            },
            handleScroll: false,
            handleScale: false,
        });

        _subCharts[code] = subChart;
        return subChart;
    }

    // ---- 创建 Series (主图价格线) ----
    function getPriceSeries(code) {
        const key = `price_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        const cfg = INDEX_CONFIG[code];
        const s = chart.addLineSeries({
            color: cfg.color,
            lineWidth: 1.2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        _series[key] = s;
        return s;
    }

    function getAvgSeries(code) {
        const key = `avg_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        const s = chart.addLineSeries({
            color: '#fadb14',
            lineWidth: 0.8,
            crosshairMarkerVisible: false,
            priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        _series[key] = s;
        return s;
    }

    function getCompareSeries(code) {
        const key = `compare_${code}`;
        if (_series[key]) return _series[key];
        const chart = _mainCharts[code];
        if (!chart) return null;
        const s = chart.addLineSeries({
            color: '#2d9b4e',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceFormat: { type: 'price', precision: 0, minMove: 1 },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        _series[key] = s;
        return s;
    }

    // ---- 子图 Series ----
    function getMACDDifSeries(code) {
        const key = `sub_dif_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        const s = chart.addLineSeries({
            color: '#1890ff',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        _series[key] = s;
        return s;
    }

    function getMADCDeaSeries(code) {
        const key = `sub_dea_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        const s = chart.addLineSeries({
            color: '#fa8c16',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        _series[key] = s;
        return s;
    }

    function getMACDHistogramSeries(code) {
        const key = `sub_macd_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        const s = chart.addHistogramSeries({
            color: '#e5474a',
            priceFormat: { type: 'volume' },
            priceLineVisible: false,
            lastValueVisible: false,
        });
        _series[key] = s;
        return s;
    }

    // ---- 成交额差额柱状图 ----
    function getDiffHistogramSeries(code) {
        const key = `sub_diff_${code}`;
        if (_series[key]) return _series[key];
        const chart = _subCharts[code];
        if (!chart) return null;
        const s = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceLineVisible: false,
            lastValueVisible: false,
        });
        _series[key] = s;
        return s;
    }

    // ---- 工具函数 ----
    function fit(code) {
        const main = _mainCharts[code];
        if (main) main.timeScale().fitContent();
        const sub = _subCharts[code];
        if (sub) sub.timeScale().fitContent();
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.ChartRenderer = {

        /** 初始化所有图表 */
        initAll() {
            INDEX_CODES.forEach(code => {
                const cfg = INDEX_CONFIG[code];
                const main = createMainChart(code);
                if (main) {
                    _mainCharts[code] = main;
                    // 为价格指数创建子图
                    if (!cfg.isAmount) {
                        ensureSubChart(code);
                    }
                }
            });
            this._setupResize();
        },

        /** 更新分时数据 */
        updatePriceSeries(code, dataPoints, options = {}) {
            const { showAvg = false, isAmount = false } = options;
            if (!dataPoints || dataPoints.length === 0) return;

            // 主图价格线
            const series = getPriceSeries(code);
            if (!series) return;
            const sorted = [...dataPoints].sort((a, b) => a.time - b.time);
            series.setData(sorted);

            // 均价线
            if (showAvg && !isAmount) {
                const avgData = sorted.filter(p => p.avg != null && p.avg > 0)
                    .map(p => ({ time: p.time, value: p.avg }));
                const avgSeries = getAvgSeries(code);
                if (avgSeries && avgData.length > 0) avgSeries.setData(avgData);
            }

            // 更新 MACD 子图（仅价格指数）
            if (!isAmount && sorted.length > 10) {
                this._updateMACD(code, sorted);
            }

            fit(code);
        },

        /** 内部：计算并更新 MACD */
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

            // DIF 线
            const difSeries = getMACDDifSeries(code);
            if (difSeries) {
                difSeries.setData(macdPoints.map(p => ({ time: p.time, value: p.dif })));
            }

            // DEA 线
            const deaSeries = getMADCDeaSeries(code);
            if (deaSeries) {
                deaSeries.setData(macdPoints.map(p => ({ time: p.time, value: p.dea })));
            }

            // MACD 柱状图（红色正/绿色负）
            const histSeries = getMACDHistogramSeries(code);
            if (histSeries) {
                const histData = macdPoints.map(p => ({
                    time: p.time,
                    value: p.macd,
                    color: p.macd >= 0 ? '#e5474a' : '#2d9b4e',
                }));
                histSeries.setData(histData);
            }

            // 同步子图时间轴与主图
            chart.timeScale().fitContent();
        },

        /** 更新成交额对比线 */
        updateCompareSeries(code, dataPoints) {
            if (!dataPoints || dataPoints.length === 0) return;
            const series = getCompareSeries(code);
            if (!series) return;
            const sorted = [...dataPoints].sort((a, b) => a.time - b.time);
            series.setData(sorted);
            fit(code);
        },

        /** 更新成交额差额柱状图 */
        updateDiffHistogram(code, diffPoints) {
            if (!diffPoints || diffPoints.length === 0) return;
            const chart = ensureSubChart(code);
            if (!chart) return;

            const histSeries = getDiffHistogramSeries(code);
            if (!histSeries) return;

            const histData = diffPoints.map(p => ({
                time: p.time,
                value: Math.abs(p.diff),
                color: p.diff >= 0 ? '#e5474a' : '#2d9b4e',
            }));
            histSeries.setData(histData);
            chart.timeScale().fitContent();
        },

        /** 更新图表尺寸 */
        resize(code, width, height) {
            const mainChart = _mainCharts[code];
            const mainH = Math.round(height * 0.7);
            const subH = Math.round(height * 0.3);
            if (mainChart) mainChart.applyOptions({ width, height: mainH });

            const subChart = _subCharts[code];
            if (subChart) {
                const container = getContainer(code);
                const subEl = container ? container.querySelector('.sub-chart') : null;
                if (subEl) {
                    subEl.style.width = width + 'px';
                    subEl.style.height = subH + 'px';
                }
                subChart.applyOptions({ width, height: subH });
            }
            _sizes[code] = { mainH, subH };
        },

        /** Resize 监听 */
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