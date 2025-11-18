const express = require('express');
const router5 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router5.post('/', async function(req, res, next) {
  try {
    res.json(await stock.create(req.body));
  } catch (err) {
    console.error(`Erreur lors de l'enregistrement dans la base de données `, err.message);
    next(err);
  }
});

module.exports = router5;