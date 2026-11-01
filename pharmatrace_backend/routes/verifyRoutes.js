// Mounted at the ROOT (app.use(verifyRoutes)) because the QR codes point at /01/...  (GS1 Digital Link paths).
const express = require('express');
const router = express.Router();
const { verifyApi, verifyPage, optionalAuth, limiter } = require('../controllers/verifyController');

router.get('/api/verify', limiter(), optionalAuth, verifyApi);
router.get('/01/:gtin', limiter(), verifyPage);
router.get('/01/:gtin/10/:batch', limiter(), verifyPage);
router.get('/01/:gtin/10/:batch/21/:serial', limiter(), verifyPage);
module.exports = router;
