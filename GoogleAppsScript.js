function sendLastRowValue() {
    var spreadSheet = SpreadsheetApp.openById("17f60tzWQ_ZZnzZ1tP2Y0YEHkwQ54lN5mnlqGVm84kLc");
    var sheet = spreadSheet.getSheetByName("Feuille 1");
    var lastRow = sheet.getLastRow().toString();
    var vColumn = sheet.getRange("V" + lastRow).getValue();
    
    if (vColumn == "") {
        var systematique = sheet.getRange("U" + lastRow).getValue();
        var systematiqueArray = JSON.parse(systematique);
        var autreMateriel = sheet.getRange("K" + lastRow).getValue();
        var autreMaterielArray = JSON.parse(autreMateriel);
        var kits = sheet.getRange("L" + lastRow).getValue();
        var kitsArray = JSON.parse(kits);
        var specifique = sheet.getRange("M" + lastRow).getValue();
        var specifiqueArray = JSON.parse(specifique);
        
        // Send the value through a POST HTTPS request
        var payload = {
            "systematique": systematiqueArray,
            "autreMateriel": autreMaterielArray,
            "kits": kitsArray,
            "specifique": specifiqueArray
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
    } else {
      Logger.log('déjà traité.')
    }
}