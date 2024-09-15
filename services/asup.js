const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const { google } = require('googleapis');
const fs = require('fs');
const { get } = require('http');
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
        WHERE medicaments.acteSoin LIKE '${care}' AND affectationVSAV = ${affectationVSAV} AND (asupStock.idStatutAsup = 1 OR asupStock.idStatutAsup = 3) ORDER BY idMedicament;`
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

    const rangeNotificationsEmail = `demandePeremption!A${lastRow - 1}:C${lastRow}`;

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

async function autoStatusReplacementPeremption(){
    let peremptionDate = new Date();
    peremptionDate.setDate(1);
    
    peremptionDate.setMonth(peremptionDate.getMonth() + 2);

    let request = `UPDATE asupStock SET idStatutAsup = 3 WHERE datePeremption < '${peremptionDate.toISOString().slice(0, 10)}' AND idStatutAsup = 1;`;

    await db.query(
        request
    );

    return { message: request + 'Envoyée' };

}

async function getRemplacementCount(){
    const totalCount = await db.query(
        `SELECT COUNT(*) FROM asupStock WHERE idStatutAsup = 3;`
    );
    const vsav1 = await db.query(
        `SELECT 
    m.nomMedicament, 
    COALESCE(SUM(CASE WHEN a.idStatutAsup = 3 THEN 1 ELSE 0 END), 0) as toReplace,
    m.prefixApp 
FROM 
    medicaments m 
LEFT JOIN 
    asupStock a 
ON 
    a.idMedicament = m.idMedicament 
AND 
    a.affectationVSAV = 1 
GROUP BY 
    m.idMedicament, m.nomMedicament;
`
    );
    const vsav2 = await db.query(
        `SELECT 
    m.nomMedicament, 
    COALESCE(SUM(CASE WHEN a.idStatutAsup = 3 THEN 1 ELSE 0 END), 0) as toReplace,
    m.prefixApp 
FROM 
    medicaments m 
LEFT JOIN 
    asupStock a 
ON 
    a.idMedicament = m.idMedicament 
AND 
    a.affectationVSAV = 2 
GROUP BY 
    m.idMedicament, m.nomMedicament;
`
    );

    const data = {
        "vsav1": helper.emptyOrRows(vsav1),
        "vsav2": helper.emptyOrRows(vsav2)
    };
    const meta = { total : totalCount };
    return {
        data,
        meta
    };
}

async function getPeremptionsCountAsup(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const rows = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM asupStock WHERE idStatutAsup != 4) AS nbTotal,
        (SELECT COUNT(*) FROM asupStock WHERE idStatutAsup = 1) AS nbReserve,
        (SELECT COUNT(*) FROM asupStock WHERE idStatutAsup = 3 OR idStatutAsup = 2) AS nbVSAV,
        (SELECT COUNT(*) FROM utilisationsASUP WHERE 1) AS nbLotsTotal
      FROM stock
      WHERE 1
      LIMIT 1;`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }
  async function getPeremptionsAsup(page = 1){
    const offset = helper.getOffset(page, config.listPerPage);
    const datePeremptionSixMois = new Date();
    datePeremptionSixMois.setMonth(datePeremptionSixMois.getMonth() + 6);
    let datePeremptionSixMoisString = datePeremptionSixMois.toISOString().slice(0, 19).replace('T', ' ');
    const rows = await db.query(
      `SELECT medicaments.nomMedicament as nomMateriel, asupStock.numLot, asupStock.datePeremption
      FROM asupStock
      INNER JOIN medicaments
      ON asupStock.idMedicament = medicaments.idMedicament
        WHERE datePeremption < '${datePeremptionSixMoisString}' AND asupStock.idStatutAsup != 4 AND asupStock.idStatutAsup != 2
        GROUP BY medicaments.nomMedicament, asupStock.numLot, asupStock.datePeremption 
        ORDER BY asupStock.datePeremption`
    );
    const data = helper.emptyOrRows(rows);
    const meta = {page};
  
    return {
      data,
      meta
    }
  }

  async function getMedicaments(){
    const rows = await db.query(
      `SELECT * FROM medicaments;`
    );
    const data = helper.emptyOrRows(rows);
    const meta = { message: 'Liste des médicaments' };
    return {
        data,
        meta
    };
  }

  async function getToReplace(medicament){
    const rows = await db.query(
      `SELECT * FROM asupStock WHERE idMedicament = ${medicament} AND (idStatutAsup = 3 OR idStatutAsup = 2);`
    );
    const data = helper.emptyOrRows(rows);
    const meta = { message: 'Liste des médicaments à remplacer' };
    return {
        data,
        meta
    };
  }

async function replacedStatus(data){
    let replacements = data.materielsAremplacer;
    let matriculeRemplaceur = data.matricule;
    for (const replacement of replacements) {
            const idStockAsup = replacement.idStockAsup;
            await db.query(`UPDATE asupStock SET idStatutAsup = 4, matriculeRemplaceur = '${matriculeRemplaceur}' WHERE idStockAsup = ${idStockAsup};`);
    }
    return { message: 'Step1-OK' };
}

async function createNewStock(data){
    const { vsavNombreDict, newMedicamentInfo, matricule } = data;
    const { selectedMedicament, datePeremption, numLot } = newMedicamentInfo;
    const { vsav1, vsav2, remaining } = vsavNombreDict;

    const totalItems = vsav1 + vsav2 + remaining;

    for (let i = 0; i < totalItems; i++) {
        let affectationVSAV;
        if (i < vsav1) {
            affectationVSAV = 1;
        } else if (i < vsav1 + vsav2) {
            affectationVSAV = 2;
        } else {
            affectationVSAV = null;
        }

        const query = `INSERT INTO asupStock (idMedicament, idStatutAsup, datePeremption, matriculeCreateur, numLot, affectationVSAV) 
                       VALUES (${selectedMedicament.value}, 1, '${datePeremption}', '${matricule}', '${numLot}', ${affectationVSAV});`;

        await db.query(query);
    }

    return { message: 'Step2-OK' };
}
  
async function getMedicamentsWithoutVsav(idMedicament){
    const rows = await db.query(
      `SELECT * FROM asupStock WHERE idMedicament = "${idMedicament}" AND affectationVSAV IS NULL;`
    );
    const data = helper.emptyOrRows(rows);
    const meta = { message: 'Liste des médicaments' };
    return {
        data,
        meta
    };
}

async function affectVsav(data){
    const vsav1 = data.vsav1;
    const vsav2 = data.vsav2;

    for (const item of vsav1) {
        await db.query(`UPDATE asupStock SET affectationVSAV = 1 WHERE idStockAsup = ${item.idStockAsup};`);
    }
    for (const item of vsav2) {
        await db.query(`UPDATE asupStock SET affectationVSAV = 2 WHERE idStockAsup = ${item.idStockAsup};`);
    }
    return { message: 'Step3-OK' };
}

async function getVizData(){
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };

    const interventions1 = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
    const interventions2 = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%202');

    const interventionsData1 = await interventions1.json();
    const interventionsData2 = await interventions2.json();

    const interventions = [...interventionsData1, ...interventionsData2];

    let twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo = twoYearsAgo.toISOString().slice(0, 19).replace('T', ' ');


    const rows1 = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 1
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin;`
    );
    const rows2 = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 2
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur;`
    );
    const rows3 = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 3
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur;`
    );
    const rows4A = await db.query(
        `SELECT * FROM utilisationsASUP WHERE dateActe > '${twoYearsAgo}';`
    );

    const rows4B = helper.emptyOrRows(rows4A);

    const rows4 = await Promise.all(rows4B.map(async (row) => {
        if (row.idMedicamentsList) {
            const medicamentIds = row.idMedicamentsList.split(',');
            const medicaments = await Promise.all(medicamentIds.map(async (id) => {
                const medicamentData = await db.query(`SELECT medicaments.nomMedicament, asupStock.datePeremption, asupStock.numLot FROM asupStock
                    INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
                    WHERE idStockAsup = ${id}`);
                return medicamentData[0];
            }));
            row.idMedicamentsList = medicaments;
        }
        const intervention = interventions.find(intervention => {
            const interventionYear = new Date(intervention.notificationDate).getFullYear();
            const acteYear = new Date(row.dateActe).getFullYear();
            return intervention.numeroInter == row.numIntervention && interventionYear === acteYear;
        });
        if (intervention) {
            row.interventionDetails = intervention;
        } else {
            row.interventionDetails = {
            identifiant: "",
            numeroInter: row.numIntervention,
            notificationDate: row.dateActe,
            notificationHeure: "",
            notificationTitre: "Entrée manuelle",
            notificationAdresse: "",
            notificationLon: "4.8448856",
            notificationLat: "45.8172792",
            notificationEngins: "",
            notificationVille: "",
            notification: ""
            };
        }
        return row;
    }));

    const rows5 = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.matriculeRemplaceur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 4 AND asupStock.datePeremption > '${twoYearsAgo}'
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur;`
    );

    const data = {
        rows1: helper.emptyOrRows(rows1),
        rows2: helper.emptyOrRows(rows2),
        rows3: helper.emptyOrRows(rows3),
        rows4: helper.emptyOrRows(rows4),
        rows5: helper.emptyOrRows(rows5)
    };
    const meta = { message: 'Visualization data' };
    return {
        data,
        meta
    };
};


module.exports = {
    getAsupAgent,
    getDoctor,
    getMedicamentsforCare,
    newInterventionAsup,
    sendEmail,
    addDemandePeremption,
    getDemandesPeremption,
    autoStatusReplacementPeremption,
    getRemplacementCount,
    getPeremptionsCountAsup,
    getPeremptionsAsup,
    getMedicaments,
    getToReplace,
    replacedStatus,
    createNewStock,
    getMedicamentsWithoutVsav,
    affectVsav,
    getVizData
};