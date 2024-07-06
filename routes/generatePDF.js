const express = require('express');
const router = express.Router();
const path = require('path'); 
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        const page = await generatePDFRecap.generatePDFRecap();
        res.send(page); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur du serveur');
    }
});

module.exports = router;