

# 板块信息
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

# 涨跌比，涨跌停比


# 优化


# 界面调整

