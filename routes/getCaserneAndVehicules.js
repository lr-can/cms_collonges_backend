const express = require('express');
const router9 = express.Router();
const formation = require('../services/formation');

router9.get('/', async function(req, res, next) {
    try {
      res.json(await formation.getVehiculesAndCaserne());
    } catch (err) {
      console.error(`Error in form`, err.message);
      next(err);
    }
  });

module.exports = router9;