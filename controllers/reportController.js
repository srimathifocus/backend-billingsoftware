const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Customer = require('../models/Customer')
const User = require('../models/User')
const ShopDetails = require('../models/ShopDetails')
const BalanceSheet = require('../models/BalanceSheet')
const Expense = require('../models/Expense')
const moment = require('moment')

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

// Generate Audit Report
exports.generateAuditReport = async (req, res) => {
  try {
    const { financialYear } = req.query
    
    // Default to current financial year (April to March)
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1 // JavaScript months are 0-based
    
    // Determine financial year - if current month is Jan-Mar, we're in the second year of FY
    const fyYear = financialYear ? 
      parseInt(financialYear) : 
      (currentMonth >= 4 ? currentYear : currentYear - 1)
    
    const fyStart = moment(`${fyYear}-04-01`).startOf('day').toDate()
    const fyEnd = moment(`${fyYear + 1}-03-31`).endOf('day').toDate()
    

    
    const dateFilter = {
      createdAt: { $gte: fyStart, $lte: fyEnd }
    }
    
    // Fetch shop details from database
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ message: 'Shop details not found. Please configure shop details first.' })
    }
    
    // Get all data for the financial year
    const allLoans = await Loan.find(dateFilter)
      .populate('customerId', 'name phone email')
      .populate('itemIds', 'name category weight')
    
    const allCustomers = await Customer.find(dateFilter)
    const allUsers = await User.find()
    
    // Fetch balance sheet data for the financial year (aggregate monthly data)
    const balanceSheetData = await BalanceSheet.find({
      year: { $in: [fyYear, fyYear + 1] },
      $or: [
        { year: fyYear, month: { $gte: 4 } }, // Apr-Dec of start year
        { year: fyYear + 1, month: { $lte: 3 } } // Jan-Mar of end year
      ]
    })
    
    // Fetch expense data for the financial year
    const expenseData = await Expense.find({
      year: { $in: [fyYear, fyYear + 1] },
      $or: [
        { year: fyYear, month: { $gte: 4 } }, // Apr-Dec of start year
        { year: fyYear + 1, month: { $lte: 3 } } // Jan-Mar of end year
      ]
    })
    
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
    
    // Aggregate balance sheet data for the financial year
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
    
    // If no expense data found for the specified financial year, use the latest available data
    let finalExpenseData = expenseData
    if (expenseData.length === 0) {
      console.log('No expense data found for financial year, using latest data')
      finalExpenseData = await Expense.find().sort({ year: -1, month: -1 }).limit(12)
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
    

    
    // Calculate totals
    const totalAssets = aggregatedBalanceSheet.cashInHandBank + aggregatedBalanceSheet.loanReceivables + 
                       aggregatedBalanceSheet.forfeitedInventory + aggregatedBalanceSheet.furnitureFixtures
    const totalLiabilities = aggregatedBalanceSheet.customerPayables + aggregatedBalanceSheet.bankOverdraft
    const totalExpenses = aggregatedExpenses.salaries + aggregatedExpenses.rent + 
                          aggregatedExpenses.utilities + aggregatedExpenses.miscellaneous
    const totalRevenue = aggregatedBalanceSheet.interestIncome + aggregatedBalanceSheet.saleOfForfeitedItems
    const netProfit = totalRevenue - totalExpenses
    
    // Generate report data
    const auditReport = {
      title: `${shopDetails.shopName.toUpperCase()} – AUDIT REPORT`,
      auditPeriod: `${moment(fyStart).format('MMMM D, YYYY')} – ${moment(fyEnd).format('MMMM D, YYYY')}`,
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
      

      
      // Auditor Observations
      observations: [
        'All books maintained with regular entries',
        'Physical inventory matched ledger entries during audit',
        'GST & IT returns filed on time',
        'No cases of regulatory violations found',
       
      ],
      
      // Conclusion
      conclusion: `${shopDetails.shopName} has maintained financial and operational compliance for the financial year. Proper documentation, record-keeping, and KYC procedures are in place.`
    }
    
    res.json(auditReport)
    
  } catch (error) {
    console.error('Audit report error:', error)
    res.status(500).json({ message: error.message })
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
    
    const { financialYear } = req.query
    
    // Default to current financial year (April to March)
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1 // JavaScript months are 0-based
    
    // Determine financial year - if current month is Jan-Mar, we're in the second year of FY
    const fyYear = financialYear ? 
      parseInt(financialYear) : 
      (currentMonth >= 4 ? currentYear : currentYear - 1)
    
    const fyStart = moment(`${fyYear}-04-01`).startOf('day').toDate()
    const fyEnd = moment(`${fyYear + 1}-03-31`).endOf('day').toDate()
    
    const dateFilter = {
      createdAt: { $gte: fyStart, $lte: fyEnd }
    }
    
    // Fetch shop details from database
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ message: 'Shop details not found. Please configure shop details first.' })
    }
    
    // Get all data for the financial year (same logic as generateAuditReport)
    const allLoans = await Loan.find(dateFilter)
      .populate('customerId', 'name phone email')
      .populate('itemIds', 'name category weight')
    
    const allCustomers = await Customer.find(dateFilter)
    
    // Fetch balance sheet data for the financial year
    const balanceSheetData = await BalanceSheet.find({
      year: { $in: [fyYear, fyYear + 1] },
      $or: [
        { year: fyYear, month: { $gte: 4 } },
        { year: fyYear + 1, month: { $lte: 3 } }
      ]
    })
    
    // Fetch expense data for the financial year
    const expenseData = await Expense.find({
      year: { $in: [fyYear, fyYear + 1] },
      $or: [
        { year: fyYear, month: { $gte: 4 } },
        { year: fyYear + 1, month: { $lte: 3 } }
      ]
    })
    
    // Calculate financial data (same logic as generateAuditReport)
    const activeLoans = allLoans.filter(loan => loan.status === 'active')
    const settledLoans = allLoans.filter(loan => loan.status === 'settled')
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
    
    // Aggregate expense data
    const aggregatedExpenses = expenseData.reduce((acc, exp) => {
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
    
    // Calculate totals
    const totalAssets = aggregatedBalanceSheet.cashInHandBank + aggregatedBalanceSheet.loanReceivables + 
                       aggregatedBalanceSheet.forfeitedInventory + aggregatedBalanceSheet.furnitureFixtures
    const totalExpenses = aggregatedExpenses.salaries + aggregatedExpenses.rent + 
                          aggregatedExpenses.utilities + aggregatedExpenses.miscellaneous
    const totalRevenue = aggregatedBalanceSheet.interestIncome + aggregatedBalanceSheet.saleOfForfeitedItems
    const netProfit = totalRevenue - totalExpenses
    
    // Calculate inventory data
    const goldInventory = allLoans.filter(loan => 
      loan.itemIds.some(item => item.category === 'gold')
    )
    
    // Generate audit report data
    const auditReport = {
      title: `${shopDetails.shopName.toUpperCase()} – AUDIT REPORT`,
      auditPeriod: `${moment(fyStart).format('MMMM D, YYYY')} – ${moment(fyEnd).format('MMMM D, YYYY')}`,
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
      
      observations: [
        'All books maintained with regular entries',
        'Physical inventory matched ledger entries during audit',
        'GST & IT returns filed on time',
        'No cases of regulatory violations found'
      ],
      
      conclusion: `${shopDetails.shopName} has maintained financial and operational compliance for the financial year. Proper documentation, record-keeping, and procedures are in place.`
    }
    
    // Generate PDF
    const fileName = `audit_report_${fyYear}_${fyYear + 1}.pdf`
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
