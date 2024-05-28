const express = require('express');
const router = express.Router();
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        res.send(await generatePDFRecap.generatePDFRecap());
         
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur du serveur');
    }
});

module.exports = router;