// Deploy from the existing spreadsheet's bound Apps Script project.
// Enable the advanced Google Sheets service before deployment.
const APP_ORIGIN = 'https://dex-project-jp.github.io';
const SHEET_NAME = '成績一覧';
const SHEET_ID = 1326213985;
const HEADERS = ['回','日付','店舗','大会','順位','参加人数','上位率'];
const NOTE_PREFIX = 'POKER STATS LAB ID: ';

function configurePokerStats() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || book.getName() !== 'ポーカー成績管理' ||
      book.getSheetByName(SHEET_NAME)?.getSheetId() !== SHEET_ID) {
    throw new Error('対象のスプレッドシートから Apps Script を開いてください');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('POKER_STATS_SPREADSHEET', book.getId());
  if (!props.getProperty('POKER_STATS_TOKEN')) {
    props.setProperty('POKER_STATS_TOKEN', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g,''));
  }
}

function doPost(e) {
  let nonce = '';
  let result = {ok:false,code:'request'};
  try {
    const body = e.parameter.payload;
    if (!body || body.length > 12000000) throw new Error('Invalid payload');
    const data = JSON.parse(body);
    if (!/^[a-f0-9]{32}$/.test(data.nonce)) throw new Error('Invalid nonce');
    nonce = data.nonce;
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('POKER_STATS_TOKEN');
    if (!token || !tokensEqual_(token, data.token)) {
      result.code = 'auth';
    } else {
      const id = props.getProperty('POKER_STATS_SPREADSHEET');
      result = {ok:true,...appendMissing_(id,data.records)};
    }
  } catch (error) {
    console.error(error.message);
  }
  const message = JSON.stringify({...result,nonce});
  return HtmlService.createHtmlOutput('<script>window.top.postMessage('+message+','+
    JSON.stringify(APP_ORIGIN)+');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function tokensEqual_(expected, supplied) {
  if (typeof supplied !== 'string' || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let i=0;i<expected.length;i++) difference |= expected.charCodeAt(i)^supplied.charCodeAt(i);
  return difference === 0;
}

function dateKey_(value, timezone) {
  const formatted = value instanceof Date ? Utilities.formatDate(value,timezone,'yyyy-MM-dd') : String(value).trim();
  const match = /^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/.exec(formatted);
  if (!match) throw new Error('Unsupported date in records sheet');
  const [,year,month,day] = match;
  if (+year<1900 || +month<1 || +month>12 || (day && (+day<1 || +day>new Date(Date.UTC(+year,+month,0)).getUTCDate()))) {
    throw new Error('Invalid record date');
  }
  return [year,month.padStart(2,'0'),...(day?[day.padStart(2,'0')]:[])].join('-');
}

function recordKey_(date,venue,event,players,rank,timezone) {
  return JSON.stringify([dateKey_(date,timezone),String(venue).trim(),String(event).trim(),Number(players),Number(rank)]);
}

function appendMissing_(id, incoming) {
  if (!id || !Array.isArray(incoming) || incoming.length>10000) throw new Error('Invalid record list');
  const ids = new Set();
  const records = incoming.map(r=>{
    if (typeof r.id!=='string'||!r.id||r.id.length>200||ids.has(r.id)||
        typeof r.venue!=='string'||!r.venue.trim()||r.venue.length>120||
        typeof r.event!=='string'||!r.event.trim()||r.event.length>120||
        !Number.isSafeInteger(r.players)||r.players<1||r.players>1000000||
        !Number.isSafeInteger(r.rank)||r.rank<1||r.rank>r.players) throw new Error('Invalid record');
    ids.add(r.id);
    return {...r,date:dateKey_(r.date),key:recordKey_(r.date,r.venue,r.event,r.players,r.rank)};
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = SpreadsheetApp.openById(id);
    const sheet = book.getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getSheetId()!==SHEET_ID) throw new Error('Records tab is missing');
    const lastRow = sheet.getLastRow();
    const values = sheet.getRange(1,1,lastRow,HEADERS.length).getValues();
    if (HEADERS.some((header,i)=>values[0][i]!==header)) throw new Error('Records headers changed');
    const notes = sheet.getRange(1,1,lastRow,1).getNotes();
    const remoteIds = new Set();
    const remoteKeys = new Set();
    let sequence = 0;
    for (let i=1;i<values.length;i++) {
      const [number,date,venue,event,rank,players] = values[i];
      if (notes[i][0].startsWith(NOTE_PREFIX)) remoteIds.add(notes[i][0].slice(NOTE_PREFIX.length));
      if (date !== '') remoteKeys.add(recordKey_(date,venue,event,players,rank,book.getSpreadsheetTimeZone()));
      sequence = Math.max(sequence,Number(number)||0);
    }
    const rows = [];
    for (const r of records) {
      if (remoteIds.has(r.id)||remoteKeys.has(r.key)||remoteKeys.has(r.previous)) continue;
      const row = lastRow+rows.length+1;
      rows.push({values:[
        {userEnteredValue:{numberValue:++sequence},note:NOTE_PREFIX+r.id},
        {userEnteredValue:{stringValue:r.date.replace(/-/g,'/')}},
        {userEnteredValue:{stringValue:r.venue}},
        {userEnteredValue:{stringValue:r.event}},
        {userEnteredValue:{numberValue:r.rank}},
        {userEnteredValue:{numberValue:r.players}},
        {userEnteredValue:{formulaValue:'=IFERROR(1-(E'+row+'-1)/F'+row+',"")'},
         userEnteredFormat:{numberFormat:{type:'PERCENT',pattern:'0.0%'}}}
      ]});
      remoteKeys.add(r.key);
    }
    if (rows.length) {
      const requests = [];
      const remaining = sheet.getMaxRows()-lastRow;
      if (rows.length>remaining) requests.push({appendDimension:{sheetId:SHEET_ID,dimension:'ROWS',length:rows.length-remaining}});
      requests.push({updateCells:{start:{sheetId:SHEET_ID,rowIndex:lastRow,columnIndex:0},
        rows,fields:'userEnteredValue,note,userEnteredFormat.numberFormat'}});
      // Cell values and IDs are committed together, even if the response is lost.
      Sheets.Spreadsheets.batchUpdate({requests},id);
    }
    return {added:rows.length,existing:records.length-rows.length};
  } finally {
    lock.releaseLock();
  }
}
