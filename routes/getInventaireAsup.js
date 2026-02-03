const express = require('express');
const router = express.Router();
const asup = require('../services/asup');

/* GET inventaire ASUP par codeMateriel et VSAV */
router.get('/:codeMateriel/:VSAV', async function(req, res, next) {
    try {
        const codeMateriel = req.params.codeMateriel;
        const vsav = req.params.VSAV;
        res.json(await asup.getInventaireAsup(codeMateriel, vsav));
    } catch (err) {
        console.error(`Erreur lors de la récupération de l'inventaire ASUP:`, err.message);
        next(err);
    }
});

module.exports = router;

