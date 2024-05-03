const express = require('express');
const router17 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router17.get('/:idMateriel', async function(req, res, next) {
  try {
    const idMateriel = req.params.idMateriel;
    res.json(await stock.getReserveItems(req.query.page, idMateriel));
  } catch (err) {
    console.error(`Error while getting the list `, err.message);
    next(err);
  }
});

module.exports = router17;