const express = require('express');
const router11 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router11.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getRealCount(req.query.page));
  } catch (err) {
    console.error(`Error while getting the real count `, err.message);
    next(err);
  }
});

module.exports = router11;