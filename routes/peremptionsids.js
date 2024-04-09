const express = require('express');
const router2 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router2.get('/:idMateriel', async function(req, res, next) {
  try {
    const idMateriel = req.params.idMateriel;
    res.json(await stock.getPeremptionids(req.query.page, idMateriel));
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});

module.exports = router2;