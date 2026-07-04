# A股盯盘工具

## 功能概览
- 四大指数分时图（上证、创业板、科创50、全A成交额）
- 盘中异动监控（实时轮询）
- 竞价涨停/跌停数据
- 涨跌分布 + 涨跌停趋势图
- **个股板块信息展示**（同花顺 | 韭研公社 | 手动录入）

---

## 板块信息

### 数据来源
板块信息最多展示 **6 个**，按来源优先级排序：

| 优先级 | 来源 | 说明 |
|--------|------|------|
| 🔴 最高 | 手动录入 | 通过 `sector-editor.html` 盘后人工标注 |
| 🟡 次高 | 韭研公社 | 异动数据的 `name` 分类作为板块标签 |
| 🟢 兜底 | 同花顺 | 接口 `weight` 排序，实时按需获取 |

### 数据获取流程
```
异动出现 → 读个股 code
  ├─ 查内存缓存 → 命中 → 直接显示板块标签
  └─ 未命中 → 异步调同花顺接口，显示 ... 占位
              → 返回后合并到缓存 + 持久化 + 局部刷新 UI
```

### 请求去重
同一只股票在首次请求返回前出现多条异动，只会发送 **1 次** 同花顺请求。

### 独立维护页面
`sector-editor.html` 提供三个功能区域：

1. **韭研公社导入**（盘后）
   - 选择日期，点击"获取异动数据"
   - 自动生成 token：`MD5('Uu0KfOB8iUP69d3c:' + timestamp)`
   - 解析返回数据，将异动分类作为板块标签关联到个股
   - 外层的 `name`（异动分类）和 `expound` 中的细分板块（`xxx+xxx+xxx` 格式）都作为板块输出
   - 接口：`POST https://app.jiuyangongshe.com/jystock-app/api/v1/action/field`

2. **手动录入**（盘后）
   - 输入股票代码查询
   - 添加/删除板块标签
   - 保存到本地缓存

3. **已维护列表**
   - 展示所有已缓存板块的个股
   - 支持搜索过滤、编辑、删除

### 板块标签颜色说明
| 颜色 | 来源 |
|------|------|
| 🟠 橙色 | 手动录入 |
| 🔵 蓝色 | 韭研公社 |
| ⚫ 灰色 | 同花顺 |
| ⚪ 虚线 | 超出显示数量（+N） |

---

## 同花顺板块接口

```
GET https://basic.10jqka.com.cn/fuyao/f10_stock_index/concept/v1/stock_concept_list?simple=1&market_id={marketId}&code={code}
```

marketId 规则：60 开头 → 17，00/30 开头 → 32，688 开头 → 16

返回 `res.data` 数组：
```js
res.data: [
    {
      "concept_id": 308832,  // 板块id
      "etf_code": "562950",  // 相关etf
      "name": "PCB概念",     // 板块名称
      "quote_code": "885959",// 板块同花顺code
      "weight": 2,           // 排序权重
    }
]
```

---

## 韭研公社接口

```
POST https://app.jiuyangongshe.com/jystock-app/api/v1/action/field
Headers:
  platform: "3"
  token: MD5("Uu0KfOB8iUP69d3c:" + timestamp)
  content-type: "application/json"
Body: { "date": "YYYY-MM-DD", "pc": 1 }
```

### token 生成方式
```js
// 使用 spark-md5 库
function md5Hash(input) {
  let buffer = new TextEncoder().encode(input).buffer;
  let spark = new SparkMD5.ArrayBuffer();
  spark.append(buffer);
  let rawBinary = spark.end(true);
  return Array.from(rawBinary, ch => ch.charCodeAt(0)
    .toString(16).padStart(2, '0')).join('');
}
const token = md5Hash('Uu0KfOB8iUP69d3c:' + new Date().getTime());
```

### 返回格式
```js
{
  "data": [
    {
      "action_field_id": "xxxx",  // 没有则跳过该组
      "list": [
        {
          "code": "sh603137",       // 个股代码（需去除前两位 sh/sz/bj）
          "name": "恒尚节能",      // 个股名称
          "article": {
            "action_info": {
              "expound": "xxx"     // 异动原因描述，\n 拆分后第一条为概要，格式 xxx+xxx+xxx
            }
          }
        }
      ],
      "name": "机器人"  // 异动分类（作为大板块）
    }
  ]
}
```

**板块解析规则**：
- 外层 `name`（异动分类）作为板块标签
- `expound` 按 `\n` 拆分后取第一条，按 `+` 拆分，每个部分作为细分板块标签



