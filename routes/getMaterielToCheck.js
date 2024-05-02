const express = require('express');
const router14 = express.Router();
const stock = require('../services/stock');

/* GET info. */
router14.get('/:status', async function(req, res, next) {
  try {
    const status = req.params.status;
    res.json(await stock.getMaterielsToCheck(req.query.page, status));
  } catch (err) {
    console.error(`Error while getting the list `, err.message);
    next(err);
  }
});

module.exports = router14;