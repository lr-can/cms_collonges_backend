const { db } = require('./firebase-admin');

const MANOEUVRE_INFO_PATH = 'manoeuvre/info';
const MANOEUVRANTS_PATH = 'manoeuvre/manoeuvrants';

// Fonction pour créer les données de manoeuvre dans Firebase
async function createManoeuvreInFirebase(data, numInter) {
    try {
        const numManoeuvre = numInter;
        
        // Construction de titleManoeuvre
        const titleManoeuvre = data.sinistre?.libelleComplet || '';
        
        // Construction de adresseManoeuvre
        let adresseManoeuvre = '';
        if (data.adresses?.adresseCommune) {
            const commune = (data.adresses.adresseCommune.commune || '').toUpperCase().trim();
            const voie = (data.adresses.adresseCommune.voie || '').toUpperCase().trim();
            adresseManoeuvre = `${commune} ${voie}`.trim();
            
            // Ajout de l'ERP si présent
            if (data.adresses.adresseCommune.erp) {
                adresseManoeuvre += ` | ERP ${data.adresses.adresseCommune.erp.toUpperCase().trim()}`;
            }
        }

        // Insérer les infos de manoeuvre dans Firebase
        const infoRef = db.ref(MANOEUVRE_INFO_PATH);
        await infoRef.set({
            numManoeuvre: numManoeuvre,
            titleManoeuvre: titleManoeuvre,
            adresseManoeuvre: adresseManoeuvre
        });

        console.log('Manoeuvre info inserted successfully in Firebase!');

        // Préparation des données pour Manoeuvrants
        const grades_list = {
            "Sap 2CL": "SAP",
            "Sap 1CL": "SAP",
            "Caporal": "CAP",
            "Caporal-Chef": "CCH",
            "Sergent": "SGT",
            "Sergent-Chef": "SCHE",
            "Adjudant": "ADJ",
            "Adjudant-Chef": "ADC",
            "Lieutenant": "LTN",
            "Capitaine": "CNE",
            "Commandant": "CDT",
            "Colonel": "COL",
            "Lieutenant-Colonel": "LCL",
            "Expert": "EXP",
            "Infirmière": "INF",
        };

        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const manoeuvrants = {};

        if (data.ordresDeparts && Array.isArray(data.ordresDeparts)) {
            for (const OD of data.ordresDeparts) {
                if (OD.engins && Array.isArray(OD.engins)) {
                    for (const engin of OD.engins) {
                        if (engin.affectation && Array.isArray(engin.affectation)) {
                            for (const agent of engin.affectation) {
                                const agent_grade = grades_list[agent.grade] || agent.grade;
                                
                                // Extraire nom et prénom depuis label
                                let nom = '';
                                let prenom = '';
                                if (agent.label) {
                                    const labelParts = agent.label
                                        .replace(`${agent.matricule} - `, '')
                                        .replace(agent_grade, '')
                                        .trim()
                                        .split(' ');
                                    if (labelParts.length > 0) {
                                        nom = labelParts[0] || '';
                                        prenom = labelParts.slice(1).join(' ') || '';
                                    }
                                }
                                // Fallback sur nomAgent et prenomAgent si disponibles
                                nom = nom || agent.nomAgent || agent.nom || '';
                                prenom = prenom || agent.prenomAgent || agent.prenom || '';

                                const gfo = engin.gfo || (agent.emploi ? agent.emploi.split('_')[0] : '');
                                const role = agent.emploi ? agent.emploi.split('_')[1] : '';

                                // Utiliser matricule + timestamp comme clé unique
                                const manoeuvrantId = `${agent.matricule}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                
                                manoeuvrants[manoeuvrantId] = {
                                    matricule: agent.matricule || '',
                                    grade: agent_grade,
                                    nom: nom,
                                    prenom: prenom,
                                    engin: agent.engin || engin.engin || '',
                                    caserne: engin.caserne || '',
                                    gfo: gfo,
                                    role: role,
                                    statusConnexion: 'PENDING',
                                    statusAlerte: 'PENDING',
                                    ordreDepart: OD.ordreDepart || ''
                                };
                            }
                        }
                    }
                }
            }
        }

        // Insérer tous les manoeuvrants dans Firebase
        if (Object.keys(manoeuvrants).length > 0) {
            await manoeuvrantsRef.update(manoeuvrants);
            console.log('Manoeuvrants data inserted successfully in Firebase!');
        }

        return { success: true, numManoeuvre, manoeuvrantsCount: Object.keys(manoeuvrants).length };
    } catch (err) {
        console.error('Error inserting manoeuvre info in Firebase:', err);
        throw err;
    }
}

async function changeConnexion(matricule) {
    try {
        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const snapshot = await manoeuvrantsRef.once('value');
        const manoeuvrants = snapshot.val() || {};

        // Trouver tous les manoeuvrants avec ce matricule et mettre à jour leur statusConnexion
        const updates = {};
        let found = false;

        for (const id in manoeuvrants) {
            if (manoeuvrants[id].matricule === matricule) {
                updates[`${MANOEUVRANTS_PATH}/${id}/statusConnexion`] = 'OK';
                found = true;
            }
        }

        if (!found) {
            throw new Error(`Matricule ${matricule} not found`);
        }

        await db.ref().update(updates);

        console.log(`StatusConnexion updated to OK for matricule ${matricule}`);
        return { success: true, matricule, statusConnexion: 'OK' };
    } catch (err) {
        console.error('Error changing connexion:', err);
        throw err;
    }
}

async function declenchementManoeuvre(engin, caserne) {
    try {
        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const snapshot = await manoeuvrantsRef.once('value');
        const manoeuvrants = snapshot.val() || {};

        // Trouver tous les manoeuvrants correspondant à engin et caserne
        const updates = {};
        let count = 0;

        for (const id in manoeuvrants) {
            if (manoeuvrants[id].engin === engin && manoeuvrants[id].caserne === caserne) {
                updates[`${MANOEUVRANTS_PATH}/${id}/statusAlerte`] = 'DONE';
                count++;
            }
        }

        if (count === 0) {
            throw new Error(`No manoeuvrants found for engin ${engin} and caserne ${caserne}`);
        }

        await db.ref().update(updates);

        console.log(`StatusAlerte updated to DONE for engin ${engin} and caserne ${caserne}`);
        return { success: true, engin, caserne, rowsUpdated: count, statusAlerte: 'DONE' };
    } catch (err) {
        console.error('Error in declenchementManoeuvre:', err);
        throw err;
    }
}

async function departManoeuvre(matricule) {
    try {
        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const snapshot = await manoeuvrantsRef.once('value');
        const manoeuvrants = snapshot.val() || {};

        // Trouver tous les manoeuvrants avec ce matricule et mettre à jour leur statusAlerte
        const updates = {};
        let found = false;

        for (const id in manoeuvrants) {
            if (manoeuvrants[id].matricule === matricule) {
                updates[`${MANOEUVRANTS_PATH}/${id}/statusAlerte`] = 'RECEIVED';
                found = true;
            }
        }

        if (!found) {
            throw new Error(`Matricule ${matricule} not found`);
        }

        await db.ref().update(updates);

        console.log(`StatusAlerte updated to RECEIVED for matricule ${matricule}`);
        return { success: true, matricule, statusAlerte: 'RECEIVED' };
    } catch (err) {
        console.error('Error in departManoeuvre:', err);
        throw err;
    }
}

async function reinitialiseManoeuvre() {
    try {
        // Supprimer les données de manoeuvre dans Firebase
        const infoRef = db.ref(MANOEUVRE_INFO_PATH);
        await infoRef.remove();

        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        await manoeuvrantsRef.remove();

        console.log('Manoeuvre data cleared successfully from Firebase');
        return { success: true, message: 'Manoeuvre data cleared from Firebase' };
    } catch (err) {
        console.error('Error reinitialising manoeuvre:', err);
        throw err;
    }
}

async function declencherOrdreDepart(ordreDepart) {
    try {
        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const snapshot = await manoeuvrantsRef.once('value');
        const manoeuvrants = snapshot.val() || {};

        // Trouver tous les manoeuvrants correspondant à l'ordre de départ
        const updates = {};
        let count = 0;

        for (const id in manoeuvrants) {
            if (String(manoeuvrants[id].ordreDepart) === String(ordreDepart)) {
                updates[`${MANOEUVRANTS_PATH}/${id}/statusAlerte`] = 'DONE';
                count++;
            }
        }

        if (count === 0) {
            throw new Error(`No manoeuvrants found for ordre depart ${ordreDepart}`);
        }

        await db.ref().update(updates);

        console.log(`StatusAlerte updated to DONE for ordre depart ${ordreDepart}`);
        return { success: true, ordreDepart, rowsUpdated: count, statusAlerte: 'DONE' };
    } catch (err) {
        console.error('Error in declencherOrdreDepart:', err);
        throw err;
    }
}

async function getManoeuvreDetails() {
    try {
        const infoRef = db.ref(MANOEUVRE_INFO_PATH);
        const infoSnapshot = await infoRef.once('value');
        const info = infoSnapshot.val();

        const manoeuvrantsRef = db.ref(MANOEUVRANTS_PATH);
        const manoeuvrantsSnapshot = await manoeuvrantsRef.once('value');
        const manoeuvrants = manoeuvrantsSnapshot.val() || {};

        // Convertir les données en format similaire à Google Sheets pour compatibilité
        const result = {
            Manoeuvre_info: [],
            Manoeuvrants: []
        };

        // Convertir info en format tableau (comme Google Sheets)
        if (info) {
            result.Manoeuvre_info = [[
                info.numManoeuvre || '',
                info.titleManoeuvre || '',
                info.adresseManoeuvre || ''
            ]];
        }

        // Convertir manoeuvrants en format tableau (comme Google Sheets)
        // Structure: matricule, grade, nom, prenom, engin, caserne, gfo, role, statusConnexion, statusAlerte, ordreDepart
        for (const id in manoeuvrants) {
            const m = manoeuvrants[id];
            result.Manoeuvrants.push([
                m.matricule || '',
                m.grade || '',
                m.nom || '',
                m.prenom || '',
                m.engin || '',
                m.caserne || '',
                m.gfo || '',
                m.role || '',
                m.statusConnexion || '',
                m.statusAlerte || '',
                m.ordreDepart || ''
            ]);
        }

        return result;
    } catch (err) {
        console.error('Error getting manoeuvre details:', err);
        throw err;
    }
}

module.exports = {
    createManoeuvreInFirebase,
    changeConnexion,
    declenchementManoeuvre,
    departManoeuvre,
    reinitialiseManoeuvre,
    getManoeuvreDetails,
    declencherOrdreDepart
};
