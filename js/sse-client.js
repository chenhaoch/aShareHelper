// ============================================================
//  SSE 数据获取 (大盘指数)
// ============================================================

/**
 * 创建 SSE 数据连接客户端
 * @param {string} url - SSE 服务 URL
 * @param {object} callbacks - 回调函数 { onMessage, onError, onOpen }
 * @returns {{ close: Function, source: EventSource }}
 */
function createSSEClient(url, callbacks = {}) {
    const { onMessage, onError, onOpen } = callbacks;
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data);
            if (onMessage) onMessage(parsed);
        } catch (e) {
            console.error('[SSE 解析失败]', event.data);
            if (onError) onError(new Error('数据解析异常'));
        }
    };
    eventSource.onopen = (event) => {
        console.log(`[SSE] 连接已建立: ${url}`);
        if (onOpen) onOpen(event);
    };
    eventSource.onerror = (event) => {
        console.error(`[SSE] 连接异常: ${url}`, event);
        if (onError) onError(event);
    };
    return {
        close: () => {
            console.log(`[SSE] 手动关闭: ${url}`);
            eventSource.close();
        },
        source: eventSource,
    };
}

/**
 * 加载所有大盘指数的趋势数据 (SSE 连接)
 * @returns {Array} SSE 客户端数组
 */
function loadIndexDateTrends() {
    const baseDomain = 'https://15.push2.eastmoney.com';
    const hisDomain = 'https://15.push2his.eastmoney.com';
    const basePath = `/api/qt/stock/trends2/sse?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f17&fields2=f51,f52,f53,f54,f55,f56,f57,f58&mpi=1000&ut=fa5fd1943c7b386f172d6893dbfba10b&iscr=0&iscca=0&wbp2u=|0|0|0|web`;

    const clients = [];
    const c1 = createSSEClient(`${baseDomain}${basePath}&ndays=1&secid=1.000001`, {
        onMessage: (data) => { if (data?.data?.trends) updateIndexDisplay('000001', data.data); }
    });
    clients.push(c1);
    const c2 = createSSEClient(`${baseDomain}${basePath}&ndays=1&secid=0.399006`, {
        onMessage: (data) => { if (data?.data?.trends) updateIndexDisplay('399006', data.data); }
    });
    clients.push(c2);
    const c3 = createSSEClient(`${baseDomain}${basePath}&ndays=1&secid=1.000688`, {
        onMessage: (data) => { if (data?.data?.trends) updateIndexDisplay('000688', data.data); }
    });
    clients.push(c3);
    const c4 = createSSEClient(`${hisDomain}${basePath}&ndays=2&secid=47.800004`, {
        onMessage: (data) => { if (data?.data?.trends) updateIndexDisplay('800004', data.data); }
    });
    clients.push(c4);

    STATE.sseClients = clients;
    return clients;
}