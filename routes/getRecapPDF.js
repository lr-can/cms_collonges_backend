const express = require('express');
const router = express.Router();
const path = require('path'); 
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        const filePath = path.join(__dirname, '../recap.pdf'); 
        res.sendFile(filePath); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur du serveur');
    }
});

module.exports = router;