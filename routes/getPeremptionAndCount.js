const express = require('express');
const router10 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router10.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getPeremptionAndCount());
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});

module.exports = router10;