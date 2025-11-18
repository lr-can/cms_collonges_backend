const express = require('express');
const router19 = express.Router();
const stock = require('../services/stock');

router19.put('/', async function(req, res, next) {
    try {
      res.json(await stock.reinitialiserRetourInter());
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router19;