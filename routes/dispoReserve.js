const express = require('express');
const router18 = express.Router();
const stock = require('../services/stock');

router18.post('/', async function(req, res, next) {
    try {
      res.json(await stock.dispoReserve(req.body));
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router18;