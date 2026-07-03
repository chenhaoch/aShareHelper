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
     * 判断是否为竞价时间（9:25 之前）
     */
    function isChangeAuctionTime(tm) {
        const s = String(tm).padStart(6, '0');
        const h = parseInt(s.slice(0, 2), 10);
        const m = parseInt(s.slice(2, 4), 10);
        if (h < 9) return false;
        if (h === 9 && m <= 25) return true;
        if (h === 9 && m > 25) return false;
        if (h > 9) return false;
        return false;
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
     * 处理异动条目：过滤、去重、分类
     */
    function processChangeItems(list) {
        let newIntradayItems = [];

        for (const item of list) {
            const code = item.c || '';
            const name = item.n || '';
            // 股票代码过滤
            if (!/^(60|00|3|688)\d+$/.test(code)) continue;
            if (/^(\*ST|ST)/.test(name)) continue;

            // 竞价时间内的封涨停/封跌停 → 永久保留
            if (isChangeAuctionTime(item.tm) && (item.t === 4 || item.t === 8)) {
                const key = makeChangeKey({
                    code,
                    time: item.tm,
                    price: item.i ? item.i.split(',')[0] : '',
                });
                if (!AppState.auctionSet.has(key)) {
                    AppState.auctionSet.add(key);
                    AppState.persistentAuction.push(item);
                }
                continue;
            }

            // 跳过竞价时段的其他类型
            if (isChangeAuctionTime(item.tm)) continue;

            // 盘中数据
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

        if (newIntradayItems.length > 0) {
            let changes = AppState.intradayChanges;
            changes = changes.concat(newIntradayItems);
            changes.sort((a, b) => (b.tm || 0) - (a.tm || 0));
            if (changes.length > CHANGE_API.maxChanges) {
                changes = changes.slice(0, CHANGE_API.maxChanges);
            }
            AppState.intradayChanges = changes;

            renderAllChanges();
        }
    }

    /**
     * 渲染所有异动列表
     */
    function renderAllChanges() {
        const auctionItems = AppState.persistentAuction
            .slice()
            .sort((a, b) => (b.tm || 0) - (a.tm || 0));

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
    };
})();