const express = require('express');
const { google } = require('googleapis');
const config = require('../config');

const router = express.Router();

const HIST_SMARTEMIS_SPREADSHEET_ID = '1iz10zClKpYZnp1QJWDpEmBl6zKUXX__AOju09ZBLzZ8';
const HIST_SMARTEMIS_SHEETS = ['Communes', 'Compteurs_departs', 'Vehicules_Hist'];

function buildSheetRange(title, columns = 'A:ZZ') {
  const needsQuotes = /\s|[^A-Za-z0-9_\-]/.test(title);
  const safeTitle = needsQuotes ? `'${title.replace(/'/g, "\\'")}'` : title;
  return `${safeTitle}!${columns}`;
}

function extractTitleFromRange(range = '') {
  if (!range.includes('!')) {
    return range;
  }
  const title = range.split('!')[0];
  return title.replace(/^'(.*)'$/, '$1');
}

function valuesToDictionaries(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  const rawHeaders = Array.isArray(values[0]) ? values[0] : [];
  const usedHeaders = new Set();
  const headers = rawHeaders.map((header, index) => {
    const base = String(header || '').trim() || `column_${index + 1}`;
    let finalHeader = base;
    let suffix = 2;

    while (usedHeaders.has(finalHeader)) {
      finalHeader = `${base}_${suffix}`;
      suffix += 1;
    }

    usedHeaders.add(finalHeader);
    return finalHeader;
  });

  return values
    .slice(1)
    .map((row) => {
      const hasContent = Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== '');
      if (!hasContent) {
        return null;
      }

      const line = {};
      headers.forEach((header, index) => {
        line[header] = row[index] || '';
      });
      return line;
    })
    .filter(Boolean);
}

function getGoogleSheetsClient() {
  const privateKeyRaw =
    (config && config.google && config.google.private_key) || process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail =
    (config && config.google && config.google.client_email) || process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKeyRaw || !clientEmail) {
    throw new Error(
      'Google credentials missing: configure GG_private_key and GG_client_email (or GOOGLE_PRIVATE_KEY / GOOGLE_CLIENT_EMAIL).'
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT(clientEmail, null, privateKey, [
    'https://www.googleapis.com/auth/spreadsheets',
  ]);

  return google.sheets({ version: 'v4', auth });
}

router.get('/', async function (req, res, next) {
  try {
    const sheets = getGoogleSheetsClient();

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: HIST_SMARTEMIS_SPREADSHEET_ID,
      fields: 'sheets.properties.title',
    });

    const availableTitles = ((meta && meta.data && meta.data.sheets) || [])
      .map((sheet) => (sheet.properties && sheet.properties.title ? sheet.properties.title : ''));

    const missingSheets = HIST_SMARTEMIS_SHEETS.filter((title) => !availableTitles.includes(title));
    if (missingSheets.length > 0) {
      return res.status(404).json({
        message: 'Certaines feuilles demandées sont introuvables dans le spreadsheet.',
        missingSheets,
      });
    }

    const ranges = HIST_SMARTEMIS_SHEETS.map((title) => buildSheetRange(title));
    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: HIST_SMARTEMIS_SPREADSHEET_ID,
      ranges,
    });

    const valuesByTitle = {};
    const valueRanges = (batchRes && batchRes.data && batchRes.data.valueRanges) || [];

    valueRanges.forEach((valueRange) => {
      if (!valueRange || !valueRange.range) {
        return;
      }
      const title = extractTitleFromRange(valueRange.range);
      valuesByTitle[title] = valueRange.values || [];
    });

    const response = {};
    HIST_SMARTEMIS_SHEETS.forEach((title) => {
      response[title] = valuesToDictionaries(valuesByTitle[title] || []);
    });

    return res.json(response);
  } catch (err) {
    console.error('Erreur lors de la récupération des données hist_Smartemis:', err.message);
    return next(err);
  }
});

module.exports = router;
