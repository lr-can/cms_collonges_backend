// Fonction principale pour exécuter le script
function main() {
    // Définir les paramètres de base
  const spreadsheetId = "1e8EkudrrjimEWt-AN3DqwbzYpb8-dN92lDXHzCU_KNI";
  const url = "https://cms-collonges-api.adaptable.app/exportDataBase";

  // Récupérer les données depuis l'API
  const data = fetchData(url);

  // Accéder au fichier Google Sheets
  const ss = SpreadsheetApp.openById(spreadsheetId);

  // Vérifier et mettre à jour la feuille "stock" si les données existent
  if (data.stock) {
    updateSheet(ss, "stock", data.stock, [
      "idStock",
      "idMateriel",
      "idStatut",
      "idAgent",
      "dateCreation",
      "numLot",
      "datePeremption",
    ]);
  } else {
    console.log("Aucune donnée trouvée pour 'stock'");
  }

  // Vérifier et mettre à jour la feuille "retourIntervention" si les données existent
  if (data.retourIntervention) {
    updateSheet(ss, "retourIntervention", data.retourIntervention, [
      "idRI",
      "idMateriel",
      "statutRI",
      "lastModification",
      "nomRetourInter",
    ]);
  } else {
    console.log("Aucune donnée trouvée pour 'retourIntervention'");
  }

  // Vérifier et mettre à jour la feuille "materiels" si les données existent
  if (data.materiels) {
    updateSheet(ss, "materiels", data.materiels, [
      "idMateriel",
      "nomMateriel",
      "nbReserve",
      "nbVSAV",
      "nomCommandeSingulier",
      "nomCommandePluriel",
      "zone",
      "nbTotal",
    ]);
  } else {
    console.log("Aucune donnée trouvée pour 'materiels'");
  }
}


// Fonction pour récupérer les données depuis l'API
function fetchData(url) {
const response = UrlFetchApp.fetch(url);
const jsonResponse = JSON.parse(response.getContentText());
const data = jsonResponse.data
return data;
}

function updateSheet(ss, sheetName, data, columns) {
    const sheet = ss.getSheetByName(sheetName);
  
    // Supprimer toutes les lignes sauf la première, en tenant compte des lignes figées
    const lastRow = sheet.getLastRow();
    const frozenRows = sheet.getFrozenRows();
    const rowsToDelete = Math.max(lastRow - frozenRows - 1, 0); // S'assurer que rowsToDelete n'est pas négatif
    if (rowsToDelete > 0 && lastRow > frozenRows) { // Ajout d'une vérification supplémentaire
      sheet.deleteRows(frozenRows + 1, rowsToDelete);
    }
  
    // Préparer les données à insérer
    const rows = data.map((item) => columns.map((column) => item[column]));
  
    // Insérer les données
    if (rows.length > 0) {
      sheet.getRange(frozenRows + 2, 1, rows.length, columns.length).setValues(rows);
    }
    removeDuplicateRows(ss, sheetName, columns); // Modifier ici pour passer `columns`
}

  function removeDuplicateRows(ss, sheetName, columns) { // Modifier ici pour accepter `columns`
    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const uniqueData = data.filter((value, index, self) => 
      index === self.findIndex((t) => t.join('|') === value.join('|'))
    );
  
    // Supprimer toutes les lignes et réinsérer les données uniques
    sheet.clearContents();
    sheet.getRange(1, 1, uniqueData.length, uniqueData[0].length).setValues(uniqueData);
}
