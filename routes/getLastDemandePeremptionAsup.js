const express = require('express');
const router9 = express.Router();
const asup = require('../services/asup');

router9.get('/', async function(req, res, next) {
    try {
      res.json(await asup.getDemandesPeremption());
    } catch (err) {
      console.error(`Error in asup`, err.message);
      next(err);
    }
  });

module.exports = router9;