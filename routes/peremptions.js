const express = require('express');
const router1 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router1.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getPeremption(req.query.page));
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});


module.exports = router1;