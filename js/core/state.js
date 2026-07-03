// ============================================================
//  应用状态管理
//  基于事件总线的响应式状态
// ============================================================

const AppState = (function () {
    // ---- 私有状态 ----

    /** 指数数据索引 */
    const _indexData = {};

    /** 每个指数的昨日收盘价 */
    const _prePrices = {};

    /** 是否已初始化 */
    let _initialized = false;

    /** 异动去重 Set */
    const _changeSet = new Set();

    /** 盘中异动列表 */
    let _intradayChanges = [];

    /** 竞价涨停/跌停数据（持久保留） */
    let _persistentAuction = [];

    /** 竞价去重 Set */
    const _auctionSet = new Set();

    /** 异动轮询定时器 ID */
    let _changeTimer = null;

    // ---- 公共 API ----

    const api = {

        // ---- 指数数据 ----

        /**
         * 获取指数存储对象（按需初始化）
         */
        getIndexData(code) {
            if (!_indexData[code]) {
                const cfg = INDEX_CONFIG[code];
                if (cfg.isAmount) {
                    _indexData[code] = {
                        today: new Map(),
                        yesterday: new Map(),
                        todayCumulative: [],
                        yesterdayCumulative: [],
                    };
                } else {
                    _indexData[code] = new Map();
                }
            }
            return _indexData[code];
        },

        /**
         * 设置昨日收盘价
         */
        setPrePrice(code, price) {
            if (price > 0) {
                _prePrices[code] = price;
            }
        },

        /**
         * 获取昨日收盘价
         */
        getPrePrice(code) {
            return _prePrices[code] || 0;
        },

        // ---- 初始化 ----

        get initialized() { return _initialized; },
        set initialized(v) { _initialized = v; },

        // ---- 异动数据 ----

        get changeSet() { return _changeSet; },
        get auctionSet() { return _auctionSet; },

        get intradayChanges() { return _intradayChanges; },
        set intradayChanges(v) { _intradayChanges = v; },

        get persistentAuction() { return _persistentAuction; },
        set persistentAuction(v) { _persistentAuction = v; },

        get changeTimer() { return _changeTimer; },
        set changeTimer(v) { _changeTimer = v; },
    };

    return api;
})();