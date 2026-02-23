const express = require('express');
const router = express.Router();
const kit = require('../services/kit');
const stock = require('../services/stock');
const kitFicheInventaire = require('../services/kitFicheInventaire');

/* GET catalogue materielKit (optionnel: ?nomKit=xxx) */
router.get('/materielKit', async (req, res, next) => {
  try {
    const data = await kit.getMaterielKitList(req.query);
    res.json(data);
  } catch (err) {
    console.error('Erreur getMaterielKitList', err.message);
    next(err);
  }
});

/* GET stock disponible (pool commun, pour piocher dans les kits) */
router.get('/stockDisponible', async (req, res, next) => {
  try {
    const data = await stock.getStockDisponible(req.query);
    res.json(data);
  } catch (err) {
    console.error('Erreur getStockDisponible', err.message);
    next(err);
  }
});

/* GET stock disponible agrégé par matériel */
router.get('/stockDisponibleParMateriel', async (req, res, next) => {
  try {
    const data = await stock.getStockDisponibleParMateriel();
    res.json(data);
  } catch (err) {
    console.error('Erreur getStockDisponibleParMateriel', err.message);
    next(err);
  }
});

/* GET noms des types de kits */
router.get('/nomsKits', async (req, res, next) => {
  try {
    const data = await kit.getNomsKits();
    res.json(data);
  } catch (err) {
    console.error('Erreur getNomsKits', err.message);
    next(err);
  }
});

/* GET articles d'un type de kit */
router.get('/materielKit/:nomKit', async (req, res, next) => {
  try {
    const data = await kit.getMaterielKitByNomKit(req.params.nomKit);
    res.json(data);
  } catch (err) {
    console.error('Erreur getMaterielKitByNomKit', err.message);
    next(err);
  }
});

/* GET liste des kits physiques (optionnel: ?nomKit=xxx&statut=1) */
router.get('/completKit', async (req, res, next) => {
  try {
    const data = await kit.getCompletKitList(req.query);
    res.json(data);
  } catch (err) {
    console.error('Erreur getCompletKitList', err.message);
    next(err);
  }
});

/* GET détail d'un kit par idKit (string, ex: KIT-ACC-2025-001) */
router.get('/completKit/:idKit', async (req, res, next) => {
  try {
    const p = req.params.idKit;
    const useComplet = req.query.contenuComplet === '1' || req.query.contenuComplet === 'true';
    let data;
    if (useComplet) {
      data = await kit.getContenuKitComplet(p);
    } else {
      data = /^\d+$/.test(p)
        ? await kit.getCompletKitById(parseInt(p, 10))
        : await kit.getCompletKitDetail(p);
    }
    if (!data) return res.status(404).json({ message: 'Kit non trouvé' });
    res.json(data);
  } catch (err) {
    console.error('Erreur getCompletKitDetail', err.message);
    next(err);
  }
});

/* POST néo-création d'un kit physique */
router.post('/completKit', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body.idKit || !body.nomKit || !body.createurId) {
      return res.status(400).json({ message: 'idKit, nomKit et createurId requis' });
    }
    res.json(await kit.createCompletKit(body));
  } catch (err) {
    console.error('Erreur createCompletKit', err.message);
    next(err);
  }
});

/* PUT modification d'un kit (par id numérique) */
router.put('/completKit/:id', async (req, res, next) => {
  try {
    res.json(await kit.updateCompletKit(parseInt(req.params.id, 10), req.body));
  } catch (err) {
    console.error('Erreur updateCompletKit', err.message);
    next(err);
  }
});

/* POST réaliser un kit (constituer stockKit depuis le modèle) */
router.post('/realiser', async (req, res, next) => {
  try {
    const { idKit, createurId, createurNom } = req.body;
    if (!idKit || !createurId) {
      return res.status(400).json({ message: 'idKit et createurId requis' });
    }
    res.json(await kit.realiserKit(req.body));
  } catch (err) {
    console.error('Erreur realiserKit', err.message);
    next(err);
  }
});

/* POST remplacer un matériel dans un kit */
router.post('/remplacerMateriel', async (req, res, next) => {
  try {
    const { completKitId, stockKitId } = req.body;
    if (!completKitId || !stockKitId) {
      return res.status(400).json({ message: 'completKitId et stockKitId requis' });
    }
    res.json(await kit.remplacerMaterielKit(req.body));
  } catch (err) {
    console.error('Erreur remplacerMaterielKit', err.message);
    next(err);
  }
});

/* POST ajouter un matériel au kit */
router.post('/stockKit/ajouter', async (req, res, next) => {
  try {
    const { completKitId, materielKitId, quantiteReelle } = req.body;
    if (!completKitId || !materielKitId) {
      return res.status(400).json({ message: 'completKitId et materielKitId requis' });
    }
    res.json(await kit.ajouterMaterielStockKit(req.body));
  } catch (err) {
    console.error('Erreur ajouterMaterielStockKit', err.message);
    next(err);
  }
});

/* PUT mise à jour d'une ligne stockKit (id = K1, K2, ...) */
router.put('/stockKit/:id', async (req, res, next) => {
  try {
    res.json(await kit.updateStockKit(req.params.id, req.body));
  } catch (err) {
    console.error('Erreur updateStockKit', err.message);
    next(err);
  }
});

/* PUT mise à jour d'un groupe stockKit (quantité, date, lot) */
router.put('/stockKit/groupe', async (req, res, next) => {
  try {
    const { completKitId, materielKitId } = req.body;
    if (!completKitId || !materielKitId) {
      return res.status(400).json({ message: 'completKitId et materielKitId requis' });
    }
    res.json(await kit.updateStockKitGroupe(parseInt(completKitId, 10), parseInt(materielKitId, 10), req.body));
  } catch (err) {
    console.error('Erreur updateStockKitGroupe', err.message);
    next(err);
  }
});

/* GET matériel manquant pour atteindre 4 kits de chaque type */
router.get('/materielManquant', async (req, res, next) => {
  try {
    const nbKits = parseInt(req.query.nbKits || '4', 10);
    res.json(await kit.getMaterielManquantKits(nbKits));
  } catch (err) {
    console.error('Erreur getMaterielManquantKits', err.message);
    next(err);
  }
});

/* POST ajouter une observation au kit */
router.post('/observation/:completKitId', async (req, res, next) => {
  try {
    const { observation } = req.body;
    if (!observation) {
      return res.status(400).json({ message: 'observation requise' });
    }
    res.json(await kit.ajouterObservation(parseInt(req.params.completKitId, 10), observation));
  } catch (err) {
    console.error('Erreur ajouterObservation', err.message);
    next(err);
  }
});

/* GET prochains ids stockKit disponibles (K1, K2, ...) */
router.get('/nextAvailableStockKitIds/:count', async (req, res, next) => {
  try {
    const count = parseInt(req.params.count, 10);
    if (isNaN(count) || count <= 0) {
      return res.status(400).json({ message: 'Le paramètre count doit être un nombre entier positif.' });
    }
    res.json(await kit.getNextAvailableStockKitIds(count));
  } catch (err) {
    console.error('Erreur getNextAvailableStockKitIds', err.message);
    next(err);
  }
});

/* GET suggestion d'idKit pour néo-création */
router.get('/nextIdKit', async (req, res, next) => {
  try {
    const suggestion = await kit.getNextIdKitSuggestion(req.query.nomKit);
    res.json({ suggestion });
  } catch (err) {
    console.error('Erreur getNextIdKitSuggestion', err.message);
    next(err);
  }
});

/* GET fiche inventaire HTML imprimable (?agent=... JSON encodé en query, optionnel) */
router.get('/ficheInventaire/:idKit', async (req, res, next) => {
  try {
    let agent = {};
    if (req.query.agent) {
      try {
        agent = JSON.parse(decodeURIComponent(req.query.agent));
      } catch (_) {}
    }
    const html = await kitFicheInventaire.getFicheInventaireHTML(req.params.idKit, agent);
    if (!html) return res.status(404).send('Kit non trouvé');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Erreur ficheInventaire', err.message);
    next(err);
  }
});

module.exports = router;
