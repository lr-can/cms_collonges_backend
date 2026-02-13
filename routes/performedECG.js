const express = require('express');
const router20 = express.Router();
const stock = require('../services/stock');

router20.get('/', async function(req, res, next) {
  try {
    res.json(await stock.performedECG());
  } catch (err) {
    console.error(`Error while db`, err.message);
    next(err);
  }
});

module.exports = router20;
