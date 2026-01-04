const { google } = require('googleapis');
const config = require('../config');

const SPREADSHEET_ID = '1tnZ7-Lrjp6FBoZfhhOacIuU72e3sa7aaL-Yissqxu4E';

async function getSheetsAuth() {
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    return google.sheets({ version: 'v4', auth });
}

async function changeConnexion(matricule) {
    try {
        const sheets = await getSheetsAuth();
        
        // Lire toutes les données pour trouver la ligne du matricule
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Manoeuvrants!A:J',
        });

        const values = response.data.values || [];
        if (values.length < 2) {
            throw new Error('No data found in Manoeuvrants sheet');
        }

        // Trouver la ligne correspondant au matricule (colonne A, index 0)
        let rowIndex = -1;
        for (let i = 1; i < values.length; i++) {
            if (values[i][0] === matricule) {
                rowIndex = i + 1; // +1 car les indices de ligne dans l'API commencent à 1
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Matricule ${matricule} not found`);
        }

        // Mettre à jour StatusConnexion (colonne I, index 8)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Manoeuvrants!I${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [['OK']],
            },
        });

        console.log(`StatusConnexion updated to OK for matricule ${matricule}`);
        return { success: true, matricule, statusConnexion: 'OK' };
    } catch (err) {
        console.error('Error changing connexion:', err);
        throw err;
    }
}

async function declenchementManoeuvre(engin, caserne) {
    try {
        const sheets = await getSheetsAuth();
        
        // Lire toutes les données
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Manoeuvrants!A:J',
        });

        const values = response.data.values || [];
        if (values.length < 2) {
            throw new Error('No data found in Manoeuvrants sheet');
        }

        // Trouver toutes les lignes correspondant à engin et caserne
        // engLib est en colonne E (index 4), engCaserne en colonne F (index 5)
        const rowsToUpdate = [];
        for (let i = 1; i < values.length; i++) {
            if (values[i][4] === engin && values[i][5] === caserne) {
                rowsToUpdate.push(i + 1); // +1 car les indices de ligne commencent à 1
            }
        }

        if (rowsToUpdate.length === 0) {
            throw new Error(`No rows found for engin ${engin} and caserne ${caserne}`);
        }

        // Mettre à jour StatusAlerte (colonne J, index 9) pour toutes les lignes trouvées
        const updates = rowsToUpdate.map(rowIndex => ({
            range: `Manoeuvrants!J${rowIndex}`,
            values: [['DONE']],
        }));

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            valueInputOption: 'USER_ENTERED',
            resource: {
                data: updates,
            },
        });

        console.log(`StatusAlerte updated to DONE for engin ${engin} and caserne ${caserne}`);
        return { success: true, engin, caserne, rowsUpdated: rowsToUpdate.length, statusAlerte: 'DONE' };
    } catch (err) {
        console.error('Error in declenchementManoeuvre:', err);
        throw err;
    }
}

async function departManoeuvre(matricule) {
    try {
        const sheets = await getSheetsAuth();
        
        // Lire toutes les données
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Manoeuvrants!A:J',
        });

        const values = response.data.values || [];
        if (values.length < 2) {
            throw new Error('No data found in Manoeuvrants sheet');
        }

        // Trouver la ligne correspondant au matricule
        let rowIndex = -1;
        for (let i = 1; i < values.length; i++) {
            if (values[i][0] === matricule) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Matricule ${matricule} not found`);
        }

        // Mettre à jour StatusAlerte (colonne J, index 9)
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Manoeuvrants!J${rowIndex}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [['RECEIVED']],
            },
        });

        console.log(`StatusAlerte updated to RECEIVED for matricule ${matricule}`);
        return { success: true, matricule, statusAlerte: 'RECEIVED' };
    } catch (err) {
        console.error('Error in departManoeuvre:', err);
        throw err;
    }
}

async function reinitialiseManoeuvre() {
    try {
        const sheets = await getSheetsAuth();
        
        // Vider Manoeuvre_info à partir de A2
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Manoeuvre_info!A2:C',
        });

        // Vider Manoeuvrants à partir de A2
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Manoeuvrants!A2:J',
        });

        console.log('Manoeuvre sheets cleared successfully');
        return { success: true, message: 'Manoeuvre sheets cleared' };
    } catch (err) {
        console.error('Error reinitialising manoeuvre:', err);
        throw err;
    }
}

async function getManoeuvreDetails() {
    try {
        const sheets = await getSheetsAuth();
        
        // Récupérer les titres des feuilles
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });
        
        const sheetsMeta = (meta && meta.data && meta.data.sheets) || [];
        const desiredTitles = ['Manoeuvre_info', 'Manoeuvrants'];
        const availableTitles = sheetsMeta.map(s => s.properties && s.properties.title ? s.properties.title : '');
        const titlesToFetch = desiredTitles.filter(t => availableTitles.includes(t));
        
        if (titlesToFetch.length === 0) {
            return {};
        }

        // Construire les ranges
        const ranges = titlesToFetch.map(title => {
            const needsQuotes = /\s|[^A-Za-z0-9_\-]/.test(title);
            const safeTitle = needsQuotes ? `'${title.replace(/'/g, "\\'")}'` : title;
            if (title === 'Manoeuvre_info') {
                return `${safeTitle}!A:Z`;
            } else {
                return `${safeTitle}!A:Z`;
            }
        });

        // Récupérer les données en batch
        const batchRes = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges,
        });

        // Mapper les résultats par titre de feuille
        const result = {};
        const valueRanges = batchRes.data.valueRanges || [];
        
        for (let i = 0; i < titlesToFetch.length; i++) {
            const title = titlesToFetch[i];
            const valueRange = valueRanges[i];
            if (valueRange && valueRange.values) {
                result[title] = valueRange.values;
            } else {
                result[title] = [];
            }
        }

        return result;
    } catch (err) {
        console.error('Error getting manoeuvre details:', err);
        throw err;
    }
}

module.exports = {
    changeConnexion,
    declenchementManoeuvre,
    departManoeuvre,
    reinitialiseManoeuvre,
    getManoeuvreDetails
};

