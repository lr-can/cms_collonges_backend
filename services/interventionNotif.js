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

    const sheets = google.sheets({version: 'v4', auth});
    const spreadsheetId = config.google.spreadsheetId;
    const rowData = data.notification;
    const range = 'Feuille 1!A1:K';

    try {
        // Append the new row to the spreadsheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [['Added with CMS API','','','','','','','','','',rowData]],
            },
        });
        console.log('Row appended successfully!');
        
        return response;
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
}

async function giveInterventionType(titre) {
    let interTypeDictionnary = {};

    try {
        const response = await fetch('https://opensheet.elk.sh/19kgbE-Z4kIbM49-rVE0hv9ihMBv_a5hOzP9DAa1CHt8/1');
        const data = await response.json();

        data.forEach(row => {
            const interventionCode = row['codeSinistre']; // Correction ici
            const libelleMajSinistre = row['libelleMajSinistre'];
            let value = "";

            if (interventionCode.startsWith('1')) {
                value = "SSUAP";
            } else if (interventionCode.startsWith('2')) {
                if (/^2B\d{2}$/.test(interventionCode)) {
                    value = "Violences_Urbaines";
                } else {
                    value = "Accident";
                }
            } else if (interventionCode.startsWith('3')) {
                if (interventionCode.length === 3) {
                    value = "Violences_Urbaines_Graves";
                } else {
                    value = "Incendie";
                }
            } else if (interventionCode.startsWith('4') || interventionCode.startsWith('5')) {
                value = "PPBE";
            }

            interTypeDictionnary[libelleMajSinistre] = value;
        });

        const type = interTypeDictionnary[titre];
        return { type: type };

    } catch (err) {
        console.error('Error fetching data:', err);
        throw err;
    }
}

module.exports = { insertInterventionNotif, giveInterventionType};
