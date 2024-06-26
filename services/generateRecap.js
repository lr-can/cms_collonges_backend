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
                margin-top: 2px;
            }
            .row:nth-child(1){
                background-color: #f2f2f2;
            }
            .cell {
                display: table-cell;
                border-right: 1px solid #cecdcd;
                border-bottom: 1px solid #e5e5e5;
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
                color: #7b7b7b;
                font-weight: bold;
            }
            .green{
                background-color: #dffee6;
                color: #1f8d49;
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
        let materielNom = '';
        if (row.expectedReserveCount + row.expectedVsavCount < row.realTotalCount) {
            cellStyle = 'blue';
            materielNom = 'blue';
        } else if (row.expectedReserveCount + row.expectedVsavCount > row.realTotalCount) {
            cellStyle = 'red';
            materielNom = 'red';
        } else {
            cellStyle = 'green';
            materielNom = 'gray';
        }
        let cellStyleReserve = '';
        if (row.expectedReserveCount < row.realReserveCount) {
            cellStyleReserve = 'blue';
        } else if (row.expectedReserveCount > row.realReserveCount) {
            cellStyleReserve = 'red';
        } else {
            cellStyleReserve = 'gray';
        }
        let cellStyleVSAV = '';
        if (row.expectedVsavCount < row.realVsavCount) {
            cellStyleVSAV = 'blue';
        } else if (row.expectedVsavCount > row.realVsavCount) {
            cellStyleVSAV = 'red';
        } else {
            cellStyleVSAV = 'gray';
        }

        htmlBody += `
        <div class="row">
            <div class="cell ${materielNom}">
                ${row.nomMateriel}
            </div>
            <div class="cell gray">
                ${row.expectedReserveCount}
            </div>
            <div class="cell gray">
                ${row.expectedVsavCount}
            </div>
            <div class="cell ${cellStyleReserve}">
                ${row.realReserveCount}
            </div>
            <div class="cell ${cellStyleVSAV}">
                ${row.realVsavCount}
            </div>
            <div class="cell gray">
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
              default: '<div style="text-align:center">Etat de la base de données - CMS Collonges</div>', // fallback value
            }
        },
          "footer": {
            "height": "20mm",
            "contents": {
              default: '<div style="width:100%;text-align:right">{{page}}</span>/<span>{{pages}}</div>', // fallback value
            }}};
        const pdfContent = htmlHeader + htmlBody + htmlFooter;

        pdf.create(pdfContent, options).toFile('./recap.pdf', async (err, res) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log('PDF generated successfully');
            
        });
        await helper.timeout(10000);
        return pdfContent;
}


module.exports = {generatePDFRecap};