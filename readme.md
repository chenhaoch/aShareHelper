

# 板块信息
1. 同花顺根据个股获取板块列表
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

2. 韭研公社获取当日异动涨停
请求：

```js
fetch("https://app.jiuyangongshe.com/jystock-app/api/v1/action/field", {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9",
    "content-type": "application/json",
    "platform": "3",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "timestamp": "1783086762968",
    "token": "dc2a8c86eb475932411671b4dfa95e14"
  },
  "referrer": "https://www.jiuyangongshe.com/",
  "body": "{\"date\":\"2026-07-03\",\"pc\":1}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});
```
// Uu0KfOB8iUP69d3c:{time}, 在通过计算得出token
返回结果：
```js
{
  "data": [
    {"action_field_id": "xxxx",
      "list": [{"code": "sh603137", "name": "恒尚节能","article":{"action_info": {"expound": "xxx"}}} ],
      "name": "机器人"  // 异动分类，
    }
  ]
}
```
最外层的action_field_id如果没有，那就跳过，name表示异动个股列表的原因分类，可以当做板块。
list的内容中code表示个股code，需要去除前两位字符。 name是个股名称，expound是异动原因描述，异动原因根据`\n`拆分后，第一条字符串就是异动原因概要。






1. 韭研公社 的token问题  OK 
2. 韭研公社获取数据筛选问题  复盘手动筛选
3. 板块筛选，数据整理  手动整理个股板块对应关系



