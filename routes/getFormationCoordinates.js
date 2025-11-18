const express = require('express');
const router11 = express.Router();
const formation = require('../services/formation');

/* GET info. */
router11.get('/:lon/:lat', async function(req, res, next) {
    try {
        const { lon, lat } = req.params;
        res.json(await formation.getMapCoordinates(lon, lat));
    } catch (err) {
        console.error(`Error while getting the coordinates `, err.message);
        next(err);
    }
});

module.exports = router11;