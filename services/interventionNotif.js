const { google } = require('googleapis');
const config = require('../config');
const db = require('./db');
let fetch


async function insertInterventionNotif(data, msg="Added with CMS API") {

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
        let notifPhoneOptions = {
            method: "post",
            headers: {
                "Content-Type": "text/plain" 
            },
            body: rowData,
            redirect: "follow"
        };
    const notifPhoneResponse = await fetch(process.env.MACRO_TRIGGER2, notifPhoneOptions);
    if (!notifPhoneResponse.ok) {
        console.log('Error in phone notification:', notifPhoneResponse.statusText);
    }
    let cleanedEntry = rowData.replace(/\n/g, '').replace(/\r/g, ' ').replace(/(\|.*? -)/g, '-').replace(/simples - poubelles/g, 'simples | poubelles').replace(/batiment - structure/g, 'batiment | structure').replace(/terrain - montee/g, 'terrain | montee').replace(/RECO - AVIS/g, 'RECO | AVIS');
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

    addressInter = cleanedEntry.match(/(.*) - (\d+) Engins/);
    longitude = "";
    latitude = "";
    villeInter = "";

    if (addressInter) {
        addressInter = addressInter[1].replace(/🚧.*?-.*?-.*?-/, '').replace(" ", "");
        if (addressInter.includes('HYDR SAONE')) {
            longitude = "4.855327";
            latitude = "45.821767";
        } else {
            try {
                const coords = await findInterventionCoordinates(addressInter);
                longitude = String(coords.lng).replace(',', '.');
                latitude = String(coords.lat).replace(',', '.');
            } catch (err) {
                console.error('Error finding coordinates:', err);
                throw err;
            }
        }
        let splittedAddress = addressInter.split(' ');
        if (addressInter.includes("LYON 0")){
            villeInter = splittedAddress[0] + " " + splittedAddress[1].replace("0", "") + "ÈME";
            addressInter = addressInter.replace(/LYON 0\d/, villeInter);
        } else {
            villeInter = splittedAddress[0];
        }
    } else {
        addressInter = '';
    }

    incidentInter = cleanedEntry.match(/(\d+):(\d+) -(.*)-/);

    if (incidentInter) {
        incidentInter = incidentInter[3].toString().match(/ (.*) -/)[1];
    } else {
        incidentInter = '';
    }

    enginsInter = cleanedEntry.match(/- (\d+) Engins/);

    if (enginsInter) {
        enginsInter = enginsInter[1];
    } else {
        enginsInter = '';
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
            const postResponse = await fetch(process.env.MACRO_TRIGGER, postOptions);
            if (!postResponse.ok) {
                console.log('Error in post request:', postResponse.statusText);
            } else {
                console.log('Post request successful!');
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

    if (data.status === 'OK') {
        const location = data.results[0].geometry.location;
        return { lat: location.lat, lng: location.lng };
    } else {
        throw new Error('Unable to find coordinates for the given address');
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

    if (data.itvDetail && data.itvDetail.depItvCsList && data.itvDetail.depItvCsList.length > 0) {
        const depItvCsList = JSON.stringify(data.itvDetail.depItvCsList);
        const srvExtList = JSON.stringify(data.itvDetail.srvExtList);
        const now = new Date();
        const formattedDate = now.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        let range10 = 'Feuille 9!A2:C5';
        try {
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: range10,
            });
            console.log('Data cleared successfully!');
            let values = [
                [ depItvCsList, srvExtList, formattedDate ]
              ];
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: range10,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values,
                },
            });
            console.log('Data inserted successfully:', values);
        } catch (error) {
            console.error('Error inserting data:', error);
        }
    }
    if (data.histItvList && data.histItvList.length > 0) {
        const values = data.histItvList.map(item => [
            item.histDate?.date || '',
            item.histTxt || '',
        ]);

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
        try {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: rangeHist,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values,
                },
            });
            console.log('Historical intervention data inserted successfully:', values);
        } catch (error) {
            console.error('Error inserting historical intervention data:', error);
        }
    }

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
        if (data.notificationList){
            if (!fetch) {
                fetch = (await import('node-fetch')).default;
            };
            const backendNotifications = await fetch('https://opensheet.elk.sh/1-S_8VCPQ76y3XTiK1msvjoglv_uJVGmRNvUZMYvmCnE/Feuille%201');
            const backendData = await backendNotifications.json();
            const currentTime = new Date().getTime();
            const fiveHoursInMillis = 5 * 60 * 60 * 1000;

             data.notificationList.sort((a, b) => {
                const dateA = new Date(a.notificationDate.date).getTime();
                const dateB = new Date(b.notificationDate.date).getTime();
                return dateA - dateB; // Tri ascendant, le plus ancien en premier
            });

            for (const notification of data.notificationList) {
                if (notification.notificationTyp === "ITV" && !notification.notificationTxt.includes("xercice")) {
                    let notificationTxt_modified = "🚧 " + notification.notificationTxt.replace(/\\n/g, "-");
                    const notificationTime = new Date(notification.notificationDate.date).getTime();

                    if (currentTime - notificationTime <= fiveHoursInMillis) {
                        const existingNotification = backendData.find(item => item.notification === notificationTxt_modified);

                        if (!existingNotification) {
                            await insertInterventionNotif({ notification: notificationTxt_modified }, "Added with Smartemis App");
                        }
                    }
                }
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

        return { vehiculeList, agentsData };
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
                data.vehiculeRI || '',
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

module.exports = { insertInterventionNotif, giveInterventionType, insertSmartemisResponse, verifyIfInter, clearSmartemisResponse, giveAgentsAndVehicules, getPlanning, insertRIIntoGSHEET };
