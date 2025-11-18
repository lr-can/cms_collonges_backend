const express = require('express');
const router11 = express.Router();
const formation = require('../services/formation');

/* GET info. */
router11.get('/:input', async function(req, res, next) {
    try {
        const input = req.params.input;
        res.json(await formation.autoCompleteAddress(input));
    } catch (err) {
        console.error(`Error while getting the coordinates `, err.message);
        next(err);
    }
});

module.exports = router11;