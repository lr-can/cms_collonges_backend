const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const { google } = require('googleapis');
const fs = require('fs');
let fetch


async function getAsupAgent(matricule) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        const agents = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsASUP');
        const data = await agents.json();
        
        const agent = data.find(agent => agent.matricule === matricule);
        if (!agent) {
            throw new Error('Agent non trouvé');
        }
        
        const { nomAgent, prenomAgent, grade, asup1, asup2 } = agent;
        return { nomAgent, prenomAgent, grade, asup1, asup2 };
    } catch (error) {
        console.error(error);
        throw new Error('Aucun agent ne correspond au matricule ' + matricule + '.');
    }
}
async function getDoctor(RPPS) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT(
            config.google.client_email,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

    const sheets = google.sheets({version: 'v4', auth});
    const spreadsheetId = config.google.spreadsheetId2;
    const rppsNumber = RPPS;
    const range = 'recherche_RPPS!A2';

    try {
        // Append the new row to the spreadsheet
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [
                    [
                    `=MATCH(${rppsNumber}; RPPS!A:A; 0)`
                        ]
                    ],
            },
        });
        
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
    try {
        const response = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/recherche_RPPS');
        const data = await response.json();
        
        const rowNumber = data[0].RowNumber;

        const range = `RPPS!A${rowNumber}:C${rowNumber}`;

        const response2 = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        console.log(response);

        const values = response2.data.values;

        if (!values || values.length === 0) {
            throw new Error('No data found in the specified row.');
        }

        const [identifiantRPPS, nomExercice, prenomExercice] = values[0];

        return { identifiantRPPS, nomExercice, prenomExercice };
        
    } catch (error) {
        console.error(error);
        throw new Error(error);
    }
}

async function getMedicamentsforCare(care, affectationVSAV, page = 1){
      const rows = await db.query(
        `SELECT asupStock.idStockAsup, asupStock.idMedicament, asupStock.numLot, asupStock.datePeremption, medicaments.nomMedicament
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE medicaments.acteSoin LIKE '${care}' AND asupStock.idStatutAsup = 1 AND affectationVSAV = ${affectationVSAV} ORDER BY idMedicament;`
      );
      const data = helper.emptyOrRows(rows);
      const meta = {page};
    
      return {
        data,
        meta
      }
}

async function newInterventionAsup(formData){
    const currentidUtilisation = await db.query(
        `SELECT MAX(idUtilisation) FROM utilisationsASUP;`
    );
    const idUtilisation = currentidUtilisation + 1;
    
    let query1 = `INSERT INTO utilisationsASUP idUtilisation, matriculeAgent, dateActe, medecinPrescripteur, numIntervention, acteSoin, idMedicamentsList, effetsSecondaires, commentaire
    VALUES (${idUtilisation}, "${data.matricule}", '', "${data.medecinPrescripteur}", "${data.numIntervention}", "${data.acteSoin}", "${data.idMedicamentsList}", "${data.effetsSecondaires}", "${data.commentaire}");`

    let query2 = '';
    for (const item of formData.idMedicamentsList) {
        query2 += `UPDATE asupStock
                                SET idStatutAsup = 2, idUtilisationAsup = ${idUtilisation}
                                WHERE idStockAsup = ${item};`;
    }
    const rows = await db.query(
        query1 + query2, 
    );
    const data = helper.emptyOrRows(rows);
    const meta = {message: 'Insertion réussie'};
    return {
        data,
        meta
    }
}

module.exports = {
    getAsupAgent,
    getDoctor,
    getMedicamentsforCare,
    newInterventionAsup
};