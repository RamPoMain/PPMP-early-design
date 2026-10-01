/* ============================================================
   DICT PROCUREMENT — BULK IMPORT (Excel template)

   Adds a "Bulk import" button to the request form's top bar (beside
   Close). It opens a small dialog with two steps:
     1. Download template  -> PPMP_Items_Template.xlsx
     2. Upload the filled template -> every row is checked with the
        same rules the form uses, a review dialog shows what is ready
        and what is not, and the valid rows are saved as line items.

   Where the items go
     - New request:  a new Draft PPMP is created using the form's
       PPMP No., Fiscal Year and End-User, and the "Indicative or
       Final" choice made on the form.
     - "Add entry" to an existing Draft PPMP: the items are appended
       to that PPMP.
   The button is hidden while viewing or editing a saved item.

   Not in the spreadsheet: supporting documents. Imported items have
   none, so they are attached later (Edit) before submitting — the
   existing "missing document" check at submit time already covers it.

   Needs: SheetJS (xlsx.full.min.js) loaded before this file, plus
   request-modal.js and dashboard-logic.js on the same page.
   ============================================================ */

(function () {
    'use strict';

    var TEMPLATE_SHEET = 'PPMP Items';
    var TEMPLATE_FILE = 'PPMP_Items_Template.xlsx';
    var MAX_IMPORT_BYTES = 2 * 1024 * 1024;
    var MAX_IMPORT_ROWS = 200;

    // One entry per template column, in display order. `match` finds the
    // column by its header text, so reordering columns or adding extra ones
    // in Excel does not break the import.
    var COLUMNS = [
        { key: 'project_description',     label: 'Description',        match: /description|objective/,        width: 44, header: 'General Description and Objective of the Project to be Procured' },
        { key: 'project_type',            label: 'Type of Project',    match: /type of (the )?project/,       width: 26, header: 'Type of Project (Goods / Consulting Services / Infrastructure)' },
        { key: 'quantity_size',           label: 'Quantity and Size',  match: /quantity|size/,                width: 28, header: 'Quantity and Size of the Project' },
        { key: 'mode',                    label: 'Mode of Procurement',match: /\bmode\b/,                     width: 32, header: 'Recommended Mode of Procurement' },
        { key: 'pre_procurement',         label: 'Pre-Procurement',    match: /pre.?procurement/,             width: 24, header: 'Pre-Procurement Conference (Yes / No)' },
        { key: 'bid_evaluation_criteria', label: 'Bid Criteria',       match: /criteria/,                     width: 40, header: 'Criteria for Bid Evaluation' },
        { key: 'start_date',              label: 'Start date',         match: /^start/,                       width: 22, header: 'Start of Procurement Activity (YYYY-MM-DD)' },
        { key: 'end_date',                label: 'End date',           match: /^end/,                         width: 22, header: 'End of Procurement Activity (YYYY-MM-DD)' },
        { key: 'delivery_period',         label: 'Delivery period',    match: /delivery|implementation/,      width: 26, header: 'Expected Delivery / Implementation Period (YYYY-MM-DD)' },
        { key: 'fund_source',             label: 'Source of Funds',    match: /fund/,                         width: 22, header: 'Source of Funds' },
        { key: 'budget',                  label: 'Budget',             match: /budget/,                       width: 22, header: 'Estimated Budget / Budgetary Allocation (PHP)' },
        { key: 'strategies',              label: 'Strategies',         match: /strateg/,                      width: 40, header: 'Procurement Strategies and Tools (separate with ;)' },
        { key: 'remarks',                 label: 'Remarks',            match: /remark/,                       width: 30, header: 'Remarks' }
    ];

    // ------------------------------------------------------------
    // Small helpers
    // ------------------------------------------------------------

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function str(value) {
        return value == null ? '' : String(value).trim();
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function toast(message) {
        if (typeof showToast === 'function') showToast(message); else alert(message);
    }

    function pesoText(n) {
        return '\u20B1' + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
    }

    // Case-insensitive match of a cell against the allowed values.
    // Returns the canonical spelling, or null.
    function canonical(value, allowed) {
        var v = str(value).toLowerCase();
        if (!v) return null;
        for (var i = 0; i < allowed.length; i++) {
            if (allowed[i].toLowerCase() === v) return allowed[i];
        }
        return null;
    }

    // Allowed values come from the form itself so they never drift from it.
    function readSelectOptions(selectId) {
        var select = document.getElementById(selectId);
        if (!select) return [];
        return Array.prototype.slice.call(select.options)
            .filter(function (o) { return o.value && !o.disabled; })
            .map(function (o) { return o.value.trim(); });
    }

    function readStrategyOptions() {
        return Array.prototype.slice.call(document.querySelectorAll('#strategiesMenu .option'))
            .map(function (o) { return o.textContent.trim(); })
            .filter(Boolean);
    }

    function getAllowedValues() {
        return {
            types: readSelectOptions('project_type'),
            modes: readSelectOptions('modeOfProcurement'),
            yesNo: ['Yes', 'No'],
            criteria: readSelectOptions('bid_evaluation_criteria'),
            strategies: readStrategyOptions()
        };
    }

    // ------------------------------------------------------------
    // Cell parsing
    // ------------------------------------------------------------

    // Accepts an Excel date serial, a Date, "YYYY-MM-DD" or "MM/DD/YYYY".
    // Returns "YYYY-MM-DD" or null.
    function toIsoDate(v) {
        if (v === '' || v == null) return null;
        var y, m, d, dt;

        if (v instanceof Date && !isNaN(v)) {
            y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate();
        } else if (typeof v === 'number' && isFinite(v)) {
            // Excel serial days since 1899-12-30
            dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
            y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
        } else {
            var s = String(v).trim();
            var iso = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(s);
            var us = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
            if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
            else if (us) { m = +us[1]; d = +us[2]; y = +us[3]; }
            else return null;
        }

        dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
        return y + '-' + pad2(m) + '-' + pad2(d);
    }

    // Returns { number, text } or null when the cell is not a valid amount.
    function toBudget(v) {
        if (typeof v === 'number') {
            return isFinite(v) ? { number: v, text: String(v) } : null;
        }
        var cleaned = String(v == null ? '' : v).replace(/[\u20B1,\s]/g, '').replace(/^php/i, '').replace(/^p(?=\d)/i, '');
        if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
        return { number: parseFloat(cleaned), text: cleaned };
    }

    // ------------------------------------------------------------
    // Sheet -> rows
    // ------------------------------------------------------------

    // Maps each column key to its index in the header row.
    function mapHeaders(headerRow) {
        var index = {};
        var used = {};
        (headerRow || []).forEach(function (cell, i) {
            var text = str(cell).toLowerCase().replace(/\s+/g, ' ');
            if (!text) return;
            for (var c = 0; c < COLUMNS.length; c++) {
                var col = COLUMNS[c];
                if (!used[col.key] && col.match.test(text)) {
                    index[col.key] = i;
                    used[col.key] = true;
                    break;
                }
            }
        });
        var missing = COLUMNS.filter(function (col) { return index[col.key] === undefined; });
        return { index: index, missing: missing };
    }

    // Checks one row. Returns { item, errors }. `item` is only set when
    // there are no errors.
    function validateRow(raw, allowed) {
        var errors = [];
        var item = {};

        function text(key) { return str(raw[key]); }

        var description = text('project_description');
        if (description.length < 3) errors.push('Description is required (at least 3 characters).');
        item.project_description = description;

        var type = canonical(raw.project_type, allowed.types);
        if (!type) errors.push('Type of Project must be one of: ' + allowed.types.join(', ') + '.');
        item.project_type = type || '';

        var quantity = text('quantity_size');
        if (quantity.length < 3) errors.push('Quantity and Size is required (at least 3 characters).');
        item.quantity_size = quantity;

        var mode = canonical(raw.mode, allowed.modes);
        if (!mode) errors.push('Mode of Procurement is missing or not one of the valid modes.');
        item.mode = mode || '';

        var pre = canonical(raw.pre_procurement, allowed.yesNo);
        if (!pre) errors.push('Pre-Procurement Conference must be Yes or No.');
        item.pre_procurement = pre || '';

        var criteria = canonical(raw.bid_evaluation_criteria, allowed.criteria);
        if (!criteria) errors.push('Criteria for Bid Evaluation is missing or not one of the valid criteria.');
        item.bid_evaluation_criteria = criteria || '';

        var start = toIsoDate(raw.start_date);
        var end = toIsoDate(raw.end_date);
        var delivery = toIsoDate(raw.delivery_period);
        if (!start) errors.push('Start date is missing or not a valid date (use YYYY-MM-DD).');
        if (!end) errors.push('End date is missing or not a valid date (use YYYY-MM-DD).');
        if (!delivery) errors.push('Delivery period is missing or not a valid date (use YYYY-MM-DD).');
        if (start && end && end < start) errors.push('End date cannot be earlier than the start date.');
        if (end && delivery && delivery <= end) errors.push('Delivery period must be after the end date.');
        item.start_date = start || '';
        item.end_date = end || '';
        item.delivery_period = delivery || '';

        var fund = text('fund_source');
        if (fund.length < 2) errors.push('Source of Funds is required.');
        item.fund_source = fund;

        var budget = toBudget(raw.budget);
        if (!budget) {
            errors.push('Budget must be a valid number.');
        } else if (budget.number <= 0) {
            errors.push('Budget must be greater than 0.');
            budget = null;
        }
        item.budget = budget ? budget.text : '';

        // Same mode/budget bracket rule as the form (request-modal.js).
        if (budget && mode && typeof MODE_BUDGET_BRACKETS !== 'undefined' && typeof getRecommendedMode === 'function') {
            var isBracketMode = MODE_BUDGET_BRACKETS.some(function (tier) { return tier.mode === mode; });
            if (isBracketMode) {
                var recommended = getRecommendedMode(budget.number);
                if (recommended.mode !== mode) {
                    errors.push('Budget of ' + pesoText(budget.number) + ' is in the ' + recommended.label +
                        ' bracket, which requires "' + recommended.mode + '".');
                }
            }
        }

        var strategies = [];
        var unknown = [];
        str(raw.strategies).split(/[;\n|,]+/).forEach(function (part) {
            var name = part.trim();
            if (!name) return;
            var match = canonical(name, allowed.strategies);
            if (match) { if (strategies.indexOf(match) === -1) strategies.push(match); }
            else unknown.push(name);
        });
        if (unknown.length) errors.push('Unknown strategy: ' + unknown.join('; ') + '.');
        else if (strategies.length === 0) errors.push('Select at least one Procurement Strategy.');
        item.strategies = strategies;

        var remarks = text('remarks');
        if (remarks.length < 3) errors.push('Remarks is required (at least 3 characters).');
        item.remarks = remarks;

        item.supporting_documents = [];

        return { item: errors.length ? null : item, errors: errors };
    }

    // Turns the sheet's rows (array of arrays, header first) into a result:
    //   { fatal, ready: [{ rowNumber, item }], problems: [{ rowNumber, errors }], total }
    function analyzeRows(rows, allowed) {
        if (!rows || rows.length === 0) {
            return { fatal: 'The file is empty.', ready: [], problems: [], total: 0 };
        }

        var mapped = mapHeaders(rows[0]);
        if (mapped.missing.length) {
            return {
                fatal: 'These columns were not found: ' + mapped.missing.map(function (c) { return c.label; }).join(', ') +
                    '. Please use the downloaded template and keep its header row.',
                ready: [], problems: [], total: 0
            };
        }

        var ready = [];
        var problems = [];
        var total = 0;

        for (var r = 1; r < rows.length; r++) {
            var cells = rows[r] || [];
            var raw = {};
            var hasData = false;
            COLUMNS.forEach(function (col) {
                var cell = cells[mapped.index[col.key]];
                raw[col.key] = cell;
                if (str(cell) !== '') hasData = true;
            });
            if (!hasData) continue;

            total += 1;
            if (total > MAX_IMPORT_ROWS) {
                return {
                    fatal: 'This file has more than ' + MAX_IMPORT_ROWS + ' items. Please split it into smaller files.',
                    ready: [], problems: [], total: total
                };
            }

            var result = validateRow(raw, allowed);
            if (result.item) ready.push({ rowNumber: r + 1, item: result.item });
            else problems.push({ rowNumber: r + 1, errors: result.errors });
        }

        if (total === 0) {
            return { fatal: 'No filled-in rows were found under the header row.', ready: [], problems: [], total: 0 };
        }

        return { fatal: null, ready: ready, problems: problems, total: total };
    }

    // ------------------------------------------------------------
    // Template download
    // ------------------------------------------------------------

    function downloadTemplate() {
        if (!window.XLSX) {
            toast('The Excel library could not be loaded. Check your internet connection and reload the page.');
            return;
        }

        var allowed = getAllowedValues();
        var wb = XLSX.utils.book_new();

        // Sheet 1: the one people fill in
        var items = XLSX.utils.aoa_to_sheet([COLUMNS.map(function (c) { return c.header; })]);
        items['!cols'] = COLUMNS.map(function (c) { return { wch: c.width }; });
        XLSX.utils.book_append_sheet(wb, items, TEMPLATE_SHEET);

        // Sheet 2: instructions + a worked example
        var brackets = (typeof MODE_BUDGET_BRACKETS !== 'undefined' ? MODE_BUDGET_BRACKETS : []).map(function (t) {
            return '     ' + t.label + '  ->  ' + t.mode;
        });
        var example = [
            'Procurement of 10 laptop computers for field offices',
            allowed.types.indexOf('Goods') !== -1 ? 'Goods' : (allowed.types[0] || ''),
            '10 units',
            'Small Value Procurement (SVP)',
            'No',
            allowed.criteria[0] || '',
            '2026-11-01', '2026-12-15', '2027-01-31',
            'GAA 2027',
            850000,
            allowed.strategies[0] || '',
            'For regional deployment'
        ];
        var instructions = XLSX.utils.aoa_to_sheet([
            ['HOW TO FILL IN THE PPMP ITEMS TEMPLATE'],
            [],
            ['1. Use the "' + TEMPLATE_SHEET + '" sheet. One row = one procurement item. Keep the header row as it is (columns are found by their header text).'],
            ['2. PPMP No., Fiscal Year, End-User and Indicative/Final are NOT in this file. They come from the request form you upload it into.'],
            ['3. Dates: type them as YYYY-MM-DD (for example 2026-11-30). Real Excel date cells also work.'],
            ['4. End of Procurement Activity cannot be before the start. Expected Delivery must be AFTER the end date.'],
            ['5. Estimated Budget: numbers only (commas are fine). The Mode of Procurement must match the budget when it is one of these:'],
            [brackets[0] || ''], [brackets[1] || ''], [brackets[2] || ''],
            ['6. Type of Project, Mode, Pre-Procurement, Bid Criteria and Strategies must match the "Valid Values" sheet (capital letters do not matter).'],
            ['7. Several strategies in one cell: separate them with a semicolon (;).'],
            ['8. Supporting documents cannot be put in this file. Imported items are saved as Draft; open the PPMP, click Edit, and attach each item\'s required document before submitting.'],
            ['9. Rows that fail a check are listed on screen before anything is saved, and only the valid rows are imported.'],
            [],
            ['EXAMPLE ROW (this is only an example; do not leave it in the "' + TEMPLATE_SHEET + '" sheet)'],
            COLUMNS.map(function (c) { return c.header; }),
            example
        ]);
        instructions['!cols'] = [{ wch: 140 }];
        XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');

        // Sheet 3: valid values
        var lists = [
            ['Type of Project', 'Recommended Mode of Procurement', 'Pre-Procurement Conference', 'Criteria for Bid Evaluation', 'Procurement Strategies and Tools']
        ];
        var longest = Math.max(allowed.types.length, allowed.modes.length, allowed.yesNo.length, allowed.criteria.length, allowed.strategies.length);
        for (var i = 0; i < longest; i++) {
            lists.push([
                allowed.types[i] || '', allowed.modes[i] || '', allowed.yesNo[i] || '',
                allowed.criteria[i] || '', allowed.strategies[i] || ''
            ]);
        }
        var valid = XLSX.utils.aoa_to_sheet(lists);
        valid['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 26 }, { wch: 58 }, { wch: 46 }];
        XLSX.utils.book_append_sheet(wb, valid, 'Valid Values');

        XLSX.writeFile(wb, TEMPLATE_FILE);
    }

    // ------------------------------------------------------------
    // Reading the uploaded file
    // ------------------------------------------------------------

    function handleFile(file) {
        if (!file) return;

        if (!window.XLSX) {
            toast('The Excel library could not be loaded. Check your internet connection and reload the page.');
            return;
        }
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
            toast('Please choose an Excel (.xlsx, .xls) or .csv file.');
            return;
        }
        if (file.size > MAX_IMPORT_BYTES) {
            toast('That file is larger than 2 MB. Please split it into smaller files.');
            return;
        }

        var reader = new FileReader();
        reader.onerror = function () { toast('The file could not be read.'); };
        reader.onload = function () {
            var rows;
            try {
                var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
                var sheetName = wb.SheetNames.indexOf(TEMPLATE_SHEET) !== -1 ? TEMPLATE_SHEET : wb.SheetNames[0];
                rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' });
            } catch (err) {
                console.error('Bulk import: could not parse file', err);
                toast('That file could not be read. Is it a valid Excel or CSV file?');
                return;
            }
            showReview(analyzeRows(rows, getAllowedValues()), file.name);
        };
        reader.readAsArrayBuffer(file);
    }

    // ------------------------------------------------------------
    // Where the items will go
    // ------------------------------------------------------------

    function readHeader() {
        var val = function (id) {
            var el = document.getElementById(id);
            return el ? String(el.value || '').trim() : '';
        };
        return {
            ppmp_no: val('ppmp_no'),
            fiscal_year: val('fiscal_year'),
            end_user: val('end_user'),
            is_indicative: val('is_indicative')
        };
    }

    function isAddingToExisting() {
        return typeof currentEditingId !== 'undefined' && !!currentEditingId;
    }

    function describeTarget() {
        var h = readHeader();
        if (isAddingToExisting()) return 'Items will be added to PPMP No. ' + (h.ppmp_no || '-') + '.';
        return 'Items will create a new Draft PPMP: No. ' + (h.ppmp_no || '-') +
            (h.fiscal_year ? ', FY ' + h.fiscal_year : '') + (h.end_user ? ', ' + h.end_user : '') + '.';
    }

    // Saves the items. Mirrors the record shape used by saveProcurementRequest().
    function commitImport(items) {
        var header = readHeader();

        if (!header.is_indicative) {
            if (typeof showFieldError === 'function') {
                showFieldError('is_indicative', 'Select Indicative or Final before importing items.');
            }
            toast('Select "Indicative or Final" on the form first, then import.');
            return false;
        }

        var stamp = Date.now();
        var stamped = items.map(function (item, i) {
            return Object.assign({ id: stamp + i }, item);
        });

        var db = JSON.parse(localStorage.getItem('procurement_records')) || [];
        var session = typeof getSession === 'function' ? getSession() : null;
        var existing = isAddingToExisting() ? db.find(function (r) { return r.id == currentEditingId; }) : null;
        var ppmpNo;

        if (existing) {
            var merged = (typeof getRecordItems === 'function' ? getRecordItems(existing) : []).slice().concat(stamped);
            var updated = Object.assign({}, existing, { items: merged });
            db[db.findIndex(function (r) { return r.id == currentEditingId; })] = updated;
            ppmpNo = updated.ppmp_no;
        } else {
            ppmpNo = header.ppmp_no || (typeof getNextPpmpNumber === 'function' ? String(getNextPpmpNumber()) : 'N/A');
            db.push({
                id: stamp,
                creatorId: session ? session.id : null,
                ppmp_no: ppmpNo,
                is_indicative: header.is_indicative,
                end_user: header.end_user || (session && session.office) || 'N/A',
                fiscal_year: header.fiscal_year || String(new Date().getFullYear()),
                items: stamped,
                status: 'Draft',
                currentApproverRole: null,
                remarksHistory: [],
                date: new Date().toLocaleDateString()
            });
        }

        try {
            localStorage.setItem('procurement_records', JSON.stringify(db));
        } catch (err) {
            console.error('Bulk import: could not save', err);
            toast('The items could not be saved (browser storage is full).');
            return false;
        }

        if (typeof closeRequestModal === 'function') closeRequestModal();
        if (typeof refreshDashboardRecords === 'function') refreshDashboardRecords();

        toast(stamped.length + (stamped.length === 1 ? ' item' : ' items') +
            ' imported under PPMP No. ' + ppmpNo + '. Attach the supporting documents before submitting.');
        return true;
    }

    // ------------------------------------------------------------
    // Dialogs (one at a time): the import dialog and the review dialog
    // ------------------------------------------------------------

    var dialogEl = null;

    function closeDialog() {
        if (dialogEl && dialogEl.parentNode) dialogEl.parentNode.removeChild(dialogEl);
        dialogEl = null;
    }

    // Capture phase so Esc closes only this dialog, not the request form
    // behind it (request-modal.js closes on Esc too).
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', function (e) {
            if (dialogEl && e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeDialog();
            }
        }, true);
    }

    // Builds the overlay + card, shows it, and returns the overlay.
    function openDialog(titleId, innerHtml) {
        closeDialog();
        var overlay = document.createElement('div');
        overlay.className = 'bi-overlay';
        overlay.innerHTML =
            '<div class="bi-dialog" role="dialog" aria-modal="true" aria-labelledby="' + titleId + '">' + innerHtml + '</div>';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDialog(); });
        document.body.appendChild(overlay);
        dialogEl = overlay;
        return overlay;
    }

    // ------------------------------------------------------------
    // Review dialog (after a file has been read)
    // ------------------------------------------------------------

    function showReview(result, fileName) {
        var body = '';
        if (result.fatal) {
            body = '<p class="bi-fatal">' + esc(result.fatal) + '</p>';
        } else {
            body += '<div class="bi-summary">' +
                '<span class="bi-chip is-ok">' + result.ready.length + ' ready</span>' +
                (result.problems.length ? '<span class="bi-chip is-bad">' + result.problems.length + ' with problems</span>' : '') +
                '<span class="bi-chip">' + result.total + ' rows read</span></div>';

            if (result.problems.length) {
                body += '<h4 class="bi-sub">Rows that need fixing (they will be skipped)</h4><ul class="bi-problems">' +
                    result.problems.map(function (p) {
                        return '<li><strong>Row ' + p.rowNumber + '</strong><ul>' +
                            p.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></li>';
                    }).join('') + '</ul>';
            }

            if (result.ready.length) {
                var shown = result.ready.slice(0, 8);
                body += '<h4 class="bi-sub">Ready to import</h4><div class="bi-table-wrap"><table class="bi-table"><thead><tr>' +
                    '<th>Row</th><th>Description</th><th>Type</th><th>Mode</th><th>Budget</th></tr></thead><tbody>' +
                    shown.map(function (r) {
                        return '<tr><td>' + r.rowNumber + '</td><td>' + esc(r.item.project_description) + '</td><td>' +
                            esc(r.item.project_type) + '</td><td>' + esc(r.item.mode) + '</td><td>' +
                            esc(pesoText(parseFloat(r.item.budget))) + '</td></tr>';
                    }).join('') + '</tbody></table></div>' +
                    (result.ready.length > shown.length
                        ? '<p class="bi-more">and ' + (result.ready.length - shown.length) + ' more</p>' : '');
                body += '<p class="bi-note">' + esc(describeTarget()) +
                    ' Supporting documents are not part of the file, so attach them to each item (Edit) before submitting.</p>';
            }
        }

        var canImport = !result.fatal && result.ready.length > 0;
        var overlay = openDialog('biReviewTitle',
            '<h3 id="biReviewTitle">Review import</h3>' +
            '<p class="bi-file">' + esc(fileName) + '</p>' +
            '<div class="bi-dialog-body">' + body + '</div>' +
            '<div class="bi-dialog-actions">' +
                '<button type="button" class="bi-btn is-secondary" data-bi-back>Choose another file</button>' +
                '<span class="bi-spacer"></span>' +
                '<button type="button" class="bi-btn is-secondary" data-bi-cancel>' + (canImport ? 'Cancel' : 'Close') + '</button>' +
                (canImport ? '<button type="button" class="bi-btn" data-bi-confirm>Import ' + result.ready.length +
                    (result.ready.length === 1 ? ' item' : ' items') + '</button>' : '') +
            '</div>');

        overlay.querySelector('[data-bi-cancel]').addEventListener('click', closeDialog);
        overlay.querySelector('[data-bi-back]').addEventListener('click', openImportDialog);
        var confirmBtn = overlay.querySelector('[data-bi-confirm]');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                // On failure the form shows what to fix (e.g. Indicative/Final).
                commitImport(result.ready.map(function (r) { return r.item; }));
                closeDialog();
            });
        }
        (confirmBtn || overlay.querySelector('[data-bi-cancel]')).focus();
    }

    // ------------------------------------------------------------
    // Import dialog: download the template, then drop the filled file
    // ------------------------------------------------------------

    function openImportDialog() {
        var indicativeEl = document.getElementById('is_indicative');
        // Only a brand-new PPMP needs the choice here; adding to an existing
        // PPMP keeps that PPMP's own value.
        var needsType = !isAddingToExisting() && indicativeEl && !indicativeEl.disabled;
        var typeField = '';
        if (needsType) {
            var options = Array.prototype.slice.call(indicativeEl.options)
                .filter(function (o) { return o.value && !o.disabled; });
            typeField =
                '<label class="bi-type-field"><span>PPMP type for these items</span>' +
                '<select id="biIndicative"><option value="">Select\u2026</option>' +
                options.map(function (o) {
                    return '<option value="' + esc(o.value) + '"' + (o.value === indicativeEl.value ? ' selected' : '') + '>' + esc(o.value) + '</option>';
                }).join('') + '</select></label>';
        }

        var overlay = openDialog('biImportTitle',
            '<h3 id="biImportTitle">Bulk import from Excel</h3>' +
            '<p class="bi-file">' + esc(describeTarget()) + '</p>' +
            '<div class="bi-dialog-body">' +
                '<div class="bi-step"><span class="bi-num">1</span><div class="bi-step-main">' +
                    '<strong>Download the template</strong>' +
                    '<p>Fill in one row per item. The Instructions sheet lists the allowed values.</p>' +
                    '<button type="button" class="bi-btn is-secondary" id="biDownloadBtn">' +
                        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        'Download template</button>' +
                '</div></div>' +
                '<div class="bi-step"><span class="bi-num">2</span><div class="bi-step-main">' +
                    '<strong>Upload the filled file</strong>' +
                    '<p>Every row is checked before anything is saved.</p>' +
                    typeField +
                    '<div class="bi-drop" id="biDrop" tabindex="0" role="button" aria-label="Upload the filled template">' +
                        '<span class="bi-drop-text">Drop the file here or <span class="bi-link">browse</span></span>' +
                        '<span class="bi-drop-sub">.xlsx, .xls or .csv &middot; up to 2 MB &middot; up to ' + MAX_IMPORT_ROWS + ' items</span>' +
                    '</div>' +
                    '<input type="file" id="biFileInput" accept=".xlsx,.xls,.csv" hidden>' +
                '</div></div>' +
            '</div>' +
            '<div class="bi-dialog-actions"><span class="bi-spacer"></span>' +
                '<button type="button" class="bi-btn is-secondary" data-bi-cancel>Close</button></div>');

        var input = overlay.querySelector('#biFileInput');
        var drop = overlay.querySelector('#biDrop');

        overlay.querySelector('[data-bi-cancel]').addEventListener('click', closeDialog);
        overlay.querySelector('#biDownloadBtn').addEventListener('click', downloadTemplate);

        var typeSelect = overlay.querySelector('#biIndicative');
        if (typeSelect) {
            typeSelect.addEventListener('change', function () {
                // Keeps the form's own field in step, so the saved PPMP uses it.
                indicativeEl.value = typeSelect.value;
            });
        }

        drop.addEventListener('click', function () { input.click(); });
        drop.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
        });
        input.addEventListener('change', function () { handleFile(input.files && input.files[0]); });

        ['dragenter', 'dragover'].forEach(function (name) {
            drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
        });
        ['dragleave', 'drop'].forEach(function (name) {
            drop.addEventListener(name, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (e) {
            handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
        });

        drop.focus();
    }

    // ------------------------------------------------------------
    // The button in the request form's top bar (beside Close)
    // ------------------------------------------------------------

    function buildButton() {
        if (document.getElementById('biOpenBtn')) return;
        var bar = document.querySelector('#requestModalOverlay .db-modal-header-actions');
        if (!bar) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'biOpenBtn';
        btn.className = 'bi-open-btn hidden';
        btn.setAttribute('aria-label', 'Bulk import items from Excel');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M12 15V4m0 0L8 8m4-4l4 4M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            'Bulk import';
        btn.addEventListener('click', openImportDialog);
        bar.insertBefore(btn, bar.firstChild);
    }

    // Visible only when creating: not while viewing a saved PPMP, not while
    // editing one of its items, and only for accounts that can request.
    function updateButton() {
        var btn = document.getElementById('biOpenBtn');
        if (!btn) return;

        var session = typeof getSession === 'function' ? getSession() : null;
        var viewing = typeof isViewMode !== 'undefined' && isViewMode;
        var editingItem = typeof currentEditingItemId !== 'undefined' && !!currentEditingItemId;
        btn.classList.toggle('hidden', !(session && session.canRequest) || viewing || editingItem);
    }

    // Re-check the button after each way of opening/changing the form.
    function hookFormFunctions() {
        ['openRequestModal', 'addEntryToPpmp', 'loadRecordIntoModal', 'enableEditMode'].forEach(function (name) {
            var original = window[name];
            if (typeof original !== 'function') return;
            window[name] = function () {
                var result = original.apply(this, arguments);
                updateButton();
                return result;
            };
        });
    }

    function init() {
        buildButton();
        hookFormFunctions();
        updateButton();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else init();
    }

    // Exposed for testing and for the console.
    var api = {
        COLUMNS: COLUMNS,
        toIsoDate: toIsoDate,
        toBudget: toBudget,
        mapHeaders: mapHeaders,
        validateRow: validateRow,
        analyzeRows: analyzeRows
    };
    if (typeof window !== 'undefined') window.BulkImport = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();