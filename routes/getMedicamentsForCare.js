const express = require('express');
const router8 = express.Router();
const stock = require('../services/asup');

/* GET info. */
router8.get('/:acteSoin/:affectationVSAV', async function(req, res, next) {
    try {
        res.json(await stock.getMedicamentsforCare(care = req.params.acteSoin, affectation = req.params.affectationVSAV));
    } catch (err) {
        console.error(`Error while getting médicaments `, err.message);
        next(err);
    }
});

module.exports = router8;