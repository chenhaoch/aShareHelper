

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
东方财富涨停行情：https://quote.eastmoney.com/ztb/?from=center

涨跌分布：https://push2ex.eastmoney.com/getTopicZDFenBu?cb=callbackdata6936951&ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&_=1782996817390
涨跌停对比趋势：https://push2ex.eastmoney.com/getTopicZDTCount?cb=callbackdata9331851&ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&time=0&_=1782996817391


# 优化

部分数据可以存在本地，这样刷新也能直接使用。

# 界面调整
左1放3个指数分时，成交额，涨跌对比，涨跌停趋势
左2放竞价，异动
