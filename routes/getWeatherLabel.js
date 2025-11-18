const express = require('express');
const router14 = express.Router();
const weather = require('../services/weather');

/* GET info. */
router14.get('/:code', async function(req, res, next) {
  try {
    const code = req.params.code;
    res.json(await weather.getWeatherLabelForCode(code));
  } catch (err) {
    console.error(`Error while getting the result `, err.message);
    next(err);
  }
});

module.exports = router14;