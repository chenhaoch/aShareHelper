// ============================================================
//  异动数据模块
//  负责 JSONP 获取、去重、轮询，通过事件总线通知渲染层
// ============================================================

(function () {
    'use strict';

    /** 轮询标志 */
    let _isPolling = false;

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
                    const auction = AppState.persistentAuction;
                    auction.push(item);
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

            // 渲染
            renderAllChanges();
        }
    }

    /**
     * 渲染所有异动列表
     */
    function renderAllChanges() {
        // 竞价数据倒序
        const auctionItems = AppState.persistentAuction
            .slice()
            .sort((a, b) => (b.tm || 0) - (a.tm || 0));

        // 盘中数据
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
            loadChanges();
            if (AppState.changeTimer) clearInterval(AppState.changeTimer);
            AppState.changeTimer = setInterval(() => loadChanges(), interval || CHANGE_API.pollingInterval);
        },

        /** 停止轮询 */
        stopPolling() {
            if (AppState.changeTimer) {
                clearInterval(AppState.changeTimer);
                AppState.changeTimer = null;
            }
        },

        /** 手动触发一次加载 */
        loadOnce: loadChanges,
    };
})();