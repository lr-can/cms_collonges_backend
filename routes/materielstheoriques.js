const express = require('express');
const router4 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router4.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getMaterielList(req.query.page));
  } catch (err) {
    console.error(`Error while getting materiel `, err.message);
    next(err);
  }
});

module.exports = router4;