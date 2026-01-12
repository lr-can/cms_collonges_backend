const express = require('express');
const router = express.Router();
const allAgents = require('../services/allAgents');

router.post('/', async function(req, res, next) {
  try {
    const { action, table, agents } = req.body;

    // Vérifier que l'action est "upsert"
    if (action !== 'upsert') {
      return res.status(400).json({ 
        error: 'Action non supportée. Seule l\'action "upsert" est acceptée.' 
      });
    }

    // Vérifier que la table est "all_agents"
    if (table !== 'all_agents') {
      return res.status(400).json({ 
        error: 'Table non supportée. Seule la table "all_agents" est acceptée.' 
      });
    }

    // Vérifier que le tableau d'agents existe et n'est pas vide
    if (!Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ 
        error: 'Le tableau d\'agents est requis et ne peut pas être vide.' 
      });
    }

    const result = await allAgents.upsertAgents(agents);
    res.json(result);
  } catch (err) {
    console.error(`Erreur lors de la synchronisation des agents:`, err.message);
    next(err);
  }
});

module.exports = router;

