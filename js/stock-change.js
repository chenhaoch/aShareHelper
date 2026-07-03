// ============================================================
//  异动数据获取 (JSONP) & 渲染
// ============================================================

// 异动类型配置
const CHANGE_TYPES = {"4":{"name":"封涨停板","color":"price_up","direction":1,"pair":8,"id":4,"type":"price"},"8":{"name":"封跌停板","color":"price_down","direction":-1,"pair":4,"id":8,"type":"price"},"16":{"name":"打开涨停板","color":"price_down","direction":-1,"pair":32,"id":16,"type":"price"},"32":{"name":"打开跌停板","color":"price_up","direction":1,"pair":16,"id":32,"type":"price"},"64":{"name":"有大买盘","color":"price_up","direction":1,"pair":128,"id":64,"type":"sl"},"128":{"name":"有大卖盘","color":"price_down","direction":-1,"pair":64,"id":128,"type":"sl"},"8193":{"name":"大笔买入","color":"price_up","direction":1,"pair":8194,"id":8193,"type":"sl"},"8194":{"name":"大笔卖出","color":"price_down","direction":-1,"pair":8193,"id":8194,"type":"sl"},"8201":{"name":"火箭发射","color":"price_up","direction":1,"pair":8204,"id":8201,"type":"change"},"8202":{"name":"快速反弹","color":"price_up","direction":1,"pair":8203,"id":8202,"type":"change"},"8203":{"name":"高台跳水","color":"price_down","direction":-1,"pair":8202,"id":8203,"type":"change"},"8204":{"name":"加速下跌","color":"price_down","direction":-1,"pair":8201,"id":8204,"type":"change"},"8207":{"name":"竞价上涨","color":"price_up","direction":1,"pair":8208,"id":8207,"type":"change"},"8208":{"name":"竞价下跌","color":"price_down","direction":-1,"pair":8207,"id":8208,"type":"change"},"8209":{"name":"高开5日线","color":"price_up","direction":1,"pair":8210,"id":8209,"type":"change"},"8210":{"name":"低开5日线","color":"price_down","direction":-1,"pair":8209,"id":8210,"type":"change"},"8211":{"name":"向上缺口","color":"price_up","direction":1,"pair":8212,"id":8211,"type":"change"},"8212":{"name":"向下缺口","color":"price_down","direction":-1,"pair":8211,"id":8212,"type":"change"},"8213":{"name":"60日新高","color":"price_up","direction":1,"pair":8214,"id":8213,"type":"price"},"8214":{"name":"60日新低","color":"price_down","direction":-1,"pair":8213,"id":8214,"type":"price"},"8215":{"name":"60日大幅上涨","color":"price_up","direction":1,"pair":8216,"id":8215,"type":"change"},"8216":{"name":"60日大幅下跌","color":"price_down","direction":-1,"pair":8215,"id":8216,"type":"change"}};

/**
 * 解析 tm（数字时间）为 "HH:MM:SS" 格式
 * 示例：110916 → "11:09:16"，92500 → "09:25:00"
 * @param {number} tm - 时间数字
 * @returns {string}
 */
function parseTMTime(tm) {
    var s = String(tm);
    while (s.length < 6) s = '0' + s;
    return s.slice(0, 2) + ':' + s.slice(2, 4) + ':' + s.slice(4, 6);
}

/**
 * 判断是否为竞价时间（9:25 之前）
 * @param {number} tm - 时间数字
 * @returns {boolean}
 */
function isChangeAuctionTime(tm) {
    var s = String(tm);
    while (s.length < 6) s = '0' + s;
    var h = parseInt(s.slice(0, 2), 10);
    var m = parseInt(s.slice(2, 4), 10);
    if (h < 9) return false;
    if (h === 9 && m <= 25) return true;
    if (h === 9 && m > 25) return false;
    if (h > 9) return false;
    return false;
}

/**
 * 格式化 info 数值显示，根据不同类型显示不同的信息
 * @param {string} rawInfo - 原始 info 字符串
 * @param {number} typeId - 异动类型 ID
 * @returns {string} 格式化后的显示文本
 */
function formatChangeInfo(rawInfo, typeId) {
    if (!rawInfo) return '';
    const parts = rawInfo.split(',');
    // type 4,8: 封涨停/封跌停 → 显示封单金额（封单股数 * 价格）
    if (typeId === 4 || typeId === 8) {
        // parts: [价格, 封单股数, 价格, 涨幅]
        if (parts.length >= 3) {
            const price = parseFloat(parts[0]) || 0;
            const blockShares = parseFloat(parts[1]) || 0;
            const amount = price * blockShares;
            return '封单 ' + formatAmount(amount);
        }
        return rawInfo;
    }
    // type 16,32: 打开涨停/打开跌停 → 显示涨幅
    if (typeId === 16 || typeId === 32) {
        // parts: [价格, 涨幅]
        if (parts.length >= 2) {
            const pct = parseFloat(parts[1]) || 0;
            return (pct * 100).toFixed(2) + '%';
        }
        return rawInfo;
    }
    // type 64,128,8193,8194: 有大买盘/有大卖盘/大笔买入/大笔卖出 → 显示成交额
    if (typeId === 64 || typeId === 128 || typeId === 8193 || typeId === 8194) {
        // parts: [股数, 价格, 涨幅, 成交额]
        if (parts.length >= 4) {
            const turnover = parseFloat(parts[3]) || 0;
            return formatAmount(turnover);
        }
        return rawInfo;
    }
    // type 8201,8202,8203,8204: 火箭发射/快速反弹/高台跳水/加速下跌 → 显示涨幅
    if (typeId === 8201 || typeId === 8202 || typeId === 8203 || typeId === 8204) {
        // parts: [涨幅, 价格, 涨幅]
        if (parts.length >= 1) {
            const pct = parseFloat(parts[0]) || 0;
            return (pct * 100).toFixed(2) + '%';
        }
        return rawInfo;
    }
    // 其他类型，使用原始逻辑提取第一个值
    const firstVal = rawInfo.indexOf(",") >= 0 ? rawInfo.substring(0, rawInfo.indexOf(",")) : rawInfo;
    return firstVal;
}

/**
 * 获取 JSONP 格式的数据
 * @param {string} url - JSONP 请求 URL
 * @returns {Promise<object>}
 */
async function getJSONPData(url) {
    const res = await fetch(url);
    const text = await res.text();
    const firstParen = text.indexOf('(');
    const lastParen = text.lastIndexOf(')');
    if (firstParen === -1 || lastParen === -1 || lastParen < firstParen) {
        throw new Error('返回内容不是标准的 JSONP 格式');
    }
    const jsonString = text.substring(firstParen + 1, lastParen);
    return JSON.parse(jsonString);
}

/**
 * 从东方财富接口加载异动数据
 * 轮询机制（每5秒）保证了不同时刻的数据都能被捕获
 */
async function loadStockChange() {
    const t = Date.now();
    const type = '8201,8202,8193,4,32,64,8204,8203,8194,8,16,128';
    const cb = `jQuery35106807083396247275_${t}`;
    const pageindex = 0;
    const pagesize = 100;
    const dpt = 'wzchanges';
    const ut = '7eea3edcaed734bea9cbfc24409ed989';
    const url =
        `https://push2ex.eastmoney.com/getAllStockChanges?type=${type}&cb=${cb}&pageindex=${pageindex}&pagesize=${pagesize}&dpt=${dpt}&ut=${ut}&_=${t}`;

    try {
        const result = await getJSONPData(url);
        let list = [];
        if (result?.data?.allstock) list = result.data.allstock;
        if (!list || list.length === 0) return;

        let newIntradayItems = [];
        for (const item of list) {
            // 真实字段: tm, c, m, n, t, i
            // 过滤：只保留 60/00/3/688 开头且非 ST/*ST 的股票
            const code = item.c || '';
            const name = item.n || '';
            if (!/^(60|00|3|688)\d+$/.test(code)) continue;
            if (/^(\*ST|ST)/.test(name)) continue;

            // 竞价时间内的封涨停/封跌停 → 永久保留
            if (isChangeAuctionTime(item.tm) && (item.t === 4 || item.t === 8)) {
                const key = makeChangeKey({
                    code: code,
                    time: item.tm,
                    price: item.i ? item.i.split(',')[0] : ''
                });
                if (!STATE.auctionSet.has(key)) {
                    STATE.auctionSet.add(key);
                    STATE.persistentAuction.push(item);
                }
                continue;
            }

            // 跳过竞价时段的其他类型数据，避免混入盘中
            if (isChangeAuctionTime(item.tm)) continue;

            // 盘中数据
            const key = makeChangeKey({
                code: code,
                time: item.tm,
                price: item.i ? item.i.split(',')[0] : ''
            });
            if (!STATE.changeSet.has(key)) {
                STATE.changeSet.add(key);
                newIntradayItems.push(item);
            }
        }
        if (newIntradayItems.length > 0) {
            STATE.changes = STATE.changes.concat(newIntradayItems);
            STATE.changes.sort((a, b) => {
                return (b.tm || 0) - (a.tm || 0);
            });
            if (STATE.changes.length > 500) STATE.changes = STATE.changes.slice(0, 500);
        }
        renderChanges();
    } catch (err) {
        console.error('[异动] 加载失败:', err);
    }
}

/**
 * 渲染异动列表（竞价 + 盘中）
 * 竞价数据来自 STATE.persistentAuction（永久保留），盘中数据来自 STATE.changes
 */
function renderChanges() {
    // 竞价数据：倒序排列，显示全部
    const auctionItems = STATE.persistentAuction.slice().sort((a, b) => (b.tm || 0) - (a.tm || 0));

    // 盘中数据：从 STATE.changes
    const intradayItems = STATE.changes.slice(0, 200);
    renderChangeList('auctionList', auctionItems, '竞价');
    renderChangeList('intradayList', intradayItems, '盘中');
    document.getElementById('auctionCount').textContent = auctionItems.length + ' 条';
    document.getElementById('intradayCount').textContent = intradayItems.length + ' 条';
}

// 预创建空白模板用于 DOM 克隆
var _changeItemProto = null;
function _getChangeItemProto() {
    if (!_changeItemProto) {
        var div = document.createElement('div');
        div.className = 'change-item';
        div.innerHTML = '<span class="time"></span><span class="type-indicator"></span><span class="name"></span><span class="code"></span><span class="type-name"></span><span class="desc"></span>';
        _changeItemProto = div;
    }
    return _changeItemProto.cloneNode(true);
}

/**
 * 渲染单个异动列表（使用 DocumentFragment 批量 DOM 操作避免 innerHTML 性能问题）
 * @param {string} containerId - 容器元素 ID
 * @param {Array} items - 异动条目数组
 * @param {string} label - 列表标签（竞价/盘中）
 */
function renderChangeList(containerId, items, label) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="change-empty">暂无' + label + '数据</div>';
        return;
    }
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        // 真实字段: tm, c, m, n, t, i
        var name = item.n || '--';
        var code = item.c || '--';
        var timeStr = parseTMTime(item.tm);
        var typeId = item.t || 0;
        var typeObj = CHANGE_TYPES[String(typeId)];
        var typeName = typeObj ? typeObj.name : '异动';
        var infoDisplay = formatChangeInfo(item.i || '', typeId);

        // 根据 type 方向确定颜色
        var isUp = typeObj && typeObj.direction === 1;
        var isDown = typeObj && typeObj.direction === -1;
        var indicatorCls = isUp ? 'up' : (isDown ? 'down' : '');
        var descCls = isUp ? 'up' : (isDown ? 'down' : '');

        var el = _getChangeItemProto();
        el.querySelector('.time').textContent = timeStr;
        el.querySelector('.type-indicator').className = 'type-indicator ' + indicatorCls;
        el.querySelector('.name').textContent = name;
        el.querySelector('.code').textContent = code;
        el.querySelector('.type-name').className = 'type-name ' + descCls;
        el.querySelector('.type-name').textContent = typeName;
        el.querySelector('.desc').className = 'desc ' + descCls;
        el.querySelector('.desc').textContent = infoDisplay;
        fragment.appendChild(el);
    }
    container.replaceChildren(fragment);
}

/**
 * 启动异动轮询
 * @param {number} interval - 轮询间隔 (ms)
 */
function startChangePolling(interval = 5000) {
    loadStockChange();
    if (STATE.changeTimer) clearInterval(STATE.changeTimer);
    STATE.changeTimer = setInterval(loadStockChange, interval);
}