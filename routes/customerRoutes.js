const express = require('express')
const router = express.Router()
const { protect, adminOnly } = require('../middleware/authMiddleware')

// Debug: Log all routes being registered
console.log('Customer routes being registered...')
const { 
  getAllCustomers, 
  getCustomerDetails,
  getCustomerLoans,
  getCustomerInvoices,
  printCustomerList,
  updateCustomer,
  deleteCustomer,
  getCustomerEditHistory,
  getAllEditHistory
} = require('../controllers/customerController')

// Static routes first (to avoid conflicts with :customerId)
// Get all customers
router.get('/', protect, getAllCustomers)

// Get all edit history (Admin only)
router.get('/edit-history/all', protect, adminOnly, getAllEditHistory)

// Print customer list
router.get('/print/list', protect, printCustomerList)

// Dynamic routes with :customerId parameter
// Get customer details by ID
router.get('/:customerId', protect, getCustomerDetails)

// Test route for debugging
router.put('/test/:customerId', protect, (req, res) => {
  console.log('Test PUT route hit with ID:', req.params.customerId)
  res.json({ message: 'Test PUT route working', customerId: req.params.customerId })
})

// Simple test route without parameters
router.put('/test-simple', protect, (req, res) => {
  console.log('Simple test PUT route hit')
  res.json({ message: 'Simple test PUT route working' })
})

// Update customer (Admin only)
router.put('/:customerId', protect, updateCustomer)

// Delete customer (Admin only)
router.delete('/:customerId', protect, adminOnly, deleteCustomer)

// Get customer loans
router.get('/:customerId/loans', protect, getCustomerLoans)

// Get customer invoices
router.get('/:customerId/invoices', protect, getCustomerInvoices)

// Get customer edit history (Admin only)
router.get('/:customerId/edit-history', protect, adminOnly, getCustomerEditHistory)

module.exports = router