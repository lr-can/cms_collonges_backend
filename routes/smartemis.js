const express = require('express');
const router5 = express.Router();
const notif = require('../services/interventionNotif');

/* POST smartemis response. */
router5.post('/', async function(req, res, next) {
  try {
    const result = await notif.insertSmartemisResponse(req.body);
    res.json(result);
  } catch (err) {
    console.error(`Erreur lors de l'enregistrement dans google sheets`, err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      errors: [err.message]
    });
  }
});

module.exports = router5;