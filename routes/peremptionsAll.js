const express = require('express');
const router = express.Router();
const peremptionsAll = require('../services/peremptionsAll');

/* GET péremptions consolidées : materiel, kit, medicamentsAsup (30 jours, par semaines) */
router.get('/', async function (req, res, next) {
  try {
    const data = await peremptionsAll.getAllPeremptions();
    res.json(data);
  } catch (err) {
    console.error('Erreur peremptions_all:', err.message);
    next(err);
  }
});

module.exports = router;
