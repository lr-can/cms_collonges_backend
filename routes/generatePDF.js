const express = require('express');
const helper = require('../helper');
const router = express.Router();
const path = require('path'); 
const generatePDFRecap = require('../services/generateRecap');

router.get('/', async (req, res) => {
    try {
        const buffer = await generatePDFRecap.generatePDFRecap();
        helper.bufferToStream(buffer).pipe(res);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error: ' + err.message);
    }
});

module.exports = router;