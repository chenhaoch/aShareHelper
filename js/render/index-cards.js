// ============================================================
//  指数卡片 DOM 渲染器
//  负责更新指数卡片中的 sub 信息和头部数据
// ============================================================

(function () {
    'use strict';

    /**
     * 更新单个指数卡片的 sub 信息（涨跌幅/价格）
     * @param {string} code - 指数代码
     * @param {object} info - { price, change, changePct, prePrice, amountDiff? }
     */
    function updateCardSub(code, info) {
        const subEl = document.getElementById(`sub_${code}`);
        if (!subEl) return;

        const cfg = INDEX_CONFIG[code];
        if (!cfg) return;

        if (cfg.isAmount) {
            // 成交额显示差额
            if (info.amountDiff != null) {
                const sign = info.amountDiff > 0 ? '+' : '';
                const cls = info.amountDiff > 0 ? 'text-up' : (info.amountDiff < 0 ? 'text-down' : 'text-flat');
                subEl.innerHTML = `<span class="${cls}">${sign}${(info.amountDiff / 1e8).toFixed(2)}亿</span>`;
            } else {
                subEl.textContent = '';
            }
        } else if (info.price != null && info.prePrice > 0) {
            // ponytail: 只显示点数xxx(+xx%)
            const sign = info.change >= 0 ? '+' : '';
            const cls = info.change >= 0 ? 'text-up' : 'text-down';
            subEl.innerHTML =
                `<span class="${cls}">${info.price.toFixed(2)} (${sign}${info.changePct.toFixed(2)}%)</span>`;
        } else if (info.price != null) {
            subEl.textContent = info.price.toFixed(2);
        } else {
            subEl.textContent = '--';
        }

        // 成交额预估更新
        if (cfg.isAmount && info.estimatedTotal != null) {
            const nameEl = document.getElementById(`name_${code}`);
            if (nameEl) {
                const fmt = info.estimatedTotal >= 1e8
                    ? (info.estimatedTotal / 1e8).toFixed(2) + '亿'
                    : (info.estimatedTotal / 1e4).toFixed(2) + '万';
                nameEl.textContent = `全A成交额 预估${fmt}`;
            }
        } else if (cfg.isAmount) {
            const nameEl = document.getElementById(`name_${code}`);
            if (nameEl) {
                nameEl.textContent = `全A成交额`;
            }
        }
    }

    window.IndexCardsRenderer = {
        updateCardSub,
    };
})();