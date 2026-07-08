// ============================================================
//  应用常量配置
// ============================================================

/**
 * 指数配置
 * code: 指数代码
 * name: 显示名称
 * color: 分时线颜色
 * secId: SSE 连接的 secid 参数
 * ndays: 请求天数 (普通指数1天，成交额首次2天后续1天)
 */
const INDEX_CONFIG = {
    '000001': { name: '上证指数', color: '#1890ff', secId: '1.000001', ndays: 1, isAmount: false },
    '399006': { name: '创业板指', color: '#1890ff', secId: '0.399006', ndays: 1, isAmount: false },
    '000688': { name: '科创50',   color: '#1890ff', secId: '1.000688', ndays: 1, isAmount: false },
    '159740': { name: '恒生科技', color: '#1890ff', secId: '0.159740', ndays: 1, isAmount: false },
    '800004': { name: '全A成交额', color: '#1890ff', secId: '47.800004', ndays: 2, isAmount: true },
};

/** 指数代码列表 */
const INDEX_CODES = Object.keys(INDEX_CONFIG);

/** 普通指数代码（非成交额） */
const PRICE_INDEX_CODES = INDEX_CODES.filter(c => !INDEX_CONFIG[c].isAmount);

/** SSE 基础 URL */
const SSE_BASE = {
    push2: 'https://15.push2.eastmoney.com',
    push2his: 'https://15.push2his.eastmoney.com',
};

/** SSE 公共路径参数 */
const SSE_COMMON_PATH =
    '/api/qt/stock/trends2/sse?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f17' +
    '&fields2=f51,f52,f53,f54,f55,f56,f57,f58&mpi=1000' +
    '&ut=fa5fd1943c7b386f172d6893dbfba10b&iscr=0&iscca=0&wbp2u=|0|0|0|web';

/** 涨跌分布接口配置 */
const ZDFB_API = {
    baseUrl: 'https://push2ex.eastmoney.com/getTopicZDFenBu',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    dpt: 'wz.ztzt',
};

/** 涨跌停对比趋势接口配置 */
const ZDT_API = {
    baseUrl: 'https://push2ex.eastmoney.com/getTopicZDTCount',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    dpt: 'wz.ztzt',
};

/** 异动接口配置 */
const CHANGE_API = {
    baseUrl: 'https://push2ex.eastmoney.com/getAllStockChanges',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    dpt: 'wzchanges',
    types: '8201,8202,8193,4,32,64,8204,8203,8194,8,16,128,8207,8208',
    pagesize: 64,
    pollingInterval: 5000,
    maxIntradayItems: 200,
    maxChanges: 500,
};

/** 异动类型配置 */
const CHANGE_TYPES = {
    "4":   { name: "封涨停板",   color: "price_up",   direction: 1,  pair: 8,  id: 4,   type: "price" },
    "8":   { name: "封跌停板",   color: "price_down", direction: -1, pair: 4,  id: 8,   type: "price" },
    "16":  { name: "打开涨停板", color: "price_down", direction: -1, pair: 32, id: 16,  type: "price" },
    "32":  { name: "打开跌停板", color: "price_up",   direction: 1,  pair: 16, id: 32,  type: "price" },
    "64":  { name: "有大买盘",   color: "price_up",   direction: 1,  pair: 128,id: 64,  type: "sl" },
    "128": { name: "有大卖盘",   color: "price_down", direction: -1, pair: 64, id: 128, type: "sl" },
    "8193":{ name: "大笔买入",   color: "price_up",   direction: 1,  pair: 8194,id: 8193, type: "sl" },
    "8194":{ name: "大笔卖出",   color: "price_down", direction: -1, pair: 8193,id: 8194, type: "sl" },
    "8201":{ name: "火箭发射",   color: "price_up",   direction: 1,  pair: 8204,id: 8201, type: "change" },
    "8202":{ name: "快速反弹",   color: "price_up",   direction: 1,  pair: 8203,id: 8202, type: "change" },
    "8203":{ name: "高台跳水",   color: "price_down", direction: -1, pair: 8202,id: 8203, type: "change" },
    "8204":{ name: "加速下跌",   color: "price_down", direction: -1, pair: 8201,id: 8204, type: "change" },
    "8207":{ name: "竞价上涨",   color: "price_up",   direction: 1,  pair: 8208,id: 8207, type: "change" },
    "8208":{ name: "竞价下跌",   color: "price_down", direction: -1, pair: 8207,id: 8208, type: "change" },
    "8209":{ name: "高开5日线",  color: "price_up",   direction: 1,  pair: 8210,id: 8209, type: "change" },
    "8210":{ name: "低开5日线",  color: "price_down", direction: -1, pair: 8209,id: 8210, type: "change" },
    "8211":{ name: "向上缺口",   color: "price_up",   direction: 1,  pair: 8212,id: 8211, type: "change" },
    "8212":{ name: "向下缺口",   color: "price_down", direction: -1, pair: 8211,id: 8212, type: "change" },
    "8213":{ name: "60日新高",   color: "price_up",   direction: 1,  pair: 8214,id: 8213, type: "price" },
    "8214":{ name: "60日新低",   color: "price_down", direction: -1, pair: 8213,id: 8214, type: "price" },
    "8215":{ name: "60日大幅上涨", color: "price_up",   direction: 1,  pair: 8216,id: 8215, type: "change" },
    "8216":{ name: "60日大幅下跌", color: "price_down", direction: -1, pair: 8215,id: 8216, type: "change" },
};

/** 交易时间常量（分钟） */
const TRADING = {
    OPEN: 570,    // 9:30 开盘分钟
    NOON: 690,    // 11:30 午休开始分钟
    AFTERNOON: 780, // 13:00 下午开盘分钟
    CLOSE: 900,   // 15:00 收盘分钟
    AUCTION_END: 565, // 9:25 竞价截止分钟
};