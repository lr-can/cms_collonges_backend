const { google } = require("googleapis");
const config = require("../config");

const DEMANDE_FORMATION_SPREADSHEET_ID = "1ONmh2uTEzQ-fO9Ds4Y-ZLvwFpxjZi5_04ZRA2GaQipc";
const DEMANDE_FORMATION_SHEET_NAME = "historique";
const DEMANDE_FORMATION_STATUS_PENDING = "PENDING";

const DEMANDE_FORMATION_COLUMNS = [
  "AgentNom",
  "AgentPrenom",
  "AgentGrade",
  "AgentMatricule",
  "AgentAdresseMail",
  "FormationIntitule",
  "FormationTitre",
  "FormationCategorie",
  "Voeu1NomShort",
  "Voeu1SessionId",
  "Voeu1DateDebut",
  "Voeu1DateFin",
  "Voeu1CentreFormation",
  "Voeu1Annulee",
  "Voeu2NomShort",
  "Voeu2SessionId",
  "Voeu2DateDebut",
  "Voeu2DateFin",
  "Voeu2CentreFormation",
  "Voeu2Annulee",
  "Hebergement",
  "Commentaire",
  "Statut",
];

function getNestedValue(source, path) {
  return path.split(".").reduce((value, key) => (value ? value[key] : undefined), source);
}

function makeHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateDemandeFormationPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw makeHttpError("Payload invalide: objet JSON attendu.", 400);
  }

  const requiredFields = [
    "agent.nom",
    "agent.prenom",
    "agent.grade",
    "agent.matricule",
    "agent.adresseMail",
    "formation.intitule",
    "formation.titre",
    "formation.categorie",
    "voeu1.nomShort",
    "voeu1.sessionId",
    "voeu1.dateDebut",
    "voeu1.dateFin",
    "voeu1.centreFormation",
  ];

  const missingFields = requiredFields.filter((fieldPath) => {
    const value = getNestedValue(payload, fieldPath);
    if (value === undefined || value === null) {
      return true;
    }
    return typeof value === "string" && value.trim() === "";
  });

  if (missingFields.length > 0) {
    throw makeHttpError(
      `Payload invalide: champs obligatoires manquants (${missingFields.join(", ")}).`,
      400
    );
  }
}

function toSheetValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (typeof value === "number") {
    return value;
  }
  return String(value).trim();
}

function buildDemandeFormationRow(payload) {
  const agent = payload.agent || {};
  const formation = payload.formation || {};
  const voeu1 = payload.voeu1 || {};
  const voeu2 = payload.voeu2 || {};

  return [
    toSheetValue(agent.nom),
    toSheetValue(agent.prenom),
    toSheetValue(agent.grade),
    toSheetValue(agent.matricule),
    toSheetValue(agent.adresseMail),
    toSheetValue(formation.intitule),
    toSheetValue(formation.titre),
    toSheetValue(formation.categorie),
    toSheetValue(voeu1.nomShort),
    toSheetValue(voeu1.sessionId),
    toSheetValue(voeu1.dateDebut),
    toSheetValue(voeu1.dateFin),
    toSheetValue(voeu1.centreFormation),
    toSheetValue(voeu1.annulee),
    toSheetValue(voeu2.nomShort),
    toSheetValue(voeu2.sessionId),
    toSheetValue(voeu2.dateDebut),
    toSheetValue(voeu2.dateFin),
    toSheetValue(voeu2.centreFormation),
    toSheetValue(voeu2.annulee),
    toSheetValue(payload.hebergement),
    toSheetValue(payload.commentaire),
    DEMANDE_FORMATION_STATUS_PENDING,
  ];
}

function getGoogleSheetsAuth() {
  const privateKeyRaw =
    (config && config.google && config.google.private_key) || process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail =
    (config && config.google && config.google.client_email) || process.env.GOOGLE_CLIENT_EMAIL;

  if (!privateKeyRaw || !clientEmail) {
    throw makeHttpError(
      "Google credentials manquants: client_email/private_key requis pour inserer la demande.",
      500
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  return new google.auth.JWT(clientEmail, null, privateKey, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

async function insertDemandeFormation(payload) {
  validateDemandeFormationPayload(payload);

  const auth = getGoogleSheetsAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const rowValues = buildDemandeFormationRow(payload);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: DEMANDE_FORMATION_SPREADSHEET_ID,
    range: `${DEMANDE_FORMATION_SHEET_NAME}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [rowValues],
    },
  });

  return {
    success: true,
    message: "Demande de formation enregistree dans Google Sheets.",
    spreadsheetId: DEMANDE_FORMATION_SPREADSHEET_ID,
    sheetName: DEMANDE_FORMATION_SHEET_NAME,
    status: DEMANDE_FORMATION_STATUS_PENDING,
    columns: DEMANDE_FORMATION_COLUMNS,
    updatedRange: response.data?.updates?.updatedRange || null,
    updatedRows: response.data?.updates?.updatedRows || 0,
  };
}

module.exports = {
  insertDemandeFormation,
  DEMANDE_FORMATION_COLUMNS,
  DEMANDE_FORMATION_STATUS_PENDING,
};
