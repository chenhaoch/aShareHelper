// ============================================================
//  简易事件总线（发布/订阅模式）
//  用于解耦数据层和渲染层
// ============================================================

const EventBus = (function () {
    /** 事件名 → Set<回调函数> */
    const _listeners = {};

    return {
        /**
         * 订阅事件
         * @param {string} event - 事件名
         * @param {Function} fn - 回调函数
         * @returns {Function} 取消订阅的函数
         */
        on(event, fn) {
            if (!_listeners[event]) {
                _listeners[event] = new Set();
            }
            _listeners[event].add(fn);
            // 返回取消订阅函数
            return () => {
                _listeners[event].delete(fn);
            };
        },

        /**
         * 取消订阅
         * @param {string} event - 事件名
         * @param {Function} fn - 回调函数
         */
        off(event, fn) {
            if (_listeners[event]) {
                _listeners[event].delete(fn);
            }
        },

        /**
         * 触发事件
         * @param {string} event - 事件名
         * @param {*} data - 传递的数据
         */
        emit(event, data) {
            const fns = _listeners[event];
            if (!fns || fns.size === 0) return;
            // 使用 forEach 确保所有回调都被调用
            // 用 try-catch 包装，防止单个回调异常影响其他
            fns.forEach(fn => {
                try {
                    fn(data);
                } catch (e) {
                    console.error(`[EventBus] 事件 "${event}" 回调执行出错:`, e);
                }
            });
        },

        /**
         * 移除指定事件的所有监听器
         * @param {string} event - 事件名（可选，不传则清空所有）
         */
        clear(event) {
            if (event) {
                delete _listeners[event];
            } else {
                Object.keys(_listeners).forEach(k => delete _listeners[k]);
            }
        }
    };
})();