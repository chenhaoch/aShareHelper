{name: '顶级买单', color: 'price_up', direction: 1, pair: 2, id: 1, …}
{name: '顶级卖单', color: 'price_down', direction: -1, pair: 1, id: 2, …}
{name: '封涨停板', color: 'price_up', direction: 1, pair: 8, id: 4, …}
{name: '封跌停板', color: 'price_down', direction: -1, pair: 4, id: 8, …}
{name: '打开涨停板', color: 'price_down', direction: -1, pair: 32, id: 16, …}
{name: '打开跌停板', color: 'price_up', direction: 1, pair: 16, id: 32, …}


{name: '有大买盘', color: 'price_up', direction: 1, pair: 128, id: 64, …} 
{name: '有大卖盘', color: 'price_down', direction: -1, pair: 64, id: 128, …} 
{name: '机构买单', color: 'price_up', direction: 1, pair: 512, id: 256, …} 
{name: '机构卖单', color: 'price_down', direction: -1, pair: 256, id: 512, …} 


{name: '大笔买入', color: 'price_up', direction: 1, pair: 8194, id: 8193, …} 
{name: '大笔卖出', color: 'price_down', direction: -1, pair: 8193, id: 8194, …} 
{name: '拖拉机买', color: 'price_up', direction: 1, pair: 8196, id: 8195, …} 
{name: '拖拉机卖', color: 'price_down', direction: -1, pair: 8195, id: 8196, …} 

{name: '火箭发射', color: 'price_up', direction: 1, pair: 8204, id: 8201, …} 
{name: '快速反弹', color: 'price_up', direction: 1, pair: 8203, id: 8202, …} 
{name: '高台跳水', color: 'price_down', direction: -1, pair: 8202, id: 8203, …} 
{name: '加速下跌', color: 'price_down', direction: -1, pair: 8201, id: 8204, …} 


{name: '买入撤单', color: 'price_down', direction: -1, pair: 8026, id: 8205, …} 
{name: '卖出撤单', color: 'price_up', direction: 1, pair: 8205, id: 8206, …} 
{name: '竞价上涨', color: 'price_up', direction: 1, pair: 8208, id: 8207, …} 
{name: '竞价下跌', color: 'price_down', direction: -1, pair: 8207, id: 8208, …} 



获取个股所属板块列表：
调用接口`https://basic.10jqka.com.cn/fuyao/f10_stock_index/concept/v1/stock_concept_list?simple=1&market_id={marketId}&code={code}`
marketId根据code确地，60开头选择17,00和30开头选择32,688开头选择16
获取到返回结果res，板块列表是res.data。它的格式是：
res.data: [
    {
      "concept_id": 308832,  // 板块id
      "etf_code": "562950", // 相关etf
      "name": "PCB概念",  // 板块名称
      "quote_code": "885959",  // 板块同花顺code
      "weight": 2,  // 排序
    }
]



竞价显示个股板块，以及封单金额
异动显示个股板块，已经更多具体信息。 筛选清楚更多异动类型