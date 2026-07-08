// ============================================================
//  异动数据模块
//  负责 JSONP 获取、去重、轮询，通过事件总线通知渲染层
// ============================================================

(function () {
    'use strict';

    /** 轮询标志 */
    let _isPolling = false;
    /** 是否首次请求（首次不受交易时段限制） */
    let _firstRequest = true;
    /** 竞价数据是否已保存（盘中数据首次到达时保存一次） */
    let _auctionSavedOnce = false;
    /** 异动开关（关闭后不再请求数据，保留已有列表） */
    let _enabled = true;

    /**
     * 判断当前是否在交易时段内
     * 只在交易日 9:15~11:35 和 12:55~15:05 发送请求
     */
    function isTradingTime() {
        const now = new Date();
        // 周六(6)和周日(0)不交易
        const day = now.getDay();
        if (day === 0 || day === 6) return false;
        const t = now.getHours() * 100 + now.getMinutes();
        // 上午 9:15~11:35, 下午 12:55~15:05
        return (t >= 915 && t <= 1135) || (t >= 1255 && t <= 1505);
    }

    /**
     * 统一异动过滤：code格式、名称、各类型阈值
     * @param {object} item - 单条异动数据
     * @param {boolean} isAuction - 是否为竞价时段（由调用方传入）
     */
    function shouldKeepChangeItem(item, isAuction) {
        const code = item.c || '';
        const name = item.n || '';

        // 1. 代码格式过滤
        if (!/^(60|00|3|688)\d+$/.test(code)) {
            return false;
        }
        // 2. 名称 ST 过滤
        if (/^(\*ST|ST)/.test(name)) {
            return false;
        }

        const typeId = item.t || 0;
        const parts = (item.i || '').split(',');
        const tm = item.tm || 0;
        if (isAuction) {
            // 竞价只保留 4(封涨停)、8(封跌停)、8207(竞价上涨≥6%)、8208(竞价下跌≤-6%)
            if (typeId === 4 || typeId === 8) return true;
            if (typeId === 8207) {
                const pct = parseFloat(parts[0]);
                if (isNaN(pct) || pct <= 0.06) {
                    return false;
                }
                return true;
            }
            if (typeId === 8208) {
                const pct = parseFloat(parts[0]);
                if (isNaN(pct) || pct >= -0.06) {
                    return false;
                }
                return true;
            }
            return false;
        }

        // 盘中：大买/大卖类型需成交额 >1000 万
        if (typeId === 64 || typeId === 128 || typeId === 8193 || typeId === 8194) {
            const turnover = parseFloat(parts[3]) || 0;
            if (turnover <= 1e7) {
                return false;
            }
            return true;
        }
        // 盘中：火箭发射/快速反弹需涨幅 >7%
        if (typeId === 8201 || typeId === 8202) {
            const pct = parseFloat(parts[0]);
            if (isNaN(pct) || pct <= 0.07) {
                return false;
            }
            return true;
        }
        // 其他类型直接通过
        return true;
    }

    /**
     * 生成异动唯一 key
     */
    function makeChangeKey(item) {
        const code = item.code || item.c || '';
        const time = item.time || item.tm || '';
        const price = item.price || (item.i ? item.i.split(',')[0] : '');
        return `${code}_${time}_${price}`;
    }

    /**
     * 获取 JSONP 格式数据
     */
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

    /**
     * 加载异动数据
     */
    async function loadChanges() {
        if (!_enabled) return; // ponytail: 开关关闭后不再请求

        // 首次请求不受交易时段限制（确保开盘前能获取竞价数据）
        // 之后的轮询只在交易时段内发送
        if (!_firstRequest && !isTradingTime()) return;

        if (_isPolling) return; // 防抖：上次请求未完成跳过
        _isPolling = true;

        const t = Date.now();
        const cb = `jQuery_${t}`;
        const url =
            `${CHANGE_API.baseUrl}?type=${CHANGE_API.types}&cb=${cb}` +
            `&pageindex=0&pagesize=${CHANGE_API.pagesize}` +
            `&dpt=${CHANGE_API.dpt}&ut=${CHANGE_API.ut}&_=${t}`;

        try {
            const result = await fetchJSONP(url);
            const list = result?.data?.allstock;
            if (!list || list.length === 0) return;

            processChangeItems(list);
        } catch (err) {
            console.error('[ChangeData] 异动加载失败:', err);
        } finally {
            _isPolling = false;
            _firstRequest = false; // 首次请求完成，后续需判断交易时段
        }
    }

    /**
     * 判断条目时间是否属于竞价时段（<9:30）
     */
    function isAuctionTime(tm) {
        const s = String(tm || 0).padStart(6, '0');
        const hh = parseInt(s.slice(0, 2), 10);
        const mm = parseInt(s.slice(2, 4), 10);
        return hh < 9 || (hh === 9 && mm < 30);
    }

    /**
     * 处理异动条目：过滤、去重、分类
     */
    function processChangeItems(list) {
        let newIntradayItems = [];
        let hasNewAuction = false;

        for (const item of list) {
            const isAuction = isAuctionTime(item.tm);
            // 统一过滤，传入 isAuction 避免重复解析时间
            if (!shouldKeepChangeItem(item, isAuction)) continue;

            const code = item.c || '';
            if (isAuction) {
                const key = makeChangeKey({
                    code,
                    time: item.tm,
                    price: item.i ? item.i.split(',')[0] : '',
                });
                if (!AppState.auctionSet.has(key)) {
                    AppState.auctionSet.add(key);
                    // ponytail: 接口按时间降序返回，新数据插到前面，渲染时无需再排序
                    AppState.persistentAuction.unshift(item);
                    hasNewAuction = true;
                }
            } else {
                const key = makeChangeKey({
                    code,
                    time: item.tm,
                    price: item.i ? item.i.split(',')[0] : '',
                });
                if (!AppState.changeSet.has(key)) {
                    AppState.changeSet.add(key);
                    newIntradayItems.push(item);
                }
            }
        }

        if (newIntradayItems.length > 0 || hasNewAuction) {
            if (newIntradayItems.length > 0) {
                // ponytail: 首次收到盘中数据时，竞价时段已结束，一次性保存竞价数据
                if (!_auctionSavedOnce) {
                    _auctionSavedOnce = true;
                    StorageManager.saveAuctionData(AppState.persistentAuction);
                }

                // ponytail: 接口按时间降序返回，新数据 concat 在前面保持顺序，无需再 sort
                AppState.intradayChanges = newIntradayItems.concat(
                    AppState.intradayChanges
                ).slice(0, CHANGE_API.maxChanges);
            }

            renderAllChanges();
        }
    }

    /**
     * 渲染所有异动列表
     */
    function renderAllChanges() {
        // ponytail: 数据在 processChangeItems 中已按时间降序排列，渲染时无需再排序
        const auctionItems = AppState.persistentAuction.slice();

        const intradayItems = AppState.intradayChanges.slice(0, CHANGE_API.maxIntradayItems);

        ChangeListRenderer.renderChangeList('auctionList', auctionItems, '竞价');
        ChangeListRenderer.renderChangeList('intradayList', intradayItems, '盘中');

        document.getElementById('auctionCount').textContent = auctionItems.length + ' 条';
        document.getElementById('intradayCount').textContent = intradayItems.length + ' 条';
    }

    // ============================================================
    //  公共 API
    // ============================================================

    window.ChangeDataLoader = {
        /** 启动轮询 */
        startPolling(interval) {
            // 立即检查并执行一次（如果在交易时段内）
            loadChanges();
            if (AppState.changeTimer) clearInterval(AppState.changeTimer);
            // 每秒检查一次，但内部 isTradingTime 和 _isPolling 双重控制
            AppState.changeTimer = setInterval(() => loadChanges(), interval || CHANGE_API.pollingInterval);
        },

        /** 停止轮询 */
        stopPolling() {
            if (AppState.changeTimer) {
                clearInterval(AppState.changeTimer);
                AppState.changeTimer = null;
            }
        },

        loadOnce: loadChanges,

        /** 设置异动开关 */
        setEnabled(v) {
            _enabled = v;
            if (v) {
                // ponytail: 重新开启时立即恢复轮询
                _firstRequest = true; // 允许立即触发一次
                loadChanges();
            } else {
                // ponytail: 关闭时只停请求，不清空已有列表
            }
        },
    };
})();
