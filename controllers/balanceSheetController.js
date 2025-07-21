const BalanceSheet = require('../models/BalanceSheet')
const Expense = require('../models/Expense')

// Get all balance sheets
exports.getAllBalanceSheets = async (req, res) => {
  try {
    const balanceSheets = await BalanceSheet.find().sort({ year: -1, month: -1 })
    
    res.json({
      success: true,
      data: balanceSheets
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get balance sheet by month and year
exports.getBalanceSheetByMonthYear = async (req, res) => {
  try {
    const { month, year } = req.params
    
    const balanceSheet = await BalanceSheet.findOne({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })
    
    if (!balanceSheet) {
      return res.status(404).json({
        success: false,
        message: 'Balance sheet not found for the specified month and year'
      })
    }

    res.json({
      success: true,
      data: balanceSheet
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Create or update balance sheet
exports.createOrUpdateBalanceSheet = async (req, res) => {
  try {
    const { 
      month, 
      year, 
      cashInHandBank,
      loanReceivables,
      forfeitedInventory,
      furnitureFixtures,
      customerPayables,
      bankOverdraft,
      ownersEquity,
      interestIncome,
      saleOfForfeitedItems
    } = req.body

    // Validate month and year
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month or year provided'
      })
    }

    let balanceSheet = await BalanceSheet.findOne({ month, year })

    if (balanceSheet) {
      // Update existing balance sheet
      balanceSheet.cashInHandBank = cashInHandBank !== undefined ? cashInHandBank : balanceSheet.cashInHandBank
      balanceSheet.loanReceivables = loanReceivables !== undefined ? loanReceivables : balanceSheet.loanReceivables
      balanceSheet.forfeitedInventory = forfeitedInventory !== undefined ? forfeitedInventory : balanceSheet.forfeitedInventory
      balanceSheet.furnitureFixtures = furnitureFixtures !== undefined ? furnitureFixtures : balanceSheet.furnitureFixtures
      balanceSheet.customerPayables = customerPayables !== undefined ? customerPayables : balanceSheet.customerPayables
      balanceSheet.bankOverdraft = bankOverdraft !== undefined ? bankOverdraft : balanceSheet.bankOverdraft
      balanceSheet.ownersEquity = ownersEquity !== undefined ? ownersEquity : balanceSheet.ownersEquity
      balanceSheet.interestIncome = interestIncome !== undefined ? interestIncome : balanceSheet.interestIncome
      balanceSheet.saleOfForfeitedItems = saleOfForfeitedItems !== undefined ? saleOfForfeitedItems : balanceSheet.saleOfForfeitedItems
    } else {
      // Create new balance sheet
      balanceSheet = new BalanceSheet({
        month,
        year,
        cashInHandBank: cashInHandBank || 0,
        loanReceivables: loanReceivables || 0,
        forfeitedInventory: forfeitedInventory || 0,
        furnitureFixtures: furnitureFixtures || 0,
        customerPayables: customerPayables || 0,
        bankOverdraft: bankOverdraft || 0,
        ownersEquity: ownersEquity || 0,
        interestIncome: interestIncome || 0,
        saleOfForfeitedItems: saleOfForfeitedItems || 0
      })
    }

    // Calculate net profit by getting expenses for the same month/year
    const expense = await Expense.findOne({ month, year })
    const totalExpenses = expense ? expense.totalExpenses : 0
    balanceSheet.netProfit = balanceSheet.totalRevenue - totalExpenses

    await balanceSheet.save()

    res.json({
      success: true,
      message: balanceSheet.isNew ? 'Balance sheet created successfully' : 'Balance sheet updated successfully',
      data: balanceSheet
    })
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Balance sheet already exists for this month and year'
      })
    } else {
      res.status(500).json({ 
        success: false,
        message: error.message 
      })
    }
  }
}

// Delete balance sheet
exports.deleteBalanceSheet = async (req, res) => {
  try {
    const { month, year } = req.params
    
    const balanceSheet = await BalanceSheet.findOneAndDelete({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })
    
    if (!balanceSheet) {
      return res.status(404).json({
        success: false,
        message: 'Balance sheet not found'
      })
    }

    res.json({
      success: true,
      message: 'Balance sheet deleted successfully'
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get complete audit report for a specific month/year
exports.getAuditReport = async (req, res) => {
  try {
    const { month, year } = req.params
    
    const balanceSheet = await BalanceSheet.findOne({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })
    
    const expense = await Expense.findOne({ 
      month: parseInt(month), 
      year: parseInt(year) 
    })

    if (!balanceSheet && !expense) {
      return res.status(404).json({
        success: false,
        message: 'No financial data found for the specified month and year'
      })
    }

    // Calculate net profit
    const totalRevenue = balanceSheet ? balanceSheet.totalRevenue : 0
    const totalExpenses = expense ? expense.totalExpenses : 0
    const netProfit = totalRevenue - totalExpenses

    const auditReport = {
      month: parseInt(month),
      year: parseInt(year),
      balanceSheet: balanceSheet || {
        cashInHandBank: 0,
        loanReceivables: 0,
        forfeitedInventory: 0,
        furnitureFixtures: 0,
        totalAssets: 0,
        customerPayables: 0,
        bankOverdraft: 0,
        ownersEquity: 0,
        totalLiabilitiesEquity: 0,
        interestIncome: 0,
        saleOfForfeitedItems: 0,
        totalRevenue: 0
      },
      expenses: expense || {
        salaries: 0,
        rent: 0,
        utilities: 0,
        miscellaneous: 0,
        totalExpenses: 0
      },
      netProfit
    }

    res.json({
      success: true,
      data: auditReport
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get balance sheets for a specific year
exports.getBalanceSheetsByYear = async (req, res) => {
  try {
    const { year } = req.params
    
    const balanceSheets = await BalanceSheet.find({ year: parseInt(year) }).sort({ month: 1 })
    
    res.json({
      success: true,
      data: balanceSheets
    })
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}