const SPREADSHEET_ID = ''; // Optional: specify an external sheet ID if not bound to a spreadsheet

function getSpreadsheet() {
  // 1. Try SPREADSHEET_ID if provided
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      console.error('Failed to open spreadsheet by ID: ' + SPREADSHEET_ID, e);
    }
  }

  // 2. Try to get container-bound spreadsheet
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch(e) {
    console.log('Not a container-bound script or failed to get active spreadsheet.');
  }
  
  if (ss) {
    return ss;
  }
  
  // 3. Try to get spreadsheet from Script Properties
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('DB_SPREADSHEET_ID');
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch(e) {
      console.error('Failed to open spreadsheet from script properties ID: ' + ssId, e);
    }
  }
  
  // 4. Create a new spreadsheet if it still doesn't exist
  if (!ss) {
    try {
      ss = SpreadsheetApp.create('DM-A Task Tracking Database');
      props.setProperty('DB_SPREADSHEET_ID', ss.getId());
      console.log('Created new standalone spreadsheet database. ID: ' + ss.getId());
    } catch(e) {
      console.error('Failed to create a new spreadsheet database.', e);
      throw new Error('Spreadsheet database could not be initialized. Please authorize Sheets access or set SPREADSHEET_ID.');
    }
  }
  return ss;
}

// Helper to safely get or create a sheet in a spreadsheet
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Check by looping through all sheets to avoid cache issues
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() === name) {
        sheet = sheets[i];
        break;
      }
    }
  }
  
  if (!sheet) {
    try {
      sheet = ss.insertSheet(name);
      if (headers && headers.length > 0) {
        sheet.appendRow(headers);
        sheet.setFrozenRows(1);
      }
    } catch (e) {
      // If insertion fails (e.g. sheet already exists in backend), retrieve it
      sheet = ss.getSheetByName(name);
      if (!sheet) {
        const sheets = ss.getSheets();
        for (let i = 0; i < sheets.length; i++) {
          if (sheets[i].getName() === name) {
            sheet = sheets[i];
            break;
          }
        }
      }
    }
  }
  return sheet;
}

function initSheet() {
  const ss = getSpreadsheet();
  if (!ss) {
    throw new Error('Could not resolve spreadsheet database.');
  }
  
  // 1. Get or Create Tasks Sheet
  const tasksHeaders = [
    'id', 'aircraftReg', 'aircraftType', 'ataChapter', 'createdDate', 'rtsDate', 'assignedTeam', 
    'requestor', 'requestorContact', 'priorityLevel', 'taskDescription', 
    'currentStatus', 'attachments', 'comments', 'isExternal'
  ];
  let sheet = ss.getSheetByName('Tasks');
  let isNewTasks = false;
  if (!sheet) {
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName() === 'Tasks') {
        sheet = sheets[i];
        break;
      }
    }
  }
  if (!sheet) {
    sheet = getOrCreateSheet(ss, 'Tasks', tasksHeaders);
    isNewTasks = true;
  }
  
  if (isNewTasks) {
    // Auto-remove default Sheet1 if it exists and is empty
    const sheet1 = ss.getSheetByName('Sheet1');
    if (sheet1 && sheet1.getLastRow() === 0) {
      try {
        ss.deleteSheet(sheet1);
      } catch(e) {}
    }
  } else {
    // Check if 'ataChapter' column exists in headers, if not add it
    const data = sheet.getDataRange().getValues();
    if (data.length > 0) {
      const headers = data[0];
      if (headers.indexOf('ataChapter') === -1) {
        // Insert it at column 4 (after aircraftType)
        sheet.insertColumnBefore(4);
        sheet.getRange(1, 4).setValue('ataChapter');
      }
      
      // Check if 'isExternal' column exists in headers, if not add it
      const updatedData = sheet.getDataRange().getValues();
      if (updatedData.length > 0) {
        const updatedHeaders = updatedData[0];
        if (updatedHeaders.indexOf('isExternal') === -1) {
          sheet.getRange(1, updatedHeaders.length + 1).setValue('isExternal');
        }
      }
    }
  }
  
  // 2. Get or Create ManualIssues Sheet
  const manualHeaders = ['label', 'aircraft', 'notes', 'assignedTeam', 'aircraftType', 'count'];
  getOrCreateSheet(ss, 'ManualIssues', manualHeaders);
  
  // 3. Get or Create Blacklist Sheet
  const blacklistHeaders = ['label', 'team'];
  getOrCreateSheet(ss, 'Blacklist', blacklistHeaders);

  // 4. Get or Create FYI Sheet
  const fyiHeaders = ['id', 'team', 'title', 'content', 'dateCreated', 'sapTCode', 'attachmentUrl', 'attachmentName', 'ataChapter'];
  const fyiSheet = getOrCreateSheet(ss, 'FYI', fyiHeaders);
  const fyiData = fyiSheet.getDataRange().getValues();
  if (fyiData.length > 0) {
    const headers = fyiData[0];
    if (headers.indexOf('sapTCode') === -1) {
      fyiSheet.getRange(1, headers.length + 1).setValue('sapTCode');
    }
    const updatedHeaders = fyiSheet.getDataRange().getValues()[0];
    if (updatedHeaders.indexOf('attachmentUrl') === -1) {
      fyiSheet.getRange(1, updatedHeaders.length + 1).setValue('attachmentUrl');
    }
    const updatedHeaders2 = fyiSheet.getDataRange().getValues()[0];
    if (updatedHeaders2.indexOf('attachmentName') === -1) {
      fyiSheet.getRange(1, updatedHeaders2.length + 1).setValue('attachmentName');
    }
    const updatedHeaders3 = fyiSheet.getDataRange().getValues()[0];
    if (updatedHeaders3.indexOf('ataChapter') === -1) {
      fyiSheet.getRange(1, updatedHeaders3.length + 1).setValue('ataChapter');
    }
  }

  // 5. Get or Create SAPCodes Sheet
  const sapHeaders = ['id', 'description', 'sourceFile'];
  getOrCreateSheet(ss, 'SAPCodes', sapHeaders);
}

// Authenticate user against access code 'DMA'
function authenticateUser(passcode) {
  try {
    if (passcode && passcode.trim().toUpperCase() === 'DMA') {
      return {
        success: true,
        user: {
          username: 'DMA Staff',
          role: 'Administrator'
        }
      };
    }
    return { success: false, message: 'Invalid access code.' };
  } catch (e) {
    console.error('Error in authenticateUser: ', e);
    return { success: false, message: 'Server error: ' + e.message };
  }
}

function doGet() {
  try {
    initSheet();
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('DM-A Task Tracking')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch(e) {
    console.error('Error in doGet: ', e);
    return HtmlService.createHtmlOutput('<h1>Initialization Error</h1><p>' + e.toString() + '</p>');
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch(e) {
    console.error('Failed to include file: ' + filename, e);
    return '<!-- Error including ' + filename + ' -->';
  }
}

// Tasks CRUD
function getTasks() {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('Tasks');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const tasks = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const task = {};
    headers.forEach((header, idx) => {
      let val = row[idx];
      if (header === 'attachments' || header === 'comments') {
        try {
          val = val ? JSON.parse(val) : [];
        } catch (e) {
          val = [];
        }
      }
      task[header] = val;
    });
    tasks.push(task);
  }
  return tasks;
}

function saveTask(task) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('Tasks');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const rowValues = headers.map(header => {
    let val = task[header];
    if (header === 'attachments' || header === 'comments') {
      val = JSON.stringify(val || []);
    }
    return val;
  });
  
  // Check if task already exists
  let existingRowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === task.id) {
      existingRowIdx = i + 1; // 1-indexed row number
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return true;
}

function deleteTask(id) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('Tasks');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return true;
}

// Manual Issues CRUD
function getManualIssues() {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('ManualIssues');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const issues = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const issue = {};
    headers.forEach((header, idx) => {
      let val = row[idx];
      if (header === 'aircraft') {
        try {
          val = val ? JSON.parse(val) : [];
        } catch (e) {
          val = val ? val.split(',').map(s => s.trim()) : [];
        }
      }
      issue[header] = val;
    });
    issues.push(issue);
  }
  return issues;
}

function saveAllManualIssues(issues) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('ManualIssues');
  
  // Clear data rows (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  issues.forEach(issue => {
    sheet.appendRow([
      issue.label,
      JSON.stringify(issue.aircraft || []),
      issue.notes || '',
      issue.assignedTeam || 'Mechanical System Team',
      issue.aircraftType || 'A320',
      issue.count || 1
    ]);
  });
  return true;
}

// Blacklist CRUD
function getBlacklist() {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('Blacklist');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const list = [];
  for (let i = 1; i < data.length; i++) {
    list.push({ label: data[i][0], team: data[i][1] });
  }
  return list;
}

function saveAllBlacklistedIssues(blacklist) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('Blacklist');
  
  // Clear data rows (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  
  blacklist.forEach(item => {
    sheet.appendRow([item.label, item.team]);
  });
  return true;
}

/**
 * Uploads a base64 file to a dedicated Google Drive folder (custom or default).
 * @param {string} fileName The name of the file
 * @param {string} mimeType The MIME type of the file
 * @param {string} base64Data The raw base64 data string
 * @return {object} Object containing the file URL, name, and size
 */
/**
 * Uploads a base64 file to a dedicated Google Drive folder (custom or default),
 * categorizing it into subfolders by team name and week number.
 * @param {string} fileName The name of the file
 * @param {string} mimeType The MIME type of the file
 * @param {string} base64Data The raw base64 data string
 * @param {string} [teamName] Optional team name to categorize by
 * @param {string} [dateStr] Optional date string (YYYY-MM-DD) to categorize by week
 * @return {object} Object containing the file URL, name, and size
 */
function uploadFileToDrive(fileName, mimeType, base64Data, teamName, dateStr) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
    let folder;
    
    if (folderId) {
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (e) {
        console.warn('Configured custom folder ID not accessible, falling back to default: ' + e.toString());
      }
    }
    
    if (!folder) {
      const folderName = "MRO Task Tracking Attachments";
      const folders = DriveApp.getFoldersByName(folderName);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    }
    
    // Sub-folder categorization
    let activeFolder = folder;
    
    // 1. Team-level folder categorization
    let teamNameSanitized = 'General';
    if (teamName && teamName.trim()) {
      // Pick first team if a list is provided
      const teams = teamName.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
      if (teams.length > 0) {
        teamNameSanitized = teams[0];
      }
    }
    activeFolder = getOrCreateSubfolder(activeFolder, teamNameSanitized);
    
    // 2. Week-level folder categorization
    if (dateStr && dateStr !== 'skip') {
      const weekFolderName = getWeekFolderName(dateStr);
      activeFolder = getOrCreateSubfolder(activeFolder, weekFolderName);
    }
    
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, fileName);
    const file = activeFolder.createFile(blob);
    
    // Set view permissions
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      id: file.getId(),
      name: fileName,
      url: file.getUrl(),
      size: file.getSize()
    };
  } catch (e) {
    console.error("Failed to upload file to Google Drive: " + e.toString());
    throw new Error("Cloud upload failed: " + e.message);
  }
}

/**
 * Retrieves a subfolder by name or creates it if it doesn't exist.
 * @param {Folder} parentFolder Google Drive Folder object
 * @param {string} subfolderName Name of the subfolder
 * @return {Folder}
 */
function getOrCreateSubfolder(parentFolder, subfolderName) {
  const folders = parentFolder.getFoldersByName(subfolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subfolderName);
}

/**
 * Formats a date string into a week folder name (e.g. "Week 26 (2026)").
 * @param {string} dateString Date string in YYYY-MM-DD format
 * @return {string}
 */
function getWeekFolderName(dateString) {
  let date = new Date();
  if (dateString) {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }
  
  // Calculate ISO-8601 week number
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  
  const formattedWeek = weekNum < 10 ? '0' + weekNum : weekNum;
  return 'Week ' + formattedWeek + ' (' + year + ')';
}

/**
 * Saves the custom Google Drive folder URL by extracting the folder ID.
 * @param {string} url The Google Drive folder URL or ID
 * @return {boolean}
 */
function saveFolderUrl(url) {
  const props = PropertiesService.getScriptProperties();
  if (!url) {
    props.deleteProperty('DRIVE_FOLDER_ID');
    props.deleteProperty('DRIVE_FOLDER_URL');
    return true;
  }
  
  let folderId = url.trim();
  
  // Extract ID from standard folders path
  let match = folderId.match(/folders\/([a-zA-Z0-9-_]+)/);
  if (match) {
    folderId = match[1];
  } else {
    // Extract ID from shared-drives path (Shared Drive root)
    match = folderId.match(/shared-drives\/([a-zA-Z0-9-_]+)/);
    if (match) {
      folderId = match[1];
    } else {
      // Extract ID from open?id= path
      match = folderId.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (match) {
        folderId = match[1];
      }
    }
  }
  
  // Verify if folder is accessible by this script instance
  try {
    const folder = DriveApp.getFolderById(folderId);
    props.setProperty('DRIVE_FOLDER_ID', folderId);
    props.setProperty('DRIVE_FOLDER_URL', url.trim());
    return true;
  } catch (e) {
    throw new Error('Cannot access the folder. Ensure it is a valid Google Drive or Shared Drive link and shared with access permissions. For Microsoft OneDrive or SharePoint, please use the task-level "Attach Link" instead.');
  }
}

/**
 * Retrieves the currently saved custom Google Drive folder URL.
 * @return {string}
 */
function getFolderUrl() {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_URL') || '';
}

// FYI CRUD
function getFYIs() {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('FYI');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((header, idx) => {
      item[header] = row[idx];
    });
    list.push(item);
  }
  return list;
}

function saveFYI(fyiItem) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('FYI');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const rowValues = headers.map(header => fyiItem[header] || '');
  
  // Check if item already exists
  let existingRowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === fyiItem.id) {
      existingRowIdx = i + 1; // 1-indexed row number
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return true;
}

function deleteFYI(id) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('FYI');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return true;
}

// SAP Codes CRUD
function getSAPCodes() {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('SAPCodes');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((header, idx) => {
      item[header] = row[idx];
    });
    list.push(item);
  }
  return list;
}

function saveSAPCode(codeItem) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('SAPCodes');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const rowValues = headers.map(header => codeItem[header] || '');
  
  // Check if item already exists (by id)
  let existingRowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(codeItem.id)) {
      existingRowIdx = i + 1; // 1-indexed row number
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    sheet.getRange(existingRowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return true;
}

function deleteSAPCode(id) {
  initSheet();
  const sheet = getSpreadsheet().getSheetByName('SAPCodes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return true;
}
