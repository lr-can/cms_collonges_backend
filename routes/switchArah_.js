const express = require('express');
const router11 = express.Router();
const interventionNotif = require('../services/interventionNotif');

/* GET info. */
router11.get('/', async function(req, res, next) {
  try {
    res.json(await interventionNotif.switchArah());
  } catch (err) {
    console.error(`Error while getting the real count `, err.message);
    next(err);
  }
});

module.exports = router11;