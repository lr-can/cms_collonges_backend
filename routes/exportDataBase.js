const express = require('express');
const router8 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router8.get('/', async function(req, res, next) {
  try {
    res.json(await stock.exportDataBase());
  } catch (err) {
    console.error(`Error while getting materiel `, err.message);
    next(err);
  }
});

module.exports = router8;