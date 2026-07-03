// ============================================================
//  异动列表 DOM 渲染器
//  负责渲染竞价列表和盘中异动列表
// ============================================================

(function () {
    'use strict';

    /** DOM 模板缓存 */
    let _changeItemProto = null;

    function _getChangeItemProto() {
        if (!_changeItemProto) {
            const div = document.createElement('div');
            div.className = 'change-item';
            div.innerHTML =
                '<span class="time"></span>' +
                '<span class="type-indicator"></span>' +
                '<span class="name"></span>' +
                '<span class="code"></span>' +
                '<span class="type-name"></span>' +
                '<span class="desc"></span>';
            _changeItemProto = div;
        }
        return _changeItemProto.cloneNode(true);
    }

    /**
     * 解析数字时间 "HH:MM:SS"
     */
    function parseTMTime(tm) {
        const s = String(tm).padStart(6, '0');
        return s.slice(0, 2) + ':' + s.slice(2, 4) + ':' + s.slice(4, 6);
    }

    /**
     * 格式化 info 显示
     */
    function formatChangeInfo(rawInfo, typeId) {
        if (!rawInfo) return '';
        const parts = rawInfo.split(',');
        if (typeId === 4 || typeId === 8) {
            if (parts.length >= 3) {
                const price = parseFloat(parts[0]) || 0;
                const blockShares = parseFloat(parts[1]) || 0;
                const amount = price * blockShares;
                return '封单 ' + (amount >= 1e8 ? (amount / 1e8).toFixed(2) + '亿' : (amount / 1e4).toFixed(2) + '万');
            }
            return rawInfo;
        }
        if (typeId === 16 || typeId === 32) {
            if (parts.length >= 2) {
                return (parseFloat(parts[1]) * 100).toFixed(2) + '%';
            }
            return rawInfo;
        }
        if (typeId === 64 || typeId === 128 || typeId === 8193 || typeId === 8194) {
            if (parts.length >= 4) {
                const turnover = parseFloat(parts[3]) || 0;
                return turnover >= 1e8 ? (turnover / 1e8).toFixed(2) + '亿' : (turnover / 1e4).toFixed(2) + '万';
            }
            return rawInfo;
        }
        if (typeId === 8201 || typeId === 8202 || typeId === 8203 || typeId === 8204) {
            if (parts.length >= 1) {
                return (parseFloat(parts[0]) * 100).toFixed(2) + '%';
            }
            return rawInfo;
        }
        const firstVal = rawInfo.indexOf(',') >= 0 ? rawInfo.substring(0, rawInfo.indexOf(',')) : rawInfo;
        return firstVal;
    }

    /**
     * 渲染单个异动列表
     */
    function renderChangeList(containerId, items, label) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="change-empty">暂无' + label + '数据</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const name = item.n || '--';
            const code = item.c || '--';
            const timeStr = parseTMTime(item.tm);
            const typeId = item.t || 0;
            const typeObj = CHANGE_TYPES[String(typeId)];
            const typeName = typeObj ? typeObj.name : '异动';
            const infoDisplay = formatChangeInfo(item.i || '', typeId);

            const isUp = typeObj && typeObj.direction === 1;
            const isDown = typeObj && typeObj.direction === -1;
            const indicatorCls = isUp ? 'up' : (isDown ? 'down' : '');
            const descCls = isUp ? 'up' : (isDown ? 'down' : '');

            const el = _getChangeItemProto();
            el.querySelector('.time').textContent = timeStr;
            el.querySelector('.type-indicator').className = 'type-indicator ' + indicatorCls;
            el.querySelector('.name').textContent = name;
            el.querySelector('.code').textContent = code;
            el.querySelector('.type-name').className = 'type-name ' + descCls;
            el.querySelector('.type-name').textContent = typeName;
            el.querySelector('.desc').className = 'desc ' + descCls;
            el.querySelector('.desc').textContent = infoDisplay;
            fragment.appendChild(el);
        }
        container.replaceChildren(fragment);
    }

    window.ChangeListRenderer = {
        renderChangeList,
        parseTMTime,
        formatChangeInfo,
    };
})();