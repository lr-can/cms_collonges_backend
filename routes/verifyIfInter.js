const express = require('express');
const router11 = express.Router();
const InterNotif = require('../services/interventionNotif');

/* GET info. */
router11.get('/', async function(req, res, next) {
  try {
    res.json(await InterNotif.verifyIfInter());
  } catch (err) {
    console.error(`Error while getting the status `, err.message);
    next(err);
  }
});

module.exports = router11;