const express = require('express')
const router = express.Router()
const expenseController = require('../controllers/expenseController')
const { protect } = require('../middleware/authMiddleware')

// Apply authentication middleware to all routes
router.use(protect)

// GET /api/expenses - Get all expenses
router.get('/', expenseController.getAllExpenses)

// GET /api/expenses/year/:year - Get expenses by year
router.get('/year/:year', expenseController.getExpensesByYear)

// GET /api/expenses/:month/:year - Get expense by month and year
router.get('/:month/:year', expenseController.getExpenseByMonthYear)

// POST /api/expenses - Create or update expense
router.post('/', expenseController.createOrUpdateExpense)

// PUT /api/expenses - Create or update expense (alternative endpoint)
router.put('/', expenseController.createOrUpdateExpense)

// DELETE /api/expenses/:month/:year - Delete expense
router.delete('/:month/:year', expenseController.deleteExpense)

module.exports = router