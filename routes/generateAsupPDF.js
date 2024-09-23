const express = require('express');
const helper = require('../helper');
const router = express.Router();
const path = require('path'); 
const asup = require('../services/asup');

router.get('/', async (req, res) => {
    try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const htmlFile = await asup.generatePDF();
        res.attachment(`asup_${currentMonth}_${currentYear}.pdf`);
        res.send(htmlFile);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error: ' + err.message);
    }
});

module.exports = router;