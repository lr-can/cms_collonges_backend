const express = require('express');
const router2 = express.Router();
const service = require('../services/interventionNotif');

/* GET info. */
router2.get('/:titre', async function(req, res, next) {
  try {
    const titre = req.params.titre;
    res.json(await service.giveInterventionType(titre));
  } catch (err) {
    console.error(`The desired data `, err.message);
    next(err);
  }
});

module.exports = router2;