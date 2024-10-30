const express = require('express');
const router13 = express.Router();
const form = require('../services/formation');

router13.post('/', async function(req, res, next) {
    try {
      const matricules = req.body.matricules;
      const engins = req.body.gfos;
      res.json(await form.assignAgentsToVehicles(matricules, engins));
    } catch (err) {
      console.error(`Error while db`, err.message);
      next(err);
    }
  });

module.exports = router13;