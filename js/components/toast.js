// ============================================================
//  Toast 通知组件
//  轻量无依赖，自动消失，支持 info / success / warning / error
// ============================================================

(function () {
    'use strict';

    var _container = null;

    function _ensureContainer() {
        if (!_container) {
            _container = document.createElement('div');
            _container.className = 'toast-container';
            _container.setAttribute('aria-live', 'polite');
            document.body.appendChild(_container);
        }
        return _container;
    }

    /**
     * 显示一条 toast 通知
     * @param {string} msg - 消息内容
     * @param {string} [type=info] - info / success / warning / error
     * @param {number} [duration=2500] - 显示时长（毫秒）
     */
    function toast(msg, type, duration) {
        if (!msg) return;
        type = type || 'info';
        duration = duration || 2500;

        var el = document.createElement('div');
        el.className = 'toast-item toast-' + type;
        el.textContent = msg;
        _ensureContainer().appendChild(el);

        // ponytail: 用 requestAnimationFrame 确保 transition 生效
        requestAnimationFrame(function () {
            el.classList.add('toast-visible');
        });

        setTimeout(function () {
            el.classList.remove('toast-visible');
            el.classList.add('toast-hiding');
            setTimeout(function () {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 300);
        }, duration);
    }

    window.Toast = {
        info: function (msg, duration) { toast(msg, 'info', duration); },
        success: function (msg, duration) { toast(msg, 'success', duration); },
        warning: function (msg, duration) { toast(msg, 'warning', duration); },
        error: function (msg, duration) { toast(msg, 'error', duration); },
    };

})();