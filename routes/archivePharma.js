const express = require('express');
const router16 = express.Router();
const stock = require('../services/stock');

router16.post('/', async function(req, res, next) {
    try {
      res.json(await stock.archivePharma(req.body));
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router16;