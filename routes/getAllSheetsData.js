const express = require('express');
const router2 = express.Router();
const service = require('../services/interventionNotif');

/* GET info. */
router2.get('/:spreadsheetid', async function(req, res, next) {
  try {
    const titre = req.params.spreadsheetid;
    res.json(await service.getAllSheetsData(titre));
  } catch (err) {
    console.error(`The desired data `, err.message);
    next(err);
  }
});

module.exports = router2;