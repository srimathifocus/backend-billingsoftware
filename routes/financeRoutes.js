const express = require('express');
const router = express.Router();
const { 
  createOrUpdateFinanceData,
  getAllFinanceData,
  getFinanceDataWithMetrics,
  deleteFinanceData,
  generateTamilNaduAuditReport,
  finalizeFinanceData
} = require('../controllers/financeController');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Finance data routes
router.post('/', createOrUpdateFinanceData);
router.get('/', getAllFinanceData);
router.get('/metrics', getFinanceDataWithMetrics); // Route for auto-calculated metrics
router.delete('/:id', deleteFinanceData);

// Tamil Nadu Audit Report
router.get('/audit-report', generateTamilNaduAuditReport);

// Finalize finance data
router.put('/:id/finalize', finalizeFinanceData);

module.exports = router;