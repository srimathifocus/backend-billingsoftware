const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { 
  getLoanInvoice, 
  getRepaymentInvoice,
  generateLoanInvoicePDF,
  generateRepaymentInvoicePDF,
  printLoanInvoice,
  printRepaymentInvoice
} = require('../controllers/invoiceController')

const {
  generateCompactLoanInvoicePDF,
  generateCompactRepaymentInvoicePDF
} = require('../controllers/compactInvoiceController')

router.get('/loan/:loanId', protect, getLoanInvoice)
router.get('/repayment/:loanId', protect, getRepaymentInvoice)
router.get('/loan/:loanId/pdf', protect, generateLoanInvoicePDF)
router.get('/repayment/:loanId/pdf', protect, generateRepaymentInvoicePDF)

// Print routes (for browser printing)
router.get('/billing/:loanId/print', protect, printLoanInvoice)
router.get('/repayment/:loanId/print', protect, printRepaymentInvoice)

// Compact Invoice Routes for Jewelry Shop
router.get('/loan/:loanId/compact-pdf', protect, generateCompactLoanInvoicePDF)
router.get('/repayment/:loanId/compact-pdf', protect, generateCompactRepaymentInvoicePDF)

module.exports = router