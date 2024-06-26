const express = require('express');
const router = express.Router();
const path = require('path'); 
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        await generatePDFRecap.generatePDFRecap();
        res.send('PDF Généré.') 
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur du serveur');
    }
});

module.exports = router;