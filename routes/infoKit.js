/**
 * API publique pour le QR code des kits
 * GET /infoKit/:idKit
 */
const express = require('express');
const router = express.Router();
const kit = require('../services/kit');

router.get('/:idKit', async (req, res, next) => {
  try {
    const data = await kit.getInfoKit(req.params.idKit);
    if (!data) return res.status(404).json({ message: 'Kit non trouvé' });
    res.json(data);
  } catch (err) {
    console.error('Erreur getInfoKit', err.message);
    next(err);
  }
});

module.exports = router;
