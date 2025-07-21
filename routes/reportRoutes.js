const router = require('express').Router()
const reportController = require('../controllers/reportController')
const { protect, adminOnly } = require('../middleware/authMiddleware')

// Legacy report route (kept for backward compatibility)
router.get('/', protect, reportController.getReport)

// New admin-only report routes
router.get('/dashboard', protect, adminOnly, reportController.getReportDashboard)
router.get('/transactions', protect, adminOnly, reportController.generateTransactionReport)
router.get('/audit', protect, adminOnly, reportController.generateAuditReport)

module.exports = router
