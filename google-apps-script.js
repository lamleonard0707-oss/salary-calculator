/**
 * Salary Calculator → Google Sheets 自動匯入
 * 部署做 Web App，PWA 會 POST 資料過嚟
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

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
    // Header
    sheet.getRange(row, 1, 1, 8).setValues([['人名', '日期', '返工', '收工', '00:00前($)', '00:00後($)', '交通($)', '更期薪金($)']]);
    sheet.getRange(row, 1, 1, 8).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    row++;

    const detailStartRow = row;

    // 每個兼職員工嘅每更資料
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
          null  // 用算式
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

    for (const p of data.parttime) {
      // 更期薪金用 SUMIF 算式：搵返上面明細嗰啲行
      sheet.getRange(row, 1, 1, 6).setValues([[
        p.name,
        p.shiftCount,
        null,  // formula
        p.bonus,
        p.adjTotal,
        null   // formula
      ]]);
      // 更期薪金 = SUMIF(明細人名列, 呢個人名, 明細薪金列)
      sheet.getRange(row, 3).setFormula(
        '=SUMIF(A' + detailStartRow + ':A' + (detailStartRow + getTotalShifts(data) - 1) + ',A' + row + ',H' + detailStartRow + ':H' + (detailStartRow + getTotalShifts(data) - 1) + ')'
      );
      // 總計 = 更期薪金 + 勤工獎 + 調整
      sheet.getRange(row, 6).setFormula('=C' + row + '+D' + row + '+E' + row);
      row++;
    }

    // 兼職合計
    row++;
    sheet.getRange(row, 1).setValue('兼職合計').setFontWeight('bold');
    sheet.getRange(row, 6).setFormula('=SUM(F' + summaryStartRow + ':F' + (row - 2) + ')');
    sheet.getRange(row, 6).setFontWeight('bold');
    const ptTotalRow = row;
    row += 2;

    // ===== 全職人員 =====
    sheet.getRange(row, 1, 1, 2).setValues([['全職人員', '月薪']]);
    sheet.getRange(row, 1, 1, 2).setFontWeight('bold').setBackground('#fbbc04').setFontColor('black');
    row++;

    const ftStartRow = row;
    for (const ft of data.fulltime) {
      sheet.getRange(row, 1, 1, 2).setValues([[ft.name, ft.salary]]);
      row++;
    }

    sheet.getRange(row, 1).setValue('全職合計').setFontWeight('bold');
    sheet.getRange(row, 2).setFormula('=SUM(B' + ftStartRow + ':B' + (row - 1) + ')');
    sheet.getRange(row, 2).setFontWeight('bold');
    const ftTotalRow = row;
    row += 2;

    // ===== 總支出 =====
    sheet.getRange(row, 1).setValue('💰 總支出').setFontWeight('bold').setFontSize(14);
    sheet.getRange(row, 2).setFormula('=F' + ptTotalRow + '+B' + ftTotalRow);
    sheet.getRange(row, 2).setFontWeight('bold').setFontSize(14).setNumberFormat('$#,##0.00');

    // 格式化：數字列用貨幣格式
    sheet.getRange(detailStartRow, 5, getTotalShifts(data), 4).setNumberFormat('$#,##0.00');
    sheet.getRange(summaryStartRow, 3, data.parttime.length, 4).setNumberFormat('$#,##0.00');
    sheet.getRange(ftStartRow, 2, data.fulltime.length + 1, 1).setNumberFormat('$#,##0.00');

    // 自動調寬
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

// 測試用 — 可以手動行一次睇下得唔得
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
    fulltime: [
      { name: '大佬', salary: 20000 }
    ]
  };

  const e = { postData: { contents: JSON.stringify(testData) } };
  const result = doPost(e);
  Logger.log(result.getContent());
}
