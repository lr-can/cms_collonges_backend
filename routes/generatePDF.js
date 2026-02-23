const express = require('express');
const helper = require('../helper');
const router = express.Router();
const path = require('path'); 
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        const htmlFile = await generatePDFRecap.generatePDFRecap();
        res.send(htmlFile);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error: ' + err.message);
    }
});

router.get('/commande', async (req, res) => {
    try {
        const data = await generatePDFRecap.getRecapCommande();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;