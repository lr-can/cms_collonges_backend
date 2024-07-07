const helper = require('../helper');
const dataBase = require('./db');
const fs = require('fs');
const axios = require('axios');

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
                @font-face {
        font-family: 'Marianne';
        src: url(https://raw.githubusercontent.com/LAB-MI/deplacement-covid-19/master/src/fonts/marianne-regular-webfont.woff);
        }
            body {
                font-family: 'Marianne', sans-serif;
            }
            table {
                width: 100%;
            }
            h1 {
                text-align: center;
                font-size: 2rem;
            }
            h2 {
                font-size: 1rem;
            }
            .table {
                margin: 0 auto;
                width: 80%;
                display: table;
                border-collapse: collapse;
            }
            .row {
                display: table-row;
                margin-top: 2px;
            }
            .row:nth-child(1) {
                background-color: #f2f2f2;
            }
            .cell {
                display: table-cell;
                border: 1px solid #cecdcd;
                padding: 10px;
                text-align: center;
                color: #3a3a3a;
            }
            .cell:nth-child(1) {
                text-align: left;
                width: 25vw;
            }
            .blue {
                background-color: #f4f6ff;
                color: #0078f3;
                font-weight: bold;
            }
            .red {
                background-color: #fff4f4;
                color: #f60700;
                font-weight: bold;
            }
            .gray {
                background-color: white;
                color: #7b7b7b;
                font-weight: bold;
            }
            .gray2 {
                color: #3a3a3a;
                background-color: #f2f2f2;}
            .green {
                background-color: #dffee6;
                color: #1f8d49;
                font-weight: bold;
            }
            .heading {
                display: flex;
                align-items: center;
            }
            .heading > img {
                width: 30%;
            }
            .heading > h1 {
                text-align: center;
                width: 70%;
            }
                            .print-button {
                text-align: center;
                margin: 10px;
                border-radius: 30px;
                padding: 10px;
                background-color: #0078f3;
                color: white;
                cursor: pointer;
                width: 15vw;
            }
            .print-button:hover {
                background-color: #0056b3;
            }
            @media (max-width: 900px) {
    .table {
        overflow-x: auto;
        overflow-y: auto;
        display: block;
        white-space: nowrap;
    }

    /* Applique le positionnement sticky à la première cellule de chaque ligne et à chaque cellule de la première ligne */
    .row .cell:first-child, .first-row .cell {
        position: sticky;
        z-index: 2;
    }

    /* Configuration spécifique pour la première cellule de chaque ligne */
    .row .cell:first-child {
        left: 0;
        width: 10vw;
        min-width: 100px; /* Ajustez cette valeur selon le besoin */
        max-width: 10vw; /* Assurez-vous que la largeur maximale est également définie */
        white-space: normal; /* Permet au texte de revenir à la ligne */
        word-wrap: break-word;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
    }

    /* Configuration pour chaque cellule de la première ligne pour les rendre sticky en haut */
    .first-row .cell {
        top: 0;
        white-space: normal;
        word-wrap: break-word;
    }

    .print-button {
        width: 80vw;
    }

    /* Configuration spécifique pour la cellule à l'intersection de la première ligne et de la première colonne */
    .first-row .cell:first-child {
        top: 0;
        left: 0;
        z-index: 3; /* Plus élevé pour rester au-dessus lors du défilement dans les deux axes */
    }
}
    .footer {
            text-align: right;
            padding: 10px;
            font-size: 0.8rem;
            color: #7b7b7b;
            }
    @media print {
body {-webkit-print-color-adjust: exact;}

        </style>
    </head>
    <body>
    <script>
    function printPDF() {
        const printButton = document.querySelector('.print-button');
        printButton.style.display = 'none';
        window.print();}
    </script>
        <div class="heading">
            <img src="https://github.com/lr-can/CMS_Collonges/blob/main/src/assets/logoTitle.png?raw=true" alt="Logo CMS Collonges" width="200" height="auto">
            <h1>Récapitulatif des stocks</h1>
        </div>
        <div class="print-button" onclick="printPDF()">
            Imprimer le récapitulatif
        </div>
        <div class="table">
            <div class="row">
                <div class="cell gray2" id="Materiel">
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
    <div class="footer">$PLACEHOLDER$</div>
    </body>
    </html>`;
    let htmlBody = '';
    const currentDate = new Date();
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const formattedDate = currentDate.toLocaleDateString('fr-FR', options);
    const formattedTime = currentDate.toLocaleTimeString('fr-FR');

    const timestamp = `<div class="timestamp">Edité le ${formattedDate} à ${formattedTime}</div>`;
    htmlFooter = htmlFooter.replace('$PLACEHOLDER$', timestamp);

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
            materielNom = 'gray2';
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
            ${row.expectedReserveCount - row.realReserveCount > 0 ? `(-${Math.abs(row.expectedReserveCount - row.realReserveCount)})` : ''}
            ${row.expectedReserveCount - row.realReserveCount < 0 ? `(+${Math.abs(row.expectedReserveCount - row.realReserveCount)})` : ''}
            </div>
            <div class="cell ${cellStyleVSAV}">
            ${row.realVsavCount}
            ${row.expectedVsavCount - row.realVsavCount > 0 ? `(-${Math.abs(row.expectedVsavCount - row.realVsavCount)})` : ''}
            ${row.expectedVsavCount - row.realVsavCount < 0 ? `(+${Math.abs(row.expectedVsavCount - row.realVsavCount)})` : ''}
            </div>
            <div class="cell gray">
            ${row.totalExpectedCount}
            </div>
            <div class="cell ${cellStyle}">
            ${row.realTotalCount}
            ${row.totalExpectedCount - row.realTotalCount > 0 ? `(-${Math.abs(row.totalExpectedCount - row.realTotalCount)})` : ''}
            ${row.totalExpectedCount - row.realTotalCount < 0 ? `(+${Math.abs(row.totalExpectedCount - row.realTotalCount)})` : ''}
            </div>
        </div>
        `;
    });
        const pdfContent = htmlHeader + htmlBody + htmlFooter;
        return pdfContent;
}


module.exports = {generatePDFRecap};