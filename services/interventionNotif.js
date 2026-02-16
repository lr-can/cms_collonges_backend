const { google } = require('googleapis');
const config = require('../config');
const db = require('./db');
const { text } = require('express');
let fetch

const GROUPAMA_STADIUM_COORDS = {
    lat: '45.768160',
    lng: '4.981116'
};

function cleanSmartemisNotificationEntry(entry = '') {
    return entry
        .replace(/\n/g, '')
        .replace(/\r/g, ' ')
        .replace(/simples - poubelles/g, 'simples | poubelles')
        .replace(/batiment - structure/g, 'batiment | structure')
        .replace(/terrain - montee/g, 'terrain | montee')
        .replace(/Electrisation -/g, 'Electrisation')
        .replace(/RECO - AVIS/g, 'RECO | AVIS')
        .replace(/DFU -/g, 'DFU')
        .replace(/DFE -/g, 'DFE')
        .replace(/DV -/g, 'DV')
        .replace(/DVR -/g, 'DVR')
        .replace(/DFUR -/g, 'DFUR');
}

function normalizeLocationText(value = '') {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getForcedCoordinatesFromNotification(notificationText = '', addressText = '') {
    const normalizedNotification = normalizeLocationText(notificationText);
    const normalizedAddress = normalizeLocationText(addressText);
    const combinedText = `${normalizedNotification} ${normalizedAddress}`.trim();

    const isGroupamaStadium = combinedText.includes('groupama stadium');
    const isSullyDecines = combinedText.includes('10 rue sully') && combinedText.includes('decines charpieu');

    if (isGroupamaStadium || isSullyDecines) {
        return GROUPAMA_STADIUM_COORDS;
    }

    return null;
}

async function resolveInterventionCoordinates(addressInter, notificationText) {
    const forcedCoordinates = getForcedCoordinatesFromNotification(notificationText, addressInter);
    if (forcedCoordinates) {
        return {
            longitude: forcedCoordinates.lng,
            latitude: forcedCoordinates.lat
        };
    }

    if (!addressInter) {
        return {
            longitude: '',
            latitude: ''
        };
    }

    if (addressInter.includes('HYDR SAONE')) {
        return {
            longitude: '4.855327',
            latitude: '45.821767'
        };
    }

    try {
        const coords = await findInterventionCoordinates(addressInter);
        return {
            longitude: String(coords.lng).replace(',', '.'),
            latitude: String(coords.lat).replace(',', '.')
        };
    } catch (err) {
        console.error('Error finding coordinates:', err);
        return {
            longitude: '',
            latitude: ''
        };
    }
}


async function insertInterventionNotif(data, msg = "Added with CMS API") {

    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }

    const rowData = (data && typeof data.notification === 'string') ? data.notification.trim() : '';
    if (!rowData) {
        throw new Error('Notification vide: insertion annulée');
    }

    let existingNotification = null;
    try {
        const response = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const sheetData = await response.json();
        if (Array.isArray(sheetData)) {
            existingNotification = sheetData.find(item => item.notification === rowData);
        }
    } catch (error) {
        console.error('Impossible de vérifier les doublons, insertion poursuivie :', error.message);
    }

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
    const range = 'Feuille 1!A1:L';
    let enginsInter = "";
    let numInter = "";
    let dateInter = "";
    let heureInter = "";
    let addressInter = "";
    let longitude = "";
    let latitude = "";
    let villeInter = "";
    let incidentInter = "";

    if (rowData.startsWith('🚧')) {
        try {
            await clearSmartemisResponse();
        let notifPhoneOptions = {
            method: "post",
            headers: {
                "Content-Type": "text/plain" 
            },
            body: rowData,
            redirect: "follow"
        };
    // Send phone notification, but don't block main flow if it fails
    fetch(process.env.MACRO_TRIGGER2, notifPhoneOptions)
        .then(notifPhoneResponse => {
            if (!notifPhoneResponse.ok) {
                console.log('Error in phone notification:', notifPhoneResponse.statusText);
            }
        })
        .catch(err => {
            console.log('Error sending phone notification:', err);
        });
    let cleanedEntry = cleanSmartemisNotificationEntry(rowData);
    
    // Parse using split to handle additional dashes in addresses
    // Format: 🚧 N°{num}/1 - {date} {heure} - {titre} - {adresse} - {engins} Engins
    // Note: We removed the replace(/(\|.*? -)/g, '-') to preserve ERP information in addresses
    let parts = cleanedEntry.split(' - ');
    
    // If we have more than 5 parts, it means the address contains additional dashes
    // We need to merge the middle parts (parts 3 to n-2) into the address
    if (parts.length > 5) {
        // Parts structure: [0: 🚧 N°{num}/1, 1: {date} {heure}, 2: {titre}, 3..n-2: {adresse}, n-1: {engins} Engins]
        // Merge parts 3 to n-2 into a single address part
        let addressParts = parts.slice(3, parts.length - 1);
        parts = [
            parts[0],  // 🚧 N°{num}/1
            parts[1],  // {date} {heure}
            parts[2],  // {titre}
            addressParts.join(' - '),  // {adresse} (merged with original dashes)
            parts[parts.length - 1]  // {engins} Engins
        ];
    }
    
    numInter = cleanedEntry.match(/N°(\d+)/);

    if (numInter) {
        numInter = numInter[1];
    } else {
        numInter = '';
    }
    
    dateInter = cleanedEntry.match(/- (\d+).(\d+)/);

    if (dateInter) {
        let annee = new Date().getFullYear();
        dateInter = `${dateInter[1]}/${dateInter[2]}/${annee}`;
    } else {
        dateInter = '';
    }

    heureInter = cleanedEntry.match(/(\d+):(\d+)/);

    if (heureInter) {
        heureInter = `${heureInter[0]}`;
    } else {
        heureInter = '';
    }

    // Extract address from parts if we have the correct structure
    longitude = "";
    latitude = "";
    villeInter = "";
    
    if (parts.length >= 5) {
        addressInter = (parts[3] || '').trim();

        const resolvedCoordinates = await resolveInterventionCoordinates(addressInter, cleanedEntry);
        longitude = resolvedCoordinates.longitude;
        latitude = resolvedCoordinates.latitude;

        let splittedAddress = addressInter.split(' ');
        if (addressInter.includes("LYON 0") && splittedAddress.length >= 2){
            villeInter = splittedAddress[0] + " " + splittedAddress[1].replace("0", "") + "ÈME";
            addressInter = addressInter.replace(/LYON 0\d/, villeInter);
        } else {
            villeInter = splittedAddress[0] || "";
        }
    } else {
        // Fallback to old method if split didn't work
        addressInter = cleanedEntry.match(/(.*) - (\d+) Engins/);
        if (addressInter) {
            addressInter = addressInter[1].replace(/🚧.*?-.*?-.*?-/, '').replace(" ", "");

            const resolvedCoordinates = await resolveInterventionCoordinates(addressInter, cleanedEntry);
            longitude = resolvedCoordinates.longitude;
            latitude = resolvedCoordinates.latitude;

            let splittedAddress = addressInter.split(' ');
            if (addressInter.includes("LYON 0") && splittedAddress.length >= 2){
                villeInter = splittedAddress[0] + " " + splittedAddress[1].replace("0", "") + "ÈME";
                addressInter = addressInter.replace(/LYON 0\d/, villeInter);
            } else {
                villeInter = splittedAddress[0] || "";
            }
        } else {
            addressInter = '';
        }
    }

    // Extract incident type from parts if we have the correct structure
    if (parts.length >= 5) {
        incidentInter = parts[2].trim();
    } else {
        // Fallback to old method
        incidentInter = cleanedEntry.match(/(\d+):(\d+) -(.*)-/);
        if (incidentInter) {
            incidentInter = incidentInter[3].toString().match(/ (.*) -/);
            if (incidentInter) {
                incidentInter = incidentInter[1];
            } else {
                incidentInter = '';
            }
        } else {
            incidentInter = '';
        }
    }

    // Extract engins from parts if we have the correct structure
    if (parts.length >= 5) {
        enginsInter = parts[4].match(/(\d+) Engins/);
        if (enginsInter) {
            enginsInter = enginsInter[1];
        } else {
            enginsInter = '';
        }
    } else {
        // Fallback to old method
        enginsInter = cleanedEntry.match(/- (\d+) Engins/);
        if (enginsInter) {
            enginsInter = enginsInter[1];
        } else {
            enginsInter = '';
        }
    }
        } catch (parseError) {
            console.error('Erreur de parsing de la notification, insertion en mode dégradé :', parseError);
            enginsInter = "";
            numInter = "";
            dateInter = "";
            heureInter = "";
            addressInter = "";
            longitude = "";
            latitude = "";
            villeInter = "";
            incidentInter = "";
        }
    }
    

    try {
        // Append the new row to the spreadsheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[msg,numInter,dateInter,heureInter,incidentInter,addressInter,longitude,latitude, enginsInter,villeInter,rowData, 'TRUE']],
            },
        });
        console.log('Row appended successfully!');
        let payload = {
            "identifiant": msg,
            "numeroInter": numInter,
            "notificationDate": dateInter,
            "notificationHeure": heureInter,
            "notificationTitre": incidentInter,
            "notificationAdresse": addressInter,
            "notificationLon": longitude,
            "notificationLat": latitude,
            "notificationEngins": enginsInter,
            "notificationVille": villeInter,
            "notification": rowData,
            "departStatus": "TRUE"
        }
        const postOptions = {
            method: "post",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            redirect: "follow"
        };
        try {
            const postResponse = await fetch(process.env.MACRO_TRIGGER, postOptions);
            if (!postResponse.ok) {
                console.log('Error in post request:', postResponse.statusText);
            } else {
                console.log('Post request successful!');
            }
        } catch (postError) {
            console.error('Erreur lors du post macro, insertion Sheets conservée :', postError);
        }

        return response;
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
}
}

async function findInterventionCoordinates(adress){
    if (!fetch){
        fetch = (await import('node-fetch')).default;
    }
    const api_key = process.env.GMAPS_API;
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(adress)}&bounds=46.2926,%204.2811%7C45.4225,%205.1137&key=${api_key}`);
    const data = await response.json();

    if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
    } else {
        const details = data.error_message ? ` (${data.error_message})` : '';
        throw new Error(`Unable to find coordinates for the given address. Status: ${data.status}${details}`);
    }
}
function unidecode(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
}

async function giveInterventionType(titre) {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        let normalizedTitle = unidecode(titre.toUpperCase().replace(/-/g, "").replace(/\|/g, "").replace(/  /g, " ").replace(/,/g, " "));
        const response = await fetch('https://opensheet.elk.sh/13y-17sHUSenIoehILJMzuJcpqnRG2CVX9RvDzvaa448/libelleSinistres');
        const data = await response.json();
        let remappedData = data.map(row => {
            return {
                codeSinistre: row['sinistreCode'],
                libelleMajSinistre: unidecode(row['sinistreLib'].toUpperCase().replace(/-/g, "").replace(/  /g, " ").replace(/,/g, " ").replace(/\|/g, "")),
                categorie: row["sinistreCat"]
            };
        });

        typeFromTitre = remappedData.find(row => row['libelleMajSinistre'] === normalizedTitle);
        if (typeFromTitre) {
            const categorie = typeFromTitre.categorie;
            console.log(categorie)
            if (categorie === "INC") {
                return { type: "Incendie" };
            } else if (categorie === "SSUAP") {
                return { type: "SSUAP" };
            } else if (categorie === "ACC") {
                return { type: "Accident" };
            } else if (categorie === "Niv. Sup") {
                if (typeFromTitre.codeSinistre.startsWith('2A') || typeFromTitre.codeSinistre.startsWith('2B')) {
                    return { type: "Violences_Urbaines" };
                } else {
                return { type: "Violences_Urbaines_Graves" };
                }
            } else if (categorie === "PPBE") {
                return { type: "PPBE" };
            } else {
                return { type: "Unknown" };
            }
        } else {
            return { type: "Unknown" };
        }

    } catch (err) {
        console.error('Error fetching data:', err);
        return { type: "Unknown" };
    }
}

async function getPlanningCounterListFromSheet(sheets, spreadsheetId) {
    try {
        // Lire les données de la Feuille 16 (Code, Libellé, Nombre, NombreMax)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Feuille 16!A2:D100',
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            console.log('No planning counter data found in Feuille 16');
            return [];
        }

        // Parser les données : Code (A), Libellé (B), Nombre (C), NombreMax (D)
        const planningCounterList = rows.map(row => ({
            cod: row[0] || '',
            lib: row[1] || '',
            value: row[2] || '0',
            totalValue: row[3] || '0'
        })).filter(item => item.cod); // Filtrer les lignes vides

        return planningCounterList;
    } catch (error) {
        console.error('Error reading planning counter list from sheet:', error);
        return [];
    }
}

async function updateAgentsEmplois(csPersList, planningCounterList) {
    const result = {
        success: false,
        mode: null,
        logs: [],
        updatedAgents: [],
        processedCodes: [],
        errors: []
    };
    
    if (!csPersList || !planningCounterList || planningCounterList.length === 0) {
        result.logs.push('Pas de csPersList ou planningCounterList vide');
        return result;
    }

    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId2 = config.google.spreadsheetId2;
    
    // Les agents avec leurs colonnes d'emplois sont dans la feuille "agentsASUP" du spreadsheetId2
    // La Feuille 16 du spreadsheetId classique contient le planningCounterList (Code, Libellé, Nombre, NombreMax)
    const spreadsheetIdAgents = spreadsheetId2;
    const rangeAgents = 'agentsASUP!A:AK'; // Feuille agentsASUP de spreadsheetId2 contenant les agents

    try {
        // Lire les données actuelles de la feuille agentsASUP du spreadsheetId2 (agents avec colonnes d'emplois)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetIdAgents,
            range: rangeAgents,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) {
            result.logs.push('Aucune donnée trouvée dans agentsASUP');
            result.errors.push('Aucune donnée trouvée dans agentsASUP');
            return result;
        }

        // Récupérer les en-têtes
        const headers = rows[0];
        const headerIndexMap = {};
        headers.forEach((header, index) => {
            headerIndexMap[header] = index;
        });

        // Créer un map des agents existants par matricule
        const agentsMap = new Map();
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[0]) { // Si matricule existe
                agentsMap.set(row[0], {
                    rowIndex: i,
                    data: row
                });
            }
        }

        // Filtrer csPersList pour exclure les agents avec administrativeStatusCode == "IN" ou "IND" (pour disponibilité)
        const availableAgents = csPersList.filter(person => 
            person.administrativeStatus && 
            person.administrativeStatus.code !== "IN" && 
            person.administrativeStatus.code !== "IND"
        );

        // Créer un map de tous les agents par matricule (pour les interventions)
        const allAgentsMap = new Map();
        csPersList.forEach(person => {
            const matricule = `${person.persStatutCod}${person.persId}`;
            allAgentsMap.set(matricule, person);
        });

        // Créer un map des agents disponibles par matricule
        const availableAgentsMap = new Map();
        availableAgents.forEach(person => {
            const matricule = `${person.persStatutCod}${person.persId}`;
            availableAgentsMap.set(matricule, person);
        });

        // Créer un map des codes de planningCounterList
        const planningMap = new Map();
        planningCounterList.forEach(item => {
            planningMap.set(item.cod, {
                lib: item.lib,
                value: parseInt(item.value) || 0,
                totalValue: parseInt(item.totalValue) || 0
            });
        });

        // Fonction pour obtenir l'index d'une colonne
        const getColIndex = (colName) => headerIndexMap[colName] || -1;

        // Fonction pour mettre à jour une valeur dans une ligne
        const updateCell = (row, colIndex, value) => {
            while (row.length <= colIndex) {
                row.push('');
            }
            row[colIndex] = value;
        };

        // Fonction pour initialiser un agent manquant
        const initAgent = (person) => {
            const matricule = `${person.persStatutCod}${person.persId}`;
            let agentRow = agentsMap.get(matricule);
            
            if (!agentRow) {
                // Créer un nouvel agent
                const newRow = new Array(headers.length).fill(0);
                newRow[getColIndex('matricule')] = matricule;
                newRow[getColIndex('nomAgent')] = person.nom || '';
                newRow[getColIndex('prenomAgent')] = person.prenom || '';
                newRow[getColIndex('grade')] = 'Sap 2CL';
                newRow[getColIndex('email')] = `${(person.prenom || '').toLowerCase()}.${(person.nom || '').toUpperCase()}@sdmis.fr`;
                // Les autres colonnes initialisées à 0
                
                agentsMap.set(matricule, {
                    rowIndex: rows.length,
                    data: newRow
                });
                rows.push(newRow);
            }
        };

        // Initialiser les agents manquants (sans réinitialiser les colonnes d'emplois)
        csPersList.forEach(initAgent);

        // Récupérer les données d'asup depuis la base de données
        const allAgents = require('./allAgents');
        const agentsData = await allAgents.getAllAgents();
        const asupMap = new Map();
        agentsData.forEach(agent => {
            asupMap.set(agent.matricule, {
                asup1: agent.asup1 === '1' || agent.asup1 === 1,
                grade: agent.grade
            });
        });

        // Fonction pour vérifier si un grade est Infirmière, Sap 1CL ou Sap 2CL
        const isSpecialGrade = (grade) => {
            if (!grade) return false;
            const gradeLower = grade.toLowerCase();
            return gradeLower.includes('infirmière') || 
                   gradeLower.includes('infirmier') ||
                   gradeLower === 'sap 1cl' ||
                   gradeLower === 'sap 2cl';
        };

        // Fonction pour obtenir les colonnes concernées par un code
        const getColumnsForCode = (cod) => {
            const columns = [];
            switch(cod) {
                case 'CDG':
                    columns.push('CDG_cdg');
                    break;
                case 'CAINC':
                    columns.push('INC_ca');
                    break;
                case 'CASAP':
                    columns.push('SAP_ca');
                    break;
                case 'CADIV':
                    columns.push('DIV_ca');
                    break;
                case 'EQSAP':
                    columns.push('SAP_eq', 'SAP_eqc', 'PSSAP_eqc', 'PSSAP_eq', 'PSSAP_ca');
                    break;
                case 'EQINC':
                    columns.push('INC_eq', 'PSINC_eq', 'PSINC_ce', 'INC_ce');
                    break;
                case 'EQDIV':
                    columns.push('DIV_eq');
                    break;
                case 'INFPSU':
                    columns.push('INFAMU_inf');
                    break;
                case 'CCOD1':
                    columns.push('INC_cd', 'PSINC_cd');
                    break;
                case 'BTARS':
                    columns.push('SAP_cd');
                    break;
                case 'B':
                    columns.push('PSSAP_cd', 'DIV_cd', 'INFAMU_cd', 'CDG_cd', 'AQUA_cd');
                    break;
                case 'MATELOT':
                    columns.push('BATO_eq');
                    break;
                case 'CODBRSM':
                case 'CODBRS':
                    columns.push('BATO_ca');
                    break;
                case 'EQSAV':
                    columns.push('AQUA_ca');
                    break;
                case 'APP':
                    columns.push('SAP_eqc', 'PSSAP_eqc');
                    break;
            }
            return columns;
        };

        // Fonction pour appliquer les correspondances pour un code donné
        const applyCorrespondance = (cod, agentRow, asup1, grade) => {
            switch(cod) {
                case 'CDG':
                    updateCell(agentRow.data, getColIndex('CDG_cdg'), 1);
                    break;
                case 'CAINC':
                    updateCell(agentRow.data, getColIndex('INC_ca'), 1);
                    break;
                case 'CASAP':
                    updateCell(agentRow.data, getColIndex('SAP_ca'), 1);
                    break;
                case 'CADIV':
                    updateCell(agentRow.data, getColIndex('DIV_ca'), 1);
                    break;
                case 'EQSAP':
                    updateCell(agentRow.data, getColIndex('SAP_eq'), 1);
                    updateCell(agentRow.data, getColIndex('SAP_eqc'), 1);
                    if (asup1) {
                        updateCell(agentRow.data, getColIndex('PSSAP_eqc'), 1);
                        updateCell(agentRow.data, getColIndex('PSSAP_eq'), 1);
                    }
                    if (!isSpecialGrade(grade)) {
                        updateCell(agentRow.data, getColIndex('PSSAP_ca'), 1);
                    }
                    break;
                case 'EQINC':
                    updateCell(agentRow.data, getColIndex('INC_eq'), 1);
                    if (asup1) {
                        updateCell(agentRow.data, getColIndex('PSINC_eq'), 1);
                        updateCell(agentRow.data, getColIndex('PSINC_ce'), 1);
                    }
                    if (!isSpecialGrade(grade)) {
                        updateCell(agentRow.data, getColIndex('INC_ce'), 1);
                    }
                    break;
                case 'EQDIV':
                    updateCell(agentRow.data, getColIndex('DIV_eq'), 1);
                    break;
                case 'INFPSU':
                    updateCell(agentRow.data, getColIndex('INFAMU_inf'), 1);
                    break;
                case 'CCOD1':
                    updateCell(agentRow.data, getColIndex('INC_cd'), 1);
                    if (asup1) {
                        updateCell(agentRow.data, getColIndex('PSINC_cd'), 1);
                    }
                    break;
                case 'BTARS':
                    updateCell(agentRow.data, getColIndex('SAP_cd'), 1);
                    break;
                case 'B':
                    updateCell(agentRow.data, getColIndex('PSSAP_cd'), 1);
                    updateCell(agentRow.data, getColIndex('DIV_cd'), 1);
                    // Vérifier si SAP_eq = 1
                    const sapEqIndex = getColIndex('SAP_eq');
                    const sapCdIndex = getColIndex('SAP_cd');
                    if (
                        (sapEqIndex >= 0 && agentRow.data[sapEqIndex] == 1) ||
                        (sapCdIndex >= 0 && agentRow.data[sapCdIndex] == 1)
                    ) {
                        updateCell(agentRow.data, getColIndex('INFAMU_cd'), 1);
                    }
                    // Vérifier si INC_eq = 1
                    const incEqIndex = getColIndex('INC_eq');
                    if (incEqIndex >= 0 && agentRow.data[incEqIndex] == 1) {
                        updateCell(agentRow.data, getColIndex('CDG_cd'), 1);
                    }
                    updateCell(agentRow.data, getColIndex('AQUA_cd'), 1);
                    break;
                case 'MATELOT':
                    updateCell(agentRow.data, getColIndex('BATO_eq'), 1);
                    break;
                case 'CODBRSM':
                case 'CODBRS':
                    updateCell(agentRow.data, getColIndex('BATO_ca'), 1);
                    break;
                case 'APP':
                    updateCell(agentRow.data, getColIndex('SAP_eqc'), 1);
                    if (asup1) {
                        updateCell(agentRow.data, getColIndex('PSSAP_eqc'), 1);
                    }
                    break;
            }
        };

        // Déterminer le mode : disponibilité, intervention ou emplois
        const dispo = planningCounterList.find(item => item.cod === 'DISPO');
        const depItvPers = planningCounterList.find(item => item.cod === 'DEP_ITV__PERS');
        const totalAgentsCount = csPersList.length;
        const availableAgentsCount = availableAgents.length;
        
        let mode = 'emplois'; // Par défaut, mode emplois
        if (dispo) {
            const dispoTotalValue = parseInt(dispo.totalValue) || 0;
            if (totalAgentsCount === dispoTotalValue) {
                mode = 'disponibilite'; // Mode Feuille 12
            }
        }
        
        if (mode !== 'disponibilite' && depItvPers) {
            const depItvValue = parseInt(depItvPers.value) || 0;
            if (totalAgentsCount === depItvValue) {
                mode = 'intervention'; // Mode Feuille 5
            }
        }

        result.mode = mode;
        result.logs.push(`Mode détecté: ${mode} - totalAgentsCount: ${totalAgentsCount}, availableAgentsCount: ${availableAgentsCount}`);
        
        // Si on est en mode disponibilité ou intervention, on ne traite pas les emplois
        if (mode === 'disponibilite' || mode === 'intervention') {
            result.logs.push(`Mode ${mode} détecté, pas de traitement des emplois`);
        } else {
            // Vérifier si csPersList est vide (personne de disponible)
            if (totalAgentsCount === 0 || csPersList.length === 0) {
                result.logs.push(`⚠️ Aucun agent disponible (csPersList.length = ${csPersList.length}). Aucune modification effectuée.`);
                result.errors.push(`Aucun agent disponible pour la catégorie. Aucune modification effectuée.`);
                result.success = true; // Pas d'erreur, juste rien à faire
                return result;
            }
            
            // Mode emplois : traiter les codes d'emplois (un code par requête)
            const codesToProcess = planningCounterList.filter(item => 
                item.cod !== 'DISPO' && 
                item.cod !== 'DEP_ITV__PERS' && 
                item.cod !== 'SMRES' && 
                item.cod !== 'DIP' && 
                item.cod !== 'AEC'
            );

            result.logs.push(`Codes à traiter (après filtrage): ${codesToProcess.map(c => c.cod).join(', ')}`);

            // Filtrer les codes qui correspondent aux critères
            const validCodes = codesToProcess.filter(item => {
                const value = parseInt(item.value) || 0;
                const totalValue = parseInt(item.totalValue) || 0;
                // Vérifier : availableAgents.length === value ET csPersList.length === totalValue
                const isValid = value > 0 && 
                       availableAgentsCount === value && 
                       totalAgentsCount === totalValue;
                
                if (!isValid && item.cod === 'CDG') {
                    const logMsg = `CDG filtré - value: ${value}, totalValue: ${totalValue}, availableAgentsCount: ${availableAgentsCount}, totalAgentsCount: ${totalAgentsCount}`;
                    result.logs.push(logMsg);
                }
                
                return isValid;
            });

            result.logs.push(`Codes valides: ${validCodes.map(c => c.cod).join(', ')}`);
            result.processedCodes = validCodes.map(c => ({
                cod: c.cod,
                lib: c.lib,
                value: parseInt(c.value) || 0,
                totalValue: parseInt(c.totalValue) || 0
            }));

            // Grouper les codes qui ont les mêmes value et totalValue (codes ambigus)
            const codesByKey = new Map();
            validCodes.forEach(item => {
                const value = parseInt(item.value) || 0;
                const totalValue = parseInt(item.totalValue) || 0;
                const key = `${value}_${totalValue}`;
                if (!codesByKey.has(key)) {
                    codesByKey.set(key, []);
                }
                codesByKey.get(key).push(item);
            });

            // Traiter chaque groupe de codes (même value et totalValue = codes ambigus)
            codesByKey.forEach((codesGroup, key) => {
                const logMsg = `Traitement du groupe ${key} avec ${codesGroup.length} code(s): ${codesGroup.map(c => c.cod).join(', ')}`;
                result.logs.push(logMsg);
                
                // Si le groupe contient plusieurs codes (ambiguïté)
                if (codesGroup.length > 1) {
                    // Exception spéciale : si le groupe contient CASAP et CADIV, traiter les deux
                    const hasCASAP = codesGroup.some(c => c.cod === 'CASAP');
                    const hasCADIV = codesGroup.some(c => c.cod === 'CADIV');
                    
                    if (hasCASAP && hasCADIV && codesGroup.length === 2) {
                        // Cas spécial : traiter les deux codes CASAP et CADIV
                        result.logs.push(`⚠️ Cas spécial détecté : CASAP et CADIV ont les mêmes valeurs. Traitement des deux codes.`);
                        
                        // Traiter CASAP
                        codesGroup.forEach(item => {
                            if (item.cod === 'CASAP' || item.cod === 'CADIV') {
                                const cod = item.cod;
                                const value = parseInt(item.value) || 0;
                                
                                const codeLog = {
                                    cod: cod,
                                    columnsReset: [],
                                    agentsUpdated: []
                                };
                                
                                result.logs.push(`Traitement du code ${cod} - Réinitialisation et mise à jour pour ${csPersList.length} agents`);
                                
                                // Obtenir les colonnes concernées par ce code
                                const columnsToReset = getColumnsForCode(cod);
                                codeLog.columnsReset = columnsToReset;
                                result.logs.push(`Colonnes à réinitialiser pour ${cod}: ${columnsToReset.join(', ')}`);
                                
                                // Réinitialiser les colonnes concernées pour TOUS les agents dans la feuille
                                let resetCount = 0;
                                agentsMap.forEach((agentRow, matricule) => {
                                    columnsToReset.forEach(colName => {
                                        const colIndex = getColIndex(colName);
                                        if (colIndex >= 0) {
                                            const oldValue = agentRow.data[colIndex];
                                            if (oldValue != 0 && oldValue != '0' && oldValue != '') {
                                                updateCell(agentRow.data, colIndex, 0);
                                                resetCount++;
                                                if (resetCount <= 10) {
                                                    result.logs.push(`Réinitialisé ${colName} pour ${matricule} (ancienne valeur: ${oldValue})`);
                                                }
                                            } else {
                                                updateCell(agentRow.data, colIndex, 0);
                                            }
                                        }
                                    });
                                });
                                result.logs.push(`${resetCount} colonnes réinitialisées pour le code ${cod} (sur tous les agents de la feuille)`);
                                
                                // Mettre à 1 pour TOUS les agents de csPersList
                                csPersList.forEach(person => {
                                    const matricule = `${person.persStatutCod}${person.persId}`;
                                    const agentRow = agentsMap.get(matricule);
                                    if (!agentRow) return;

                                    const asupInfo = asupMap.get(matricule);
                                    const asup1 = asupInfo && asupInfo.asup1;
                                    const grade = agentRow.data[getColIndex('grade')] || asupInfo?.grade || '';

                                    // Appliquer les correspondances (mettre à 1)
                                    applyCorrespondance(cod, agentRow, asup1, grade);
                                    
                                    codeLog.agentsUpdated.push({
                                        matricule: matricule,
                                        nom: person.nom,
                                        prenom: person.prenom
                                    });
                                });
                                
                                result.logs.push(`${codeLog.agentsUpdated.length} agents mis à jour pour le code ${cod}`);
                                result.updatedAgents.push(codeLog);
                            }
                        });
                        return; // On a traité les deux codes, on sort
                    } else {
                        // Autre ambiguïté : ne rien modifier
                        const ambiguousCodes = codesGroup.map(c => c.cod).join(', ');
                        result.logs.push(`⚠️ Ambiguïté détectée pour le groupe ${key} avec les codes: ${ambiguousCodes}. Aucune modification effectuée.`);
                        result.errors.push(`Ambiguïté: plusieurs codes (${ambiguousCodes}) ont les mêmes valeurs (value=${codesGroup[0].value}, totalValue=${codesGroup[0].totalValue}). Aucune modification effectuée.`);
                        return; // Ne rien faire pour ce groupe
                    }
                }
                
                // Si un seul code dans le groupe, le traiter normalement
                const item = codesGroup[0];
                const cod = item.cod;
                const value = parseInt(item.value) || 0;
                
                const codeLog = {
                    cod: cod,
                    columnsReset: [],
                    agentsUpdated: []
                };
                
                result.logs.push(`Traitement du code ${cod} - Réinitialisation et mise à jour pour ${csPersList.length} agents`);
                
                // Obtenir les colonnes concernées par ce code
                const columnsToReset = getColumnsForCode(cod);
                codeLog.columnsReset = columnsToReset;
                result.logs.push(`Colonnes à réinitialiser pour ${cod}: ${columnsToReset.join(', ')}`);
                
                // Réinitialiser les colonnes concernées pour TOUS les agents dans la feuille (pas seulement csPersList)
                let resetCount = 0;
                agentsMap.forEach((agentRow, matricule) => {
                    // Réinitialiser les colonnes concernées à 0 pour tous les agents
                    columnsToReset.forEach(colName => {
                        const colIndex = getColIndex(colName);
                        if (colIndex >= 0) {
                            const oldValue = agentRow.data[colIndex];
                            if (oldValue != 0 && oldValue != '0' && oldValue != '') {
                                updateCell(agentRow.data, colIndex, 0);
                                resetCount++;
                                // Logger seulement pour les agents qui avaient une valeur non nulle
                                if (resetCount <= 10) { // Limiter les logs
                                    result.logs.push(`Réinitialisé ${colName} pour ${matricule} (ancienne valeur: ${oldValue})`);
                                }
                            } else {
                                // S'assurer que c'est bien 0 même si c'était déjà vide
                                updateCell(agentRow.data, colIndex, 0);
                            }
                        }
                    });
                });
                result.logs.push(`${resetCount} colonnes réinitialisées pour le code ${cod} (sur tous les agents de la feuille)`);
                
                // Mettre à 1 pour TOUS les agents de csPersList (pas seulement les disponibles)
                csPersList.forEach(person => {
                    const matricule = `${person.persStatutCod}${person.persId}`;
                    const agentRow = agentsMap.get(matricule);
                    if (!agentRow) return;

                    const asupInfo = asupMap.get(matricule);
                    const asup1 = asupInfo && asupInfo.asup1;
                    const grade = agentRow.data[getColIndex('grade')] || asupInfo?.grade || '';

                    // Appliquer les correspondances (mettre à 1)
                    applyCorrespondance(cod, agentRow, asup1, grade);
                    
                    // Vérifier que les valeurs ont bien été mises à jour
                    const cdgIndex = getColIndex('CDG_cdg');
                    if (cod === 'CDG' && cdgIndex >= 0) {
                        const cdgValue = agentRow.data[cdgIndex];
                        result.logs.push(`Agent ${matricule} - CDG_cdg après mise à jour: ${cdgValue}`);
                    }
                    
                    codeLog.agentsUpdated.push({
                        matricule: matricule,
                        nom: person.nom,
                        prenom: person.prenom
                    });
                });
                
                result.logs.push(`${codeLog.agentsUpdated.length} agents mis à jour pour le code ${cod}`);
                result.updatedAgents.push(codeLog);
            });
        }

        // Préparer les données pour la mise à jour
        // On doit mettre à jour toutes les lignes (y compris celles qui ont été modifiées)
        // IMPORTANT: rows contient les références aux tableaux modifiés, donc les modifications sont présentes
        const valuesToUpdate = rows.slice(1).map((row, index) => {
            // Créer une copie de la ligne pour éviter de modifier l'original
            const rowCopy = [...row];
            
            // S'assurer que la ligne a la bonne longueur
            while (rowCopy.length < headers.length) {
                rowCopy.push('');
            }
            
            // Vérifier les valeurs pour les agents modifiés (pour debug)
            const matricule = rowCopy[getColIndex('matricule')];
            if (matricule && result.updatedAgents.some(update => 
                update.agentsUpdated.some(agent => agent.matricule === matricule)
            )) {
                const cdgIndex = getColIndex('CDG_cdg');
                if (cdgIndex >= 0) {
                    result.logs.push(`Ligne ${index + 2} - Agent ${matricule} - CDG_cdg avant sauvegarde: ${rowCopy[cdgIndex]}`);
                }
            }
            
            return rowCopy.slice(0, headers.length);
        });

        result.logs.push(`Préparation de ${valuesToUpdate.length} lignes pour la mise à jour`);

        // Fonction pour convertir un numéro de colonne en lettre (1 -> A, 27 -> AA, etc.)
        const colNumToLetter = (num) => {
            let result = '';
            while (num > 0) {
                num--;
                result = String.fromCharCode(65 + (num % 26)) + result;
                num = Math.floor(num / 26);
            }
            return result;
        };

        // Mettre à jour la feuille agentsASUP dans spreadsheetId2
        // Utiliser un range qui couvre toutes les lignes à mettre à jour
        const lastRow = rows.length;
        const lastCol = colNumToLetter(headers.length);
        const updateRange = `agentsASUP!A2:${lastCol}${lastRow}`;
        
        result.logs.push(`Mise à jour du range: ${updateRange} (${headers.length} colonnes, ${lastRow} lignes)`);
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetIdAgents,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: valuesToUpdate,
            },
        });

        result.success = true;
        result.logs.push(`Agents emplois mis à jour avec succès - ${valuesToUpdate.length} lignes`);
        return result;
    } catch (error) {
        result.success = false;
        result.errors.push(`Erreur lors de la mise à jour: ${error.message}`);
        result.logs.push(`Erreur: ${error.message}`);
        console.error('Error updating agents emplois:', error);
        return result;
    }
}

async function insertSmartemisResponse(data) {
    const result = {
        success: true,
        operations: [],
        emploisUpdate: null,
        errors: []
    };
    const startTime = Date.now();
    const safeLen = (value) => Array.isArray(value) ? value.length : 0;
    const log = (message, extra) => {
        console.log(`[smartemis] ${message}`, extra || {});
    };
    const parseSmartemisDate = (notificationTxt, now) => {
        if (!notificationTxt) {
            return null;
        }
        const match = notificationTxt.match(/- (\d{2})\/(\d{2}) (\d{2}):(\d{2}) -/);
        if (!match) {
            return null;
        }
        const day = Number(match[1]);
        const month = Number(match[2]);
        const hour = Number(match[3]);
        const minute = Number(match[4]);
        if (!day || !month) {
            return null;
        }
        let year = now.getFullYear();
        const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
        if (isNaN(candidate.getTime())) {
            return null;
        }
        // Gère le passage décembre/janvier (ex: notif du 31/12 reçue début janvier).
        if (candidate.getTime() > now.getTime() + (6 * 60 * 60 * 1000)) {
            year -= 1;
        }
        return new Date(year, month - 1, day, hour, minute, 0, 0);
    };

    log('insertSmartemisResponse start', {
        keys: Object.keys(data || {}),
        itvDetail: Boolean(data && data.itvDetail),
        depItvCsListLen: data && data.itvDetail ? safeLen(data.itvDetail.depItvCsList) : 0,
        histItvListLen: safeLen(data && data.histItvList),
        engListLen: safeLen(data && data.engList),
        localGlobalInstructionListLen: safeLen(data && data.localGlobalInstructionList),
        csPersListLen: safeLen(data && data.csPersList),
        notificationListLen: safeLen(data && data.notificationList),
        planningCounterListLen: safeLen(data && data.planningCounterList)
    });
    const hasMainLists = Boolean(
        (data && data.itvDetail && data.itvDetail.depItvCsList && data.itvDetail.depItvCsList.length > 0) ||
        (data && Array.isArray(data.histItvList) && data.histItvList.length > 0) ||
        (data && Array.isArray(data.engList) && data.engList.length > 0) ||
        (data && Array.isArray(data.localGlobalInstructionList) && data.localGlobalInstructionList.length > 0) ||
        (data && Array.isArray(data.csPersList) && data.csPersList.length > 0) ||
        (data && Array.isArray(data.planningCounterList) && data.planningCounterList.length > 0)
    );
    if (!hasMainLists && safeLen(data && data.notificationList) > 0) {
        log('payload warning', {
            message: 'Payload recu sans listes principales (seulement notificationList)',
            notificationListLen: safeLen(data && data.notificationList),
            hasResult: Boolean(data && data.result)
        });
    }
    
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

    if (data.itvDetail && data.itvDetail.depItvCsList && data.itvDetail.depItvCsList.length > 0) {
        const depItvCsList = JSON.stringify(data.itvDetail.depItvCsList);
        const srvExtList = JSON.stringify(data.itvDetail.srvExtList);
        const now = new Date();
        const formattedDate = now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        let range10 = 'Feuille 9!A2:C5';
        const itvDetailStart = Date.now();
        log('itvDetail start', { range: range10, depItvCsListLen: data.itvDetail.depItvCsList.length });
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: range10,
            });
            const itvDetailValues = [
                [ depItvCsList, srvExtList, formattedDate ]
              ];
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: range10,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: itvDetailValues,
                },
            });
            result.operations.push({
                type: 'itvDetail',
                range: range10,
                success: true
            });
            log('itvDetail success', { range: range10, durationMs: Date.now() - itvDetailStart });
        } catch (error) {
            result.operations.push({
                type: 'itvDetail',
                range: range10,
                success: false,
                error: error.message
            });
            result.errors.push(`Erreur lors de l'insertion de itvDetail: ${error.message}`);
            result.success = false;
            log('itvDetail error', { range: range10, durationMs: Date.now() - itvDetailStart, error: error.message });
            console.error(error);
        }
    }
    if (data.histItvList && data.histItvList.length > 0) {
        const histValues = data.histItvList.map(item => [
            item.histDate?.date || '',
            item.histTxt || '',
        ]);

        let rangeHist = 'Feuille 10!A2:C100';
        const histStart = Date.now();
        log('histItvList start', { range: rangeHist, rows: histValues.length });
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: rangeHist,
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangeHist,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: histValues,
                },
            });
            result.operations.push({
                type: 'histItvList',
                range: rangeHist,
                success: true,
                rowsInserted: histValues.length
            });
            log('histItvList success', { range: rangeHist, durationMs: Date.now() - histStart });
        } catch (error) {
            result.operations.push({
                type: 'histItvList',
                range: rangeHist,
                success: false,
                error: error.message
            });
            result.errors.push(`Erreur lors de l'insertion de histItvList: ${error.message}`);
            result.success = false;
            log('histItvList error', { range: rangeHist, durationMs: Date.now() - histStart, error: error.message });
            console.error(error);
        }
    }

    if (data.engList) {
        try {
            const engValues = data.engList.map(eng => [
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
            engValues.forEach(row => row.push(currentTime));

            const engStart = Date.now();
            log('engList start', { range: range, rows: engValues.length });
            const response = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: engValues,
                },
            });

            result.operations.push({
                type: 'engList',
                range: range,
                success: true,
                rowsUpdated: engValues.length
            });
            log('engList success', { range: range, durationMs: Date.now() - engStart });
        } catch (error) {
            result.operations.push({
                type: 'engList',
                range: range,
                success: false,
                error: error.message
            });
            result.errors.push(`Erreur lors de la mise à jour de engList: ${error.message}`);
            result.success = false;
            log('engList error', { range: range, error: error.message });
            console.error(error);
        }
    }
    if (data.localGlobalInstructionList && data.localGlobalInstructionList.length >= 0) {
        const instructionValues = data.localGlobalInstructionList.map(item => ({
            origin: item.instructionOrigCs || '',
            nom: item.instructionOrigName || '',
            debut: item.instructionStartDate?.date || '',
            fin: item.instructionEndDate?.date || '',
            titre: item.instructionTitle || '',
            text: item.instructionTxt || ''
        }));
        let rangeInstr = 'Feuille 13!A2:F100';
        const instructionStart = Date.now();
        log('localGlobalInstructionList start', { range: rangeInstr, rows: instructionValues.length });
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: rangeInstr,
            });
        } catch (error) {
            result.errors.push(`Erreur lors du clear de ${rangeInstr}: ${error.message}`);
            log('localGlobalInstructionList clear error', { range: rangeInstr, error: error.message });
            console.error(error);
        }
        if (instructionValues.length > 0) {
        try {
            const response = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangeInstr,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: instructionValues.map(item => [
                        item.origin,
                        item.nom,
                        item.debut,
                        item.fin,
                        item.titre,
                        item.text
                    ]),
                },
            });
            result.operations.push({
                type: 'localGlobalInstructionList',
                range: rangeInstr,
                success: true,
                rowsInserted: instructionValues.length
            });
            log('localGlobalInstructionList success', { range: rangeInstr, durationMs: Date.now() - instructionStart });
        } catch (error) {
            result.operations.push({
                type: 'localGlobalInstructionList',
                range: rangeInstr,
                success: false,
                error: error.message
            });
            result.errors.push(`Erreur lors de l'insertion de localGlobalInstructionList: ${error.message}`);
            result.success = false;
            log('localGlobalInstructionList error', { range: rangeInstr, durationMs: Date.now() - instructionStart, error: error.message });
            console.error(error);
        }
    }
    }
    if (data.csPersList){
        const allAgents = require('./allAgents');
        const agentsData = await allAgents.getAllAgents();
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
        const csPersValues = agentInfoList.map(agent => [
            agent.matricule,
            agent.grade,
            agent.nom,
            agent.prenom,
            agent.administrativeStatusCode,
            agent.administrativeStatusRgb
        ]);
        
        // Récupérer planningCounterList depuis data ou depuis la Feuille 16
        let planningCounterList = data.planningCounterList;
        if (!planningCounterList || planningCounterList.length === 0) {
            // Lire depuis la Feuille 16 du spreadsheetId
            planningCounterList = await getPlanningCounterListFromSheet(sheets, spreadsheetId);
        }
        
        // Déterminer la feuille selon la logique :
        // - Si csPersList.length === totalValue de DISPO → Feuille 12 (disponibilité)
        // - Sinon si csPersList.length === value de DEP_ITV__PERS → Feuille 5 (intervention)
        // - Sinon → mode emplois (pas de mise à jour de cette feuille)
        let range2 = null; // Par défaut, pas de mise à jour (mode emplois)
        if (planningCounterList && planningCounterList.length > 0) {
            const dispo = planningCounterList.find(item => item.cod === 'DISPO');
            const depItvPers = planningCounterList.find(item => item.cod === 'DEP_ITV__PERS');
            const enInterPers = depItvPers ? parseInt(depItvPers.value) || 0 : 0;
            const totalAgents = enInterPers + (data.csPersList ? data.csPersList.length : 0);

            console.log('totalAgents', totalAgents);
            console.log('enInterPers', enInterPers);
            console.log('data.csPersList', data.csPersList.length);
            
            if (dispo) {
                const dispoTotalValue = parseInt(dispo.totalValue) || 0;
                console.log('dispoTotalValue', dispoTotalValue);
                console.log('totalAgents === dispoTotalValue', totalAgents === dispoTotalValue);
                if (totalAgents === dispoTotalValue) {
                    range2 = 'Feuille 12!A2:F100'; // Mode disponibilité
                }
            }
            
            if (!range2 && depItvPers && parseInt(depItvPers.value) > 0) {
                const depItvValue = parseInt(depItvPers.value) || 0;
                console.log('depItvValue', depItvValue);
                console.log('totalAgents === depItvValue', totalAgents === depItvValue);
                if (totalAgents > depItvValue) {
                    range2 = 'Feuille 5!A2:F30'; // Mode intervention
                }
            }
        }
                
        // Ne mettre à jour la feuille que si on n'est pas en mode emplois
        if (range2) {
            const csPersStart = Date.now();
            log('csPersList update start', { range: range2, rows: csPersValues.length });
            try {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: range2,
                });
                result.operations.push({
                    type: 'clear',
                    range: range2,
                    success: true
                });
            } catch (error) {
                result.operations.push({
                    type: 'clear',
                    range: range2,
                    success: false,
                    error: error.message
                });
                result.errors.push(`Erreur lors du clear de ${range2}: ${error.message}`);
                log('csPersList clear error', { range: range2, error: error.message });
                console.error(error);
            }
            try {
                const response = await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: range2,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: csPersValues,
                    },
                });
                result.operations.push({
                    type: 'update',
                    range: range2,
                    success: true,
                    rowsUpdated: csPersValues.length
                });
                log('csPersList update success', { range: range2, durationMs: Date.now() - csPersStart });
            } catch (error) {
                result.operations.push({
                    type: 'update',
                    range: range2,
                    success: false,
                    error: error.message
                });
                result.errors.push(`Erreur lors de la mise à jour de ${range2}: ${error.message}`);
                log('csPersList update error', { range: range2, durationMs: Date.now() - csPersStart, error: error.message });
                console.error(error);
            }
        } else {
            result.operations.push({
                type: 'info',
                message: 'Mode emplois détecté - pas de mise à jour de la feuille csPersList'
            });
            log('csPersList info', { message: 'Mode emplois detecte - pas de mise a jour', rows: csPersValues.length });
        }

        // Mettre à jour les emplois des agents si planningCounterList existe
        // (se fait toujours, même en mode disponibilité/intervention, mais la fonction gère le mode)
        if (planningCounterList && planningCounterList.length > 0) {
            try {
                log('updateAgentsEmplois start', { rows: data.csPersList.length, planningCounterListLen: planningCounterList.length });
                const emploisResult = await updateAgentsEmplois(data.csPersList, planningCounterList);
                result.emploisUpdate = emploisResult;
                if (!emploisResult.success) {
                    result.success = false;
                }
                log('updateAgentsEmplois success', { success: emploisResult.success });
            } catch (error) {
                result.emploisUpdate = {
                    success: false,
                    error: error.message
                };
                result.errors.push(`Erreur lors de la mise à jour des emplois: ${error.message}`);
                result.success = false;
                log('updateAgentsEmplois error', { error: error.message });
                console.error(error);
            }
        }
    }
        if (data.notificationList){
            if (!fetch) {
                fetch = (await import('node-fetch')).default;
            };
            const notificationStart = Date.now();
            log('notificationList start', { rows: data.notificationList.length });
            const backendNotifications = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
            const backendData = await backendNotifications.json();
            const currentTime = new Date().getTime();
            const nowDate = new Date();
            const fiveHoursInMillis = 5 * 60 * 60 * 1000;
            let insertedCount = 0;
            let skippedExistingCount = 0;
            let skippedOldCount = 0;
            let skippedNonItvCount = 0;
            let skippedExerciseCount = 0;
            let parsedFallbackCount = 0;

             data.notificationList.sort((a, b) => {
                const dateA = new Date(a.notificationDate.date).getTime();
                const dateB = new Date(b.notificationDate.date).getTime();
                return dateA - dateB; // Tri ascendant, le plus ancien en premier
            });

            for (const notification of data.notificationList) {
                if (notification.notificationTyp === "ITV" && !notification.notificationTxt.includes("xercice")) {
                    let notificationTxt_modified = "🚧 " + notification.notificationTxt.replace(/\\n/g, "-");
                    const notificationTime = new Date(notification.notificationDate.date).getTime();
                    let effectiveTime = notificationTime;
                    if (isNaN(notificationTime)) {
                        const parsedDate = parseSmartemisDate(notificationTxt_modified, nowDate);
                        if (parsedDate) {
                            effectiveTime = parsedDate.getTime();
                            parsedFallbackCount += 1;
                            log('notificationList parsed fallback (invalid payload date)', {
                                notificationId: notification.notificationId,
                                parsedDate: parsedDate.toISOString()
                            });
                        }
                    }

                    if (currentTime - effectiveTime <= fiveHoursInMillis) {
                        const existingNotification = backendData.find(item => item.notification === notificationTxt_modified);

                        if (!existingNotification) {
                            await insertInterventionNotif({ notification: notificationTxt_modified }, "Added with Smartemis App");
                            insertedCount += 1;
                        } else {
                            skippedExistingCount += 1;
                        }
                    } else {
                        const parsedDate = parseSmartemisDate(notificationTxt_modified, nowDate);
                        if (parsedDate && (currentTime - parsedDate.getTime() <= fiveHoursInMillis)) {
                            const existingNotification = backendData.find(item => item.notification === notificationTxt_modified);
                            if (!existingNotification) {
                                await insertInterventionNotif({ notification: notificationTxt_modified }, "Added with Smartemis App");
                                insertedCount += 1;
                                parsedFallbackCount += 1;
                                log('notificationList parsed fallback (payload too old)', {
                                    notificationId: notification.notificationId,
                                    parsedDate: parsedDate.toISOString()
                                });
                            } else {
                                skippedExistingCount += 1;
                            }
                        } else {
                            skippedOldCount += 1;
                        }
                    }
                } else {
                    if (notification.notificationTyp !== "ITV") {
                        skippedNonItvCount += 1;
                    } else if (notification.notificationTxt.includes("xercice")) {
                        skippedExerciseCount += 1;
                    }
                }
            }
            log('notificationList success', {
                durationMs: Date.now() - notificationStart,
                insertedCount,
                skippedExistingCount,
                skippedOldCount,
                skippedNonItvCount,
                skippedExerciseCount,
                parsedFallbackCount
            });
        }
    if (data.planningCounterList && data.planningCounterList.length > 0) {
        const planningValues = data.planningCounterList.map(item => [
            item.cod || '',
            item.lib || '',
            item.value || '',
            item.totalValue || ''
        ]);
        let rangePlanning = 'Feuille 16!A2:D100';
        const planningStart = Date.now();
        log('planningCounterList start', { range: rangePlanning, rows: planningValues.length });
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: rangePlanning,
            });
        } catch (error) {
            result.errors.push(`Erreur lors du clear de ${rangePlanning}: ${error.message}`);
            log('planningCounterList clear error', { range: rangePlanning, error: error.message });
            console.error(error);
        }
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangePlanning,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: planningValues,
                },
            });
            result.operations.push({
                type: 'planningCounterList',
                range: rangePlanning,
                success: true,
                rowsInserted: planningValues.length
            });
            log('planningCounterList success', { range: rangePlanning, durationMs: Date.now() - planningStart });
        } catch (error) {
            result.operations.push({
                type: 'planningCounterList',
                range: rangePlanning,
                success: false,
                error: error.message
            });
            result.errors.push(`Erreur lors de l'insertion de planningCounterList: ${error.message}`);
            result.success = false;
            log('planningCounterList error', { range: rangePlanning, durationMs: Date.now() - planningStart, error: error.message });
            console.error(error);
        }
    }
    
    log('insertSmartemisResponse end', {
        durationMs: Date.now() - startTime,
        success: result.success,
        operations: result.operations.length,
        errors: result.errors.length
    });
    return result;
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

    let rangeHist = 'Feuille 10!A2:C100';
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: rangeHist,
            });
            console.log('Data cleared successfully!');
        }
        catch (error) {
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

function giveDateComment(dateObj_in){
    let dateObj = new Date(dateObj_in);
    let dateWeekDay = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    if (dateWeekDay === "Friday" || dateWeekDay === "Saturday" || dateWeekDay === "Sunday") {
        return ["WEEK-END"];
    } else if (dateWeekDay === "Monday" || dateWeekDay === "Tuesday") {
        return ["LUN", "MAR"];
    } else if (dateWeekDay === "Wednesday" || dateWeekDay === "Thursday") {
        return ["MER", "JEU"];
    }
}

async function switchArah(){
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = config.google.spreadsheetId;
    const range = 'Feuille 8!A2:A2';
    try {
        // Get the current value
        const getRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        let currentValue = (getRes.data.values && getRes.data.values[0] && getRes.data.values[0][0]) || '';
        let newValue = currentValue === 'OUI' ? 'NON' : 'OUI';

        // Update the value
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newValue]],
            },
        });
        console.log(`Value switched from ${currentValue} to ${newValue}`);
        return newValue;
    } catch (err) {
        console.error('Error switching value:', err);
    }
}

async function getPlanning(){
    if (!fetch){
        fetch = (await import('node-fetch')).default;
    }
    try {
        const response = await fetch('https://opensheet.elk.sh/1zFKFK_tlFQD3_Y6JkgRYm_E0THA6AVkYGYJjMpM8DPY/Feuille%201');
        const data = await response.json();
        data.forEach(row => {
            const [day, month, year] = row.Date.split('/');
            row.Date = new Date(`${year}-${month}-${day}`);
        });
        const today = new Date();
        today.setDate(today.getDate() - 1);
        const planning = await data.filter(row => row.Date >= today).sort((a, b) => a.Date - b.Date);
        let currentTeam = {};
        currentTeam = {
           equipe : planning[0].equipeGarde,
           dateComment : giveDateComment(planning[0].Date),
           date: planning[0].Date
        }
        let nextTeam = {};
        let teamAfter = {};
        let nextTwoEvents = [];
        let nextTwoBirthdays = [];
        let nextReunion = "";
        let nextReunionTeam = "";
        for (let i = 1; i < planning.length; i++) {
            if (planning[i].equipeGarde !== currentTeam.equipe) {
                nextTeam = {
                    equipe: planning[i].equipeGarde,
                    dateComment: giveDateComment(planning[i].Date),
                    date: planning[i].Date
                };
                break;
            }
        }
        for (let i = 1; i < planning.length; i++) {
            if (planning[i].equipeGarde !== nextTeam.equipe && planning[i].Date > nextTeam.date) {
                teamAfter = {
                    equipe: planning[i].equipeGarde,
                    dateComment: giveDateComment(planning[i].Date),
                    date: planning[i].Date
                };
                break;
            }
        }
        const events = planning.filter(row => row.evenementNom && row.evenementNom != '').sort((a, b) => a.Date - b.Date);
        if (events.length > 0) {
            nextTwoEvents = events.slice(0, 2);
        }
        const birthdays = planning.filter(row => row.anniversaire && row.anniversaire != '').sort((a, b) => a.Date - b.Date);
        if (birthdays.length > 0) {
            nextTwoBirthdays = birthdays.slice(0, 2);
        }
        const reunions = planning.filter(row => row.réunion && row.réunion == 'oui').sort((a, b) => a.Date - b.Date);
        if (reunions.length > 0) {
            nextReunion = reunions[0].Date;
            nextReunionTeam = reunions[0].equipeGarde;
        }

        return { currentTeam, nextTeam, teamAfter, nextTwoEvents, nextTwoBirthdays, nextReunion, nextReunionTeam };
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
            .filter(vehicule => vehicule.engStatusCod === "AL" || vehicule.engStatusCod === "RE" || vehicule.engStatusCod === "PA")
            .map(vehicule => vehicule.engLib);
        const gradeDict = {
            "sap 2cl": "2CL",
            "sap 1cl": "1CL",
            "caporal": "CAP",
            "caporal-chef": "CCH",
            "sergent": "SGT",
            "sergent-chef": "SCHE",
            "adjudant": "ADJ",
            "adjudant-chef": "ADC",
            "lieutenant": "LTN",
            "capitaine": "CNE",
            "commandant": "CDT",
            "lieutenant-colonel": "LCL",
            "colonel": "COL"
        };
        const gradePriority = {
            "2CL": 1,
            "1CL": 2,
            "CAP": 3,
            "CCH": 4,
            "SGT": 5,
            "SCHE": 6,
            "ADJ": 7,
            "ADC": 8,
            "LTN": 9,
            "CNE": 10,
            "CDT": 11,
            "LCL": 12,
            "COL": 13
        };

        const agentsList = agentsData
            .sort((a, b) => {
                const gradeA = gradeDict[a.grade.toLowerCase()] || "ZZZ";
                const gradeB = gradeDict[b.grade.toLowerCase()] || "ZZZ";
                if (gradeA !== gradeB) {
                    return (gradePriority[gradeB] || 99) - (gradePriority[gradeA] || 99);
                } else {
                    return a.nom.localeCompare(b.nom);
                }
            })
            .map(agent => `${gradeDict[agent.grade.toLowerCase()]} ${agent.nom} ${agent.prenom} (${agent.matricule})`);
        const agentsStr = agentsList.join(' | ');
        return { vehiculeList, agentsData, agentsStr };

    } catch (err){
        console.error('Error fetching data:', err);
        throw err;
    }
}

async function insertRIIntoGSHEET(data){
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = "17f60tzWQ_ZZnzZ1tP2Y0YEHkwQ54lN5mnlqGVm84kLc";
    const range = 'Feuille 2!A2:E';
    let vehiculeRI = data.vehiculeRI || '';

    if (vehiculeRI.includes("+")){
      let vehicule = vehiculeRI.replace("+", "").split(" ")
      vehiculeRI = vehicule[0] + " de remplacement (+" + vehicule[1] + ")"
    }


    await db.query(
          `UPDATE retourIntervention SET statutRI = 1
          WHERE idMateriel = 'controleGluco' OR idMateriel = 'gantL' OR idMateriel = 'gantM' 
          OR idMateriel = 'gantS' OR idMateriel = 'gantXL' OR idMateriel = 'masqueChir'
          OR idMateriel = 'gelHydroAlcolo'`);

    if (data.matToCheck && data.matToCheck.length > 0) {
    await db.query(
        `UPDATE retourIntervention SET statutRI = 1
        WHERE nomRetourInter IN (${data.matToCheck.map(item => `'${item.replace(/'/g, " ")}'`).join(', ')})`);
    }
    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
            values: [[
                data.interNum || '',
                data.interCommune || '',
                data.interLib || '',
                data.interDate || '',
                data.interLon || '',
                data.interLat || '',
                data.CAGrade || '',
                data.CANom || '',
                data.CALib || '',
                data.CAMail || '',
                data.EQGrade || '',
                data.EQNom || '',
                data.EQLib || '',
                data.EQMail || '',
                data.matUtilise || '',
                data.onlyMatBilan || '',
                data.MatBilan || '',
                data.MatOxy || '',
                data.MatRea || '',
                data.MatPlaie || '',
                data.MatTrauma || '',
                data.MatKits || '',
                vehiculeRI || '',
                data.ReconditionnementRI || '',
                data.CommentaireRI || '',
                'Pending' // StatusRI
            ]],
            },
        });
        console.log('Row appended successfully!');
        return response;
    } catch (err) {
        console.error('Error appending row:', err);
        throw err; // Renvoie l'erreur pour être gérée par l'appelant
    }
}

async function resetRICounter(type, matricule){
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = "17f60tzWQ_ZZnzZ1tP2Y0YEHkwQ54lN5mnlqGVm84kLc";
    let range = '';
    let agent = await db.query(
        `SELECT * FROM agents WHERE idAgent LIKE "${matricule}"`,
    );
    let agent_label = agent[0].gradeAbbrAgent + " " + agent[0].nomAgent;
    if (type == "partiel"){
        range = 'Feuille 3!B2';
        await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[0]],
        },
    });
    } else { 
        range = 'Feuille 3!A2:B2';
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[0, 0]],
            },
        });
    }
    console.log(`Counter reset to 0 by ${agent_label}`);
    let message = `CMS Collonges :
    ${agent_label} vient de réaliser un inventaire ${type}. Les compteurs ont été réinitialisés.`;
    let notifPhoneOptions = {
        method: "post",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            newEngin: "null",
            newMessage: "null",
            pharmacie: message
        }),
        redirect: "follow"
    };
    // Send phone notification, but don't block main flow if it fails
    fetch(process.env.MACRO_TRIGGER.replace("/smartemis", "/enginsSmartemis"), notifPhoneOptions)
        .then(notifPhoneResponse => {
            if (!notifPhoneResponse.ok) {
                console.log('Error in phone notification:', notifPhoneResponse.statusText);
            }
        })
        .catch(err => {
            console.log('Error sending phone notification:', err);
        });
}

async function insertParrainageData(payload) {
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1UmDP0LygLZ7xMuYODsvxD1uhQY3ZNd2RYz3_agOl9a8';
    const range = 'Reponses!A2:Q';

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: payload,
        });
        console.log('Parrainage data appended successfully!');
        return response;
    } catch (err) {
        console.error('Error appending parrainage data:', err);
        throw err;
    }
}

async function getAllSheetsData(spreadsheetId) {
    const privateKeyRaw = (config && config.google && config.google.private_key) || process.env.GOOGLE_PRIVATE_KEY;
    const clientEmail = (config && config.google && config.google.client_email) || process.env.GOOGLE_CLIENT_EMAIL;
    if (!privateKeyRaw || !clientEmail) {
        console.error('Google credentials missing: provide config.google.private_key and config.google.client_email or set GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL env vars');
        return [];
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        clientEmail,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        // Fetch available sheet titles
        const meta = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties.title'
        });
        const sheetsMeta = (meta && meta.data && meta.data.sheets) || [];
        const availableTitles = sheetsMeta.map(s => s.properties && s.properties.title ? s.properties.title : '');

        // We only want Feuille 1, and Feuille 4 through Feuille 13
        const desiredTitles = ['Feuille 1'];
        for (let i = 4; i <= 14; i++) desiredTitles.push(`Feuille ${i}`);

        // Keep only those that actually exist in the spreadsheet, preserving desired order
        const titlesToFetch = desiredTitles.filter(t => availableTitles.includes(t));
        if (titlesToFetch.length === 0) return [];

        // Build ranges for the selected sheets
        const ranges = titlesToFetch.map(title => {
            const needsQuotes = /\s|[^A-Za-z0-9_\-]/.test(title);
            const safeTitle = needsQuotes ? `'${title.replace(/'/g, "\\'")}'` : title;
            return `${safeTitle}!A:Z`;
        });

        // Batch get ranges (chunk to be safe)
        const chunk = (arr, size) => {
            const out = [];
            for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
            return out;
        };

        const allValueRanges = [];
        const rangeChunks = chunk(ranges, 100);
        for (const rc of rangeChunks) {
            const batchRes = await sheets.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges: rc,
            });
            allValueRanges.push(...(batchRes.data.valueRanges || []));
        }

        // Map results back to titles
        const valuesByTitle = {};
        for (const vr of allValueRanges) {
            if (!vr || !vr.range) continue;
            let titlePart = vr.range.split('!')[0];
            titlePart = titlePart.replace(/^'(.*)'$/, '$1');
            valuesByTitle[titlePart] = vr.values || [];
        }

        const allSheetData = titlesToFetch.map(title => ({
            title,
            values: valuesByTitle[title] || []
        }));

        return allSheetData;
    } catch (err) {
        console.error('Error fetching selected sheets data (batch):', err);
        throw err;
    }
}


module.exports = { insertInterventionNotif, giveInterventionType, insertSmartemisResponse, verifyIfInter, clearSmartemisResponse, giveAgentsAndVehicules, getPlanning, insertRIIntoGSHEET, resetRICounter, switchArah, insertParrainageData, getAllSheetsData };
