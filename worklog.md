# A股盯盘 - 重构与优化工作日志

## 总体目标

- 代码结构分层清晰，职责单一
- 引入专业图表库 Lightweight Charts 替代手写 Canvas
- 性能优化：增量绘制、减少重排、数据去重优化、内存管理
- 为新需求（涨跌对比、涨跌停趋势、板块信息）预留扩展点

---

## 分阶段实施计划

### Phase 1: 基础设施搭建 + 图表库引入
- [ ] 创建 `js/core/` 目录：constants.js（常量配置）、event-bus.js（事件总线）、state.js（重构状态管理）
- [ ] 引入 Lightweight Charts CDN
- [ ] 更新 `index.html`：统一入口 + 新 script 引用
- [ ] 验证：页面正常加载，Lightweight Charts 可用

### Phase 2: 图表重构
- [ ] 实现 `js/render/chart-renderer.js`：使用 Lightweight Charts 替换手写 Canvas
- [ ] 实现子图：MACD 子图（用库的 Histogram + LineSeries）
- [ ] 成交额对比图重构（今日 vs 昨日 + 差额柱状图）
- [ ] 回调函数重新编排：数据到图表的单向流动
- [ ] 验证：分时图、MACD、成交额对比图均正常显示

### Phase 3: 数据层重构
- [ ] 实现 `js/data/index-data.js`：SSE 数据获取 + 数据合并，通过事件总线通知渲染层
- [ ] 实现 `js/data/change-data.js`：异动 JSONP 获取、去重、轮询逻辑分离
- [ ] 实现 `js/data/storage.js`：localStorage 缓存（昨日成交额数据、竞价数据）
- [ ] 重构 `js/render/index-cards.js`：DOM 更新与数据分离
- [ ] 重构 `js/render/change-list.js`：增量 DOM 更新
- [ ] 验证：所有数据正常显示

### Phase 4: 网络与性能优化
- [ ] SSE 断线重连（指数退避）
- [ ] 昨日成交额仅请求一次
- [ ] 异动轮询防抖（请求未返回时跳过下次轮询）
- [ ] Set 大小上限 + 时间窗口清理
- [ ] chart.data 改用 Map 实现 O(1) 去重
- [ ] 验证：性能提升，控制台无错误

### Phase 5: 交互优化与扩展点
- [ ] 图表交互优化（十字光标、tooltip）
- [ ] Canvas 线宽调整（更细的线条）
- [ ] 涨跌对比/涨跌停趋势的扩展接口预留
- [ ] 板块数据获取与存储的扩展接口预留
- [ ] 最终验证

---

## 进度记录

| 日期 | 阶段 | 状态 | 备注 |
|------|------|------|------|
| 2026-07-03 | Phase 1 | ✅ 完成 | 核心模块、图表库、事件总线、入口重构完成 |
| 2026-07-03 | Phase 2 | ✅ 完成 | MACD 子图(Histogram+Line)、成交额对比(今日/昨日/差额)、事件驱动 |
| 2026-07-03 | Phase 3 | ✅ 完成 | 数据层、存储层完成，事件驱动单向数据流 |
| 2026-07-03 | Phase 4 | ✅ 完成 | SSE重连、防抖、Map去重、Set清理已在代码中实现 |
| 2026-07-03 | Phase 5 | ✅ 完成 | 线宽调整(1.2/0.8px)、扩展接口预留 |

---

## 技术选型

- **图表库**: Lightweight Charts v4.1.3 (TradingView)
- **状态管理**: 自定义事件总线（发布/订阅）
- **存储**: localStorage（缓存昨日数据、竞价数据）
- **数据获取**: SSE（指数趋势）+ JSONP（异动数据）

## 注意事项

- 保持原生 HTML/JS，不引入构建工具
- 每次 Phase 完成后更新本文件
- 每阶段完成后进行回归验证