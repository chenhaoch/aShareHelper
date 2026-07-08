// ============================================================
//  图表渲染器 — Canvas 实现
//  支持分时图、MACD 子图、成交额对比
//  X 轴固定映射 9:30~15:00（240 分钟），即使只有部分数据
// ============================================================

(function () {
    'use strict';

    // ---- 工具函数 ----

    /**
     * 将 "HH:MM" 转换为交易分钟数 (0~240)
     * 9:30=0, 11:30=120, 13:00=121, 15:00=240
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

    function formatAmount(val) {
        if (val == null) return '--';
        const abs = Math.abs(val);
        if (abs >= 1e8) return (val / 1e8).toFixed(2) + '亿';
        if (abs >= 1e4) return (val / 1e4).toFixed(2) + '万';
        return val.toFixed(0);
    }

    function calcMACD(prices, fast, slow, signal) {
        if (!prices || prices.length < slow) return [];
        fast = fast || 12;
        slow = slow || 26;
        signal = signal || 9;
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
        return dif.map((v, i) => ({ dif: v, dea: dea[i], macd: 2 * (v - dea[i]) }));
    }

    // ---- 各 chart 缓存的 Canvas 上下文 ----
    const _mainCanvases = {};
    const _subCanvases = {};
    const _dataCache = {};

    // ---- 常量 ----
    const PAD = { top: 6, bottom: 4, left: 6, right: 6 };
    const SUB_PAD = { top: 2, bottom: 12, left: 6, right: 6 };

    function getContainer(code) {
        return document.getElementById('chart_' + code);
    }

    function getContainerRect(code) {
        const el = getContainer(code);
        if (!el) return { w: 200, h: 150 };
        const rect = el.getBoundingClientRect();
        return { w: Math.max(rect.width, 200), h: Math.max(rect.height, 150) };
    }

    // ---- Canvas 创建/更新 ----
    function _createCanvas(container, className, width, height, isSub) {
        const canvas = document.createElement('canvas');
        canvas.className = className;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const bottomPos = isSub ? 'position:absolute;bottom:0;left:0;' : '';
        canvas.style.cssText = 'display:block;width:' + width + 'px;height:' + height + 'px;' + bottomPos;
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { canvas, ctx, w: width, h: height, dpr };
    }

    function _updateCanvasSize(canvasInfo, width, height) {
        if (canvasInfo.w === width && canvasInfo.h === height) return false;
        const dpr = window.devicePixelRatio || 1;
        canvasInfo.canvas.width = width * dpr;
        canvasInfo.canvas.height = height * dpr;
        canvasInfo.canvas.style.width = width + 'px';
        canvasInfo.canvas.style.height = height + 'px';
        canvasInfo.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvasInfo.w = width;
        canvasInfo.h = height;
        return true;
    }

    function _ensureMainCanvas(code) {
        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        // ponytail: 所有指数主图高度统一为 62%，包括成交额（其子图用于差额柱状图）
        const mainH = Math.round(h * 0.62);

        if (_mainCanvases[code]) {
            _updateCanvasSize(_mainCanvases[code], w, mainH);
            return _mainCanvases[code];
        }

        const info = _createCanvas(container, 'main-canvas', w, mainH, false);
        _mainCanvases[code] = info;
        return info;
    }

    function _ensureSubCanvas(code) {
        const container = getContainer(code);
        if (!container) return null;

        const { w, h } = getContainerRect(code);
        const mainH = Math.round(h * 0.62);
        const subH = Math.max(h - mainH - 2, 35);

        if (_subCanvases[code]) {
            _updateCanvasSize(_subCanvases[code], w, subH);
            return _subCanvases[code];
        }

        // ponytail: 子图用 absolute 定位到底部，与 Lightweight Charts 的子图位置一致
        const info = _createCanvas(container, 'sub-canvas', w, subH, true);
        _subCanvases[code] = info;
        return info;
    }

    // ---- 从时间戳提取 HH:MM ----
    function _tsToTimeStr(ts) {
        const d = new Date(ts * 1000);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // ---- 核心绘制函数 ----

    function _drawMain(code) {
        const info = _mainCanvases[code];
        if (!info) return;
        const { ctx, w, h } = info;

        ctx.clearRect(0, 0, w, h);

        const cache = _dataCache[code] || {};
        const cfg = INDEX_CONFIG[code];
        const isAmount = cfg && cfg.isAmount;
        const points = cache.pricePoints || [];
        const avgPoints = cache.avgPoints || [];
        const comparePoints = cache.comparePoints || [];

        if (points.length === 0 && comparePoints.length === 0) {
            ctx.fillStyle = '#c9cdd4';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('等待数据...', w / 2, h / 2);
            return;
        }

        const chartW = w - PAD.left - PAD.right;
        const chartH = h - PAD.top - PAD.bottom;
        if (chartW <= 0 || chartH <= 0) return;

        let allVals = points.map(p => p.value);
        if (isAmount) allVals = allVals.concat(comparePoints.map(p => p.value));
        if (!isAmount) allVals = allVals.concat(avgPoints.map(p => p.value));
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
            if (tm < 0) return PAD.left;
            return PAD.left + (tm / 240) * chartW;
        }

        function getY(val) {
            const ratio = (val - minVal) / (maxVal - minVal);
            return PAD.top + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
        }

        // 网格线
        ctx.strokeStyle = '#e8eaed';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        for (let i = 0; i <= 4; i++) {
            const y = PAD.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(PAD.left, y);
            ctx.lineTo(w - PAD.right, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // 11:30 午间分隔虚线
        const noonX = PAD.left + (120 / 240) * chartW;
        ctx.strokeStyle = '#a0a7b0';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(noonX, PAD.top);
        ctx.lineTo(noonX, PAD.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        function drawLine(pts, strokeColor, lineWidth) {
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth || 1.8;
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

        drawLine(points, cfg ? cfg.color : '#1890ff', 1.2);
        if (!isAmount && avgPoints.length > 1) {
            drawLine(avgPoints, '#fa8c16', 0.8);
        }
        if (isAmount && comparePoints.length > 0) {
            drawLine(comparePoints, '#2d9b4e', 1.6);
        }

        // 最新值标记（只保留文字标签，去掉端点圆点）
        if (points.length > 0) {
            const last = points[points.length - 1];
            const lx = getX(last.time);
            const ly = getY(last.value);
            ctx.fillStyle = cfg ? cfg.color : '#1890ff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            let label;
            if (isAmount) {
                label = formatAmount(last.value);
            } else {
                const prePrice = AppState ? AppState.getPrePrice(code) : 0;
                if (prePrice > 0) {
                    const pct = (last.value - prePrice) / prePrice * 100;
                    const sign = pct > 0 ? '+' : '';
                    label = sign + pct.toFixed(2) + '%';
                } else {
                    label = last.value.toFixed(2);
                }
            }
            ctx.fillText(label, lx + 6, ly - 2);
        }

        // 昨日成交额标记（只保留文字标签，去掉端点圆点）
        if (isAmount && comparePoints.length > 0) {
            const lastC = comparePoints[comparePoints.length - 1];
            const cx = getX(lastC.time);
            const cy = getY(lastC.value);
            ctx.fillStyle = '#2d9b4e';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText('昨 ' + formatAmount(lastC.value), cx - 4, cy - 2);
        }
    }

    function _drawMACD(code) {
        const info = _subCanvases[code];
        if (!info) return;
        const { ctx, w, h } = info;

        ctx.clearRect(0, 0, w, h);

        const cache = _dataCache[code] || {};
        const macdPoints = cache.macdPoints || [];
        if (!macdPoints || macdPoints.length === 0) return;

        const chartW = w - SUB_PAD.left - SUB_PAD.right;
        const chartH = h - SUB_PAD.top - SUB_PAD.bottom;
        if (chartW <= 0 || chartH <= 0) return;

        function getX(timeStr) {
            const tm = timeToTradingMinute(timeStr);
            if (tm < 0) return SUB_PAD.left;
            return SUB_PAD.left + (tm / 240) * chartW;
        }

        let allVals = [];
        macdPoints.forEach(p => { allVals.push(p.dif, p.dea, p.macd); });
        if (allVals.length === 0) allVals = [-1, 1];
        let macdMin = Math.min(...allVals);
        let macdMax = Math.max(...allVals);
        const macdRange = macdMax - macdMin || 1;
        const macdPadding = macdRange * 0.1;
        macdMin -= macdPadding;
        macdMax += macdPadding;

        function getY(val) {
            const ratio = (val - macdMin) / (macdMax - macdMin);
            return SUB_PAD.top + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
        }

        const zeroY = getY(0);
        ctx.strokeStyle = '#c9cdd4';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(SUB_PAD.left, zeroY);
        ctx.lineTo(w - SUB_PAD.right, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        const barW = Math.max(1, Math.min(4, chartW / macdPoints.length * 0.6));
        for (const p of macdPoints) {
            const x = getX(p.time);
            const y0 = getY(0);
            const y1 = getY(p.macd);
            ctx.fillStyle = p.macd >= 0 ? '#e5474a' : '#2d9b4e';
            const top = Math.min(y0, y1);
            const bottom = Math.max(y0, y1);
            ctx.fillRect(x - barW / 2, top, barW, bottom - top);
        }

        if (macdPoints.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#1890ff';
            ctx.lineWidth = 1.2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            let started = false;
            for (const p of macdPoints) {
                const x = getX(p.time);
                const y = getY(p.dif);
                if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        if (macdPoints.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#fa8c16';
            ctx.lineWidth = 1.2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            let started = false;
            for (const p of macdPoints) {
                const x = getX(p.time);
                const y = getY(p.dea);
                if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // ponytail: 移除 MACD Y 轴数字，只保留零轴线
    }

    function _drawDiff(code) {
        const info = _subCanvases[code];
        if (!info) return;
        const { ctx, w, h } = info;

        ctx.clearRect(0, 0, w, h);

        const cache = _dataCache[code] || {};
        const diffPoints = cache.diffPoints || [];
        if (!diffPoints || diffPoints.length === 0) return;

        const chartW = w - SUB_PAD.left - SUB_PAD.right;
        const chartH = h - SUB_PAD.top - SUB_PAD.bottom;
        if (chartW <= 0 || chartH <= 0) return;

        function getX(timeStr) {
            const tm = timeToTradingMinute(timeStr);
            if (tm < 0) return SUB_PAD.left;
            return SUB_PAD.left + (tm / 240) * chartW;
        }

        const diffVals = diffPoints.map(p => p.diff);
        let diffMin = Math.min(...diffVals);
        let diffMax = Math.max(...diffVals);
        if (diffMin > 0) diffMin = 0;
        if (diffMax < 0) diffMax = 0;
        const diffRange = diffMax - diffMin || 1;
        const diffPadding = diffRange * 0.1;
        diffMin -= diffPadding;
        diffMax += diffPadding;

        function getY(val) {
            const ratio = (val - diffMin) / (diffMax - diffMin);
            return SUB_PAD.top + chartH - Math.max(0, Math.min(1, ratio)) * chartH;
        }

        const zeroY = getY(0);
        ctx.strokeStyle = '#c9cdd4';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([1, 3]);
        ctx.beginPath();
        ctx.moveTo(SUB_PAD.left, zeroY);
        ctx.lineTo(w - SUB_PAD.right, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        const barW = Math.max(1, Math.min(4, chartW / diffPoints.length * 0.6));
        for (const p of diffPoints) {
            const x = getX(p.time);
            const y0 = getY(0);
            const y1 = getY(p.diff);
            ctx.fillStyle = p.diff >= 0 ? '#e5474a' : '#2d9b4e';
            const top = Math.min(y0, y1);
            const bottom = Math.max(y0, y1);
            ctx.fillRect(x - barW / 2, top, barW, bottom - top);
        }

        ctx.fillStyle = '#86909c';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        [diffMin, 0, diffMax].forEach(val => {
            let label = formatAmount(Math.abs(val));
            if (val < 0) label = '-' + label;
            else if (val > 0) label = '+' + label;
            ctx.fillText(label, SUB_PAD.left - 2, getY(val));
        });
    }

    // ---- 对外 API ----

    window.ChartRenderer = {

        initAll() {
            INDEX_CODES.forEach(code => {
                const container = getContainer(code);
                if (container) {
                    container.innerHTML = '';
                    container.style.position = 'relative';
                }
                delete _mainCanvases[code];
                delete _subCanvases[code];
                delete _dataCache[code];
            });
            this._setupResize();
        },

        updatePriceSeries(code, dataPoints, options) {
            options = options || {};
            if (!dataPoints || dataPoints.length === 0) return;

            if (!_dataCache[code]) _dataCache[code] = {};

            const sorted = [...dataPoints].sort((a, b) => a.time - b.time);
            _dataCache[code].pricePoints = sorted.map(p => ({
                time: _tsToTimeStr(p.time),
                value: p.value,
            }));
            _dataCache[code].avgPoints = sorted
                .filter(p => p.avg != null && p.avg > 0)
                .map(p => ({
                    time: _tsToTimeStr(p.time),
                    value: p.avg,
                }));

            _ensureMainCanvas(code);
            _drawMain(code);

            if (!options.isAmount && sorted.length > 10) {
                const prices = sorted.map(p => p.value);
                const n = prices.length;
                const fastPeriod = Math.min(12, Math.max(5, Math.floor(n / 3)));
                const slowPeriod = Math.min(26, Math.max(13, Math.floor(n / 2)));
                const signalPeriod = Math.min(9, Math.max(3, Math.floor(n / 4)));
                const macdData = calcMACD(prices, fastPeriod, slowPeriod, signalPeriod);
                if (macdData.length > 0) {
                    const offset = sorted.length - macdData.length;
                    _dataCache[code].macdPoints = sorted.slice(offset).map((p, i) => ({
                        time: _tsToTimeStr(p.time),
                        dif: macdData[i].dif,
                        dea: macdData[i].dea,
                        macd: macdData[i].macd,
                    }));
                    _ensureSubCanvas(code);
                    _drawMACD(code);
                }
            }
        },

        updateCompareSeries(code, dataPoints) {
            if (!dataPoints || dataPoints.length === 0) return;
            if (!_dataCache[code]) _dataCache[code] = {};
            _dataCache[code].comparePoints = dataPoints
                .sort((a, b) => a.time - b.time)
                .map(p => ({
                    time: _tsToTimeStr(p.time),
                    value: p.value,
                }));
            _ensureMainCanvas(code);
            _drawMain(code);
        },

        updateDiffHistogram(code, diffPoints) {
            if (!diffPoints || diffPoints.length === 0) return;
            if (!_dataCache[code]) _dataCache[code] = {};
            _dataCache[code].diffPoints = diffPoints.map(p => ({
                time: _tsToTimeStr(p.time),
                diff: p.diff,
            }));
            _ensureSubCanvas(code);
            _drawDiff(code);
        },

        resize(code, width, height) {
            if (_mainCanvases[code]) {
                _mainCanvases[code].canvas.remove();
                delete _mainCanvases[code];
            }
            if (_subCanvases[code]) {
                _subCanvases[code].canvas.remove();
                delete _subCanvases[code];
            }
            _ensureMainCanvas(code);
            _drawMain(code);

            const cache = _dataCache[code];
            if (cache) {
                if (cache.macdPoints) { _ensureSubCanvas(code); _drawMACD(code); }
                if (cache.diffPoints) { _ensureSubCanvas(code); _drawDiff(code); }
            }
        },

        _setupResize() {
            const self = this;
            let timer = null;
            window.addEventListener('resize', function () {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    INDEX_CODES.forEach(function (code) {
                        var rect = getContainerRect(code);
                        self.resize(code, rect.w, rect.h);
                    });
                }, 300);
            });
        },
    };
})();