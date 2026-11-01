const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const c = require('../controllers/batchController');

router.use(verifyToken);                                                    // super_admin passes every role check
router.get('/context', requireRole('regulator', 'manufacturer'), c.getContext);
router.get('/', requireRole('regulator', 'manufacturer'), c.listBatches);    // manufacturers only ever see their own
router.post('/', requireRole('manufacturer'), c.prepareBatch);
router.get('/:id', requireRole('regulator', 'manufacturer'), c.getBatch);
router.post('/:id/confirm-submit', requireRole('manufacturer'), c.confirmSubmit);
router.post('/:id/confirm-action', requireRole('regulator'), c.confirmAction);
module.exports = router;
