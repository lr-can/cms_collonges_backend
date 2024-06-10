const { google } = require('googleapis');
const config = require('../config');

async function insertInterventionNotif(data) {
        const privateKey = config.google.private_key.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT(
            config.google.client_email,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE'
    const rowData = [data.notification];
    const range = 'Feuille 1!A1:K';

    try {
        // Append the new row to the spreadsheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: ['Added with CMS API','','','','','','','','','',rowData],
            },
        });
        console.log('Row appended successfully!');
        return response;
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
}

module.exports = { insertInterventionNotif};
