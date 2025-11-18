const express = require('express');
const router12 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router12.get('/', async function(req, res, next) {
  try {
    res.json(await stock.getAdressesMails(req.query.page));
  } catch (err) {
    console.error(`Error while getting the email adresses`, err.message);
    next(err);
  }
});

module.exports = router12;