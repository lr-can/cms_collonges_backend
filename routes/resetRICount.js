const express = require('express');
const router6 = express.Router();
const stock = require('../services/interventionNotif');

/* GET info. */
router6.get('/:type/:matricule', async function(req, res, next) {
    try {
        const type = req.params.type;
        const matricule = req.params.matricule;
        res.json(await stock.resetRICounter(type, matricule));
    } catch (err) {
        console.error(`Error while getting peremption `, err.message);
        next(err);
    }
});

module.exports = router6;