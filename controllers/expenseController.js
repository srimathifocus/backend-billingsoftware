const Expense = require('../models/Expense')

// Get all expenses
exports.getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ year: -1, month: -1 })
    
    res.json({
      success: true,
      data: expenses
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get expense by month and year
exports.getExpenseByMonthYear = async (req, res) => {
  try {
    const { month, year } = req.params
    
    const expense = await Expense.findOne({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found for the specified month and year'
      })
    }

    res.json({
      success: true,
      data: expense
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Create or update expense
exports.createOrUpdateExpense = async (req, res) => {
  try {
    const { month, year, salaries, rent, utilities, miscellaneous } = req.body

    // Validate month and year
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month or year provided'
      })
    }

    let expense = await Expense.findOne({ month, year })

    if (expense) {
      // Update existing expense
      expense.salaries = salaries !== undefined ? salaries : expense.salaries
      expense.rent = rent !== undefined ? rent : expense.rent
      expense.utilities = utilities !== undefined ? utilities : expense.utilities
      expense.miscellaneous = miscellaneous !== undefined ? miscellaneous : expense.miscellaneous
      
      await expense.save()
    } else {
      // Create new expense
      expense = new Expense({
        month,
        year,
        salaries: salaries || 0,
        rent: rent || 0,
        utilities: utilities || 0,
        miscellaneous: miscellaneous || 0
      })
      await expense.save()
    }

    res.json({
      success: true,
      message: expense.isNew ? 'Expense created successfully' : 'Expense updated successfully',
      data: expense
    })
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Expense record already exists for this month and year'
      })
    } else {
      res.status(500).json({ 
        success: false,
        message: error.message 
      })
    }
  }
}

// Delete expense
exports.deleteExpense = async (req, res) => {
  try {
    const { month, year } = req.params
    
    const expense = await Expense.findOneAndDelete({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })
    
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense record not found'
      })
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get expenses for a specific year
exports.getExpensesByYear = async (req, res) => {
  try {
    const { year } = req.params
    
    const expenses = await Expense.find({ year: parseInt(year) }).sort({ month: 1 })
    
    res.json({
      success: true,
      data: expenses
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}