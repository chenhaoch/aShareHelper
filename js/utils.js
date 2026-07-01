// ============================================================
//  工具函数
// ============================================================

/**
 * 将时间戳格式化为 "HH:MM:SS"
 */
function formatTime(ts) {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
}

/**
 * 获取当前时间的本地化字符串
 */
function getNowStr() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
}

/**
 * 解析趋势字符串中的时间 (返回 "HH:MM")
 * @param {string} str - 趋势数据字符串
 * @returns {string|null}
 */
function parseTrendTimeStr(str) {
    const parts = str.split(',');
    if (parts.length < 8) return null;
    const t = parts[0].trim();
    const spaceIdx = t.indexOf(' ');
    if (spaceIdx === -1) return null;
    return t.substring(spaceIdx + 1);
}

/**
 * 判断是否为今日数据 (根据日期)
 * @param {string} str - 趋势数据字符串
 * @returns {boolean}
 */
function isTodayTrend(str) {
    const parts = str.split(',');
    if (parts.length < 8) return false;
    const datePart = parts[0].trim().split(' ')[0];
    if (!datePart) return false;
    const today = new Date().toISOString().slice(0, 10);
    return datePart === today;
}

/**
 * 将 "HH:MM" 转换为交易分钟数 (0~240, 去掉午休)
 * @param {string} timeStr - 时间字符串 "HH:MM"
 * @returns {number} -1 表示无效时间
 */
function timeToTradingMinute(timeStr) {
    if (!timeStr) return -1;
    const parts = timeStr.split(':');
    if (parts.length < 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    // 9:30 ~ 11:30 => 0~120
    if (h < 11 || (h === 11 && m <= 30)) {
        const mins = (h - 9) * 60 + (m - 30);
        return Math.max(0, Math.min(120, mins));
    }
    // 13:00 ~ 15:00 => 121~240
    if (h >= 13 && h <= 15) {
        const mins = (h - 13) * 60 + m + 120;
        return Math.min(240, Math.max(121, mins));
    }
    return -1;
}

/**
 * 生成异动唯一 key（用于去重）
 * @param {object} item - 异动条目
 * @returns {string}
 */
function makeChangeKey(item) {
    const code = item.code || item.zqdm || '';
    const time = item.time || item.sj || '';
    const price = item.price || item.zxj || '';
    return `${code}_${time}_${price}`;
}

/**
 * 判断是否竞价时间 (9:25 之前)
 * @param {string} timeStr - 时间字符串
 * @returns {boolean}
 */
function isAuctionTime(timeStr) {
    if (!timeStr) return false;
    const t = timeStr.replace(/:/g, '');
    if (t.length >= 4) {
        const hour = parseInt(t.slice(0, 2), 10);
        const min = parseInt(t.slice(2, 4), 10);
        if (hour < 9) return false;
        if (hour === 9 && min <= 25) return true;
        if (hour === 9 && min > 25) return false;
        if (hour > 9) return false;
    }
    return false;
}

/**
 * 格式化金额
 * @param {number} v - 金额数值
 * @returns {string}
 */
function formatAmount(v) {
    if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
    if (v >= 1e4) return (v / 1e4).toFixed(2) + '万';
    return v.toFixed(2);
}