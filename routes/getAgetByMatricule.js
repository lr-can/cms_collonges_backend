const express = require('express');
const router = express.Router();
const allAgents = require('../services/allAgents');

router.get('/:matricule', async function(req, res, next) {
  try {
    const agent = await allAgents.getAgentByMatricule(req.params.matricule);

    if (!agent) {
      return res.status(404).json({
        error: `Aucun agent ne correspond au matricule ${req.params.matricule}.`
      });
    }

    res.json(agent);
  } catch (err) {
    console.error(`Erreur lors de la récupération de l'agent`, err.message);
    next(err);
  }
});

module.exports = router;
