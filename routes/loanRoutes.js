const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const {
  getActiveLoans,
  getInactiveLoans,
  searchLoansByPhone,
  getLoanById,
  getLoanStatistics
} = require('../controllers/loanController')

// Get all active loans
router.get('/active', protect, getActiveLoans)

// Get all inactive loans
router.get('/inactive', protect, getInactiveLoans)

// Search loans by phone number
router.get('/search/:phone', protect, searchLoansByPhone)

// Get loan statistics
router.get('/statistics', protect, getLoanStatistics)

// Get loan by ID or loanId
router.get('/:id', protect, getLoanById)

module.exports = router