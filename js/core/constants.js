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

/**
 * 同花顺板块白名单（逗号分隔字符串，运行时转为 Set）
 * 只有在此列表中的同花顺板块才会被存储到缓存中。
 * 手动录入和韭研公社导入的板块不受此限制。
 * 已存储的数据不受影响，可通过 batchRemoveSectorByList 自行清理。
 *
 * 管理方式：直接编辑此字符串，逗号或中文逗号分隔即可。
 */
const SECTOR_ALLOW_LIST_RAW = '公告,5G,融资融券,深股通,港股通,沪股通,股权转让(并购重组),ST板块,证金持股,摘帽,举牌,'+
    '2026中报预增,2026一季报预增,碳交易,参股保险,其他,化债概念(AMC概念),福建自贸区,上海国企改革,福建自贸区,中韩自贸区，'+
    '中字头股票,黑龙江自贸区,上海自贸区,广东自贸区,天津自贸区,参股银行,'+
    '同花顺漂亮100,互联网保险,期货概念,区块链,智慧政务,数据要素,数字经济,网红经济,职业教育,参股券商,数据确权,语音技术,'+
    '京津冀一体化,一带一路,西部大开发,知识产权保护,人民币贬值受益,雄安新区,土地流转,雅下水电概念,乡村振兴,生态农业,碳中和,'+
    '新型城镇化,京津冀一体化,新疆振兴,新型工业化,百度概念,时空大数据,三胎概念,横琴新区,粤港澳大湾区,军民融合,污水处理,'+
    '仿制药一致性评价,3D打印,PM2.5,幽门螺杆菌概念,垃圾分类,土壤修复,核污染防治,两轮车,阿尔茨海默概念,养老概念,一体化压铸,'+
    '智能穿戴,独角兽概念,海工装备,星闪概念,车联网(车路协同),猴痘概念,长安汽车概念,基因测序,抽水蓄能,机器视觉,碳中和,'+
    'Web3.0,飞行汽车(eVTOL),央企国企改革,国企改革,智慧城市,智慧政务,家庭医生,EDR概念,海南自贸区,消毒剂,虚拟现实,元宇宙,'+
    '工业互联网,换电概念,特斯拉概念,MR(混合现实),富士康概念,海峡两岸,智能座舱,物联网,ERP概念,NFT概念,海峡两岸,碳交易,'+
    '充电桩,中俄贸易概念,智能医疗,长三角一体化,创投,信创,超超临界发电,俄乌冲突概念,电子身份证,AI语料,虚拟数字人,数字乡村,数字孪生,'+
    '财税数字化,C2M概念,细胞免疫治疗,共同富裕示范区,6G概念,ETC,生物质能发电,合成生物,肝炎概念,工业大麻,高铁,安防,家用电器,'+
    '维生素,多模态AI,AI视频,F5G概念,无线耳机,WiFi 6,大飞机,汽车热管理,智慧灯杆,智能物流,人脸识别,固废处理,染料,网络安全,'+
    'AI眼镜,智能音箱,可降解塑料,露营经济,体育产业,动力电池回收,'+
    
    '光刻机设备应用,半导体超洁净材料,合作华为,AI音视频,广电';
/*
批量删除代码，方便管理
batchRemoveSectorByList(SECTOR_ALLOW_LIST_RAW.split(/[,，]/).map(s => s.trim()).filter(Boolean))
*/

/** SECTOR_ALLOW_LIST_RAW 的 Set 形式，运行时按需使用 */
const SECTOR_ALLOW_SET = new Set(SECTOR_ALLOW_LIST_RAW.split(/[,，]/).map(s => s.trim()).filter(Boolean));
