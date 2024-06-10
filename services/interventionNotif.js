const { google } = require('googleapis');
const config = require('../config');

async function insertInterventionNotif(data) {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.google,
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE'
    const rowData = [data.notification];
    const range = 'Feuille 1!K1:K';

    // Append the new row to the spreadsheet
    sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [rowData],
        },
    }, (err, response) => {
        if (err) {
            console.error('Error appending row:', err);
            return;
        }
        console.log('Row appended successfully!');
    }
    );
}

module.exports = { insertInterventionNotif};
