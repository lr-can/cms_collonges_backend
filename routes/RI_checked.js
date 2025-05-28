const express = require('express');
const router6 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router6.get('/:idMateriel', async function(req, res, next) {
  try {
    const idMateriel = req.params.idMateriel;
    res.json(await stock.materielRIChecked(idMateriel));
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});

module.exports = router6;