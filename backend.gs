/**
 * 日用品ストック管理用 API (Google Apps Script)
 * 機能を「デプロイ」>「新しいデプロイ」>「種類:ウェブアプリ」で公開して使用してください。
 * アクセスできるユーザー: 「全員」に設定する必要があります。
 */

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const result = data.map((row, index) => {
    const obj = { id: index + 2 }; // 行番号をIDとして使用
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (action === 'add') {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => params.data[header] || "");
    sheet.appendRow(newRow);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'update') {
    const id = params.id;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const updateData = headers.map(header => params.data[header] !== undefined ? params.data[header] : "");
    sheet.getRange(id, 1, 1, headers.length).setValues([updateData]);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'delete') {
    const id = params.id;
    sheet.deleteRow(id);
    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
