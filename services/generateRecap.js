const helper = require('../helper');
const dataBase = require('./db');
const fs = require('fs');
const pdf = require('html-pdf');

async function generatePDFRecap() {
    const rowsRealCount = await dataBase.query(
        `SELECT
        stock.idMateriel,
        materiels.nomMateriel,
        COUNT(stock.idStock) AS realTotalCount,
        SUM(CASE WHEN stock.idStatut = 1 THEN 1 ELSE 0 END) AS realReserveCount,
        SUM(CASE WHEN stock.idStatut = 2 THEN 1 ELSE 0 END) AS realVsavCount,
        materiels.nbReserve as expectedReserveCount,
        materiels.nbVSAV as expectedVsavCount,
        (materiels.nbReserve + materiels.nbVSAV) as totalExpectedCount
    FROM stock 
    INNER JOIN materiels ON stock.idMateriel = materiels.idMateriel 
    WHERE stock.idStatut != '3' 
    GROUP BY stock.idMateriel;`
    );
    const data = helper.emptyOrRows(rowsRealCount);

    let htmlHeader = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Récapitulatif - CMS Collonges</title>
        <style>
            @import url(https://db.onlinewebfonts.com/c/06bac77bab58bc871a4d97b66f9a1af0?family=Marianne);
            body {
                    font-family: 'Marianne';
                }
            table {
                width: 100%;
            }
            h1{
                text-align: center;
                font-size: 2rem;
            }
            h2{
                font-size: 1rem;
            }
            .table {
                margin: 0 auto;
                width: 80%;
                display: table;
            }
            .row {
                display: table-row;
            }
            .row:nth-child(1){
                background-color: #f2f2f2;
            }
            .cell {
                display: table-cell;
                border-right: 1px solid #cecdcd;
                border-bottom: 3px solid white;
                padding: 10px;
                text-align: center;
                color: #3a3a3a;
            }
            .cell:nth-child(1){
                text-align: left;
                width: 25vw;
            }
            .blue{
                background-color: #f4f6ff;
                color: #0078f3;
                font-weight: bold;
            }
            .red{
                background-color: #fff4f4;
                color: #f60700;
                font-weight: bold;
            }
            .gray{
                background-color: #f2f2f2;
                color: #3a3a3a;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="heading">
            <img src="https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/logoTitle.png?raw=true" alt="Logo CMS Collonges" width="200" height="auto">
            <h1>Récapitulatif des stocks</h1>
        </div>
        <div class="table">
            <div class="row">
                <div class="cell" id="Materiel">
                    <h2>
                        Matériel
                    </h2>
                </div>
                <div class="cell">
                    <h2>
                        Objectif Réserve
                    </h2>
                </div>
                <div class="cell">
                    <h2>
                        Objectif VSAV
                    </h2>
                </div>  
                <div class="cell">
                    <h2>
                        Réel Réserve
                    </h2>
                </div>
                <div class="cell">
                    <h2>
                        Réel VSAV
                    </h2>
                </div>
                <div class="cell">
                    <h2>
                        Objectif Total
                    </h2>
                </div>  
                <div class="cell">
                    <h2>
                        Réel Total
                    </h2>
                </div>  
            </div>
    `;
    let htmlFooter = ` </div>    
    </body>
    </html>`;
    let htmlBody = '';

    data.forEach((row) => {
        let cellStyle = '';
        if (row.expectedReserveCount + row.expectedVsavCount < row.realTotalCount) {
            cellStyle = 'blue';
        } else if (row.expectedReserveCount + row.expectedVsavCount > row.realTotalCount) {
            cellStyle = 'red';
        } else {
            cellStyle = 'gray';
        }
        let cellStyleReserve = '';
        if (row.expectedReserveCount < row.realReserveCount) {
            cellStyleReserve = 'blue';
        } else if (row.expectedReserveCount > row.realReserveCount) {
            cellStyleReserve = 'red';
        }
        let cellStyleVSAV = '';
        if (row.expectedVsavCount < row.realVsavCount) {
            cellStyleVSAV = 'blue';
        } else if (row.expectedVsavCount > row.realVsavCount) {
            cellStyleVSAV = 'red';
        }

        htmlBody += `
        <div class="row">
            <div class="cell">
                ${row.nomMateriel}
            </div>
            <div class="cell">
                ${row.expectedReserveCount}
            </div>
            <div class="cell">
                ${row.expectedVsavCount}
            </div>
            <div class="cell ${cellStyleReserve}">
                ${row.realReserveCount}
            </div>
            <div class="cell ${cellStyleVSAV}">
                ${row.realVsavCount}
            </div>
            <div class="cell">
                ${row.totalExpectedCount}
            </div>
            <div class="cell ${cellStyle}">
                ${row.realTotalCount}
            </div>
        </div>
        `;
    });

        const options = { format: 'A4',
        "header": {
            "height": "20mm",
            "contents": {
                first: '',
              default: 'Etat de la base de données - CMS Collonges', // fallback value
            }
        },
          "footer": {
            "height": "20mm",
            "contents": {
              default: '<div style="text-align=right">{{page}}</span>/<span>{{pages}}</div>', // fallback value
            }}};
        const pdfContent = htmlHeader + htmlBody + htmlFooter;

        await pdf.create(pdfContent, options).toFile('./recap.pdf', async (err, res) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log('PDF generated successfully');
            
        });
        return pdfContent;
}


module.exports = {generatePDFRecap};