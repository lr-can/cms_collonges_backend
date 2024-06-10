const express = require('express');
const router5 = express.Router();
const notif = require('../services/interventionNotif');

/* GET info. */
router5.post('/', async function(req, res, next) {
  try {
    res.json(await notif.insertInterventionNotif(req.body));
  } catch (err) {
    console.error(`Erreur lors de l'enregistrement dans google sheets`, err.message);
    next(err);
  }
});

module.exports = router5;