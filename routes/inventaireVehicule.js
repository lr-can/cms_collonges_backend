const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const config = require('../config');

const SPREADSHEET_ID = '1AkAJTVzypZMMuoQUZ25vWjohQpi_0kJyCAql0cdQNr0';
const SHEETS_TO_FETCH = ['VSAV1', 'VSAV2', 'FPTL', 'VTUTP', 'BPSM', 'Historique'];

// Fonction helper pour authentifier avec Google Sheets
function getGoogleSheetsAuth() {
    const privateKey = config.google.private_key.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT(
        config.google.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    return auth;
}

// GET - Récupérer toutes les données des feuilles spécifiées
router.get('/', async function(req, res, next) {
    try {
        const auth = getGoogleSheetsAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        // Récupérer les métadonnées pour vérifier quelles feuilles existent
        const meta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });
        
        const sheetsMeta = (meta && meta.data && meta.data.sheets) || [];
        const availableTitles = sheetsMeta.map(s => s.properties && s.properties.title ? s.properties.title : '');

        // Filtrer pour ne garder que les feuilles demandées qui existent
        const titlesToFetch = SHEETS_TO_FETCH.filter(t => availableTitles.includes(t));
        
        if (titlesToFetch.length === 0) {
            return res.json({ message: 'Aucune feuille trouvée', data: {} });
        }

        // Construire les ranges pour chaque feuille
        const ranges = titlesToFetch.map(title => {
            const needsQuotes = /\s|[^A-Za-z0-9_\-]/.test(title);
            const safeTitle = needsQuotes ? `'${title.replace(/'/g, "\\'")}'` : title;
            return `${safeTitle}!A:Z`;
        });

        // Récupérer toutes les données en batch
        const batchRes = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: SPREADSHEET_ID,
            ranges: ranges,
        });

        // Mapper les résultats par nom de feuille
        const valuesByTitle = {};
        const valueRanges = batchRes.data.valueRanges || [];
        
        for (let i = 0; i < valueRanges.length; i++) {
            const vr = valueRanges[i];
            if (!vr || !vr.range) continue;
            
            let titlePart = vr.range.split('!')[0];
            titlePart = titlePart.replace(/^'(.*)'$/, '$1');
            valuesByTitle[titlePart] = vr.values || [];
        }

        // Construire la réponse avec toutes les feuilles
        const response = {};
        titlesToFetch.forEach(title => {
            response[title] = valuesByTitle[title] || [];
        });

        res.json(response);
    } catch (err) {
        console.error('Erreur lors de la récupération des données:', err.message);
        next(err);
    }
});

// POST - Ajouter une nouvelle entrée dans la feuille Historique
router.post('/', async function(req, res, next) {
    try {
        const {
            Date: date,
            HeureDebut,
            HeureFin,
            ChefDeGarde,
            Inventaireur1,
            Inventaireur2,
            Inventaireur3,
            Inventaire,
            EtatVehicule,
            Status = 'PENDING'
        } = req.body;

        // Validation des champs requis
        if (!date || !HeureDebut || !HeureFin || !ChefDeGarde || !Inventaireur1 || !Inventaireur2 || !Inventaireur3) {
            return res.status(400).json({ 
                message: 'Champs manquants. Requis: Date, HeureDebut, HeureFin, ChefDeGarde, Inventaireur1, Inventaireur2, Inventaireur3' 
            });
        }

        // Validation du format de date (JJ/MM/YYYY)
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({ 
                message: 'Format de date invalide. Format attendu: JJ/MM/YYYY' 
            });
        }

        // Validation du format d'heure (HH:mm)
        const timeRegex = /^\d{2}:\d{2}$/;
        if (!timeRegex.test(HeureDebut) || !timeRegex.test(HeureFin)) {
            return res.status(400).json({ 
                message: 'Format d\'heure invalide. Format attendu: HH:mm' 
            });
        }

        // Validation que Inventaire et EtatVehicule sont des objets/dictionnaires
        if (Inventaire !== undefined && (typeof Inventaire !== 'object' || Array.isArray(Inventaire) || Inventaire === null)) {
            return res.status(400).json({ 
                message: 'Inventaire doit être un objet/dictionnaire' 
            });
        }

        if (EtatVehicule !== undefined && (typeof EtatVehicule !== 'object' || Array.isArray(EtatVehicule) || EtatVehicule === null)) {
            return res.status(400).json({ 
                message: 'EtatVehicule doit être un objet/dictionnaire' 
            });
        }

        // Convertir les objets en JSON string pour l'insertion
        const inventaireStr = Inventaire ? JSON.stringify(Inventaire) : '';
        const etatVehiculeStr = EtatVehicule ? JSON.stringify(EtatVehicule) : '';

        const auth = getGoogleSheetsAuth();
        const sheets = google.sheets({ version: 'v4', auth });

        const range = 'Historique!A:J';

        // Préparer les valeurs à insérer
        const values = [[
            date,
            HeureDebut,
            HeureFin,
            ChefDeGarde,
            Inventaireur1,
            Inventaireur2,
            Inventaireur3,
            inventaireStr,
            etatVehiculeStr,
            Status
        ]];

        // Ajouter la ligne dans la feuille Historique
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values,
            },
        });

        res.json({ 
            message: 'Inventaire ajouté avec succès',
            insertedRows: response.data.updates?.updatedRows || 1
        });
    } catch (err) {
        console.error('Erreur lors de l\'ajout de l\'inventaire:', err.message);
        next(err);
    }
});

module.exports = router;

