const db = require('./db');
const helper = require('../helper');
const config = require('../config');
const { google } = require('googleapis');
const fs = require('fs');
const pdf = require('html-pdf');
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
    const shortDataResponse = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/RPPS_short');
    const shortData = await shortDataResponse.json();
    const doctor = shortData.find(doc => doc.identifiantRPPS === RPPS);

    if (doctor) {
        return {
            identifiantRPPS: doctor.identifiantRPPS,
            nomExercice: doctor.nomExercice,
            prenomExercice: doctor.prenomExercice
        };
    } else {
        const sheets = google.sheets({ version: 'v4', auth });
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

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'RPPS_short!A:C',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [
                        [identifiantRPPS, nomExercice, prenomExercice]
                    ],
                },
            });

            return { identifiantRPPS, nomExercice, prenomExercice };

        } catch (error) {
            console.error(error);
            throw new Error(error);
        }
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

    const agents = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsASUP');
    const agentsData = await agents.json();

    let twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo = twoYearsAgo.toISOString().slice(0, 19).replace('T', ' ');


    const rows1A = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 1
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin;`
    );
    const rows2A = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 2
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur;`
    );
    const rows3A = await db.query(
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
            return intervention.numeroInter.toString() == row.numIntervention.toString() && interventionYear === acteYear;
        });
        if (intervention) {
            row.interventionDetails = intervention;
        } else {
            const dateActe = new Date(row.dateActe);
            const formattedDate = `${dateActe.getDate()}/${dateActe.getMonth() + 1}/${dateActe.getFullYear()}`;
            const timeActe = dateActe.toISOString().slice(11, 16);
            row.interventionDetails = {
                identifiant: "",
                numeroInter: row.numIntervention,
                notificationDate: formattedDate,
                notificationHeure: timeActe,
                notificationTitre: "Entrée manuelle",
                notificationAdresse: "Aucune adresse trouvée",
                notificationLon: "4.8448856",
                notificationLat: "45.8172792",
                notificationEngins: "0",
                notificationVille: "Aucune ville trouvée",
                notification: "Pas de notif associée"
            };
        }
        const doctorCache = {};

        if (row.medecinPrescripteur) {
            if (doctorCache[row.medecinPrescripteur]) {
                row.medecinPrescripteur = doctorCache[row.medecinPrescripteur];
            } else {
                const doctor = await getDoctor(row.medecinPrescripteur);
                doctorCache[row.medecinPrescripteur] = doctor;
                row.medecinPrescripteur = doctor;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (row.matriculeAgent) {
            if (agentsData[row.matriculeAgent]) {
                row.agent = agentsData[row.matriculeAgent];
            } else {
                const agent = await getAsupAgent(row.matriculeAgent);
                agentsData[row.matriculeAgent] = agent;
                row.agent = agent;
            }
        }    
        return row;
    }));

    const rows5A = await db.query(
        `SELECT medicaments.nomMedicament, COUNT(asupStock.idStockAsup) as count, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.matriculeRemplaceur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin
        FROM asupStock INNER JOIN medicaments ON asupStock.idMedicament = medicaments.idMedicament
        WHERE asupStock.idStatutAsup = 4 AND asupStock.datePeremption > '${twoYearsAgo}'
        GROUP BY medicaments.nomMedicament, asupStock.affectationVSAV, asupStock.matriculeCreateur, asupStock.datePeremption, asupStock.numLot, medicaments.acteSoin, asupStock.matriculeRemplaceur;`
    );
    const rows1 = await Promise.all(rows1A.map(async (row) => {
        if (row.matriculeCreateur) {
            if (agentsData[row.matriculeCreateur]) {
                row.createur = agentsData[row.matriculeCreateur];
            } else {
                const agent = await getAsupAgent(row.matriculeCreateur);
                agentsData[row.matriculeCreateur] = agent;
                row.createur = agent;
            }
        }
        return row;
    }));

    const rows2 = await Promise.all(rows2A.map(async (row) => {
        if (row.matriculeCreateur) {
            if (agentsData[row.matriculeCreateur]) {
                row.createur = agentsData[row.matriculeCreateur];
            } else {
                const agent = await getAsupAgent(row.matriculeCreateur);
                agentsData[row.matriculeCreateur] = agent;
                row.createur = agent;
            }
        }
        return row;
    }));

    const rows3 = await Promise.all(rows3A.map(async (row) => {
        if (row.matriculeCreateur) {
            if (agentsData[row.matriculeCreateur]) {
                row.createur = agentsData[row.matriculeCreateur];
            } else {
                const agent = await getAsupAgent(row.matriculeCreateur);
                agentsData[row.matriculeCreateur] = agent;
                row.createur = agent;
            }
        }
        return row;
    }));

    const rows5 = await Promise.all(rows5A.map(async (row) => {
        if (row.matriculeCreateur) {
            if (agentsData[row.matriculeCreateur]) {
                row.createur = agentsData[row.matriculeCreateur];
            } else {
                const agent = await getAsupAgent(row.matriculeCreateur);
                agentsData[row.matriculeCreateur] = agent;
                row.createur = agent;
            }
        }
        return row;
    }));


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

async function generatePDF(){
    const data_meta = await getVizData();
    const data = data_meta.data;
        
        const htmlHeader = `
        <html>
        <head>
        <style>
            html{
                font-family: Arial, sans-serif;
                font-size: 12px;
                  word-wrap: break-word;
                word-break: break-word;
            }
                            #viz{
                    width: 100%;
                }
                .illustrationImg{
                    border-radius: 10px;
                    scale: 1.1;
                }
                .illustrationImg:hover{
                    scale: 1.2;
                    cursor: pointer;
                }
                .agentInfo {
                    display: flex;
                    align-items: center;
                }
                .agentInfo > img {
                    margin-right: 0.5rem;
                    display: inline-flex;
                    align-items: center;
                    vertical-align: middle;
                    border-radius: 5px;
                }
                .agentInfo > span {
                    display: inline-flex;
                    align-items: center;
                    vertical-align: middle;
                }
                .illustration > div{
                    margin: auto;
                }
                .replacementPanelFilter {
                    backdrop-filter: blur(10px) brightness(0.8);
                    width: 100vw;
                    height: 100vh;
                    z-index: 3;
                    position: fixed;
                    top: 0;
                    left: 0;

                }

                .replacementPanel {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 9999;
                    background-color: white;
                    border-radius: 10px;
                    padding: 1rem;
                    flex-wrap: wrap;
                    min-width: 30%;
                    max-width: 50%;
                    max-height: 80vh;
                    transition: all 0.5s ease-in-out;
                    overflow-y: scroll;
                }
                @media screen and (max-width: 768px) {
                    .replacementPanel {
                        min-width: 90vw;
                        max-width: 90vw;
                    }
                    
                }
                .bold{
                    font-weight: bold;
                }
                #dropdown{
                    width: 100%;
                    margin: auto;
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                }
                .imgLoading{
                    margin: auto;
                    margin-top: 1rem;
                    margin-bottom: 1rem;
                }

                .replacementPanel > div {
                    margin: 1rem;
                }
                #utilisationMessage{
                    font-style: italic;
                    color: #666666;
                    margin-bottom: 1rem;
                    font-size: 0.8rem;
                }
                .status3, .status2, .utilisationsASUP, .database{
                    margin-bottom: 1rem;
                    border-bottom: 1px solid #e5e5e5;
                    padding-bottom: 1rem;
                }
                .status3-title{
                    font-size: 1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: #d64d00;
                }
                .status2-title{
                    font-size: 1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: #0078f3;
                }
                .utilisationsASUP-title{
                    font-size: 1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: #009081;
                }
                .database-title{
                    font-size: 1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    color: #C08C65;
                }
                h2 {
                    font-size: 16px;
                    font-weight: bold;}
                h1 {
                    font-size: 18px;
                    font-weight: bold;
}   
                .status3-content {
                    display: table;
                    width: 100%;
                    margin-bottom: 1rem;
                    overflow-x: scroll;
                    white-space: nowrap;
                }
                .status2-content {
                    display: table;
                    width: 100%;
                    margin-bottom: 1rem;
                    overflow-x: scroll;
                    white-space: nowrap;
                }
                .status5-content {
                    display: table;
                    width: 100%;
                    margin-bottom: 1rem;
                    overflow-x: scroll;
                    white-space: nowrap;
                }
                .utilisationsASUP-content {
                    display: table;
                    width: 100%;
                    margin-bottom: 1rem;
                    overflow-x: scroll;
                    white-space: nowrap;
                }
                .status1-content {
                    display: table;
                    width: 100%;
                    margin-bottom: 1rem;
                    overflow-x: scroll;
                    white-space: nowrap;
                }
                .status1-header{
                    display: table-row;
                }
                .status3-header{
                    display: table-row;
                }
                .status2-header{
                    display: table-row;
                }
                .status5-header{
                    display: table-row;
    }
                .utilisationsASUP-header{
                    display: table-row;
                }
                .status3-header-item{
                    display: table-cell;
                    font-weight: bold;
                    padding: 0.5rem;
                    border-bottom: 1px solid #d64d00;
                    color: #d64d00;
                    text-align: center;
                    vertical-align: middle;
                }
                .status2-header-item{
                    display: table-cell;
                    font-weight: bold;
                    padding: 0.5rem;
                    border-bottom: 1px solid #0078f3;
                    color: #0078f3;
                    text-align: center;
                    vertical-align: middle;
                }
                .utilisationsASUP-header-item{
                    display: table-cell;
                    font-weight: bold;
                    padding: 0.5rem;
                    border-bottom: 1px solid #009081;
                    color: #009081;
                    text-align: center;
                    vertical-align: middle;
                }
                .status5-header-item{
                    display: table-cell;
                    font-weight: bold;
                    padding: 0.5rem;
                    border-bottom: 1px solid #666666;
                    color: #666666;
                    text-align: center;
                    vertical-align: middle;
            }

                .status3-content-items{
                    display: table-row;
                    padding: 0.5rem;
                }
                .status2-content-items{
                    display: table-row;
                    padding: 0.5rem;
                }
                .status5-content-items{
                    display: table-row;
                    padding: 0.5rem;
                }   
                .utilisationsASUP-content-items{
                    display: table-row;
                    padding: 0.5rem;
                }
                .status1-content-items{
                    display: table-row;
                    padding: 0.5rem;
                }
                .status3-content-item{
                    display: table-cell;
                    border-bottom: 1px solid #d64d00;
                    text-align: center;
                    vertical-align: middle;
                    padding: 0.5rem;
                }
                .status2-content-item{
                    display: table-cell;
                    border-bottom: 1px solid #0078f3;
                    text-align: center;
                    vertical-align: middle;
                    padding: 0.5rem;
                }
                .utilisationsASUP-content-item{
                    display: table-cell;
                    border-bottom: 1px solid #009081;
                    text-align: center;
                    vertical-align: middle;
                    padding: 0.5rem;
                }
                .status5-content-item{
                    display: table-cell;
                    border-bottom: 1px solid #666666;
                    text-align: center;
                    vertical-align: middle;
                    padding: 0.5rem;
                }
                .status1-content-item{
                    display: table-cell;
                    border-bottom: 1px solid #C08C65;
                    text-align: center;
                    vertical-align: middle;
                    padding: 0.5rem;
                }
                .status1-header-item{
                    display: table-cell;
                    font-weight: bold;
                    padding: 0.5rem;
                    border-bottom: 1px solid #C08C65;
                    color: #C08C65;
                    text-align: center;
                    vertical-align: middle;
                }
                .utilisationsASUP-content-item:hover{
                    background-color: #dffdf7;
                    cursor: pointer;
                }
                .status3-content-items:nth-child(odd){
                    background-color: #fff4f3;
                }
                .status2-content-items:nth-child(odd){
                    background-color: #f4f6ff;
                }
                .utilisationsASUP-content-items:nth-child(odd){
                    background-color: #dffdf7;
                }
                .status5-content-items:nth-child(odd){
                    background-color: #ededed;
                }
                .status1-content-items:nth-child(odd){
                    background-color: #fbf5f2;
                }
                .status3-message, .status2-message, .utilisationsASUP-message, .status1-message, .status5-message, .message{
                    font-style: italic;
                    text-align: center;
                    margin-top: 1rem;
                    text-align: left;
                    color: #666666;
                    margin-bottom: 1.3rem;
                    font-size: 0.8rem;
                }
        </style>
        </head>`;
        

                    // Corps du HTML avec insertion dynamique des données
            let htmlBody = `<body>`;
            const currentDate = new Date();
            const monthNames = [
                "janvier", "février", "mars", "avril", "mai", "juin",
                "juillet", "août", "septembre", "octobre", "novembre", "décembre"
            ];
            const currentMonth = monthNames[currentDate.getMonth()];
            const currentYear = currentDate.getFullYear();

            const moisPrefix = ["août", "avril", "octobre"].includes(currentMonth) ? "d'" : "de";
            htmlBody += `
                <div style="display: flex; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; width: 100%">
                    <img src="https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/logoTitle.png?raw=true" alt="Logo" height="70px" width="auto" style="height: 70px; margin-right: 10px;">
                    <h1>Rapport Mensuel ASUP - CMS Collonges</h1>
                    <h3>Mois ${moisPrefix} ${currentMonth} ${currentYear}</h3>
                </div>
            `;

            // Section des médicaments
            htmlBody += `
            <div id="viz">
            <h2>Liste des Médicaments Disponibles</h2>`;
            if (data.rows1 && data.rows1.length > 0) {
                htmlBody += `<div class="status1-content">
                    <div class="status1-header">
                        <div class="status1-header-item" style="width: 5%">Nbre</div>
                        <div class="status1-header-item" style="width: 35%; text-align; left">Nom Médicament</div>
                        <div class="status1-header-item" style="width: 15%">Numéro de Lot</div>
                        <div class="status1-header-item" style="width: 10%">Date de Péremption</div>
                        <div class="status1-header-item" style="width: 35%; text-align; left">Créateur</div>
                    </div>`;
                data.rows1.forEach(row => {
                    htmlBody += `
                        <div class="status1-content-items">
                            <div class="status1-content-item">${row.count}</div>
                            <div class="status1-content-item"  style="text-align: left">${row.nomMedicament}</div>
                            <div class="status1-content-item">${row.numLot}</div>
                            <div class="status1-content-item">${new Date(row.datePeremption).toLocaleDateString('fr-FR')}</div>
                            <div class="status1-content-item"  style="text-align: left">${row.createur.nomAgent} ${row.createur.prenomAgent}</div>
                        </div>`;
                });
                htmlBody += `</div>`;
            } else {
                htmlBody += `<p class="status1-message">Aucun médicament trouvé.</p>`;
            }

            // Section des actes de soin
            htmlBody += `<h2>Actes de Soin</h2>`;
            if (data.rows4 && data.rows4.length > 0) {
                htmlBody += `<div class="utilisationsASUP-content">
                    <div class="utilisationsASUP-header">
                        <div class="utilisationsASUP-header-item" style="width: 10%">Numéro d'Intervention</div>
                        <div class="utilisationsASUP-header-item" style="width: 5%">Acte Soin</div>
                        <div class="utilisationsASUP-header-item" style="width: 10%">Date</div>
                        <div class="utilisationsASUP-header-item" style="width: 30%; text-align; left">Agent ASUP</div>
                        <div class="utilisationsASUP-header-item" style="width: 40%; text-align; left">Médecin Prescripteur</div>
                        <div class="utilisationsASUP-header-item" style="width: 5%">Nbre Méd.</div>
                    </div>`;
                data.rows4.forEach(row => {
                    htmlBody += `
                        <div class="utilisationsASUP-content-items">
                            <div class="utilisationsASUP-content-item">${row.numIntervention}</div>
                            <div class="utilisationsASUP-content-item">${row.acteSoin}</div>
                            <div class="utilisationsASUP-content-item">${new Date(row.dateActe).toLocaleDateString('fr-FR')}</div>
                            <div class="utilisationsASUP-content-item"  style="text-align: left">${row.agent.nomAgent} ${row.agent.prenomAgent}</div>
                            <div class="utilisationsASUP-content-item"  style="text-align: left">${row.medecinPrescripteur.nomExercice} ${row.medecinPrescripteur.prenomExercice} (${row.medecinPrescripteur.identifiantRPPS})</div>
                            <div class="utilisationsASUP-content-item">${row.idMedicamentsList ? row.idMedicamentsList.length : "0"}</div>
                        </div>`;
                });
                htmlBody += `</div>
                <p class="utilisationsASUP-message">Rendez-vous sur CMS-Collonges pour plus d'informations</p>`;
            } else {
                htmlBody += `<p class="utilisationsASUP-message">Aucun acte de soin trouvé.</p>`;
            }

            // Section des médicaments à remplacer
            htmlBody += `<h2>Liste des Médicaments en Remplacement (Utilisation)</h2>`;
            if (data.rows2 && data.rows2.length > 0) {
                htmlBody += `<div class="status2-content">
                    <div class="status2-header">
                        <div class="status2-header-item" style="width: 5%">Nbre</div>
                        <div class="status2-header-item" style="width: 35%; text-align; left">Nom Médicament</div>
                        <div class="status2-header-item" style="width: 10%">Numéro de Lot</div>
                        <div class="status2-header-item" style="width: 5%">Date de Péremption</div>
                        <div class="status2-header-item" style="width: 35%; text-align; left">Créateur</div>
                        <div class="status2-header-item" style="width: 10%">Remplaçant</div>
                    </div>`;
                data.rows2.forEach(row => {
                    htmlBody += `
                        <div class="status2-content-items">
                            <div class="status2-content-item">${row.count}</div>
                            <div class="status2-content-item"  style="text-align: left">${row.nomMedicament}</div>
                            <div class="status2-content-item">${row.numLot}</div>
                            <div class="status2-content-item">${new Date(row.datePeremption).toLocaleDateString('fr-FR')}</div>
                            <div class="status2-content-item" style="text-align: left">${row.createur.nomAgent} ${row.createur.prenomAgent}</div>
                            <div class="status2-content-item">${row.matriculeRemplaceur}</div>
                        </div>`;
                });
                htmlBody += `</div>`;
            } else {
                htmlBody += `<p class="status2-message">Aucun médicament trouvé.</p>`;
            }

            // Section des médicaments à remplacer
            htmlBody += `<h2>Liste des Médicaments en Remplacement (Péremption)</h2>`;
            if (data.rows3 && data.rows3.length > 0) {
                htmlBody += `<div class="status3-content">
                    <div class="status3-header">
                        <div class="status3-header-item" style="width: 5%">Nbre</div>
                        <div class="status3-header-item" style="width: 35%; text-align; left">Nom Médicament</div>
                        <div class="status3-header-item" style="width: 10%">Numéro de Lot</div>
                        <div class="status3-header-item" style="width: 5%">Date de Péremption</div>
                        <div class="status3-header-item" style="width: 35%: text-align; left">Créateur</div>
                        <div class="status3-header-item" style="width: 10%">Remplaçant</div>
                    </div>`;
                data.rows3.forEach(row => {
                    htmlBody += `
                        <div class="status3-content-items">
                            <div class="status3-content-item">${row.count}</div>
                            <div class="status3-content-item"  style="text-align: left">${row.nomMedicament}</div>
                            <div class="status3-content-item"  style="text-align: left">${row.numLot}</div>
                            <div class="status3-content-item">${new Date(row.datePeremption).toLocaleDateString('fr-FR')}</div>
                            <div class="status3-content-item"  style="text-align: left">${row.createur.nomAgent} ${row.createur.prenomAgent}</div>
                            <div class="status3-content-item">${row.matriculeRemplaceur}</div>
                        </div>`;
                });
                htmlBody += `</div>`;
            } else {
                htmlBody += `<p class="status3-message">Aucun médicament trouvé.</p>`;
            }

            // Section des médicaments archivés
            htmlBody += `<h2>Liste des Médicaments Archivés</h2>`;
            if (data.rows5 && data.rows5.length > 0) {
                htmlBody += `<div class="status5-content">
                    <div class="status5-header">
                        <div class="status5-header-item" style="width: 5%">Nbre</div>
                        <div class="status5-header-item" style="width: 35%; text-align; left">Nom Médicament</div>
                        <div class="status5-header-item" style="width: 10%">Numéro de Lot</div>
                        <div class="status5-header-item" style="width: 5%">Date de Péremption</div>
                        <div class="status5-header-item" style="width: 35%; text-align; left">Créateur</div>
                        <div class="status5-header-item" style="width: 10%">Remplaçant</div>
                    </div>`;
                data.rows5.forEach(row => {
                    htmlBody += `
                        <div class="status5-content-items">
                            <div class="status5-content-item">${row.count}</div>
                            <div class="status5-content-item" style="text-align: left">${row.nomMedicament}</div>
                            <div class="status5-content-item" style="text-align: left">${row.numLot}</div>
                            <div class="status5-content-item">${new Date(row.datePeremption).toLocaleDateString('fr-FR')}</div>
                            <div class="status5-content-item" style="text-align: left">${row.createur.nomAgent} ${row.createur.prenomAgent}</div>
                            <div class="status5-content-item">${row.matriculeRemplaceur}</div>
                        </div>`;
                });
                htmlBody += `</div>`;
            } else {
                htmlBody += `<p class="status5-message">Aucun médicament trouvé.</p>`;
            }
            htmlBody += `</div></body></html>`;

                    
        // Combinaison de l'en-tête et du corps pour générer le PDF
        const finalHTML = htmlHeader + htmlBody;
        return new Promise((resolve, reject) => {
            const options = {
                format: 'A4',
                orientation: 'landscape',
                border: '1.5cm'
            };

            pdf.create(finalHTML, options).toBuffer((err, buffer) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buffer);
                }
            });
        });
    }
    


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
    getVizData,
    generatePDF
};