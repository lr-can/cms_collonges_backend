const express = require('express');
const router7 = express.Router();
const stock = require('../services/stock');

router7.delete('/:id', async function(req, res, next) {
    try {
      res.json(await stock.remove(req.params.id));
    } catch (err) {
      console.error(`Error while deleting the selected item`, err.message);
      next(err);
    }
  });

module.exports = router7;