// ============================================================
// Party Room Salary Calculator
// ============================================================

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    rates: {
        normalBefore: 55,
        normalAfter: 70,
        bossBefore: 60,
        bossAfter: 70
    },
    transport: 30,
    bonus: { tier10: 500, tier5: 200 },
    bosses: ['Leonard', 'Gordon', 'Viann', 'Vivian'],
    fulltime: [
        { name: 'Vivian', salary: 1000 },
        { name: 'Gordon', salary: 1000 },
        { name: 'Leonard', salary: 1000 },
        { name: 'Viann', salary: 1000 }
    ]
};

// --- State ---
let settings = loadSettings();
let entries = [];       // parsed shift entries
let adjustments = [];   // manual training/others adjustments
let lastResults = null;

// ============================================================
// Settings persistence
// ============================================================
function loadSettings() {
    try {
        const saved = localStorage.getItem('salary-settings');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function saveSettings() {
    settings.rates.normalBefore = num('rate-normal-before');
    settings.rates.normalAfter = num('rate-normal-after');
    settings.rates.bossBefore = num('rate-boss-before');
    settings.rates.bossAfter = num('rate-boss-after');
    settings.transport = num('transport-allowance');
    settings.bonus.tier10 = num('bonus-10');
    settings.bonus.tier5 = num('bonus-5');
    localStorage.setItem('salary-settings', JSON.stringify(settings));
    alert('設定已儲存 ✓');
}

function populateSettings() {
    el('rate-normal-before').value = settings.rates.normalBefore;
    el('rate-normal-after').value = settings.rates.normalAfter;
    el('rate-boss-before').value = settings.rates.bossBefore;
    el('rate-boss-after').value = settings.rates.bossAfter;
    el('transport-allowance').value = settings.transport;
    el('bonus-10').value = settings.bonus.tier10;
    el('bonus-5').value = settings.bonus.tier5;
    renderBossList();
    renderFulltimeList();
}

// ============================================================
// WhatsApp Message Parser — Smart / AI-style
// ============================================================
function parseWhatsAppMessages(text) {
    const results = [];
    const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Strategy 1: Try labeled format (分店/名字/時間 style)
    const labeled = parseLabeledFormat(raw);
    if (labeled.length > 0) return labeled;

    // Strategy 2: Try simple 3-line blocks (Name / Date / Time)
    const simple = parseSimpleBlocks(raw);
    if (simple.length > 0) return simple;

    // Strategy 3: Scan every line looking for dates, names, times
    return parseFlexible(raw);
}

// --- Strategy 1: Labeled format ---
// 2026.4.3
// 分店：FF
// 名字：Yo
// 時間1700-0000
function parseLabeledFormat(raw) {
    const results = [];
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    let currentDate = null;
    let currentName = null;
    let currentBranch = null;

    for (const line of lines) {
        // Try date
        const date = parseDate(line);
        if (date) {
            currentDate = date;
            continue;
        }

        // Try labeled name: 名字：Yo, 名字:Yo, Name: Yo
        const nameMatch = line.match(/^(?:名字|姓名|name|員工)\s*[：:]\s*(.+)$/i);
        if (nameMatch) {
            currentName = normalizeName(nameMatch[1]);
            continue;
        }

        // Try labeled branch: 分店：FF
        const branchMatch = line.match(/^(?:分店|店鋪|branch|店)\s*[：:]\s*(.+)$/i);
        if (branchMatch) {
            currentBranch = branchMatch[1].trim();
            continue;
        }

        // Try labeled time: 時間1700-0000, 時間：1700-0000
        const timeMatch = line.match(/^(?:時間|time)\s*[：:]?\s*(.+)$/i);
        if (timeMatch) {
            const times = parseTimeRange(timeMatch[1]);
            if (times && currentDate && currentName) {
                results.push({
                    id: crypto.randomUUID(),
                    name: currentName,
                    date: currentDate,
                    dateStr: formatDate(currentDate),
                    branch: currentBranch,
                    ...times
                });
                // Don't reset date — multiple entries may share same date
                currentName = null;
                currentBranch = null;
                continue;
            }
        }

        // Try bare time range (no label)
        const times = parseTimeRange(line);
        if (times && currentDate && currentName) {
            results.push({
                id: crypto.randomUUID(),
                name: currentName,
                date: currentDate,
                dateStr: formatDate(currentDate),
                branch: currentBranch,
                ...times
            });
            currentName = null;
            currentBranch = null;
            continue;
        }
    }

    return results;
}

// --- Strategy 2: Simple 3-line blocks (Name / Date / Time) ---
function parseSimpleBlocks(raw) {
    const results = [];
    const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

    for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) continue;

        const name = normalizeName(lines[0]);
        if (!name || /^\d/.test(name)) continue;

        const date = parseDate(lines[1]);
        if (!date) continue;

        const times = parseTimeRange(lines[2]);
        if (!times) continue;

        results.push({
            id: crypto.randomUUID(),
            name,
            date,
            dateStr: formatDate(date),
            ...times
        });
    }

    return results;
}

// --- Strategy 3: Flexible line-by-line scan ---
function parseFlexible(raw) {
    const results = [];
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

    let currentDate = null;
    let currentName = null;

    for (const line of lines) {
        // Skip WhatsApp metadata lines (timestamps, system messages)
        if (line.match(/^\[?\d{1,2}[/:]\d{2}[/:]\d{2,4}[\],]/)) continue;
        if (line.match(/^\d{1,2}:\d{2}\s*(am|pm)/i)) continue;

        // Try date
        const date = parseDate(line);
        if (date) { currentDate = date; continue; }

        // Try time range
        const times = parseTimeRange(line);
        if (times) {
            if (currentDate && currentName) {
                results.push({
                    id: crypto.randomUUID(),
                    name: currentName,
                    date: currentDate,
                    dateStr: formatDate(currentDate),
                    ...times
                });
                currentName = null;
            }
            continue;
        }

        // Try labeled fields
        const nameMatch = line.match(/^(?:名字|姓名|name|員工)\s*[：:]\s*(.+)$/i);
        if (nameMatch) { currentName = normalizeName(nameMatch[1]); continue; }

        const timeMatch = line.match(/^(?:時間|time)\s*[：:]?\s*(.+)$/i);
        if (timeMatch) {
            const t = parseTimeRange(timeMatch[1]);
            if (t && currentDate && currentName) {
                results.push({
                    id: crypto.randomUUID(),
                    name: currentName,
                    date: currentDate,
                    dateStr: formatDate(currentDate),
                    ...t
                });
                currentName = null;
            }
            continue;
        }

        // If line is short and looks like a name (no numbers, no special chars)
        if (line.length <= 20 && /^[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z\s]+$/.test(line)) {
            currentName = normalizeName(line);
        }
    }

    return results;
}

function normalizeName(raw) {
    // Capitalize first letter
    const s = raw.trim();
    if (!s) return null;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseDate(str) {
    // Support: 2026-04-09, 2026.4.3, 09/04/2026, 9/4/2026, 09-04-2026, 2026/04/09
    str = str.trim();

    // ISO format: 2026-04-09, 2026/04/09, 2026.4.3
    let m = str.match(/^(\d{4})[-/.。](\d{1,2})[-/.。](\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    m = str.match(/^(\d{1,2})[-/.。](\d{1,2})[-/.。](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

    // DD/MM/YY, DD-MM-YY, DD.MM.YY
    m = str.match(/^(\d{1,2})[-/.。](\d{1,2})[-/.。](\d{2})$/);
    if (m) return new Date(2000 + +m[3], +m[2] - 1, +m[1]);

    return null;
}

function parseTimeRange(str) {
    str = str.trim().replace(/\s+/g, '');
    // Support: 1700-0000, 17:00-00:00, 1700至0000, 1700to0000
    const m = str.match(/^(\d{3,4})[:\s]?(\d{0,2})?\s*[-–至to~]\s*(\d{3,4})[:\s]?(\d{0,2})?$/i);
    if (!m) return null;

    const inStr = m[1].padStart(4, '0');
    const outStr = m[3].padStart(4, '0');

    const inH = parseInt(inStr.slice(0, 2));
    const inM = parseInt(inStr.slice(2));
    const outH = parseInt(outStr.slice(0, 2));
    const outM = parseInt(outStr.slice(2));

    if (inH > 23 || inM > 59 || outH > 23 || outM > 59) return null;

    return {
        timeIn: inH * 60 + inM,   // minutes from midnight
        timeOut: outH * 60 + outM,
        timeInStr: `${pad2(inH)}:${pad2(inM)}`,
        timeOutStr: `${pad2(outH)}:${pad2(outM)}`
    };
}

// ============================================================
// Salary Calculation Engine
// ============================================================
function calculateSalary() {
    const MIDNIGHT = 24 * 60; // 1440 mins

    // Group entries by person
    const byPerson = {};
    for (const e of entries) {
        if (!byPerson[e.name]) byPerson[e.name] = [];
        byPerson[e.name].push(e);
    }

    // Group adjustments by person
    const adjByPerson = {};
    for (const a of adjustments) {
        if (!adjByPerson[a.name]) adjByPerson[a.name] = [];
        adjByPerson[a.name].push(a);
    }

    const results = {};

    for (const [name, shifts] of Object.entries(byPerson)) {
        const isBoss = settings.bosses.some(b => b.toLowerCase() === name.toLowerCase());
        const rateBefore = isBoss ? settings.rates.bossBefore : settings.rates.normalBefore;
        const rateAfter = isBoss ? settings.rates.bossAfter : settings.rates.normalAfter;

        let totalPay = 0;
        const shiftDetails = [];

        for (const shift of shifts) {
            let beforeMins = 0;
            let afterMins = 0;

            const tIn = shift.timeIn;
            const tOut = shift.timeOut;

            if (tOut > tIn) {
                // Same day shift (e.g. 1100-1900)
                // Everything is before midnight
                beforeMins = tOut - tIn;
                afterMins = 0;
            } else {
                // Crosses midnight (e.g. 1800-0300)
                // Before midnight: timeIn to 24:00
                beforeMins = MIDNIGHT - tIn;
                // After midnight: 00:00 to timeOut
                afterMins = tOut;
            }

            const beforePay = (beforeMins / 60) * rateBefore;
            const afterPay = (afterMins / 60) * rateAfter;
            const crossesMidnight = tOut <= tIn && tOut > 0;
            const transportPay = crossesMidnight ? settings.transport : 0;
            const shiftPay = beforePay + afterPay + transportPay;

            totalPay += shiftPay;

            shiftDetails.push({
                date: shift.dateStr,
                timeIn: shift.timeInStr,
                timeOut: shift.timeOutStr,
                beforeMins,
                afterMins,
                beforePay: round2(beforePay),
                afterPay: round2(afterPay),
                transport: transportPay,
                total: round2(shiftPay)
            });
        }

        // Sort shifts by date
        shiftDetails.sort((a, b) => a.date.localeCompare(b.date));

        // Attendance bonus
        const shiftCount = shifts.length;
        let bonus = 0;
        if (shiftCount >= 10) bonus = settings.bonus.tier10;
        else if (shiftCount >= 5) bonus = settings.bonus.tier5;

        // Adjustments (training, others)
        const personAdj = adjByPerson[name] || [];
        let adjTotal = 0;
        for (const a of personAdj) adjTotal += a.amount;

        const grandTotal = round2(totalPay + bonus + adjTotal);

        results[name] = {
            name,
            isBoss,
            shifts: shiftDetails,
            shiftCount,
            shiftPay: round2(totalPay),
            bonus,
            adjustments: personAdj,
            adjTotal: round2(adjTotal),
            total: grandTotal
        };
    }

    // People with adjustments but no shifts
    for (const [name, adjs] of Object.entries(adjByPerson)) {
        if (!results[name]) {
            let adjTotal = 0;
            for (const a of adjs) adjTotal += a.amount;
            const isBoss = settings.bosses.some(b => b.toLowerCase() === name.toLowerCase());
            results[name] = {
                name,
                isBoss,
                shifts: [],
                shiftCount: 0,
                shiftPay: 0,
                bonus: 0,
                adjustments: adjs,
                adjTotal: round2(adjTotal),
                total: round2(adjTotal)
            };
        }
    }

    return results;
}

// ============================================================
// Render Functions
// ============================================================
function renderEntries() {
    const container = el('entries-list');
    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-state">未有記錄</p>';
        el('parsed-preview').style.display = 'none';
        return;
    }

    el('parsed-preview').style.display = 'block';
    el('entry-count').textContent = entries.length;

    // Update manual-add name dropdowns
    updateNameDropdowns();

    container.innerHTML = entries.map(e => `
        <div class="entry-item">
            <span class="entry-name">${esc(e.name)}</span>
            <span class="entry-detail">${e.dateStr}</span>
            <span class="entry-detail">${e.timeInStr}–${e.timeOutStr}</span>
            <button class="entry-delete" data-id="${e.id}">✕</button>
        </div>
    `).join('');

    // Delete buttons
    container.querySelectorAll('.entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            entries = entries.filter(e => e.id !== btn.dataset.id);
            renderEntries();
        });
    });
}

function renderAdjustments() {
    const container = el('adj-list');
    if (adjustments.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = adjustments.map((a, i) => `
        <div class="adj-item">
            <span>${esc(a.name)} — ${a.type} $${a.amount} ${a.note ? '(' + esc(a.note) + ')' : ''}</span>
            <button class="entry-delete" data-idx="${i}">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            adjustments.splice(+btn.dataset.idx, 1);
            renderAdjustments();
        });
    });
}

function renderResults(results) {
    const container = el('results-container');
    const people = Object.values(results);

    if (people.length === 0) {
        container.innerHTML = '<p class="empty-state">冇計算結果</p>';
        return;
    }

    // Grand total (part-time only)
    let partTimeTotal = 0;
    for (const p of people) partTimeTotal += p.total;

    // Fulltime totals
    let fulltimeTotal = 0;
    const fulltimeHTML = settings.fulltime.map(ft => {
        fulltimeTotal += ft.salary;
        return `<div class="detail-row"><span>${esc(ft.name)}（全職）</span><span>$${ft.salary.toLocaleString()}</span></div>`;
    }).join('');

    const grandTotal = partTimeTotal + fulltimeTotal;
    const month = el('salary-month').value;
    const monthLabel = month ? formatMonthLabel(month) : '未選月份';

    let html = `
        <div class="result-summary">
            <div class="total-label">總薪金支出</div>
            <div class="total-amount">$${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <div class="total-month">${monthLabel}</div>
            <div style="margin-top:8px;font-size:0.8em;opacity:0.7">
                兼職: $${partTimeTotal.toLocaleString(undefined, {minimumFractionDigits: 2})} ｜
                全職: $${fulltimeTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </div>
        </div>
    `;

    // Sort: bosses first, then by total descending
    people.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
        return b.total - a.total;
    });

    // Fulltime section
    if (settings.fulltime.length) {
        html += `<div class="card"><h3>👔 全職人員</h3>${fulltimeHTML}</div>`;
    }

    // Part-time section
    html += `<h3 style="margin:16px 0 8px;font-size:0.95em">🕐 兼職人員</h3>`;

    for (const p of people) {
        const bossTag = p.isBoss ? '<span class="boss-tag">👑 老闆</span>' : '';

        let detailHTML = '';
        for (const s of p.shifts) {
            detailHTML += `
                <div class="detail-row">
                    <span class="detail-date">${s.date}</span>
                    <span class="detail-time">${s.timeIn}–${s.timeOut}</span>
                    <span class="detail-amount">$${s.total.toFixed(2)}</span>
                </div>
            `;
        }

        // Subtotals
        detailHTML += `<div class="detail-row subtotal"><span>更期薪金（${p.shiftCount}次）</span><span>$${p.shiftPay.toFixed(2)}</span></div>`;

        if (p.bonus > 0) {
            detailHTML += `<div class="detail-row"><span>🎁 勤工獎（${p.shiftCount}次）</span><span style="color:var(--yellow)">+$${p.bonus.toFixed(2)}</span></div>`;
        }

        if (p.adjustments.length) {
            for (const a of p.adjustments) {
                const icon = a.type === 'training' ? '📚' : '📝';
                detailHTML += `<div class="detail-row"><span>${icon} ${a.type} ${a.note ? '(' + esc(a.note) + ')' : ''}</span><span>$${a.amount.toFixed(2)}</span></div>`;
            }
        }

        html += `
            <div class="person-card">
                <div class="person-header" data-toggle>
                    <span class="person-name">${esc(p.name)} ${bossTag}</span>
                    <span class="person-total">$${p.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div class="person-detail">${detailHTML}</div>
            </div>
        `;
    }

    // Export buttons
    html += `
        <div class="export-row">
            <button class="btn btn-export" id="btn-export-csv">📄 Export CSV</button>
            <button class="btn btn-outline" id="btn-copy-summary">📋 複製摘要</button>
        </div>
    `;

    container.innerHTML = html;

    // Toggle person details
    container.querySelectorAll('[data-toggle]').forEach(header => {
        header.addEventListener('click', () => {
            const detail = header.nextElementSibling;
            detail.classList.toggle('open');
        });
    });

    // Export handlers
    el('btn-export-csv').addEventListener('click', () => exportCSV(results));
    el('btn-copy-summary').addEventListener('click', () => copySummary(results));

    // Switch to results tab
    switchTab('results');
}

// ============================================================
// Export Functions
// ============================================================
function exportCSV(results) {
    const month = el('salary-month').value || 'unknown';
    let csv = 'Name,Date,Time In,Time Out,Before 00:00 ($),After 00:00 ($),Transport ($),Shift Total ($)\n';

    for (const p of Object.values(results)) {
        for (const s of p.shifts) {
            csv += `${p.name},${s.date},${s.timeIn},${s.timeOut},${s.beforePay.toFixed(2)},${s.afterPay.toFixed(2)},${s.transport.toFixed(2)},${s.total.toFixed(2)}\n`;
        }
        // Summary row
        csv += `${p.name},TOTAL,Shifts: ${p.shiftCount},,Shift Pay:,${p.shiftPay.toFixed(2)},Bonus:,${p.bonus.toFixed(2)}\n`;
        if (p.adjTotal !== 0) {
            csv += `${p.name},ADJ,,,,,Adjustments:,${p.adjTotal.toFixed(2)}\n`;
        }
        csv += `${p.name},GRAND TOTAL,,,,,,${p.total.toFixed(2)}\n\n`;
    }

    // Fulltime
    csv += '\nFull-time\nName,Monthly Salary\n';
    for (const ft of settings.fulltime) {
        csv += `${ft.name},${ft.salary.toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function copySummary(results) {
    const month = el('salary-month').value;
    const monthLabel = month ? formatMonthLabel(month) : '';
    let text = `💰 ${monthLabel} 薪金摘要\n${'─'.repeat(25)}\n\n`;

    // Fulltime
    text += '👔 全職：\n';
    let ftTotal = 0;
    for (const ft of settings.fulltime) {
        text += `  ${ft.name}: $${ft.salary.toLocaleString()}\n`;
        ftTotal += ft.salary;
    }

    text += '\n🕐 兼職：\n';
    let ptTotal = 0;
    for (const p of Object.values(results)) {
        text += `  ${p.name}: $${p.total.toLocaleString(undefined, {minimumFractionDigits: 2})}（${p.shiftCount}更）\n`;
        ptTotal += p.total;
    }

    text += `\n${'─'.repeat(25)}\n`;
    text += `兼職合計: $${ptTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    text += `全職合計: $${ftTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    text += `總支出: $${(ptTotal + ftTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;

    navigator.clipboard.writeText(text).then(() => {
        alert('已複製到剪貼簿 ✓');
    });
}

// ============================================================
// Settings UI: Boss list, Fulltime list
// ============================================================
function renderBossList() {
    const container = el('boss-list');
    container.innerHTML = settings.bosses.map((name, i) => `
        <div class="list-item">
            <span>👑 ${esc(name)}</span>
            <button data-idx="${i}" class="boss-remove">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.boss-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            settings.bosses.splice(+btn.dataset.idx, 1);
            renderBossList();
        });
    });
}

function renderFulltimeList() {
    const container = el('fulltime-list');
    container.innerHTML = settings.fulltime.map((ft, i) => `
        <div class="list-item">
            <span>👔 ${esc(ft.name)} — $${ft.salary.toLocaleString()}</span>
            <button data-idx="${i}" class="ft-remove">✕</button>
        </div>
    `).join('');

    container.querySelectorAll('.ft-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            settings.fulltime.splice(+btn.dataset.idx, 1);
            renderFulltimeList();
        });
    });
}

// ============================================================
// Name dropdowns
// ============================================================
function updateNameDropdowns() {
    const names = [...new Set(entries.map(e => e.name))];
    const allNames = [...new Set([...names, ...settings.bosses, ...settings.fulltime.map(f => f.name)])];
    allNames.sort();

    for (const id of ['manual-name', 'adj-name']) {
        const select = el(id);
        const current = select.value;
        select.innerHTML = '<option value="">人名</option>' +
            allNames.map(n => `<option value="${esc(n)}" ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('');
    }
}

// ============================================================
// Tabs
// ============================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === `tab-${tabName}`));
}

// ============================================================
// Helpers
// ============================================================
function el(id) { return document.getElementById(id); }
function num(id) { return parseFloat(el(id).value) || 0; }
function pad2(n) { return String(n).padStart(2, '0'); }
function round2(n) { return Math.round(n * 100) / 100; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function formatDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatMonthLabel(monthStr) {
    const [y, m] = monthStr.split('-');
    return `${y}年${parseInt(m)}月`;
}

// ============================================================
// Event Listeners
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Set default month to current
    const now = new Date();
    el('salary-month').value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

    populateSettings();

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Parse button
    el('btn-parse').addEventListener('click', () => {
        const text = el('whatsapp-input').value.trim();
        if (!text) { alert('請先貼上報更訊息'); return; }
        const parsed = parseWhatsAppMessages(text);
        if (parsed.length === 0) {
            alert('解析唔到任何報更記錄，請檢查格式：\n\n人名\n日期\n時間-時間');
            return;
        }
        entries = [...entries, ...parsed];
        renderEntries();
        el('whatsapp-input').value = '';
    });

    // Manual add entry
    el('btn-manual-add').addEventListener('click', () => {
        const name = el('manual-name').value;
        const date = el('manual-date').value;
        const tIn = el('manual-timein').value.trim();
        const tOut = el('manual-timeout').value.trim();
        if (!name || !date || !tIn || !tOut) { alert('請填晒所有欄位'); return; }
        const times = parseTimeRange(`${tIn}-${tOut}`);
        if (!times) { alert('時間格式唔啱，用 4 位數字，例如 1700'); return; }
        const d = new Date(date);
        entries.push({
            id: crypto.randomUUID(),
            name: normalizeName(name),
            date: d,
            dateStr: formatDate(d),
            ...times
        });
        renderEntries();
        el('manual-timein').value = '';
        el('manual-timeout').value = '';
    });

    // Manual add adjustment
    el('btn-adj-add').addEventListener('click', () => {
        const name = el('adj-name').value;
        const type = el('adj-type').value;
        const amount = parseFloat(el('adj-amount').value);
        const note = el('adj-note').value.trim();
        if (!name || !amount) { alert('請填人名同金額'); return; }
        adjustments.push({ name: normalizeName(name), type, amount, note });
        renderAdjustments();
        el('adj-amount').value = '';
        el('adj-note').value = '';
    });

    // Calculate
    el('btn-calculate').addEventListener('click', () => {
        if (entries.length === 0) { alert('未有報更記錄'); return; }
        lastResults = calculateSalary();
        renderResults(lastResults);
    });

    // Settings: add boss
    el('btn-add-boss').addEventListener('click', () => {
        const name = el('new-boss-name').value.trim();
        if (!name) return;
        settings.bosses.push(normalizeName(name));
        el('new-boss-name').value = '';
        renderBossList();
    });

    // Settings: add fulltime
    el('btn-add-ft').addEventListener('click', () => {
        const name = el('new-ft-name').value.trim();
        const salary = parseFloat(el('new-ft-salary').value);
        if (!name || !salary) return;
        settings.fulltime.push({ name: normalizeName(name), salary });
        el('new-ft-name').value = '';
        el('new-ft-salary').value = '';
        renderFulltimeList();
    });

    // Save settings
    el('btn-save-settings').addEventListener('click', saveSettings);
});

// ============================================================
// Service Worker Registration
// ============================================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
