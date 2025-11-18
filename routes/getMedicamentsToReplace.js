const express = require('express');
const router14 = express.Router();
const stock = require('../services/asup');

/* GET info. */
router14.get('/:medicament', async function(req, res, next) {
  try {
    const medicament = req.params.medicament;
    res.json(await stock.getToReplace(medicament));
  } catch (err) {
    console.error(`Error while getting the list `, err.message);
    next(err);
  }
});

module.exports = router14;