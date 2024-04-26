function sendLastRowValue() {
    var spreadSheet = SpreadsheetApp.openById("17f60tzWQ_ZZnzZ1tP2Y0YEHkwQ54lN5mnlqGVm84kLc");
    var sheet = spreadSheet.getSheetByName("Feuille 1");
    var lastRow = sheet.getLastRow().toString();
    var vColumn = sheet.getRange("V" + lastRow).getValue();
    
    if (vColumn !== "TRUE") {
        var systematique = sheet.getRange("U" + lastRow).getValue();
        var autreMateriel = sheet.getRange("K" + lastRow).getValue();
        var kits = sheet.getRange("L" + lastRow).getValue();
        var specifique = sheet.getRange("M" + lastRow).getValue();
        
        // Send the value through a POST HTTPS request
        var payload = {
            "systematique": systematique,
            "autreMateriel": autreMateriel,
            "kits": kits,
            "specifique": specifique
        };
        
        var options = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload)
        };

        console.log(payload);
        
        var response = UrlFetchApp.fetch("https://cms-collonges-api.adaptable.app/retourIntervention", options);
        Logger.log(response.getContentText());
        
        sheet.getRange("V" + lastRow).setValue("TRUE");
    }
}