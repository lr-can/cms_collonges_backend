const express = require('express');
const router = express.Router();
const asup = require('../services/asup');

router.get('/', async function(req, res, next) {
    try {
        res.json(await asup.getAvailableAsupDetails());
    } catch (err) {
        console.error('Error while getting available ASUP gestures', err.message);
        next(err);
    }
});

module.exports = router;
