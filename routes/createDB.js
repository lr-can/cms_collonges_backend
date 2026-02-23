const express = require('express');
const router5 = express.Router();
const stock = require('../services/stock');
const kit = require('../services/kit');

/** Détecte si idMateriel est un id materielKit (numérique). */
function isMaterielKitId(val) {
  if (val == null) return false;
  return /^\d+$/.test(String(val).trim());
}

/** idStock commence par K → stockKit (kit), sinon → stock classique */
function isIdStockKit(val) {
  if (val == null || val === '') return false;
  return /^K\d+$/i.test(String(val).trim());
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
      const hasIdStockK = materielsKit.some((m) => isIdStockKit(m.idStock));
      if (hasIdStockK) {
        if (!completKitId) {
          return res.status(400).json({
            message: 'idStock commence par K (kit). Fournissez completKitId (body ou ?completKitId=)',
            inserted: 0
          });
        }
        return res.json(await kit.insererStockKitAvecIds({ completKitId, items: materielsKit }));
      }
      if (completKitId != null) {
        return res.json(await stock.affecterStockAuKit({ completKitId, items: materielsKit }));
      }
      return res.json(await stock.createFromMaterielKitReception(materielsKit));
    }

    res.json(await stock.create(body));
  } catch (err) {
    console.error(`Erreur lors de l'enregistrement dans la base de données `, err.message);
    next(err);
  }
});

module.exports = router5;