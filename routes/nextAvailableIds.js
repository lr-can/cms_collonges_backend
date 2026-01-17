const express = require('express');
const router = express.Router();
const stock = require('../services/stock');

router.get('/:count', async function(req, res, next) {
  try {
    const count = parseInt(req.params.count, 10);
    
    // Valider que count est un nombre valide
    if (isNaN(count) || count <= 0) {
      return res.status(400).json({ 
        error: 'Le paramètre count doit être un nombre entier positif.' 
      });
    }
    
    // Limiter count à un maximum raisonnable (par exemple 1000)
    const maxCount = 1000;
    const actualCount = Math.min(count, maxCount);
    
    const result = await stock.getNextAvailableIds(actualCount);
    res.json(result);
  } catch (err) {
    console.error(`Erreur lors de la récupération des prochains IDs:`, err.message);
    next(err);
  }
});

module.exports = router;

