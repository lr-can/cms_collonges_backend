const { google } = require('googleapis');
const config = require('../config');
let fetch


async function insertInterventionNotif(data) {

    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }

    const response = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
    const sheetData = await response.json();

    const existingNotification = sheetData.find(item => item.notification === data.notification);

    if (existingNotification) {
        console.log('Notification already exists, doing nothing.');
        return;
    } else {
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
                values: [['Added with CMS API','','','','','','','','','',rowData, 'TRUE']],
            },
        });
        console.log('Row appended successfully!');
        
        return response;
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
}
}

async function giveInterventionType(titre) {
    let interTypeDictionnary = {};
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
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
                if (/^2[AB]\d{2}$/.test(interventionCode)) {
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

async function insertSmartemisResponse(data) {
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.google.spreadsheetId;
    const range = 'Feuille 4!A2:N';

    if (data.engList) {
        try {
            const values = data.engList.map(eng => [
                eng.famEngCod,
                eng.famEngLib,
                eng.engId,
                eng.engLib.startsWith('+') ? `'${eng.engLib}` : eng.engLib,
                eng.engStatusCod,
                eng.engStatusBgRgb,
                eng.engStatusFgRgb,
                eng.engAbon,
                data.availablePersonCounter.nbAvailable,
                data.availablePersonCounter.nbMax,
                data.result.code,
                data.result.lib,
                data.result.num
            ]);
            const currentTime = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
            values.forEach(row => row.push(currentTime));


            const response = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values,
                },
            });

            console.log('Update successful:', response.data);
        } catch (error) {
            console.error('Error updating spreadsheet:', error);
        }
    }
    if (data.csPersList){
        if (data.csPersList.length >= 2 && data.csPersList.length < 30){
            if (!fetch){
                fetch = (await import('node-fetch')).default;
            }
            const agentsInfo = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsAsup');
            const agentsData = await agentsInfo.json();
            const agentInfoList = data.csPersList.map(person => {
                const agent = agentsData.find(agent => agent.matricule === `${person.persStatutCod}${person.persId}`);
                return {
                    persStatutCod: person.persStatutCod,
                    matricule: `${person.persStatutCod}${person.persId}`,
                    grade: agent ? agent.grade : 'Unknown',
                    nom: person.nom,
                    prenom: person.prenom,
                    administrativeStatusCode: person.administrativeStatus.code,
                    administrativeStatusRgb: person.administrativeStatus.rgb
                };              
            });
            const values = agentInfoList.map(agent => [
                agent.matricule,
                agent.grade,
                agent.nom,
                agent.prenom,
                agent.administrativeStatusCode,
                agent.administrativeStatusRgb
            ]);
            let range2 = 'Feuille 5!A2:F100';
            try {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: range2,
                });
                console.log('Data cleared successfully!');
            } catch (error) {
                console.error('Error clearing data:', error);
            }
            try {
                const response = await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: range2,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: values,
                    },
                });
                console.log('Data inserted successfully:', response.data);
            } catch (error) {
                console.error('Error inserting data:', error);
            }

            console.log(agentInfoList);
        }
    }
    }


async function clearSmartemisResponse() {
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.google.spreadsheetId;
    const range = 'Feuille 5!A2:F100';

    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range,
        });
        console.log('Data cleared successfully!');
    } catch (error) {
        console.error('Error clearing data:', error);
    }
}

async function verifyIfInter(){
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        const response = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
        const data = await response.json();
        const lastLine = data[data.length - 1];
        if (lastLine.departStatus === "TRUE") {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        throw err;
    }
}

async function giveAgentsAndVehicules(){
    if (!fetch){
        fetch = (await import('node-fetch')).default;
    }
    try{
        const vehiculeResponse = await fetch("https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%204")
        const vehiculeData = await vehiculeResponse.json();
        const agentsResponse = await fetch("https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%205")
        const agentsData = await agentsResponse.json();
        const vehiculeList = vehiculeData
            .filter(vehicule => vehicule.engStatusCod === "AL" || vehicule.engStatusCod === "RE")
            .map(vehicule => vehicule.engLib);

        return { vehiculeList, agentsData };
    } catch (err){
        console.error('Error fetching data:', err);
        throw err;
    }
}

async function assignAgentsToVehicles(matricules, gfos) {
    try {
        // 1. Fetch des agents
        const agentsResponse = await fetch('https://opensheet.elk.sh/1ottTPiBjgBXSZSj8eU8jYcatvQaXLF64Ppm3qOfYbbI/agentsASUP');
        const agentsData = await agentsResponse.json();

        // Filtrer les agents par matricules donnés
        const filteredAgents = agentsData.filter(agent => matricules.includes(agent.matricule));

        // 2. Fetch des véhicules et GFO associés
        const vehiclesResponse = await fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_COLLONGES');
        const vehiclesData = await vehiclesResponse.json();

        // 3. Fetch des emplois préférés et minimums pour chaque GFO
        const gfoResponse = await fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/GFO_EMPLOIS');
        const gfoData = await gfoResponse.json();

        // Créer un mapping des GFO pour retrouver les emplois min et préférés rapidement
        const gfoMapping = {};
        gfoData.forEach(gfo => {
            gfoMapping[gfo.GFO] = {
                emploisMin: gfo.emploisGFO_min.split(', '),
                emploisPref: gfo.emploisGFO_pref.split(', ')
            };
        });

        // 4. Créer un dictionnaire structuré pour les affectations
        const assignments = {};

        vehiclesData.forEach((vehicle, index) => {
            const vehicleGFOs = vehicle.gfoEngin.split(', ');
            const emploisAssignments = {};

            vehicleGFOs.forEach(gfo => {
                if (gfos.includes(gfo)) {
                    const { emploisMin, emploisPref } = gfoMapping[gfo];

                    // Chercher les agents ayant les emplois minimums et préférés pour ce GFO
                    const eligibleAgents = filteredAgents.filter(agent => {
                        // Vérifie si l'agent a un emploi minimum
                        const hasMinEmploi = emploisMin.some(emploi => agent[emploi] === "1");
                        // Vérifie si l'agent a un emploi préféré
                        const hasPrefEmploi = emploisPref.some(emploi => agent[emploi] === "1");
                        return hasMinEmploi || hasPrefEmploi;
                    });

                    // Assigner les emplois aux agents
                    emploisMin.concat(emploisPref).forEach(emploi => {
                        const agent = eligibleAgents.find(agent => agent[emploi] === "1");
                        if (agent && !Object.values(emploisAssignments).includes(agent)) {
                            emploisAssignments[emploi] = agent;
                        }
                    });
                }
            });

            // Ajouter la structure de chaque engin
            assignments[`engin_${index + 1}`] = {
                nom_engin: vehicle.libEngin,
                gfo: vehicle.gfoEngin,
                emplois: emploisAssignments
            };
        });

        return assignments;
    } catch (error) {
        console.error("Erreur lors de l'attribution des agents :", error);
        return {};
    }
}



module.exports = { insertInterventionNotif, giveInterventionType, insertSmartemisResponse, verifyIfInter, clearSmartemisResponse, giveAgentsAndVehicules, assignAgentsToVehicles };
