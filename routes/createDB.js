const express = require('express');
const router5 = express.Router();
const stock = require('../services/stock');
const kit = require('../services/kit');

/** Détecte si idMateriel est un id materielKit (numérique). */
function isMaterielKitId(val) {
  if (val == null) return false;
  return /^\d+$/.test(String(val).trim());
}

/* POST createDB : matériel classique (stock) OU matériel kit (stockKit) */
router5.post('/', async function (req, res, next) {
  try {
    const body = req.body;
    const materielsList = Array.isArray(body) ? body : (body.materiels || body.items || [body]);
    const completKitId =
      (typeof body === 'object' && !Array.isArray(body) && body.completKitId != null)
        ? body.completKitId
        : (req.query.completKitId ? parseInt(req.query.completKitId, 10) : null);

    const materielsKit = materielsList.filter((m) => m && isMaterielKitId(m.idMateriel));
    if (materielsKit.length > 0) {
      if (!completKitId) {
        return res.status(400).json({
          message:
            'Matériel kit détecté (idMateriel numérique). Fournissez completKitId dans le body : { completKitId: <id>, materiels: [...] } ou via query ?completKitId=',
          inserted: 0
        });
      }
      let totalInserted = 0;
      for (const m of materielsKit) {
        const materielKitId = parseInt(String(m.idMateriel).trim(), 10);
        const qte = Math.max(1, m.quantiteReelle || 1);
        const result = await kit.ajouterMaterielStockKit({
          completKitId,
          materielKitId,
          quantiteReelle: qte
        });
        totalInserted += result.inserted || 0;
      }
      return res.json({
        message:
          totalInserted === 1
            ? '1 matériel ajouté au kit.'
            : `${totalInserted} matériels ajoutés au kit.`,
        inserted: totalInserted
      });
    }

    res.json(await stock.create(body));
  } catch (err) {
    console.error(`Erreur lors de l'enregistrement dans la base de données `, err.message);
    next(err);
  }
});

module.exports = router5;