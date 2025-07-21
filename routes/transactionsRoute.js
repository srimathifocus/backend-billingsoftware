const express = require("express");
const router = express.Router();
const { protect } = require('../middleware/authMiddleware')
const {
  getTransactions,
  getTransactionSummary,
  getOverallStatistics
} = require("../controllers/transactionsController");

// Get all transactions with filters
router.get("/", protect, getTransactions);

// Get transaction summary
router.get("/summary", protect, getTransactionSummary);

// Get overall statistics
router.get("/statistics", protect, getOverallStatistics);

module.exports = router;