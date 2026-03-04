/**
 * 日用品ストック管理用 API (Google Apps Script)
 */

function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getDataRange();
    if (range.isBlank()) {
      return createJsonResponse([]);
    }
    
    const data = range.getValues();
    const headers = data.shift();
    
    if (headers.length === 0) return createJsonResponse([]);

    const result = data.map((row, index) => {
      const obj = { id: index + 2 };
      headers.forEach((header, i) => {
        if (header) obj[header] = row[i];
      });
      return obj;
    });
    
    return createJsonResponse(result);
  } catch (e) {
    return createJsonResponse({status: 'error', message: e.toString()});
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No post data received");
    }
    
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure we have headers even in an empty sheet
    let headers = [];
    if (sheet.getLastColumn() > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    } else {
      // Default headers if empty
      headers = ['name', 'category', 'quantity', 'threshold', 'max', 'unit', 'notes'];
      sheet.appendRow(headers);
    }
    
    if (action === 'add') {
      const newRow = headers.map(header => params.data[header] !== undefined ? params.data[header] : "");
      sheet.appendRow(newRow);
      return createJsonResponse({status: 'success'});
    }
    
    if (action === 'update') {
      const id = parseInt(params.id);
      if (isNaN(id)) throw new Error("Invalid ID for update");
      const updateData = headers.map(header => params.data[header] !== undefined ? params.data[header] : "");
      sheet.getRange(id, 1, 1, headers.length).setValues([updateData]);
      return createJsonResponse({status: 'success'});
    }
    
    if (action === 'delete') {
      const id = parseInt(params.id);
      if (isNaN(id)) throw new Error("Invalid ID for delete");
      sheet.deleteRow(id);
      return createJsonResponse({status: 'success'});
    }
    
    throw new Error("Unknown action: " + action);
  } catch (e) {
    return createJsonResponse({status: 'error', message: e.toString()});
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
