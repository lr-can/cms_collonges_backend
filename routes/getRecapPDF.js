const express = require('express');
const router = express.Router();
let fetch

router.get('/', async (req, res) => {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    };
    try {
        const timeStamp = new Date().toLocaleString('fr-FR');
        const currentDate = new Date().toISOString().split('T')[0];
        const uri = `https://api.apilayer.com/api/convert?access_key=30c8dcde4159d5b427db96a5a4c2c8c1&document_url=https://cms-collonges-api.adaptable.app/generatePDF&header_text=CMS COLLONGES - Récapitulatif des stocks&footer_text=Page [page] / [sitepages] - Généré le ${timeStamp}&document_name=RecapitulatifStocks-${currentDate}.pdf&accept_lang=fr-FR&force=1&footer_align=right&header_align=center`;
        const response = await fetch(uri, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        });
        const pdfData = await response;
        res.send(pdfData); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur du serveur', err.message);
    }
});

module.exports = router;