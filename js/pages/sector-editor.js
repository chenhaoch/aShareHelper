// ============================================================
//  板块维护页面入口 — sector-editor.html
//  依赖：constants.js, event-bus.js, state.js, storage.js, sector-data.js
// ============================================================

(function () {
    'use strict';

    function getLastTradingDay() {
        const now = new Date();
        const day = now.getDay();
        if (day === 0) now.setDate(now.getDate() - 2);
        else if (day === 6) now.setDate(now.getDate() - 1);
        return now.toISOString().slice(0, 10);
    }

    function init() {
        SectorData.initSectorData();
        StorageManager.autoSaveSectors();
        document.getElementById('jiuyanDate').value = getLastTradingDay();
        bindEvents();
        refreshMaintainedList();

        // 关闭页面前强制保存板块数据，不依赖5分钟间隔
        window.addEventListener('beforeunload', function () {
            StorageManager.saveAllSectors(AppState.sectorCache);
        });

        // 批量删除板块后刷新列表
        EventBus.on('sector:batch-cleaned', refreshMaintainedList);
    }

    function bindEvents() {
        document.getElementById('btnParseJiuyan').addEventListener('click', parseJiuyanJson);
        document.getElementById('manualCode').addEventListener('input', function (e) {
            const raw = e.target.value.replace(/^(sh|sz|bj)/i, '').replace(/\D/g, '');
            if (raw.length === 6) autoQuery(raw);
        });
        document.getElementById('btnSaveManual').addEventListener('click', saveManualSectors);
        document.getElementById('searchMaintained').addEventListener('input', refreshMaintainedList);
        document.getElementById('btnRefreshList').addEventListener('click', refreshMaintainedList);
        document.getElementById('btnBatchDelete').addEventListener('click', function () {
            document.getElementById('batchDeletePanel').style.display = 'block';
            document.getElementById('batchSectorName').value = '';
            document.getElementById('batchResultArea').style.display = 'none';
            document.getElementById('batchSectorName').focus();
        });
        document.getElementById('btnBatchClose').addEventListener('click', function () {
            document.getElementById('batchDeletePanel').style.display = 'none';
        });
        document.getElementById('btnBatchFind').addEventListener('click', batchFindSector);
        document.getElementById('batchSectorName').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') batchFindSector();
        });
        document.getElementById('btnBatchConfirm').addEventListener('click', batchConfirmDelete);
        document.getElementById('btnBatchCancel').addEventListener('click', function () {
            document.getElementById('batchDeletePanel').style.display = 'none';
        });
    }

    // ============================================================
    //  1. 韭研公社导入
    // ============================================================
    function parseJiuyanJson() {
        const raw = document.getElementById('jiuyanJsonInput').value.trim();
        if (!raw) { showResult('jiuyanResult', '请先粘贴 JSON 数据', 'warning'); return; }

        let result;
        try { result = JSON.parse(raw); }
        catch (e) { showResult('jiuyanResult', 'JSON 格式错误', 'error'); return; }

        if (!result || !result.data || !Array.isArray(result.data)) {
            showResult('jiuyanResult', 'JSON 缺少 data 数组', 'error');
            return;
        }

        let matchCount = 0, codeCount = 0;
        const importedCodes = new Set();

        for (const group of result.data) {
            if (!group.action_field_id || !group.name || !Array.isArray(group.list)) continue;
            const mainSectorName = group.name;
            for (const stock of group.list) {
                const rawCode = stock.code || '';
                const code = rawCode.replace(/^(sh|sz|bj)/i, '');
                if (!code) continue;
                const stockName = stock.name || '';
                if (/^(\*ST|ST)/.test(stockName)) continue;

                SectorData.mergeJiuyanSector(code, mainSectorName, stockName);
                importedCodes.add(code);
                matchCount++;

                const expound = stock.article && stock.article.action_info && stock.article.action_info.expound;
                if (expound) {
                    const summary = expound.split('\n')[0];
                    if (summary) {
                        const subSectors = summary.split('+').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
                        for (const sub of subSectors) {
                            SectorData.mergeJiuyanSector(code, sub, stockName);
                            matchCount++;
                        }
                    }
                }
            }
            codeCount++;
        }

        const msg = '导入完成！' + codeCount + ' 个分类，' + matchCount + ' 条关系，' + importedCodes.size + ' 只个股';
        showResult('jiuyanResult', msg, 'success');
        refreshMaintainedList();
    }

    // ============================================================
    //  2. 手动录入（自动查询 + 逗号分隔）
    // ============================================================
    var _currentManualCode = '';

    function autoQuery(code) {
        if (!/^\d{6}$/.test(code)) return;
        var cached = AppState.getSectorCache(code);
        if (!cached) {
            _currentManualCode = '';
            return;
        }
        _currentManualCode = code;
        var stockName = cached.stockName || '';
        document.getElementById('manualName').value = stockName;
        // 加载全部来源板块，按 weight 排序展示
        var allSectors = [];
        if (cached.sectors && cached.sectors.length > 0) {
            allSectors = cached.sectors.map(function (s) { return s.name; });
        }
        document.getElementById('manualSectorsInput').value = allSectors.join('，');
        renderManualTagList();
    }

    function _getSectorsFromInput() {
        var raw = document.getElementById('manualSectorsInput').value;
        return raw.split(/[,，、\s]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    }

    function renderManualTagList() {
        var sectors = _getSectorsFromInput();
        var container = document.getElementById('manualTagList');
        container.innerHTML = '';
        for (var i = 0; i < sectors.length; i++) {
            (function (idx) {
                var tag = document.createElement('span');
                tag.className = 'tag-item';
                tag.innerHTML = sectors[idx] + '<span class="remove" data-index="' + idx + '">\u00d7</span>';
                tag.querySelector('.remove').addEventListener('click', function () {
                    var s = _getSectorsFromInput();
                    s.splice(idx, 1);
                    document.getElementById('manualSectorsInput').value = s.join('，');
                    renderManualTagList();
                });
                container.appendChild(tag);
            })(i);
        }
    }

    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'manualSectorsInput') {
            renderManualTagList();
        }
    });

    function saveManualSectors() {
        if (!_currentManualCode) {
            var raw = document.getElementById('manualCode').value.replace(/^(sh|sz|bj)/i, '').replace(/\D/g, '');
            if (raw.length === 6) _currentManualCode = raw;
        }
        if (!_currentManualCode) { showSaveMsg('请输入6位股票代码', '#ff4d4f'); return; }
        var sectors = _getSectorsFromInput();
        if (sectors.length === 0) { showSaveMsg('请输入板块名称', '#ff4d4f'); return; }
        var stockName = document.getElementById('manualName').value.trim();
        // 使用 replaceSectors 保留已存在的来源信息（同花顺、韭研），新增的标为 manual
        SectorData.replaceSectors(_currentManualCode, sectors, stockName);
        showSaveMsg('已保存 ' + sectors.length + ' 个板块', '#52c41a');
        updateSingleRow(_currentManualCode);
    }

    function showSaveMsg(msg, color) {
        var el = document.getElementById('manualSaveResult');
        el.textContent = msg;
        el.style.color = color;
    }

    // ============================================================
    //  3. 已维护列表
    // ============================================================
    // ponytail: 缓存行模板减少 DOM 创建开销
    var _sectorTagTitle = { manual: '手动录入', jiuyan: '韭研公社', tonghuashun: '同花顺' };

    function _buildRowTr(code) {
        var cached = AppState.getSectorCache(code);
        if (!cached) return null;
        var tr = document.createElement('tr');
        tr.dataset.code = code;
        var tdCode = document.createElement('td');
        tdCode.className = 'code-cell';
        tdCode.textContent = code;
        tr.appendChild(tdCode);
        var tdName = document.createElement('td');
        tdName.className = 'name-cell';
        tdName.textContent = cached.stockName || '--';
        tr.appendChild(tdName);
        var tdSectors = document.createElement('td');
        var tagContainer = document.createElement('div');
        tagContainer.className = 'tag-list';
        if (cached.sectors) {
            for (var j = 0; j < cached.sectors.length; j++) {
                var s = cached.sectors[j];
                var tag = document.createElement('span');
                tag.className = 'sector-tag ' + (s.source === 'more' ? 'more' : s.source);
                tag.textContent = s.name;
                tag.title = _sectorTagTitle[s.source] || s.source;
                tagContainer.appendChild(tag);
            }
        }
        tdSectors.appendChild(tagContainer);
        tr.appendChild(tdSectors);
        var tdTime = document.createElement('td');
        tdTime.style.fontSize = '11px';
        tdTime.style.color = '#86909c';
        if (cached.updatedAt) {
            tdTime.textContent = new Date(cached.updatedAt).toLocaleString('zh-CN', { hour12: false });
        } else {
            tdTime.textContent = '--';
        }
        tr.appendChild(tdTime);
        var tdAction = document.createElement('td');
        tdAction.className = 'action-cell';
        var btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-default';
        btnEdit.textContent = '编辑';
        btnEdit.style.marginRight = '3px';
        btnEdit.addEventListener('click', function () { document.getElementById('manualCode').value = code; autoQuery(code); });
        var btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-danger';
        btnDelete.textContent = '删除';
        btnDelete.addEventListener('click', function () { if (confirm('确定删除 ' + code + ' 的板块数据？')) { SectorData.removeSectorCache(code); refreshMaintainedList(); } });
        tdAction.appendChild(btnEdit);
        tdAction.appendChild(btnDelete);
        tr.appendChild(tdAction);
        return tr;
    }

    /**
     * 更新/插入单行 DOM，不清空重建全表
     * @param {string} code - 标准化后的个股代码
     */
    function updateSingleRow(code) {
        var tbody = document.getElementById('maintainedTbody');
        if (!tbody) return;
        var existing = tbody.querySelector('tr[data-code="' + code + '"]');
        var newTr = _buildRowTr(code);
        if (!newTr) {
            if (existing) existing.remove();
            return;
        }
        if (existing) {
            existing.replaceWith(newTr);
        } else {
            tbody.appendChild(newTr);
        }
        // 更新计数
        var rows = tbody.querySelectorAll('tr').length;
        document.getElementById('maintainedCount').textContent = rows + ' 只';
        var emptyEl = document.getElementById('maintainedEmpty');
        emptyEl.style.display = rows === 0 ? 'block' : 'none';
        document.getElementById('maintainedTableWrapper').style.display = rows === 0 ? 'none' : 'block';
    }

    function refreshMaintainedList() {
        var searchText = document.getElementById('searchMaintained').value.trim().toLowerCase();
        var codes = SectorData.getAllCachedCodes();
        var tbody = document.getElementById('maintainedTbody');
        var emptyEl = document.getElementById('maintainedEmpty');
        tbody.innerHTML = '';
        var filtered = codes;
        if (searchText) {
            filtered = codes.filter(function (code) {
                if (code.toLowerCase().includes(searchText)) return true;
                var cached = AppState.getSectorCache(code);
                if (cached) {
                    if (cached.stockName && cached.stockName.toLowerCase().includes(searchText)) return true;
                    if (cached.sectors) return cached.sectors.some(function (s) { return s.name.toLowerCase().includes(searchText); });
                }
                return false;
            });
        }
        if (filtered.length === 0) {
            emptyEl.style.display = 'block';
            document.getElementById('maintainedTableWrapper').style.display = 'none';
            document.getElementById('maintainedCount').textContent = '0 只';
            return;
        }
        emptyEl.style.display = 'none';
        document.getElementById('maintainedTableWrapper').style.display = 'block';
        document.getElementById('maintainedCount').textContent = filtered.length + ' 只';
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < filtered.length; i++) {
            var tr = _buildRowTr(filtered[i]);
            if (tr) fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
    }

    function showResult(elementId, msg, type) {
        var el = document.getElementById(elementId);
        el.style.display = 'block';
        el.className = 'result-box ' + (type || 'info');
        el.innerHTML = '<pre>' + msg + '</pre>';
    }

    // ============================================================
    //  4. 批量删除板块
    // ============================================================
    var _batchSectorName = '';

    function batchFindSector() {
        var name = document.getElementById('batchSectorName').value.trim();
        if (!name) return;
        _batchSectorName = name;
        var stocks = SectorData.findStocksBySector(name);
        var resultArea = document.getElementById('batchResultArea');
        var infoEl = document.getElementById('batchMatchInfo');
        var listEl = document.getElementById('batchStockList');

        if (stocks.length === 0) {
            infoEl.textContent = '未找到含 "' + name + '" 相关板块的个股';
            listEl.innerHTML = '';
            resultArea.style.display = 'block';
            return;
        }

        infoEl.textContent = '匹配到 ' + stocks.length + ' 只个股（模糊匹配 "' + name + '"）：';
        listEl.innerHTML = '';
        for (var i = 0; i < stocks.length; i++) {
            var item = document.createElement('div');
            item.className = 'stock-item';
            item.innerHTML = '<span class="code">' + stocks[i].code + '</span>' + stocks[i].stockName + ' <span class="sector-tag" style="font-size:10px;">' + stocks[i].matchedSector + '</span>';
            listEl.appendChild(item);
        }
        resultArea.style.display = 'block';
    }

    function batchConfirmDelete() {
        if (!_batchSectorName) return;
        if (!confirm('确认从所有个股中删除匹配 "' + _batchSectorName + '" 的板块？此操作不可撤销。')) return;
        var result = SectorData.batchRemoveSector(_batchSectorName);
        document.getElementById('batchDeletePanel').style.display = 'none';
        refreshMaintainedList();
        if (result.affected > 0) {
            var removedStr = result.removed.slice(0, 5).join('、');
            if (result.removed.length > 5) removedStr += ' 等';
            Toast.success('已从 ' + result.affected + ' 只个股中删除 ' + result.removed.length + ' 个板块：' + removedStr);
        } else {
            Toast.info('没有符合的板块数据需要删除');
        }
        _batchSectorName = '';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();