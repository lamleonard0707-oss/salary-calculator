/**
 * Salary Calculator → Google Sheets 自動匯入
 * 部署做 Web App，PWA 會 POST 資料過嚟
 */

// 通行碼：只有帶啱通行碼嘅請求先寫得入張 Sheet。
// ⛔ 呢個檔唔好放上公開 repo（公開嗰份用 placeholder）。
const ACCESS_TOKEN = '你自己嘅通行碼（喺 Apps Script 編輯器填，唔好放上呢度）';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'unauthorized'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);

    // 驗唔過就即刻拒絕，一個字都唔會寫入張 Sheet
    if (!data || data.token !== ACCESS_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'unauthorized'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById('13ezJm_Qhy4QpOLZFlhBnK3pZR8fEqRnL5y3GFY7j05Y');

    // Sheet 名 = 月份，例如「2026年4月」
    const sheetName = data.month || '未命名';

    // 如果同名 sheet 已存在，加序號
    let finalName = sheetName;
    let counter = 1;
    while (ss.getSheetByName(finalName)) {
      counter++;
      finalName = sheetName + ' (' + counter + ')';
    }

    const sheet = ss.insertSheet(finalName);
    let row = 1;

    // ===== 兼職明細 =====
    sheet.getRange(row, 1, 1, 8).setValues([['人名', '日期', '返工', '收工', '00:00前($)', '00:00後($)', '交通($)', '更期薪金($)']]);
    sheet.getRange(row, 1, 1, 8).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    row++;

    const detailStartRow = row;

    for (const p of data.parttime) {
      for (const s of p.shifts) {
        sheet.getRange(row, 1, 1, 8).setValues([[
          p.name,
          s.date,
          s.timeIn,
          s.timeOut,
          s.beforePay,
          s.afterPay,
          s.transport,
          null
        ]]);
        // 更期薪金 = 00:00前 + 00:00後 + 交通
        sheet.getRange(row, 8).setFormula('=E' + row + '+F' + row + '+G' + row);
        row++;
      }
    }

    row++; // 空行

    // ===== 兼職摘要 =====
    sheet.getRange(row, 1, 1, 6).setValues([['人名', '更數', '更期薪金', '勤工獎', '調整', '總計']]);
    sheet.getRange(row, 1, 1, 6).setFontWeight('bold').setBackground('#34a853').setFontColor('white');
    row++;

    const summaryStartRow = row;
    const totalShifts = getTotalShifts(data);

    for (const p of data.parttime) {
      sheet.getRange(row, 1, 1, 6).setValues([[
        p.name,
        p.shiftCount,
        null,
        p.bonus,
        p.adjTotal,
        null
      ]]);
      // 更期薪金 = SUMIF
      sheet.getRange(row, 3).setFormula(
        '=SUMIF(A' + detailStartRow + ':A' + (detailStartRow + totalShifts - 1) + ',A' + row + ',H' + detailStartRow + ':H' + (detailStartRow + totalShifts - 1) + ')'
      );
      // 總計 = 更期薪金 + 勤工獎 + 調整
      sheet.getRange(row, 6).setFormula('=C' + row + '+D' + row + '+E' + row);
      row++;
    }

    // 合計
    row++;
    sheet.getRange(row, 1).setValue('💰 合計').setFontWeight('bold').setFontSize(14);
    sheet.getRange(row, 6).setFormula('=SUM(F' + summaryStartRow + ':F' + (row - 2) + ')');
    sheet.getRange(row, 6).setFontWeight('bold').setFontSize(14).setNumberFormat('$#,##0.00');

    // 格式化
    if (totalShifts > 0) {
      sheet.getRange(detailStartRow, 5, totalShifts, 4).setNumberFormat('$#,##0.00');
    }
    if (data.parttime.length > 0) {
      sheet.getRange(summaryStartRow, 3, data.parttime.length, 4).setNumberFormat('$#,##0.00');
    }

    sheet.autoResizeColumns(1, 8);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheet: finalName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getTotalShifts(data) {
  let total = 0;
  for (const p of data.parttime) {
    total += p.shifts.length;
  }
  return total;
}

// 測試用
function testDoPost() {
  const testData = {
    month: '2026年4月（測試）',
    parttime: [
      {
        name: '小明',
        shiftCount: 2,
        bonus: 0,
        adjTotal: 0,
        shifts: [
          { date: '4月1日', timeIn: '18:00', timeOut: '00:30', beforePay: 480, afterPay: 50, transport: 30 },
          { date: '4月2日', timeIn: '19:00', timeOut: '23:00', beforePay: 320, afterPay: 0, transport: 0 }
        ]
      }
    ],
    fulltime: [],
    token: ACCESS_TOKEN
  };

  const e = { postData: { contents: JSON.stringify(testData) } };
  const result = doPost(e);
  Logger.log(result.getContent());
}
