const express = require('express');
const router3 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router3.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getPeremptionsCount(req.query.page));
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});

module.exports = router3;