const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const config = require('../config');

const SPREADSHEET_ID = '1AkAJTVzypZMMuoQUZ25vWjohQpi_0kJyCAql0cdQNr0';
const ACTIVE_ENGINS_SHEET = 'ActiveEngins';
const DEFAULT_ENGIN_STATUS = 'ACTIVATED';

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

function buildSheetRange(title, columns = 'A:Z') {
    const needsQuotes = /\s|[^A-Za-z0-9_\-]/.test(title);
    const safeTitle = needsQuotes ? `'${title.replace(/'/g, "\\'")}'` : title;
    return `${safeTitle}!${columns}`;
}

function normalizeStatus(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized || DEFAULT_ENGIN_STATUS;
}

function parseActiveEngins(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }

    let startIndex = 0;
    const firstRow = values[0] || [];
    const firstColHeader = String(firstRow[0] || '').trim().toUpperCase();
    const secondColHeader = String(firstRow[1] || '').trim().toUpperCase();

    if (firstColHeader === 'ENGIN' && secondColHeader === 'STATUS') {
        startIndex = 1;
    }

    const parsed = [];
    const seen = new Set();

    for (let i = startIndex; i < values.length; i++) {
        const row = values[i] || [];
        const engin = String(row[0] || '').trim();
        if (!engin || seen.has(engin)) {
            continue;
        }
        seen.add(engin);

        parsed.push({
            engin,
            status: normalizeStatus(row[1]),
        });
    }

    return parsed;
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

        if (!availableTitles.includes(ACTIVE_ENGINS_SHEET)) {
            return res.status(404).json({
                message: `Feuille ${ACTIVE_ENGINS_SHEET} introuvable`,
                enginsStatus: [],
            });
        }

        // Source dynamique des engins à exporter + statuts
        const activeEnginsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: buildSheetRange(ACTIVE_ENGINS_SHEET, 'A:B'),
        });

        const activeEnginsValues = (activeEnginsRes && activeEnginsRes.data && activeEnginsRes.data.values) || [];
        const enginsConfig = parseActiveEngins(activeEnginsValues);

        if (enginsConfig.length === 0) {
            return res.json({
                message: `Aucun engin configuré dans ${ACTIVE_ENGINS_SHEET}`,
                enginsStatus: [],
            });
        }

        // Feuilles à lire: toutes sauf celles masquées (HIDDEN)
        const titlesToFetch = enginsConfig
            .filter(({ engin, status }) => status !== 'HIDDEN' && availableTitles.includes(engin))
            .map(({ engin }) => engin);

        // Construire les ranges pour chaque feuille
        const ranges = titlesToFetch.map(title => buildSheetRange(title, 'A:Z'));

        let valueRanges = [];
        if (ranges.length > 0) {
            // Récupérer toutes les données en batch
            const batchRes = await sheets.spreadsheets.values.batchGet({
                spreadsheetId: SPREADSHEET_ID,
                ranges: ranges,
            });
            valueRanges = batchRes.data.valueRanges || [];
        }

        // Mapper les résultats par nom de feuille
        const valuesByTitle = {};
        
        for (let i = 0; i < valueRanges.length; i++) {
            const vr = valueRanges[i];
            if (!vr || !vr.range) continue;
            
            let titlePart = vr.range.split('!')[0];
            titlePart = titlePart.replace(/^'(.*)'$/, '$1');
            valuesByTitle[titlePart] = vr.values || [];
        }

        // Compatibilité: garder les données par clé d'engin + ajouter la liste des statuts
        const response = {};
        const enginsStatus = enginsConfig.map(({ engin, status }) => {
            const hidden = status === 'HIDDEN';
            const sheetFound = availableTitles.includes(engin);

            if (!hidden && sheetFound) {
                response[engin] = valuesByTitle[engin] || [];
            }

            return {
                engin,
                status,
                hidden,
                sheetFound,
            };
        });
        response.enginsStatus = enginsStatus;

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
            Vehicule: vehiculeInput,
            Date: date,
            HeureDebut,
            HeureFin,
            ChefDeGarde,
            Inventaireur1,
            Inventaireur2,
            Inventaireur3,
            Inventaire,
            EtatVehicule,
            CommentaireInventaire,
            Commentaire,
            Status: statusInput = 'PENDING'
        } = req.body;

        const vehicule = String(vehiculeInput || req.body.vehicule || '').trim();
        const commentaire = String(
            CommentaireInventaire ??
            req.body.commentaireInventaire ??
            req.body.CommentaireInvententaire ??
            req.body.commentaireInvententaire ??
            Commentaire ??
            req.body.commentaire ??
            ''
        ).trim();
        const status = String(statusInput || req.body.status || 'PENDING').trim() || 'PENDING';

        // Validation des champs requis
        if (!vehicule || !date || !HeureDebut || !HeureFin || !ChefDeGarde || !Inventaireur1 || !Inventaireur2 || !Inventaireur3) {
            return res.status(400).json({ 
                message: 'Champs manquants. Requis: Vehicule, Date, HeureDebut, HeureFin, ChefDeGarde, Inventaireur1, Inventaireur2, Inventaireur3' 
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

        const range = 'Historique!A:L';

        // Préparer les valeurs à insérer
        const values = [[
            vehicule,
            date,
            HeureDebut,
            HeureFin,
            ChefDeGarde,
            Inventaireur1,
            Inventaireur2,
            Inventaireur3,
            inventaireStr,
            etatVehiculeStr,
            commentaire,
            status
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

