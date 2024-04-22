const express = require('express');
const router9 = express.Router();
const stock = require('../services/stock');

router.put('/', async function(req, res, next) {
    try {
      res.json(await stock.archivePeremption());
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router9;