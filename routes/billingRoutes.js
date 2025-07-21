const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { createBilling, getBillingStats } = require('../controllers/billingController')

router.post('/create', protect, createBilling)
router.get('/stats', protect, getBillingStats)

module.exports = router