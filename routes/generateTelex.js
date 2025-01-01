const express = require('express');
const router5 = express.Router();
const formation = require('../services/formation');

/* GET info. */
router5.post('/', async function(req, res, next) {
  try {
    res.send(await formation.generateTelex(req.body));
  } catch (err) {
    console.error(`Erreur lors de la création du telex.`, err.message);
    next(err);
  }
});

module.exports = router5;