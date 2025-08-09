const Finance = require('../models/Finance')
const Expense = require('../models/Expense')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Customer = require('../models/Customer')
const ShopDetails = require('../models/ShopDetails')
const moment = require('moment')

// Helper function to calculate auto metrics from database
const calculateAutoMetrics = async (year, month) => {
  const startDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`).startOf('month').toDate()
  const endDate = moment(`${year}-${month.toString().padStart(2, '0')}-01`).endOf('month').toDate()
  
  console.log(`🔍 Calculating auto metrics for ${month}/${year}`, {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })

  // Get loans given in the month
  const loansInMonth = await Loan.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).populate('itemIds', 'name category weight')

  // Get repayments made in the month
  const repaymentsInMonth = await Repayment.find({
    repaymentDate: { $gte: startDate, $lte: endDate }
  })

  // Get new customers in the month
  const newCustomersCount = await Customer.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate }
  })

  // Get current active/settled/forfeited loan counts
  const [activeLoans, settledLoans, forfeitedLoans] = await Promise.all([
    Loan.countDocuments({ status: 'active' }),
    Loan.countDocuments({ status: 'repaid' }),
    Loan.countDocuments({ status: 'forfeited' })
  ])

  // Calculate totals
  const totalLoansGivenInMonth = loansInMonth.length
  const totalLoanAmountInMonth = loansInMonth.reduce((sum, loan) => sum + loan.amount, 0)
  const totalRepaymentsInMonth = repaymentsInMonth.reduce((sum, rep) => sum + rep.totalAmount, 0)
  const totalInterestEarnedInMonth = repaymentsInMonth.reduce((sum, rep) => sum + rep.interestAmount, 0)
  const totalLoanValue = await Loan.aggregate([
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]).then(result => result[0]?.total || 0)

  return {
    totalLoansGivenInMonth,
    totalLoanAmountInMonth,
    totalRepaymentsInMonth,
    totalInterestEarnedInMonth,
    newCustomersInMonth: newCustomersCount,
    loanRegisterSummary: {
      totalPledgedLoans: totalLoansGivenInMonth,
      activeLoans,
      settledLoans,
      forfeitedLoans,
      totalLoanValue,
      averageInterestRate: 24 // Default, can be calculated from actual loans
    },
    lastUpdated: new Date()
  }
}

// Create or Update Finance Data
exports.createOrUpdateFinanceData = async (req, res) => {
  try {
    const { year, month, financialYear, businessDetails, profitLoss, balanceSheet, compliance, auditorObservations } = req.body

    console.log('📊 Creating/Updating Finance Data:', { year, month, financialYear })
    console.log('📊 Request body keys:', Object.keys(req.body))

    // Calculate auto metrics
    const autoMetrics = await calculateAutoMetrics(year, month)

    // Check if data already exists
    const existingData = await Finance.findOne({ year, month })

    let financeData
    if (existingData) {
      // Update existing data
      financeData = await Finance.findByIdAndUpdate(
        existingData._id,
        {
          financialYear: financialYear || existingData.financialYear,
          businessDetails,
          profitLoss: {
            ...profitLoss,
            revenue: {
              ...profitLoss.revenue,
              interestIncomeFromLoans: autoMetrics.totalInterestEarnedInMonth // Auto-calculate from DB
            }
          },
          balanceSheet,
          compliance,
          auditorObservations,
          autoCalculatedMetrics: autoMetrics,
          loanRegisterSummary: autoMetrics.loanRegisterSummary,
          updatedBy: req.user.id
        },
        { new: true, runValidators: true }
      )
      console.log('✅ Finance data updated successfully')
    } else {
      // Create new data
      financeData = new Finance({
        year,
        month,
        financialYear: financialYear || `${year}-${(year + 1).toString().slice(-2)}`, // Auto-generate if not provided
        businessDetails,
        profitLoss: {
          ...profitLoss,
          revenue: {
            ...profitLoss.revenue,
            interestIncomeFromLoans: autoMetrics.totalInterestEarnedInMonth // Auto-calculate from DB
          }
        },
        balanceSheet,
        compliance,
        auditorObservations,
        autoCalculatedMetrics: autoMetrics,
        loanRegisterSummary: autoMetrics.loanRegisterSummary,
        createdBy: req.user.id
      })
      await financeData.save()
      console.log('✅ Finance data created successfully')
    }

    res.status(existingData ? 200 : 201).json({
      success: true,
      message: `Finance data ${existingData ? 'updated' : 'created'} successfully`,
      data: financeData
    })

  } catch (error) {
    console.error('❌ Finance data error:', error)
    console.error('❌ Full error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errors: error.errors // For mongoose validation errors
    })
    res.status(500).json({ 
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error : {}
    })
  }
}

// Get Finance Data with Auto-calculated Metrics
exports.getFinanceDataWithMetrics = async (req, res) => {
  try {
    const { year, month } = req.query
    
    if (!year || !month) {
      return res.status(400).json({ 
        success: false,
        message: 'Year and month are required' 
      })
    }

    console.log(`🔍 Fetching finance data for ${month}/${year}`)

    // Get shop details for business information
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ 
        success: false,
        message: 'Shop details not found. Please configure shop details first.' 
      })
    }

    // Get existing finance data
    let financeData = await Finance.findOne({ 
      year: parseInt(year), 
      month: parseInt(month) 
    }).populate('createdBy', 'name').populate('updatedBy', 'name')

    // Calculate fresh auto metrics
    const autoMetrics = await calculateAutoMetrics(parseInt(year), parseInt(month))

    if (!financeData) {
      // Create default structure with auto-calculated metrics using shop details
      financeData = {
        year: parseInt(year),
        month: parseInt(month),
        businessDetails: {
          proprietorName: shopDetails.shopName || '',
          gstin: shopDetails.gstNumber || '',
          pan: '',
          shopType: 'Pawnbroking & Jewellery Sales',
          accountingSoftware: 'Custom Pawnshop Management System',
          licenseNo: shopDetails.licenseNumber || '',
          location: shopDetails.location || '',
          auditFirm: shopDetails.auditorName || ''
        },
        profitLoss: {
          revenue: {
            interestIncomeFromLoans: autoMetrics.totalInterestEarnedInMonth,
            saleOfForfeitedItems: 0,
            otherOperatingIncome: 0,
            totalRevenue: autoMetrics.totalInterestEarnedInMonth
          },
          expenses: {
            employeeSalaries: 0,
            officeRent: 0,
            goldAppraiserCharges: 0,
            utilitiesInternet: 0,
            accountingAuditFees: 0,
            miscellaneousExpenses: 0,
            totalExpenses: 0
          },
          netProfitBeforeTax: autoMetrics.totalInterestEarnedInMonth
        },
        balanceSheet: {
          assets: {
            cashInHandBank: 0,
            goldLoanReceivables: 0,
            inventoryForfeitedItems: 0,
            officeEquipment: 0,
            totalAssets: 0
          },
          liabilitiesEquity: {
            proprietorCapital: 0,
            sundryCreditors: 0,
            taxesPayableGST: 0,
            totalLiabilitiesEquity: 0
          }
        },
        compliance: {
          kycCollection: 100,
          panForHighValueLoans: 0,
          cctvInstalled: true,
          goldAppraisalByAuthorizedValuer: true,
          authorizedValuerName: '',
          insuranceOnPledgedGold: 0,
          gstFilingStatus: 'Regular',
          itReturnsStatus: 'Filed',
          registersMaintenanceStatus: 'Physical & Digital'
        },
        auditorObservations: {
          observations: [],
          conclusion: '',
          auditorName: '',
          auditorQualification: '',
          membershipNo: '',
          auditDate: new Date()
        },
        autoCalculatedMetrics: autoMetrics,
        loanRegisterSummary: autoMetrics.loanRegisterSummary,
        isNew: true
      }
    } else {
      // Update auto-calculated metrics in existing data
      financeData.autoCalculatedMetrics = autoMetrics
      financeData.loanRegisterSummary = autoMetrics.loanRegisterSummary
      financeData.profitLoss.revenue.interestIncomeFromLoans = autoMetrics.totalInterestEarnedInMonth
      
      // Auto-update business details from shop details if empty
      if (!financeData.businessDetails.proprietorName) {
        financeData.businessDetails.proprietorName = shopDetails.shopName || ''
      }
      if (!financeData.businessDetails.gstin) {
        financeData.businessDetails.gstin = shopDetails.gstNumber || ''
      }
      if (!financeData.businessDetails.licenseNo) {
        financeData.businessDetails.licenseNo = shopDetails.licenseNumber || ''
      }
      if (!financeData.businessDetails.location) {
        financeData.businessDetails.location = shopDetails.location || ''
      }
      if (!financeData.businessDetails.auditFirm) {
        financeData.businessDetails.auditFirm = shopDetails.auditorName || ''
      }
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    res.json({
      success: true,
      data: financeData,
      autoMetrics,
      period: {
        year: parseInt(year),
        month: parseInt(month),
        monthName: monthNames[parseInt(month) - 1]
      }
    })

  } catch (error) {
    console.error('❌ Get finance data error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Get All Finance Data
exports.getAllFinanceData = async (req, res) => {
  try {
    const financeData = await Finance.find()
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ year: -1, month: -1 })

    res.json({
      success: true,
      data: financeData
    })

  } catch (error) {
    console.error('❌ Get all finance data error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Delete Finance Data
exports.deleteFinanceData = async (req, res) => {
  try {
    const financeData = await Finance.findByIdAndDelete(req.params.id)

    if (!financeData) {
      return res.status(404).json({ 
        success: false,
        message: 'Finance data not found' 
      })
    }

    res.json({
      success: true,
      message: 'Finance data deleted successfully'
    })

  } catch (error) {
    console.error('❌ Delete finance data error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Generate Tamil Nadu Audit Report
exports.generateTamilNaduAuditReport = async (req, res) => {
  try {
    const { reportType, year, month, startDate, endDate } = req.query
    
    console.log('🔍 Generating Tamil Nadu Audit Report:', req.query)

    let periodStart, periodEnd, reportTitle, financeQuery

    // Handle different report types
    switch (reportType) {
      case 'monthly':
        if (!month || !year) {
          return res.status(400).json({ 
            success: false,
            message: 'Month and year are required for monthly reports' 
          })
        }
        periodStart = moment(`${year}-${month.padStart(2, '0')}-01`).startOf('month').toDate()
        periodEnd = moment(`${year}-${month.padStart(2, '0')}-01`).endOf('month').toDate()
        reportTitle = `Monthly Audit Report - ${moment(periodStart).format('MMMM YYYY')}`
        financeQuery = { year: parseInt(year), month: parseInt(month) }
        break
        
      case 'yearly':
        const reportYear = year ? parseInt(year) : moment().year()
        periodStart = moment(`${reportYear}-01-01`).startOf('year').toDate()
        periodEnd = moment(`${reportYear}-12-31`).endOf('year').toDate()
        reportTitle = `Yearly Audit Report - ${reportYear}`
        financeQuery = { year: reportYear }
        break
        
      case 'financial':
        const fyYear = year ? parseInt(year) : (moment().month() >= 3 ? moment().year() : moment().year() - 1)
        periodStart = moment(`${fyYear}-04-01`).startOf('day').toDate()
        periodEnd = moment(`${fyYear + 1}-03-31`).endOf('day').toDate()
        reportTitle = `Financial Year Audit Report - ${fyYear}-${fyYear + 1}`
        financeQuery = { financialYear: `${fyYear}-${(fyYear + 1).toString().slice(-2)}` }
        break
        
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ 
            success: false,
            message: 'Start date and end date are required for custom range' 
          })
        }
        periodStart = moment(startDate).startOf('day').toDate()
        periodEnd = moment(endDate).endOf('day').toDate()
        reportTitle = `Audit Report - ${moment(periodStart).format('DD/MM/YYYY')} to ${moment(periodEnd).format('DD/MM/YYYY')}`
        financeQuery = {} // Will need to handle date range for custom
        break
        
      default:
        return res.status(400).json({ 
          success: false,
          message: 'Invalid report type' 
        })
    }

    // Get shop details
    const shopDetails = await ShopDetails.findOne({ isActive: true })
    if (!shopDetails) {
      return res.status(404).json({ 
        success: false,
        message: 'Shop details not found. Please configure shop details first.' 
      })
    }

    // Get finance data for the period
    const financeData = await Finance.find(financeQuery)
      .populate('createdBy', 'name')
      .sort({ year: 1, month: 1 })

    // Get loans for the period
    const loans = await Loan.find({
      createdAt: { $gte: periodStart, $lte: periodEnd }
    }).populate('customerId', 'name phone email')
      .populate('itemIds', 'name category weight')

    // Get repayments for the period
    const repayments = await Repayment.find({
      repaymentDate: { $gte: periodStart, $lte: periodEnd }
    }).populate({
      path: 'loanId',
      populate: {
        path: 'customerId',
        select: 'name phone email'
      }
    })

    // Get expense data for the period
    let expenseData = []
    if (reportType === 'monthly') {
      const expense = await Expense.findOne({ 
        month: parseInt(month), 
        year: parseInt(year) 
      })
      if (expense) expenseData.push(expense)
    } else if (reportType === 'yearly') {
      expenseData = await Expense.find({ year: parseInt(year) })
    } else if (reportType === 'financial') {
      const fyYear = parseInt(year)
      // Financial year runs from April to March
      const currentYearExpenses = await Expense.find({ 
        year: fyYear,
        month: { $gte: 4 } // April to December
      })
      const nextYearExpenses = await Expense.find({ 
        year: fyYear + 1,
        month: { $lte: 3 } // January to March
      })
      expenseData = [...currentYearExpenses, ...nextYearExpenses]
    } else if (reportType === 'custom') {
      const startYear = moment(periodStart).year()
      const endYear = moment(periodEnd).year()
      const startMonth = moment(periodStart).month() + 1
      const endMonth = moment(periodEnd).month() + 1
      
      if (startYear === endYear) {
        expenseData = await Expense.find({
          year: startYear,
          month: { $gte: startMonth, $lte: endMonth }
        })
      } else {
        const firstYearExpenses = await Expense.find({
          year: startYear,
          month: { $gte: startMonth }
        })
        const lastYearExpenses = await Expense.find({
          year: endYear,
          month: { $lte: endMonth }
        })
        const middleYearExpenses = []
        for (let y = startYear + 1; y < endYear; y++) {
          const yearExpenses = await Expense.find({ year: y })
          middleYearExpenses.push(...yearExpenses)
        }
        expenseData = [...firstYearExpenses, ...middleYearExpenses, ...lastYearExpenses]
      }
    }

    // Calculate aggregated data
    let aggregatedData = {
      businessDetails: financeData[0]?.businessDetails || {},
      profitLoss: {
        revenue: {
          interestIncomeFromLoans: 0,
          saleOfForfeitedItems: 0,
          otherOperatingIncome: 0,
          totalRevenue: 0
        },
        expenses: {
          employeeSalaries: 0,
          officeRent: 0,
          goldAppraiserCharges: 0,
          utilitiesInternet: 0,
          accountingAuditFees: 0,
          miscellaneousExpenses: 0,
          totalExpenses: 0
        },
        netProfitBeforeTax: 0
      },
      balanceSheet: {
        assets: {
          cashInHandBank: 0,
          goldLoanReceivables: 0,
          inventoryForfeitedItems: 0,
          officeEquipment: 0,
          totalAssets: 0
        },
        liabilitiesEquity: {
          proprietorCapital: 0,
          sundryCreditors: 0,
          taxesPayableGST: 0,
          totalLiabilitiesEquity: 0
        }
      },
      loanRegisterSummary: {
        totalPledgedLoans: 0,
        activeLoans: 0,
        settledLoans: 0,
        forfeitedLoans: 0,
        totalLoanValue: 0,
        averageInterestRate: 24
      },
      compliance: financeData[0]?.compliance || {},
      auditorObservations: financeData[0]?.auditorObservations || {}
    }

    // Calculate loan register summary from period-specific loans
    const activeLoansCount = loans.filter(loan => loan.status === 'active').length
    const settledLoansCount = loans.filter(loan => loan.status === 'repaid').length
    const forfeitedLoansCount = loans.filter(loan => loan.status === 'forfeited').length
    
    const totalLoanValue = loans.reduce((sum, loan) => sum + loan.amount, 0)
    const totalPledgedLoans = loans.length
    
    // Calculate average interest rate from actual loans
    const averageInterestRate = loans.length > 0 
      ? Math.round(loans.reduce((sum, loan) => sum + (loan.interestPercent || 24), 0) / loans.length * 10) / 10
      : 24

    console.log('📊 Period-specific Loan Statistics:', {
      totalPledgedLoans,
      activeLoansCount,
      settledLoansCount, 
      forfeitedLoansCount,
      totalLoanValue,
      averageInterestRate,
      loanRecords: loans.length
    })
    
    // Update loan register summary with period-specific data
    aggregatedData.loanRegisterSummary = {
      totalPledgedLoans,
      activeLoans: activeLoansCount,
      settledLoans: settledLoansCount,
      forfeitedLoans: forfeitedLoansCount,
      totalLoanValue,
      averageInterestRate: averageInterestRate
    }

    // Aggregate finance data
    financeData.forEach(data => {
      // Sum up profit & loss revenue
      aggregatedData.profitLoss.revenue.interestIncomeFromLoans += data.profitLoss.revenue.interestIncomeFromLoans
      aggregatedData.profitLoss.revenue.saleOfForfeitedItems += data.profitLoss.revenue.saleOfForfeitedItems
      aggregatedData.profitLoss.revenue.otherOperatingIncome += data.profitLoss.revenue.otherOperatingIncome
      
      // Use latest balance sheet data
      if (data.balanceSheet) {
        aggregatedData.balanceSheet = data.balanceSheet
      }
    })

    // Aggregate expense data from Expense model
    console.log('🔍 Expense data found:', expenseData.length, 'records')
    expenseData.forEach(expense => {
      console.log('📊 Processing expense:', expense.month, expense.year, expense.totalExpenses)
      aggregatedData.profitLoss.expenses.employeeSalaries += expense.salaries || 0
      aggregatedData.profitLoss.expenses.officeRent += expense.rent || 0
      aggregatedData.profitLoss.expenses.utilitiesInternet += expense.utilities || 0
      aggregatedData.profitLoss.expenses.miscellaneousExpenses += expense.miscellaneous || 0
      aggregatedData.profitLoss.expenses.goldAppraiserCharges += expense.goldAppraiserCharges || 0
      aggregatedData.profitLoss.expenses.accountingAuditFees += expense.accountingAuditFees || 0
    })

    // Calculate totals
    aggregatedData.profitLoss.revenue.totalRevenue = 
      aggregatedData.profitLoss.revenue.interestIncomeFromLoans + 
      aggregatedData.profitLoss.revenue.saleOfForfeitedItems + 
      aggregatedData.profitLoss.revenue.otherOperatingIncome

    aggregatedData.profitLoss.expenses.totalExpenses = 
      aggregatedData.profitLoss.expenses.employeeSalaries + 
      aggregatedData.profitLoss.expenses.officeRent + 
      aggregatedData.profitLoss.expenses.goldAppraiserCharges + 
      aggregatedData.profitLoss.expenses.utilitiesInternet + 
      aggregatedData.profitLoss.expenses.accountingAuditFees + 
      aggregatedData.profitLoss.expenses.miscellaneousExpenses

    aggregatedData.profitLoss.netProfitBeforeTax = 
      aggregatedData.profitLoss.revenue.totalRevenue - aggregatedData.profitLoss.expenses.totalExpenses

    // Generate loan register details
    const loanRegisterDetails = loans.map(loan => ({
      loanId: loan.loanId || loan._id.toString().slice(-6).toUpperCase(),
      customerName: loan.customerId?.name || 'N/A',
      itemDescription: loan.itemIds?.map(item => item.name).join(', ') || 'N/A',
      itemWeight: loan.itemIds?.reduce((sum, item) => sum + (item.weight || 0), 0) || 0,
      loanAmount: loan.amount,
      interestPercent: loan.interestPercent,
      status: loan.status === 'repaid' ? 'Settled' : loan.status === 'forfeited' ? 'Forfeited' : 'Active',
      loanDate: moment(loan.createdAt).format('DD/MM/YYYY')
    }))

    const reportData = {
      title: reportTitle,
      generatedOn: new Date(),
      generatedBy: req.user.name,
      period: {
        startDate: periodStart,
        endDate: periodEnd
      },
      shopDetails: {
        name: shopDetails.shopName,
        licenseNo: aggregatedData.businessDetails.licenseNo || shopDetails.licenseNumber,
        location: aggregatedData.businessDetails.location || shopDetails.address,
        proprietorName: aggregatedData.businessDetails.proprietorName || shopDetails.ownerName,
        gstin: aggregatedData.businessDetails.gstin || shopDetails.gstNumber,
        pan: aggregatedData.businessDetails.pan || shopDetails.panNumber
      },
      businessDetails: aggregatedData.businessDetails,
      profitLoss: aggregatedData.profitLoss,
      balanceSheet: aggregatedData.balanceSheet,
      loanRegisterSummary: aggregatedData.loanRegisterSummary,
      loanRegisterDetails: loanRegisterDetails, // Show all period-specific loan records
      compliance: aggregatedData.compliance,
      auditorObservations: aggregatedData.auditorObservations,
      
      // Additional calculated data
      summary: {
        totalLoansIssued: loans.length,
        totalLoanAmount: loans.reduce((sum, loan) => sum + loan.amount, 0),
        totalRepayments: repayments.length,
        totalRepaymentAmount: repayments.reduce((sum, rep) => sum + rep.totalAmount, 0),
        totalInterestEarned: repayments.reduce((sum, rep) => sum + rep.interestAmount, 0)
      }
    }

    console.log('✅ Tamil Nadu audit report generated successfully')
    res.json({
      success: true,
      data: reportData
    })

  } catch (error) {
    console.error('❌ Tamil Nadu audit report error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}

// Finalize Finance Data (Lock for editing)
exports.finalizeFinanceData = async (req, res) => {
  try {
    const { id } = req.params

    const financeData = await Finance.findByIdAndUpdate(
      id,
      {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedBy: req.user.id
      },
      { new: true }
    )

    if (!financeData) {
      return res.status(404).json({ 
        success: false,
        message: 'Finance data not found' 
      })
    }

    res.json({
      success: true,
      message: 'Finance data finalized successfully',
      data: financeData
    })

  } catch (error) {
    console.error('❌ Finalize finance data error:', error)
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
}