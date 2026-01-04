const express = require('express');
const router = express.Router();
const manoeuvre = require('../services/manoeuvre');

// POST /changeConnexion/:matricule
router.post('/changeConnexion/:matricule', async function(req, res, next) {
    try {
        const result = await manoeuvre.changeConnexion(req.params.matricule);
        res.json(result);
    } catch (err) {
        console.error(`Error changing connexion for matricule ${req.params.matricule}:`, err.message);
        next(err);
    }
});

// POST /declenchementManoeuvre/:engin/:caserne
router.post('/declenchementManoeuvre/:engin/:caserne', async function(req, res, next) {
    try {
        const result = await manoeuvre.declenchementManoeuvre(req.params.engin, req.params.caserne);
        res.json(result);
    } catch (err) {
        console.error(`Error in declenchementManoeuvre for engin ${req.params.engin} and caserne ${req.params.caserne}:`, err.message);
        next(err);
    }
});

// POST /departManoeuvre/:matricule
router.post('/departManoeuvre/:matricule', async function(req, res, next) {
    try {
        const result = await manoeuvre.departManoeuvre(req.params.matricule);
        res.json(result);
    } catch (err) {
        console.error(`Error in departManoeuvre for matricule ${req.params.matricule}:`, err.message);
        next(err);
    }
});

// POST /reinitialiseManoeuvre
router.post('/reinitialiseManoeuvre', async function(req, res, next) {
    try {
        const result = await manoeuvre.reinitialiseManoeuvre();
        res.json(result);
    } catch (err) {
        console.error('Error reinitialising manoeuvre:', err.message);
        next(err);
    }
});

// GET /getManoeuvreDetails
router.get('/getManoeuvreDetails', async function(req, res, next) {
    try {
        const result = await manoeuvre.getManoeuvreDetails();
        res.json(result);
    } catch (err) {
        console.error('Error getting manoeuvre details:', err.message);
        next(err);
    }
});

module.exports = router;

