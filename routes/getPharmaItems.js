const express = require('express');
const router15 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router15.get('/:idMateriel', async function(req, res, next) {
  try {
    const idMateriel = req.params.idMateriel;
    res.json(await stock.getPharmaItems(req.query.page, idMateriel));
  } catch (err) {
    console.error(`Error while getting the list `, err.message);
    next(err);
  }
});

module.exports = router15;