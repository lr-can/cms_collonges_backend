const express = require('express');
const router11 = express.Router();
const asup = require('../services/asup');

/* GET info. */
router11.get('/', async function(req, res, next) {
  try {
    res.json(await asup.getVizData());
  } catch (err) {
    console.error(`Error while getting the real count `, err.message);
    next(err);
  }
});

module.exports = router11;