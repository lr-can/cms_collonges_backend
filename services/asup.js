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
        
        const { nomAgent, prenomAgent, grade, asup1, asup2, email } = agent;
        return { nomAgent, prenomAgent, grade, asup1, asup2, email };
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

async function newInterventionAsup(formData) {
    const currentidUtilisation = await db.query(
        `SELECT MAX(idUtilisation) FROM utilisationsASUP;`
    );
    if (currentidUtilisation[0]['MAX(idUtilisation)'] == null) {
        currentidUtilisation[0]['MAX(idUtilisation)'] = 0;
    }
    const idUtilisation = parseInt(currentidUtilisation[0]['MAX(idUtilisation)']) + 1;

    let fields = ['idUtilisation', 'matriculeAgent', 'medecinPrescripteur', 'numIntervention', 'acteSoin'];
    let values = [idUtilisation, `"${formData.matricule}"`, `"${formData.medecinPrescripteur}"`, `"${formData.numIntervention}"`, `"${formData.acteSoin}"`];

    if (formData.idMedicamentsList) {
        fields.push('idMedicamentsList');
        values.push(`"${formData.idMedicamentsList}"`);
    }
    if (formData.effetsSecondaires) {
        fields.push('effetsSecondaires');
        values.push(`"${formData.effetsSecondaires}"`);
    }
    if (formData.commentaire) {
        fields.push('commentaire');
        values.push(`"${formData.commentaire}"`);
    }

    let query1 = `INSERT INTO utilisationsASUP (${fields.join(', ')}) VALUES (${values.join(', ')});`;
    const rows = await db.query(query1);

    if (formData.idMedicamentsList) {
        for (const item of formData.idMedicamentsList.split(',')) {
            await db.query(`UPDATE asupStock SET idStatutAsup = 2, idUtilisationAsup = ${idUtilisation} WHERE idStockAsup = ${item};`);
        }
    }

    const data = helper.emptyOrRows(rows);
    const meta = { message: 'Insertion réussie' };
    return {
        data,
        meta
    };
}

async function sendEmail(emailData){
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const email = `
    Bonjour,

    L'intervention ${emailData.intervention} (${currentDate}) a fait l'objet d'un, ou de plusieurs, acte(s) de soin sur prescription.
    Voici les détails de l'intervention :

    ---------------------------------------------
    Agent : ${emailData.agent}
    Médecin : ${emailData.medecin}
    Véhicule : ${emailData.vsav}
    Soin : ${emailData.soin}
    Médicaments : ${emailData.medicaments ? emailData.medicaments : 'Aucun médicament renseigné'}
    Effets secondaires : ${emailData.effetsSecondaires ? emailData.effetsSecondaires : 'Aucun effet secondaire renseigné'}
    Commentaire : ${emailData.commentaire ? emailData.commentaire : 'Aucun commentaire renseigné'}
    ---------------------------------------------

    Respectueusement,
    Le Bureau Informatique Divers CT
    `;
    const emailAdress = emailData.agentMail;

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

    const lastRow = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'notificationsEmail!A:A',
    }).then(response => response.data.values.length + 1);

    const rangeNotificationsEmail = `notificationsEmail!A2:C${lastRow}`;
    const valuesNotificationsEmail = [[emailAdress, email, ""]];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: rangeNotificationsEmail,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: valuesNotificationsEmail,
            },
        });
    } catch (err) {
        console.error('Error appending row:', err);
        throw err;
    }
}

async function addDemandePeremption(data){
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

    const lastRow = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'demandePeremption!A:A',
    }).then(response => response.data.values.length + 1);

    const rangeNotificationsEmail = `demandePeremption!A2:C${lastRow}`;
    const valuesDemandePeremption = [[data.mois, data.url, data.correspondantAsup]];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: rangeNotificationsEmail,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: valuesDemandePeremption,
            },
        });
    } catch (err) {
        console.error('Error appending row:', err);
        throw err;
    }
}

async function getDemandesPeremption(){
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

    const lastRow = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'demandePeremption!A:A',
    }).then(response => response.data.values.length + 1);

    const rangeNotificationsEmail = `demandePeremption!A2:C${lastRow}`;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: rangeNotificationsEmail,
        });

        const values = response.data.values;
        const returnData = {
            mois: values[0][0],
            url: values[0][1],
            correspondantAsup: values[0][2]
        }

        if (!values || values.length === 0) {
            throw new Error('No data found in the specified row.');
        }

        return returnData;
        
    } catch (error) {
        console.error(error);
        throw new Error(error);
    }
}

module.exports = {
    getAsupAgent,
    getDoctor,
    getMedicamentsforCare,
    newInterventionAsup,
    sendEmail,
    addDemandePeremption,
    getDemandesPeremption
};