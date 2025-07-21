const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { repayLoan, searchLoanForRepayment } = require('../controllers/repaymentController')

// Repay a loan
router.post('/pay', protect, repayLoan)

// Search loan for repayment by loanId or phone
router.get('/search/:identifier', protect, searchLoanForRepayment)

module.exports = router