const express = require('express');
const router3 = express.Router();
const asup = require('../services/asup');

/* GET info. */
router3.get('/', async function(req, res, next) {
  try {
    res.json(await asup.getPeremptionsCountAsup(req.query.page));
  } catch (err) {
    console.error(`Error while getting peremption `, err.message);
    next(err);
  }
});

module.exports = router3;