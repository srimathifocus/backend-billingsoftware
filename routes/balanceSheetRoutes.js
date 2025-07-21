const express = require('express')
const router = express.Router()
const balanceSheetController = require('../controllers/balanceSheetController')
const { protect } = require('../middleware/authMiddleware')

// Apply authentication middleware to all routes
router.use(protect)

// GET /api/balance-sheet - Get all balance sheets
router.get('/', balanceSheetController.getAllBalanceSheets)

// GET /api/balance-sheet/year/:year - Get balance sheets by year
router.get('/year/:year', balanceSheetController.getBalanceSheetsByYear)

// GET /api/balance-sheet/audit/:month/:year - Get audit report
router.get('/audit/:month/:year', balanceSheetController.getAuditReport)

// GET /api/balance-sheet/:month/:year - Get balance sheet by month and year
router.get('/:month/:year', balanceSheetController.getBalanceSheetByMonthYear)

// POST /api/balance-sheet - Create or update balance sheet
router.post('/', balanceSheetController.createOrUpdateBalanceSheet)

// PUT /api/balance-sheet - Create or update balance sheet (alternative endpoint)
router.put('/', balanceSheetController.createOrUpdateBalanceSheet)

// DELETE /api/balance-sheet/:month/:year - Delete balance sheet
router.delete('/:month/:year', balanceSheetController.deleteBalanceSheet)

module.exports = router