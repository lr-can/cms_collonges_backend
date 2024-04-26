const express = require('express');
const router13 = express.Router();
const stock = require('../services/stock');

router13.post('/', async function(req, res, next) {
    try {
      res.json(await stock.retourIntervention(req.body));
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router13;