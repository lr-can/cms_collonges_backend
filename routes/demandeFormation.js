const express = require("express");
const router = express.Router();
const demandeFormationService = require("../services/demandeFormation");

router.post("/", async function (req, res, next) {
  try {
    const result = await demandeFormationService.insertDemandeFormation(req.body);
    res.json(result);
  } catch (err) {
    console.error("Erreur lors de l'enregistrement de la demande de formation", err.message);
    next(err);
  }
});

module.exports = router;
