const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.get('/:email/:matricule', async function(req, res, next) {
  try {
    const email = decodeURIComponent(req.params.email);
    const matricule = decodeURIComponent(req.params.matricule);

    // Valider que les paramètres ne sont pas vides
    if (!email || !matricule) {
      return res.status(400).json({
        success: false,
        error: 'Email et matricule sont requis'
      });
    }

    const result = await auth.getAuthInfo(email, matricule);
    
    // Si l'authentification a échoué, retourner 401 ou 404
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error(`Erreur lors de l'authentification:`, err.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'authentification'
    });
  }
});

module.exports = router;

