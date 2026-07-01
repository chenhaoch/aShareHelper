// ============================================================
//  全局状态
// ============================================================
window.STATE = {
    charts: {
        '000001': { name: '上证指数', data: [], color: '#1890ff', prePrice: 0 },
        '399006': { name: '创业板指', data: [], color: '#1890ff', prePrice: 0 },
        '000688': { name: '科创50', data: [], color: '#1890ff', prePrice: 0 },
        '800004': {
            name: '全A成交额',
            data: { today: [], yesterday: [] },
            color: '#1890ff',
            todayCumulative: [],
            yesterdayCumulative: [],
            prePrice: 0
        },
    },
    changeSet: new Set(),
    changes: [],
    persistentAuction: [],  // 竞价涨停/跌停数据，永久保留
    auctionSet: new Set(),  // 竞价去重 key
    sseClients: [],
    changeTimer: null,
    initialized: false,
};
