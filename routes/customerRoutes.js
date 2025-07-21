const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { 
  getAllCustomers, 
  getCustomerDetails,
  getCustomerLoans,
  getCustomerInvoices,
  printCustomerList
} = require('../controllers/customerController')

// Get all customers
router.get('/', protect, getAllCustomers)

// Get customer details by ID
router.get('/:customerId', protect, getCustomerDetails)

// Get customer loans
router.get('/:customerId/loans', protect, getCustomerLoans)

// Get customer invoices
router.get('/:customerId/invoices', protect, getCustomerInvoices)

// Print customer list
router.get('/print/list', protect, printCustomerList)

module.exports = router