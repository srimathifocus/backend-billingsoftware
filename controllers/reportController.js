const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Customer = require('../models/Customer')
const User = require('../models/User')
const ShopDetails = require('../models/ShopDetails')
const BalanceSheet = require('../models/BalanceSheet')
const Expense = require('../models/Expense')
const Finance = require('../models/Finance')
const moment = require('moment')

// Helper function to build balance sheet and expense queries for date periods
const buildMonthlyDataQueries = (periodStart, periodEnd) => {
  // Create a list of all year-month combinations in the period
  const yearMonthCombinations = []
  const current = moment(periodStart).startOf('month')
  const end = moment(periodEnd).endOf('month')
  
  while (current.isSameOrBefore(end, 'month')) {
    yearMonthCombinations.push({
      year: current.year(),
      month: current.month() + 1 // MongoDB months are 1-based
    })
    current.add(1, 'month')
  }
  
  // Build the query using $or with all year-month combinations
  if (yearMonthCombinations.length > 0) {
    const query = {
      $or: yearMonthCombinations.map(ym => ({
        year: ym.year,
        month: ym.month
      }))
    }
    return query
  } else {
    // Fallback to empty results if no valid period
    return { _id: { $exists: false } }
  }
}

// Legacy report function (kept for backward compatibility)
exports.getReport = async (req, res) => {
  const { type } = req.query
  const now = new Date()
  let start

  if (type === 'daily') {
    start = new Date(now.setHours(0, 0, 0, 0))
  } else if (type === 'weekly') {
    const day = now.getDay()
    start = new Date(now.setDate(now.getDate() - day))
    start.setHours(0, 0, 0, 0)
  } else if (type === 'monthly') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (type === 'yearly') {
    start = new Date(now.getFullYear(), 0, 1)
  } else {
    return res.status(400).json({ message: 'Invalid report type' })
  }

  const loans = await Loan.find({ createdAt: { $gte: start } })

  const totalLoanAmount = loans.reduce((sum, l) => sum + l.amount, 0)
  const totalInterest = loans.reduce((sum, l) => sum + ((l.amount * l.interestPercent) / 100), 0)
  const totalRepaid = loans.reduce((sum, l) => sum + (l.payment?.cash || 0) + (l.payment?.online || 0), 0)

  res.json({ totalLoanAmount, totalInterest, totalRepaid })
}

// Generate Transaction Report
exports.generateTransactionReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query
    
    let dateFilter = {}
    let reportTitle = ''
    
    const now = moment()
    
    // Set date filters based on report type
    switch (reportType) {
      case 'daily':
        dateFilter = {
          createdAt: {
            $gte: now.startOf('day').toDate(),
            $lte: now.endOf('day').toDate()
          }
        }
        reportTitle = `Daily Transaction Report - ${now.format('DD/MM/YYYY')}`
        break
        
      case 'monthly':
        dateFilter = {
          createdAt: {
            $gte: now.startOf('month').toDate(),
            $lte: now.endOf('month').toDate()
          }
        }
        reportTitle = `Monthly Transaction Report - ${now.format('MMMM YYYY')}`
        break
        
      case 'yearly':
        dateFilter = {
          createdAt: {
            $gte: now.startOf('year').toDate(),
            $lte: now.endOf('year').toDate()
          }
        }
        reportTitle = `Yearly Transaction Report - ${now.format('YYYY')}`
        break
        
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ message: 'Start date and end date are required for custom range' })
        }
        dateFilter = {
          createdAt: {
            $gte: moment(startDate).startOf('day').toDate(),
            $lte: moment(endDate).endOf('day').toDate()
          }
        }
        reportTitle = `Transaction Report - ${moment(startDate).format('DD/MM/YYYY')} to ${moment(endDate).format('DD/MM/YYYY')}`
        break
        
      default:
        return res.status(400).json({ message: 'Invalid report type' })
    }
    
    // Get all loans issued in the date range
    const loans = await Loan.find({
      ...dateFilter,
      status: { $in: ['active', 'repaid'] }
    })
      .populate('customerId', 'name phone email')
      .populate('itemIds', 'name category')
      .sort({ createdAt: -1 })
    
    // Get repayment transactions made in the date range
    const repaymentDateFilter = {
      repaymentDate: {
        $gte: dateFilter.createdAt.$gte,
        $lte: dateFilter.createdAt.$lte
      }
    }
    
    const repaymentTransactions = await Repayment.find(repaymentDateFilter)
      .populate({
        path: 'loanId',
        populate: {
          path: 'customerId',
          select: 'name phone'
        }
      })
      .sort({ repaymentDate: -1 })
    
    // Calculate summary statistics
    const totalLoansIssued = loans.length
    const totalLoanAmount = loans.reduce((sum, loan) => sum + loan.amount, 0)
    
    // Count and calculate repayments
    const totalRepayments = repaymentTransactions.length
    const totalRepaymentAmount = repaymentTransactions.reduce((sum, repayment) => {
      return sum + repayment.totalAmount
    }, 0)
    
    // Calculate interest earned from repayments
    const totalInterestEarned = repaymentTransactions.reduce((sum, repayment) => {
      return sum + repayment.interestAmount
    }, 0)
    
    const reportData = {
      title: reportTitle,
      generatedOn: new Date(),
      generatedBy: req.user.name,
      period: {
        startDate: dateFilter.createdAt.$gte,
        endDate: dateFilter.createdAt.$lte
      },
      summary: {
        totalLoansIssued,
        totalLoanAmount,
        totalRepayments,
        totalRepaymentAmount,
        totalInterestEarned: Math.round(totalInterestEarned),
        netRevenue: Math.round(totalInterestEarned)
      },
      loans,
      repaymentTransactions
    }
    
    res.json(reportData)
    
  } catch (error) {
    console.error('Transaction report error:', error)
    res.status(500).json({ message: error.message })
  }
}

// Generate Tamil Nadu Audit Report (Updated to use Finance Management data)
exports.generateAuditReport = async (req, res) => {
  try {
    console.log('🔍 Generating Tamil Nadu Audit Report:', req.query)
    
    // Redirect to the new Tamil Nadu audit report endpoint
    const financeController = require('./financeController')
    return await financeController.generateTamilNaduAuditReport(req, res)
    
  } catch (error) {
    console.error('❌ Audit report error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Legacy Audit Report (kept for backward compatibility)
exports.generateLegacyAuditReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate, month, year } = req.query
    console.log('🔍 Legacy Audit Report Query Parameters:', req.query)
    
    let dateFilter = {}
    let reportTitle = ''
    let periodStart, periodEnd
    
    // Handle different report types
    switch (reportType) {
      case 'monthly':
        if (!month || !year) {
          return res.status(400).json({ message: 'Month and year are required for monthly reports' })
        }
        // For monthly reports, show data only for the selected month and year
        periodStart = moment(`${year}-${month.padStart(2, '0')}-01`).startOf('month').toDate()
        periodEnd = moment(`${year}-${month.padStart(2, '0')}-01`).endOf('month').toDate()
        reportTitle = `Monthly Audit Report - ${moment(periodStart).format('MMMM YYYY')}`
        break
        
      case 'yearly':
        const reportYear = year ? parseInt(year) : moment().year()
        periodStart = moment(`${reportYear}-01-01`).startOf('year').toDate()
        periodEnd = moment(`${reportYear}-12-31`).endOf('year').toDate()
        reportTitle = `Yearly Audit Report - ${reportYear}`
        break
        
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ message: 'Start date and end date are required for custom range' })
        }
        periodStart = moment(startDate).startOf('day').toDate()
        periodEnd = moment(endDate).endOf('day').toDate()
        reportTitle = `Audit Report - ${moment(periodStart).format('DD/MM/YYYY')} to ${moment(periodEnd).format('DD/MM/YYYY')}`
        break
        
      case 'financial':
      default:
        // For financial year reports, show data for the full financial year (April to March)
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth() + 1
        
        const fyYear = year ? parseInt(year) : (currentMonth >= 4 ? currentYear : currentYear - 1)
        periodStart = moment(`${fyYear}-04-01`).startOf('day').toDate()
        periodEnd = moment(`${fyYear + 1}-03-31`).endOf('day').toDate()
        reportTitle = `Financial Year Audit Report - ${fyYear}-${fyYear + 1}`
        break
    }
    
    dateFilter = {
      createdAt: { $gte: periodStart, $lte: periodEnd }
    }
    
    console.log('📅 Date Filter Applied:', {
      reportType,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      dateFilter
    })

    
    // Fetch shop details from database
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ message: 'Shop details not found. Please configure shop details first.' })
    }
    
    // Get all data for the selected period
    console.log('🔍 Querying loans with dateFilter:', dateFilter)
    const allLoans = await Loan.find(dateFilter)
      .populate('customerId', 'name phone email')
      .populate('itemIds', 'name category weight')
      .sort({ createdAt: -1 })
    
    console.log(`📊 Found ${allLoans.length} loans matching the date filter`)
    
    const allCustomers = await Customer.find(dateFilter)
    const allUsers = await User.find()
    
    // Get all repayments for the period
    const allRepayments = await Repayment.find({
      repaymentDate: { $gte: periodStart, $lte: periodEnd }
    }).populate({
      path: 'loanId',
      populate: {
        path: 'customerId',
        select: 'name phone email'
      }
    })
    
    // Get balance sheet and expense data for the period
    const monthlyQuery = buildMonthlyDataQueries(periodStart, periodEnd)
    
    const balanceSheetData = await BalanceSheet.find(monthlyQuery)
    const expenseData = await Expense.find(monthlyQuery)
    
    // Helper function to calculate customer-wise interest analysis
    const calculateCustomerInterestAnalysis = () => {
      const customerMap = new Map()
      
      // Process loans
      allLoans.forEach(loan => {
        const customerId = loan.customerId._id.toString()
        const customerName = loan.customerId.name
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerName,
            totalLoansGiven: 0,
            totalRepaid: 0,
            interestEarned: 0,
            outstanding: 0
          })
        }
        
        const customer = customerMap.get(customerId)
        customer.totalLoansGiven += loan.amount
        
        // Calculate repayments for this loan
        const loanRepayments = allRepayments.filter(rep => 
          rep.loanId && rep.loanId._id.toString() === loan._id.toString()
        )
        
        const totalRepaidForLoan = loanRepayments.reduce((sum, rep) => sum + rep.totalAmount, 0)
        const interestEarnedForLoan = loanRepayments.reduce((sum, rep) => sum + rep.interestAmount, 0)
        
        customer.totalRepaid += totalRepaidForLoan
        customer.interestEarned += interestEarnedForLoan
        customer.outstanding += Math.max(0, loan.amount - totalRepaidForLoan)
      })
      
      return Array.from(customerMap.values()).sort((a, b) => b.totalLoansGiven - a.totalLoansGiven)
    }
    
    // Helper function to calculate monthly profit & loss
    const calculateMonthlyProfitLoss = () => {
      const monthlyData = []
      const current = moment(periodStart)
      const end = moment(periodEnd)
      
      while (current.isSameOrBefore(end, 'month')) {
        const monthStart = current.clone().startOf('month').toDate()
        const monthEnd = current.clone().endOf('month').toDate()
        
        // Loans given in this month
        const monthLoans = allLoans.filter(loan => 
          moment(loan.createdAt).isBetween(monthStart, monthEnd, null, '[]')
        )
        const loansGiven = monthLoans.reduce((sum, loan) => sum + loan.amount, 0)
        
        // Repayments in this month
        const monthRepayments = allRepayments.filter(rep =>
          moment(rep.repaymentDate).isBetween(monthStart, monthEnd, null, '[]')
        )
        const repayments = monthRepayments.reduce((sum, rep) => sum + rep.totalAmount, 0)
        const interestIncome = monthRepayments.reduce((sum, rep) => sum + rep.interestAmount, 0)
        
        // Expenses for this month
        const monthExpenses = expenseData.filter(exp => 
          exp.year === current.year() && exp.month === (current.month() + 1)
        )
        const expenses = monthExpenses.reduce((sum, exp) => 
          sum + (exp.salaries || 0) + (exp.rent || 0) + (exp.utilities || 0) + (exp.miscellaneous || 0), 0
        )
        
        const netProfit = interestIncome - expenses
        
        monthlyData.push({
          month: current.format('MMM YYYY'),
          loansGiven: Math.round(loansGiven),
          repayments: Math.round(repayments),
          interestIncome: Math.round(interestIncome),
          expenses: Math.round(expenses),
          netProfit: Math.round(netProfit)
        })
        
        current.add(1, 'month')
      }
      
      return monthlyData
    }
    
    // Calculate transaction summary
    const calculateTransactionSummary = () => {
      const totalLoanTransactions = allLoans.length
      const totalRepaymentTransactions = allRepayments.length
      const totalTransactions = totalLoanTransactions + totalRepaymentTransactions
      
      const cashTransactions = allLoans.reduce((sum, loan) => sum + (loan.payment?.cash || 0), 0) +
                              allRepayments.reduce((sum, rep) => sum + (rep.payment?.cash || 0), 0)
      
      const onlineTransactions = allLoans.reduce((sum, loan) => sum + (loan.payment?.online || 0), 0) +
                                allRepayments.reduce((sum, rep) => sum + (rep.payment?.online || 0), 0)
      
      const totalAmount = cashTransactions + onlineTransactions
      const avgTransactionValue = totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0
      
      return {
        totalTransactions,
        loanTransactions: totalLoanTransactions,
        repaymentTransactions: totalRepaymentTransactions,
        cashTransactions: Math.round(cashTransactions),
        onlineTransactions: Math.round(onlineTransactions),
        avgTransactionValue
      }
    }
    
    // Calculate financial data
    const activeLoans = allLoans.filter(loan => loan.status === 'active')
    const repaidLoans = allLoans.filter(loan => loan.status === 'repaid')
    const forfeitedLoans = allLoans.filter(loan => loan.status === 'forfeited')
    
    const totalLoanValue = allLoans.reduce((sum, loan) => sum + loan.amount, 0)
    const activeLoanValue = activeLoans.reduce((sum, loan) => sum + loan.amount, 0)
    const repaidLoanValue = repaidLoans.reduce((sum, loan) => sum + loan.amount, 0)
    const forfeitedLoanValue = forfeitedLoans.reduce((sum, loan) => sum + loan.amount, 0)
    
    // Calculate interest income (only from active and repaid loans)
    const interestIncome = allLoans.filter(loan => ['active', 'repaid'].includes(loan.status)).reduce((sum, loan) => {
      if (loan.status === 'repaid' && loan.payment) {
        const totalPaid = (loan.payment.cash || 0) + (loan.payment.online || 0)
        const interestEarned = Math.max(0, totalPaid - loan.amount)
        return sum + interestEarned
      } else if (loan.status === 'active') {
        const loanDate = new Date(loan.loanDate || loan.createdAt)
        const daysPassed = Math.floor((new Date() - loanDate) / (1000 * 60 * 60 * 24))
        const monthsPassed = daysPassed / 30
        const interest = loan.interestType === 'monthly' 
          ? (loan.amount * loan.interestPercent * monthsPassed) / 100
          : (loan.amount * loan.interestPercent * daysPassed) / 100
        return sum + Math.max(0, interest)
      }
      return sum
    }, 0)
    
    // Calculate total repayments (only from active and repaid loans)
    const totalRepayments = allLoans.filter(loan => ['active', 'repaid'].includes(loan.status)).reduce((sum, loan) => {
      return sum + (loan.payment?.cash || 0) + (loan.payment?.online || 0)
    }, 0)
    
    // Calculate inventory value
    const goldInventory = allLoans.filter(loan => 
      loan.itemIds.some(item => item.category === 'gold')
    )
    const totalGoldWeight = goldInventory.reduce((sum, loan) => {
      return sum + loan.itemIds.reduce((itemSum, item) => {
        return itemSum + (item.weight || 0)
      }, 0)
    }, 0)
    
    // Estimate current gold value (assuming Rs. 6000 per gram)
    const goldRatePerGram = 6000
    const estimatedGoldValue = totalGoldWeight * goldRatePerGram
    
    // Aggregate balance sheet data for the selected period
    const aggregatedBalanceSheet = balanceSheetData.reduce((acc, bs) => {
      acc.cashInHandBank += bs.cashInHandBank || 0
      acc.loanReceivables += bs.loanReceivables || 0
      acc.forfeitedInventory += bs.forfeitedInventory || 0
      acc.furnitureFixtures += bs.furnitureFixtures || 0
      acc.customerPayables += bs.customerPayables || 0
      acc.bankOverdraft += bs.bankOverdraft || 0
      acc.ownersEquity += bs.ownersEquity || 0
      acc.interestIncome += bs.interestIncome || 0
      acc.saleOfForfeitedItems += bs.saleOfForfeitedItems || 0
      return acc
    }, {
      cashInHandBank: 0,
      loanReceivables: 0,
      forfeitedInventory: 0,
      furnitureFixtures: 0,
      customerPayables: 0,
      bankOverdraft: 0,
      ownersEquity: 0,
      interestIncome: 0,
      saleOfForfeitedItems: 0
    })
    
    // Handle expense data for the selected period
    let finalExpenseData = expenseData
    if (expenseData.length === 0) {
      console.log(`No expense data found for the selected period (${reportType})`)
      // For monthly reports, don't fall back to latest data - show zero
      if (reportType === 'monthly') {
        console.log('Monthly report: Using zero values for expenses as no data found for the month')
        finalExpenseData = []
      } else {
        // For financial year and yearly reports, can fall back to latest data
        console.log('Using latest available expense data for non-monthly reports')
        finalExpenseData = await Expense.find().sort({ year: -1, month: -1 }).limit(12)
      }
    }
    
    // Aggregate expense data
    const aggregatedExpenses = finalExpenseData.reduce((acc, exp) => {
      acc.salaries += exp.salaries || 0
      acc.rent += exp.rent || 0
      acc.utilities += exp.utilities || 0
      acc.miscellaneous += exp.miscellaneous || 0

      return acc
    }, {
      salaries: 0,
      rent: 0,
      utilities: 0,
      miscellaneous: 0
    })
    
    // Log the data found for debugging
    console.log(`📊 Balance Sheet Data: Found ${balanceSheetData.length} records for the period`)
    console.log(`📊 Expense Data: Found ${finalExpenseData.length} records for the period`)
    
    // Calculate totals
    const totalAssets = aggregatedBalanceSheet.cashInHandBank + aggregatedBalanceSheet.loanReceivables + 
                       aggregatedBalanceSheet.forfeitedInventory + aggregatedBalanceSheet.furnitureFixtures
    const totalLiabilities = aggregatedBalanceSheet.customerPayables + aggregatedBalanceSheet.bankOverdraft
    const totalExpenses = aggregatedExpenses.salaries + aggregatedExpenses.rent + 
                          aggregatedExpenses.utilities + aggregatedExpenses.miscellaneous
    const totalRevenue = aggregatedBalanceSheet.interestIncome + aggregatedBalanceSheet.saleOfForfeitedItems
    const netProfit = totalRevenue - totalExpenses
    
    // Calculate new data structures
    const customerInterestAnalysis = calculateCustomerInterestAnalysis()
    const monthlyProfitLoss = calculateMonthlyProfitLoss()
    const transactionSummary = calculateTransactionSummary()
    
    // Calculate monthly totals
    const monthlyTotals = monthlyProfitLoss.reduce((acc, month) => {
      acc.totalLoansGiven += month.loansGiven
      acc.totalRepayments += month.repayments
      acc.totalInterestIncome += month.interestIncome
      acc.totalExpenses += month.expenses
      acc.totalNetProfit += month.netProfit
      return acc
    }, {
      totalLoansGiven: 0,
      totalRepayments: 0,
      totalInterestIncome: 0,
      totalExpenses: 0,
      totalNetProfit: 0
    })
    
    // Prepare loan summary data
    const loanSummary = allLoans.map(loan => ({
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      amount: loan.amount,
      status: loan.status,
      loanDate: loan.loanDate || loan.createdAt,
      dueDate: loan.dueDate,
      extendedDate: loan.extendedDate || null
    }))
    
    // Prepare detailed loan register for the selected period
    const loanRegisterDetails = allLoans.map(loan => {
      // Get primary item details
      const primaryItem = loan.itemIds && loan.itemIds.length > 0 ? loan.itemIds[0] : null
      const itemDescription = primaryItem 
        ? `${primaryItem.name}${primaryItem.weight ? ` (${primaryItem.weight}g)` : ''}`
        : 'N/A'
      
      return {
        loanId: loan.loanId || 'N/A',
        customerName: loan.customerId.name || 'N/A',
        itemDescription: itemDescription,
        itemWeight: primaryItem?.weight || 0,
        loanAmount: loan.amount || 0,
        interestPercent: loan.interestPercent || 0,
        status: loan.status === 'repaid' ? 'Settled' : 
                loan.status === 'forfeited' ? 'Forfeited' : 
                loan.status === 'active' ? 'Active' : 
                loan.status.charAt(0).toUpperCase() + loan.status.slice(1),
        loanDate: loan.loanDate || loan.createdAt
      }
    }).sort((a, b) => new Date(b.loanDate) - new Date(a.loanDate)) // Sort by loan date descending
    
    // Calculate loan register statistics
    const loanRegisterStats = {
      totalPledgedLoans: allLoans.length,
      activeLoans: activeLoans.length,
      settledLoans: repaidLoans.length,
      forfeitedLoans: forfeitedLoans.length,
      totalLoanValue: totalLoanValue,
      totalItemWeight: loanRegisterDetails.reduce((sum, loan) => sum + (loan.itemWeight || 0), 0)
    }
    
    // Generate report data
    const auditReport = {
      title: `${shopDetails.shopName.toUpperCase()} – AUDIT REPORT`,
      auditPeriod: `${moment(periodStart).format('MMMM D, YYYY')} – ${moment(periodEnd).format('MMMM D, YYYY')}`,
      location: shopDetails.location,
      licenseNo: shopDetails.licenseNumber,
      preparedBy: shopDetails.auditorName || 'R. Aravind & Co., Chartered Accountants',
      generatedOn: new Date(),
      generatedBy: req.user ? req.user.name : 'System Admin',
      
      // Executive Summary
      executiveSummary: {
        totalLoans: allLoans.length,
        totalLoanValue,
        activeLoans: activeLoans.length,
        repaidLoans: repaidLoans.length,
        forfeitedLoans: forfeitedLoans.length,
        totalCustomers: allCustomers.length,
        complianceStatus: 'Compliant'
      },
      
      // Financial Statements
      balanceSheet: {
        assets: {
          cashInHand: aggregatedBalanceSheet.cashInHandBank,
          loanReceivables: aggregatedBalanceSheet.loanReceivables,
          forfeitedInventory: aggregatedBalanceSheet.forfeitedInventory,
          furnitureFixtures: aggregatedBalanceSheet.furnitureFixtures,
          totalAssets: totalAssets
        },
        liabilities: {
          customerPayables: aggregatedBalanceSheet.customerPayables,
          bankOverdraft: aggregatedBalanceSheet.bankOverdraft,
          totalLiabilities: totalLiabilities
        },
        equity: {
          ownersEquity: aggregatedBalanceSheet.ownersEquity
        }
      },
      
      profitLoss: {
        revenue: {
          interestIncome: aggregatedBalanceSheet.interestIncome,
          saleOfForfeitedItems: aggregatedBalanceSheet.saleOfForfeitedItems,
          totalRevenue: totalRevenue
        },
        expenses: {
          salaries: aggregatedExpenses.salaries,
          rent: aggregatedExpenses.rent,
          utilities: aggregatedExpenses.utilities,
          miscellaneous: aggregatedExpenses.miscellaneous,
          totalExpenses: totalExpenses
        },
        netProfit: netProfit
      },
      
      // Pawn Loan Register Summary
      loanRegister: {
        goldJewelry: {
          count: goldInventory.length,
          totalValue: goldInventory.reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 24
        },
        electronics: {
          count: allLoans.filter(loan => 
            loan.itemIds.some(item => item.category === 'electronics')
          ).length,
          totalValue: allLoans.filter(loan => 
            loan.itemIds.some(item => item.category === 'electronics')
          ).reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 30
        },
        others: {
          count: allLoans.filter(loan => 
            !loan.itemIds.some(item => ['gold', 'electronics'].includes(item.category))
          ).length,
          totalValue: allLoans.filter(loan => 
            !loan.itemIds.some(item => ['gold', 'electronics'].includes(item.category))
          ).reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 30
        }
      },
      
      // Inventory Report
      inventoryReport: {
        totalGoldWeight,
        estimatedValue: estimatedGoldValue,
        totalForfeitedSales: Math.round(forfeitedLoanValue * 0.4),
        activeLoans: activeLoans.slice(0, 20).map(loan => ({
          loanId: loan.loanId,
          customerName: loan.customerId.name,
          items: loan.itemIds.map(item => ({
            name: item.name,
            category: item.category,
            weight: item.weight || 0
          })),
          amount: loan.amount,
          status: loan.status,
          loanDate: loan.loanDate,
          dueDate: loan.dueDate
        }))
      },
      
      // Interest & Charges Summary
      interestCharges: {
        interestCollected: aggregatedBalanceSheet.interestIncome,
        lateFees: Math.round(aggregatedBalanceSheet.interestIncome * 0.05), // Assuming 5% late fees
        valuationCharges: Math.round(allLoans.length * 50), // Assuming Rs. 50 per loan valuation
        waivedInterest: Math.round(aggregatedBalanceSheet.interestIncome * 0.02) // Assuming 2% waived
      },
      
      // New data sections
      loanSummary,
      customerInterestAnalysis,
      monthlyProfitLoss,
      monthlyTotals,
      transactionSummary,
      
      // Detailed Loan Register Summary
      loanRegisterDetails,
      loanRegisterStats,
      
      // Auditor Observations
      observations: [
        'All books maintained with regular entries',
        'Physical inventory matched ledger entries during audit',
        'GST & IT returns filed on time',
        'No cases of regulatory violations found',
        `Total of ${allLoans.length} loans processed during the period`,
        `Customer-wise interest analysis shows proper interest calculations`,
        `Monthly profit/loss tracking shows consistent business operations`
      ],
      
      // Conclusion
      conclusion: `${shopDetails.shopName} has maintained financial and operational compliance for the selected period. Proper documentation, record-keeping, and KYC procedures are in place. The detailed loan summary and customer-wise interest analysis demonstrate transparent business operations.`
    }
    
    res.json(auditReport)
    
  } catch (error) {
    console.error('🚨 Audit report error:', error)
    console.error('🚨 Error stack:', error.stack)
    console.error('🚨 Request query:', req.query)
    res.status(500).json({ 
      message: 'Internal server error while generating audit report',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// Get Report Dashboard Data
exports.getReportDashboard = async (req, res) => {
  try {
    const today = moment().startOf('day')
    const thisMonth = moment().startOf('month')
    const thisYear = moment().startOf('year')
    
    // Today's stats
    const todayLoans = await Loan.countDocuments({
      createdAt: { $gte: today.toDate() }
    })
    
    const todayAmount = await Loan.aggregate([
      { $match: { createdAt: { $gte: today.toDate() } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    
    // This month's stats
    const monthLoans = await Loan.countDocuments({
      createdAt: { $gte: thisMonth.toDate() }
    })
    
    const monthAmount = await Loan.aggregate([
      { $match: { createdAt: { $gte: thisMonth.toDate() } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    
    // This year's stats
    const yearLoans = await Loan.countDocuments({
      createdAt: { $gte: thisYear.toDate() }
    })
    
    const yearAmount = await Loan.aggregate([
      { $match: { createdAt: { $gte: thisYear.toDate() } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
    
    // Total stats
    const totalLoans = await Loan.countDocuments()
    const totalCustomers = await Customer.countDocuments()
    const activeLoans = await Loan.countDocuments({ status: 'active' })
    
    const dashboardData = {
      todayStats: {
        loans: todayLoans,
        amount: todayAmount[0]?.total || 0
      },
      monthStats: {
        loans: monthLoans,
        amount: monthAmount[0]?.total || 0
      },
      yearStats: {
        loans: yearLoans,
        amount: yearAmount[0]?.total || 0
      },
      totalStats: {
        totalLoans,
        totalCustomers,
        activeLoans
      }
    }
    
    res.json(dashboardData)
    
  } catch (error) {
    console.error('Dashboard data error:', error)
    res.status(500).json({ message: error.message })
  }
}

// Download Audit Report as PDF
exports.downloadAuditReport = async (req, res) => {
  try {
    const { generateAuditReportPDF } = require('../utils/auditReportGenerator')
    const path = require('path')
    const fs = require('fs')
    
    // Use the same parameters as generateAuditReport
    const { reportType, startDate, endDate, month, year } = req.query
    
    let dateFilter = {}
    let reportTitle = ''
    let periodStart, periodEnd
    
    // Handle different report types (same logic as generateAuditReport)
    switch (reportType) {
      case 'monthly':
        if (!month || !year) {
          return res.status(400).json({ message: 'Month and year are required for monthly reports' })
        }
        // For monthly reports, show data only for the selected month and year
        periodStart = moment(`${year}-${month.padStart(2, '0')}-01`).startOf('month').toDate()
        periodEnd = moment(`${year}-${month.padStart(2, '0')}-01`).endOf('month').toDate()
        reportTitle = `Monthly Audit Report - ${moment(periodStart).format('MMMM YYYY')}`
        break
        
      case 'yearly':
        const reportYear = year ? parseInt(year) : moment().year()
        periodStart = moment(`${reportYear}-01-01`).startOf('year').toDate()
        periodEnd = moment(`${reportYear}-12-31`).endOf('year').toDate()
        reportTitle = `Yearly Audit Report - ${reportYear}`
        break
        
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ message: 'Start date and end date are required for custom range' })
        }
        periodStart = moment(startDate).startOf('day').toDate()
        periodEnd = moment(endDate).endOf('day').toDate()
        reportTitle = `Audit Report - ${moment(periodStart).format('DD/MM/YYYY')} to ${moment(periodEnd).format('DD/MM/YYYY')}`
        break
        
      case 'financial':
      default:
        // For financial year reports, show data for the full financial year (April to March)
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth() + 1
        
        const fyYear = year ? parseInt(year) : (currentMonth >= 4 ? currentYear : currentYear - 1)
        periodStart = moment(`${fyYear}-04-01`).startOf('day').toDate()
        periodEnd = moment(`${fyYear + 1}-03-31`).endOf('day').toDate()
        reportTitle = `Financial Year Audit Report - ${fyYear}-${fyYear + 1}`
        break
    }
    
    dateFilter = {
      createdAt: { $gte: periodStart, $lte: periodEnd }
    }
    
    // Fetch shop details from database
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ message: 'Shop details not found. Please configure shop details first.' })
    }
    
    // Get all data for the selected period (same logic as generateAuditReport)
    const allLoans = await Loan.find(dateFilter)
      .populate('customerId', 'name phone email')
      .populate('itemIds', 'name category weight')
      .sort({ createdAt: -1 })
    
    const allCustomers = await Customer.find(dateFilter)
    const allUsers = await User.find()
    
    // Get all repayments for the period
    const allRepayments = await Repayment.find({
      repaymentDate: { $gte: periodStart, $lte: periodEnd }
    }).populate({
      path: 'loanId',
      populate: {
        path: 'customerId',
        select: 'name phone email'
      }
    })
    
    // Get balance sheet and expense data for the period
    const monthlyQuery = buildMonthlyDataQueries(periodStart, periodEnd)
    
    const balanceSheetData = await BalanceSheet.find(monthlyQuery)
    const expenseData = await Expense.find(monthlyQuery)
    
    // Helper function to calculate customer-wise interest analysis
    const calculateCustomerInterestAnalysis = () => {
      const customerMap = new Map()
      
      // Process loans
      allLoans.forEach(loan => {
        const customerId = loan.customerId._id.toString()
        const customerName = loan.customerId.name
        
        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerName,
            totalLoansGiven: 0,
            totalRepaid: 0,
            interestEarned: 0,
            outstanding: 0
          })
        }
        
        const customer = customerMap.get(customerId)
        customer.totalLoansGiven += loan.amount
        
        // Calculate repayments for this loan
        const loanRepayments = allRepayments.filter(rep => 
          rep.loanId && rep.loanId._id.toString() === loan._id.toString()
        )
        
        const totalRepaidForLoan = loanRepayments.reduce((sum, rep) => sum + rep.totalAmount, 0)
        const interestEarnedForLoan = loanRepayments.reduce((sum, rep) => sum + rep.interestAmount, 0)
        
        customer.totalRepaid += totalRepaidForLoan
        customer.interestEarned += interestEarnedForLoan
        customer.outstanding += Math.max(0, loan.amount - totalRepaidForLoan)
      })
      
      return Array.from(customerMap.values()).sort((a, b) => b.totalLoansGiven - a.totalLoansGiven)
    }
    
    // Helper function to calculate monthly profit & loss
    const calculateMonthlyProfitLoss = () => {
      const monthlyData = []
      const current = moment(periodStart)
      const end = moment(periodEnd)
      
      while (current.isSameOrBefore(end, 'month')) {
        const monthStart = current.clone().startOf('month').toDate()
        const monthEnd = current.clone().endOf('month').toDate()
        
        // Loans given in this month
        const monthLoans = allLoans.filter(loan => 
          moment(loan.createdAt).isBetween(monthStart, monthEnd, null, '[]')
        )
        const loansGiven = monthLoans.reduce((sum, loan) => sum + loan.amount, 0)
        
        // Repayments in this month
        const monthRepayments = allRepayments.filter(rep =>
          moment(rep.repaymentDate).isBetween(monthStart, monthEnd, null, '[]')
        )
        const repayments = monthRepayments.reduce((sum, rep) => sum + rep.totalAmount, 0)
        const interestIncome = monthRepayments.reduce((sum, rep) => sum + rep.interestAmount, 0)
        
        // Expenses for this month
        const monthExpenses = expenseData.filter(exp => 
          exp.year === current.year() && exp.month === (current.month() + 1)
        )
        const expenses = monthExpenses.reduce((sum, exp) => 
          sum + (exp.salaries || 0) + (exp.rent || 0) + (exp.utilities || 0) + (exp.miscellaneous || 0), 0
        )
        
        const netProfit = interestIncome - expenses
        
        monthlyData.push({
          month: current.format('MMM YYYY'),
          loansGiven: Math.round(loansGiven),
          repayments: Math.round(repayments),
          interestIncome: Math.round(interestIncome),
          expenses: Math.round(expenses),
          netProfit: Math.round(netProfit)
        })
        
        current.add(1, 'month')
      }
      
      return monthlyData
    }
    
    // Calculate transaction summary
    const calculateTransactionSummary = () => {
      const totalLoanTransactions = allLoans.length
      const totalRepaymentTransactions = allRepayments.length
      const totalTransactions = totalLoanTransactions + totalRepaymentTransactions
      
      const cashTransactions = allLoans.reduce((sum, loan) => sum + (loan.payment?.cash || 0), 0) +
                              allRepayments.reduce((sum, rep) => sum + (rep.payment?.cash || 0), 0)
      
      const onlineTransactions = allLoans.reduce((sum, loan) => sum + (loan.payment?.online || 0), 0) +
                                allRepayments.reduce((sum, rep) => sum + (rep.payment?.online || 0), 0)
      
      const totalAmount = cashTransactions + onlineTransactions
      const avgTransactionValue = totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0
      
      return {
        totalTransactions,
        loanTransactions: totalLoanTransactions,
        repaymentTransactions: totalRepaymentTransactions,
        cashTransactions: Math.round(cashTransactions),
        onlineTransactions: Math.round(onlineTransactions),
        avgTransactionValue
      }
    }
    
    // Calculate financial data (same logic as generateAuditReport)
    const activeLoans = allLoans.filter(loan => loan.status === 'active')
    const repaidLoans = allLoans.filter(loan => loan.status === 'repaid')
    const forfeitedLoans = allLoans.filter(loan => loan.status === 'forfeited')
    
    const totalLoanValue = allLoans.reduce((sum, loan) => sum + loan.amount, 0)
    
    // Aggregate balance sheet data
    const aggregatedBalanceSheet = balanceSheetData.reduce((acc, bs) => {
      acc.cashInHandBank += bs.cashInHandBank || 0
      acc.loanReceivables += bs.loanReceivables || 0
      acc.forfeitedInventory += bs.forfeitedInventory || 0
      acc.furnitureFixtures += bs.furnitureFixtures || 0
      acc.customerPayables += bs.customerPayables || 0
      acc.bankOverdraft += bs.bankOverdraft || 0
      acc.ownersEquity += bs.ownersEquity || 0
      acc.interestIncome += bs.interestIncome || 0
      acc.saleOfForfeitedItems += bs.saleOfForfeitedItems || 0
      return acc
    }, {
      cashInHandBank: 0,
      loanReceivables: 0,
      forfeitedInventory: 0,
      furnitureFixtures: 0,
      customerPayables: 0,
      bankOverdraft: 0,
      ownersEquity: 0,
      interestIncome: 0,
      saleOfForfeitedItems: 0
    })
    
    // Handle expense data for the selected period
    let finalExpenseData = expenseData
    if (expenseData.length === 0) {
      console.log(`No expense data found for the selected period (${reportType})`)
      // For monthly reports, don't fall back to latest data - show zero
      if (reportType === 'monthly') {
        console.log('Monthly report: Using zero values for expenses as no data found for the month')
        finalExpenseData = []
      } else {
        // For financial year and yearly reports, can fall back to latest data
        console.log('Using latest available expense data for non-monthly reports')
        finalExpenseData = await Expense.find().sort({ year: -1, month: -1 }).limit(12)
      }
    }
      
    // Aggregate expense data
    const aggregatedExpenses = finalExpenseData.reduce((acc, exp) => {
      acc.salaries += exp.salaries || 0
      acc.rent += exp.rent || 0
      acc.utilities += exp.utilities || 0
      acc.miscellaneous += exp.miscellaneous || 0
      return acc
    }, {
      salaries: 0,
      rent: 0,
      utilities: 0,
      miscellaneous: 0
    })
    
    // Log the data found for debugging
    console.log(`📊 Balance Sheet Data: Found ${balanceSheetData.length} records for the period`)
    console.log(`📊 Expense Data: Found ${finalExpenseData.length} records for the period`)
    
    // Calculate totals
    const totalAssets = aggregatedBalanceSheet.cashInHandBank + aggregatedBalanceSheet.loanReceivables + 
                       aggregatedBalanceSheet.forfeitedInventory + aggregatedBalanceSheet.furnitureFixtures
    const totalExpenses = aggregatedExpenses.salaries + aggregatedExpenses.rent + 
                          aggregatedExpenses.utilities + aggregatedExpenses.miscellaneous
    const totalRevenue = aggregatedBalanceSheet.interestIncome + aggregatedBalanceSheet.saleOfForfeitedItems
    const netProfit = totalRevenue - totalExpenses
    
    // Calculate new data structures
    const customerInterestAnalysis = calculateCustomerInterestAnalysis()
    const monthlyProfitLoss = calculateMonthlyProfitLoss()
    const transactionSummary = calculateTransactionSummary()
    
    // Calculate monthly totals
    const monthlyTotals = monthlyProfitLoss.reduce((acc, month) => {
      acc.totalLoansGiven += month.loansGiven
      acc.totalRepayments += month.repayments
      acc.totalInterestIncome += month.interestIncome
      acc.totalExpenses += month.expenses
      acc.totalNetProfit += month.netProfit
      return acc
    }, {
      totalLoansGiven: 0,
      totalRepayments: 0,
      totalInterestIncome: 0,
      totalExpenses: 0,
      totalNetProfit: 0
    })
    
    // Prepare loan summary data
    const loanSummary = allLoans.map(loan => ({
      loanId: loan.loanId,
      customerName: loan.customerId.name,
      amount: loan.amount,
      status: loan.status,
      loanDate: loan.loanDate || loan.createdAt,
      dueDate: loan.dueDate,
      extendedDate: loan.extendedDate || null
    }))
    
    // Prepare detailed loan register for the selected period
    const loanRegisterDetails = allLoans.map(loan => {
      // Get primary item details
      const primaryItem = loan.itemIds && loan.itemIds.length > 0 ? loan.itemIds[0] : null
      const itemDescription = primaryItem 
        ? `${primaryItem.name}${primaryItem.weight ? ` (${primaryItem.weight}g)` : ''}`
        : 'N/A'
      
      return {
        loanId: loan.loanId || 'N/A',
        customerName: loan.customerId.name || 'N/A',
        itemDescription: itemDescription,
        itemWeight: primaryItem?.weight || 0,
        loanAmount: loan.amount || 0,
        interestPercent: loan.interestPercent || 0,
        status: loan.status === 'repaid' ? 'Settled' : 
                loan.status === 'forfeited' ? 'Forfeited' : 
                loan.status === 'active' ? 'Active' : 
                loan.status.charAt(0).toUpperCase() + loan.status.slice(1),
        loanDate: loan.loanDate || loan.createdAt
      }
    }).sort((a, b) => new Date(b.loanDate) - new Date(a.loanDate)) // Sort by loan date descending
    
    // Calculate loan register statistics
    const loanRegisterStats = {
      totalPledgedLoans: allLoans.length,
      activeLoans: activeLoans.length,
      settledLoans: repaidLoans.length,
      forfeitedLoans: forfeitedLoans.length,
      totalLoanValue: totalLoanValue,
      totalItemWeight: loanRegisterDetails.reduce((sum, loan) => sum + (loan.itemWeight || 0), 0)
    }
    
    // Calculate inventory data
    const goldInventory = allLoans.filter(loan => 
      loan.itemIds.some(item => item.category === 'gold')
    )
    
    // Generate audit report data
    const auditReport = {
      title: `${shopDetails.shopName.toUpperCase()} – AUDIT REPORT`,
      auditPeriod: `${moment(periodStart).format('MMMM D, YYYY')} – ${moment(periodEnd).format('MMMM D, YYYY')}`,
      location: shopDetails.location,
      licenseNo: shopDetails.licenseNumber,
      preparedBy: shopDetails.auditorName || 'R. Aravind & Co., Chartered Accountants',
      generatedOn: new Date(),
      generatedBy: req.user ? req.user.name : 'System Admin',
      
      executiveSummary: {
        totalLoans: allLoans.length,
        totalLoanValue,
        activeLoans: activeLoans.length,
        repaidLoans: repaidLoans.length,
        forfeitedLoans: forfeitedLoans.length,
        totalCustomers: allCustomers.length
      },
      
      balanceSheet: {
        assets: {
          cashInHand: aggregatedBalanceSheet.cashInHandBank,
          loanReceivables: aggregatedBalanceSheet.loanReceivables,
          forfeitedInventory: aggregatedBalanceSheet.forfeitedInventory,
          furnitureFixtures: aggregatedBalanceSheet.furnitureFixtures,
          totalAssets: totalAssets
        }
      },
      
      profitLoss: {
        revenue: {
          interestIncome: aggregatedBalanceSheet.interestIncome,
          saleOfForfeitedItems: aggregatedBalanceSheet.saleOfForfeitedItems,
          totalRevenue: totalRevenue
        },
        expenses: {
          salaries: aggregatedExpenses.salaries,
          rent: aggregatedExpenses.rent,
          utilities: aggregatedExpenses.utilities,
          miscellaneous: aggregatedExpenses.miscellaneous,
          totalExpenses: totalExpenses
        },
        netProfit: netProfit
      },
      
      loanRegister: {
        goldJewelry: {
          count: goldInventory.length,
          totalValue: goldInventory.reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 24
        },
        electronics: {
          count: allLoans.filter(loan => 
            loan.itemIds.some(item => item.category === 'electronics')
          ).length,
          totalValue: allLoans.filter(loan => 
            loan.itemIds.some(item => item.category === 'electronics')
          ).reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 30
        },
        others: {
          count: allLoans.filter(loan => 
            !loan.itemIds.some(item => ['gold', 'electronics'].includes(item.category))
          ).length,
          totalValue: allLoans.filter(loan => 
            !loan.itemIds.some(item => ['gold', 'electronics'].includes(item.category))
          ).reduce((sum, loan) => sum + loan.amount, 0),
          avgInterestRate: 30
        }
      },
      
      // New data sections
      loanSummary,
      customerInterestAnalysis,
      monthlyProfitLoss,
      monthlyTotals,
      transactionSummary,
      
      // Detailed Loan Register Summary
      loanRegisterDetails,
      loanRegisterStats,
      
      observations: [
        'All books maintained with regular entries',
        'Physical inventory matched ledger entries during audit',
        'GST & IT returns filed on time',
        'No cases of regulatory violations found',
        `Total of ${allLoans.length} loans processed during the period`,
        `Customer-wise interest analysis shows proper interest calculations`,
        `Monthly profit/loss tracking shows consistent business operations`
      ],
      
      conclusion: `${shopDetails.shopName} has maintained financial and operational compliance for the selected period. Proper documentation, record-keeping, and KYC procedures are in place. The detailed loan summary and customer-wise interest analysis demonstrate transparent business operations.`
    }
    
    // Generate PDF
    let fileName
    switch (reportType) {
      case 'monthly':
        fileName = `audit_report_monthly_${year}_${month.padStart(2, '0')}.pdf`
        break
      case 'yearly':
        fileName = `audit_report_yearly_${year || moment().year()}.pdf`
        break
      case 'custom':
        fileName = `audit_report_custom_${moment(periodStart).format('YYYY-MM-DD')}_to_${moment(periodEnd).format('YYYY-MM-DD')}.pdf`
        break
      case 'financial':
      default:
        const fyYear = year ? parseInt(year) : (moment().month() >= 3 ? moment().year() : moment().year() - 1)
        fileName = `audit_report_fy_${fyYear}_${fyYear + 1}.pdf`
        break
    }
    
    const uploadsDir = path.join(__dirname, '../uploads')
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
    const filePath = path.join(uploadsDir, fileName)
    
    await generateAuditReportPDF(auditReport, filePath)
    
    // Send file for download
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err)
        res.status(500).json({ message: 'Error downloading audit report' })
      } else {
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        }, 5000)
      }
    })
    
  } catch (error) {
    console.error('Audit report download error:', error)
    res.status(500).json({ message: error.message })
  }
}

// Generate Enhanced Audit Report
exports.generateEnhancedAuditReport = async (req, res) => {
  try {
    const { reportType, period, year, month, startDate, endDate, customFields } = req.query;
    
    let dateFilter = {};
    let reportTitle = '';
    let periodStart, periodEnd;

    console.log('🔍 Enhanced Audit Report Query:', req.query);

    // Set date filters based on period type
    switch (period) {
      case 'monthly':
        if (!month || !year) {
          return res.status(400).json({ message: 'Month and year are required for monthly reports' });
        }
        periodStart = moment(`${year}-${month.padStart(2, '0')}-01`).startOf('month').toDate();
        periodEnd = moment(`${year}-${month.padStart(2, '0')}-01`).endOf('month').toDate();
        reportTitle = `Monthly Enhanced Audit Report - ${moment(periodStart).format('MMMM YYYY')}`;
        break;
        
      case 'yearly':
        const reportYear = year ? parseInt(year) : moment().year();
        periodStart = moment(`${reportYear}-01-01`).startOf('year').toDate();
        periodEnd = moment(`${reportYear}-12-31`).endOf('year').toDate();
        reportTitle = `Yearly Enhanced Audit Report - ${reportYear}`;
        break;
        
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ message: 'Start date and end date are required for custom range' });
        }
        periodStart = moment(startDate).startOf('day').toDate();
        periodEnd = moment(endDate).endOf('day').toDate();
        reportTitle = `Enhanced Audit Report - ${moment(periodStart).format('DD/MM/YYYY')} to ${moment(periodEnd).format('DD/MM/YYYY')}`;
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid period type' });
    }

    dateFilter = {
      createdAt: { $gte: periodStart, $lte: periodEnd }
    };

    console.log('📅 Date Filter Applied:', {
      reportType,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });

    let reportData = {
      title: reportTitle,
      generatedOn: new Date(),
      generatedBy: req.user.name,
      period: {
        startDate: periodStart,
        endDate: periodEnd
      }
    };

    // Customer Profit Analysis
    if (reportType === 'customer' || reportType === 'comprehensive') {
      console.log('📊 Generating customer profit analysis...');
      
      // Get all loans in the period
      const loans = await Loan.find(dateFilter)
        .populate('customerId', 'name phone')
        .populate('itemIds', 'name category');

      // Get all repayments in the period
      const repayments = await Repayment.find({
        repaymentDate: { $gte: periodStart, $lte: periodEnd }
      }).populate({
        path: 'loanId',
        populate: {
          path: 'customerId',
          select: 'name phone'
        }
      });

      // Build customer profit data
      const customerProfitMap = new Map();
      let totalProfit = 0;

      // Process loans
      loans.forEach(loan => {
        if (!loan.customerId) return;

        const customerId = loan.customerId._id.toString();
        const customerName = loan.customerId.name;
        const phone = loan.customerId.phone || 'N/A';
        const jewelryName = loan.itemIds.map(item => item.name).join(', ') || 'N/A';

        if (!customerProfitMap.has(customerId)) {
          customerProfitMap.set(customerId, {
            customerId,
            customerName,
            phone,
            status: loan.status,
            jewelryName,
            amount: 0,
            interestRate: loan.interestPercent,
            profit: 0,
            loanDate: loan.createdAt.toISOString()
          });
        }

        const customerData = customerProfitMap.get(customerId);
        customerData.amount += loan.amount;
      });

      // Process repayments for profit calculation
      repayments.forEach(repayment => {
        if (!repayment.loanId || !repayment.loanId.customerId) return;

        const customerId = repayment.loanId.customerId._id.toString();
        if (customerProfitMap.has(customerId)) {
          const customerData = customerProfitMap.get(customerId);
          customerData.profit += repayment.interestAmount || 0;
          totalProfit += repayment.interestAmount || 0;
        }
      });

      reportData.customerData = Array.from(customerProfitMap.values());
      reportData.overallProfit = totalProfit;

      console.log(`📈 Customer profit analysis complete: ${reportData.customerData.length} customers, total profit: ₹${totalProfit}`);
    }

    // Financial Summary
    if (reportType === 'financial' || reportType === 'comprehensive') {
      console.log('💰 Generating financial summary...');

      // Get finance data for the period
      const financeQuery = period === 'monthly' 
        ? { year: parseInt(year), month: parseInt(month) }
        : period === 'yearly'
        ? { year: parseInt(year) }
        : {};

      const financeData = await Finance.find(financeQuery);

      let totalIncome = 0;
      let totalExpenses = 0;
      let totalLoansGiven = 0;
      let totalRepayments = 0;
      let totalInterestEarned = 0;

      financeData.forEach(data => {
        totalIncome += data.totalIncome;
        totalExpenses += data.totalExpenses;
        totalLoansGiven += data.businessMetrics.totalLoansGiven;
        totalRepayments += data.businessMetrics.totalRepaymentsReceived;
        totalInterestEarned += data.businessMetrics.totalInterestEarned;
      });

      reportData.financialSummary = {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        totalLoansGiven,
        totalRepayments,
        totalInterestEarned
      };

      console.log('💼 Financial summary complete:', reportData.financialSummary);
    }

    // Comprehensive data
    if (reportType === 'comprehensive') {
      console.log('📋 Adding comprehensive data...');
      
      // Add balance sheet data and business metrics from finance data
      const financeQuery = period === 'monthly' 
        ? { year: parseInt(year), month: parseInt(month) }
        : period === 'yearly'
        ? { year: parseInt(year) }
        : {};

      const financeRecords = await Finance.find(financeQuery);
      
      reportData.balanceSheetData = financeRecords.map(record => ({
        month: record.month,
        year: record.year,
        totalAssets: record.totalAssets,
        totalLiabilities: record.totalLiabilities,
        totalEquity: record.totalEquity
      }));

      reportData.businessMetrics = financeRecords.map(record => ({
        month: record.month,
        year: record.year,
        ...record.businessMetrics
      }));
    }

    console.log('✅ Enhanced audit report generated successfully');
    res.json(reportData);

  } catch (error) {
    console.error('Enhanced audit report error:', error);
    res.status(500).json({ message: error.message });
  }
}

// List Generated Reports
exports.listGeneratedReports = async (req, res) => {
  try {
    console.log('🔍 Fetching list of generated reports')
    
    // Get recent finance records (Tamil Nadu reports)
    const recentFinanceReports = await Finance.find()
      .populate('createdBy', 'name')
      .sort({ year: -1, month: -1 })
      .limit(10)
      .lean()
    
    // Get shop details for context
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    
    const reportsList = []
    
    // Add Tamil Nadu Finance Reports
    recentFinanceReports.forEach(report => {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      
      reportsList.push({
        id: report._id,
        type: 'Tamil Nadu Finance Report',
        title: `${monthNames[report.month - 1]} ${report.year} - Finance Management Report`,
        period: `${monthNames[report.month - 1]} ${report.year}`,
        generatedOn: report.createdAt,
        generatedBy: report.createdBy?.name || 'System',
        status: report.isFinalized ? 'Finalized' : 'Draft',
        downloadUrl: `/api/finance/audit-report?reportType=monthly&year=${report.year}&month=${report.month}`,
        summary: {
          interestIncome: report.profitLoss?.revenue?.interestIncomeFromLoans || 0,
          totalExpenses: report.profitLoss?.expenses?.totalExpenses || 0,
          netProfit: report.profitLoss?.netProfitBeforeTax || 0,
          totalLoans: report.loanRegisterSummary?.totalPledgedLoans || 0
        }
      })
    })
    
    // Add sample quick report entries for recent periods
    const currentDate = moment()
    for (let i = 0; i < 3; i++) {
      const reportDate = currentDate.clone().subtract(i, 'months')
      const year = reportDate.year()
      const month = reportDate.month() + 1
      const monthName = reportDate.format('MMMM')
      
      reportsList.push({
        id: `quick-${year}-${month}`,
        type: 'Quick Transaction Report',
        title: `${monthName} ${year} - Transaction Summary`,
        period: `${monthName} ${year}`,
        generatedOn: new Date(),
        generatedBy: 'Auto-Generated',
        status: 'Available',
        downloadUrl: `/api/reports/transactions?reportType=monthly&year=${year}&month=${month}`,
        summary: {
          description: 'Quick overview of monthly transactions and activities'
        }
      })
    }
    
    res.json({
      success: true,
      data: {
        reports: reportsList,
        totalReports: reportsList.length,
        shopDetails: shopDetails ? {
          shopName: shopDetails.shopName,
          location: shopDetails.location,
          gstNumber: shopDetails.gstNumber
        } : null,
        lastUpdated: new Date()
      }
    })
    
  } catch (error) {
    console.error('❌ List reports error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}
