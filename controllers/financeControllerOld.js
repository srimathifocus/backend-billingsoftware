const Finance = require('../models/Finance')
const Loan = require('../models/Loan')
const Repayment = require('../models/Repayment')
const Customer = require('../models/Customer')
const ShopDetails = require('../models/ShopDetails')
const moment = require('moment');

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
    const { year, month, businessDetails, profitLoss, balanceSheet, compliance, auditorObservations } = req.body

    console.log('📊 Creating/Updating Finance Data:', { year, month })

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
    res.status(500).json({ 
      success: false,
      message: error.message 
    })
  }
};

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

    // Get existing finance data
    let financeData = await Finance.findOne({ 
      year: parseInt(year), 
      month: parseInt(month) 
    }).populate('createdBy', 'name').populate('updatedBy', 'name')

    // Calculate fresh auto metrics
    const autoMetrics = await calculateAutoMetrics(parseInt(year), parseInt(month))

    if (!financeData) {
      // Create default structure with auto-calculated metrics
      financeData = {
        year: parseInt(year),
        month: parseInt(month),
        businessDetails: {
          proprietorName: '',
          gstin: '',
          pan: '',
          shopType: 'Pawnbroking & Jewellery Sales',
          accountingSoftware: 'Custom Pawnshop Management System',
          licenseNo: '',
          location: '',
          auditFirm: ''
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
};

// Delete Finance Data
exports.deleteFinanceData = async (req, res) => {
  try {
    const financeData = await Finance.findByIdAndDelete(req.params.id)

    if (!financeData) {
      return res.status(404).json({ message: 'Finance data not found' });
    }

    res.json({
      success: true,
      message: 'Finance data deleted successfully'
    });

  } catch (error) {
    console.error('Delete finance data error:', error);
    res.status(500).json({ message: error.message });
  }
};

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
};

// Get finance data with auto-calculated metrics from database
exports.getFinanceDataWithMetrics = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month are required' });
    }

    const currentYear = parseInt(year);
    const currentMonth = parseInt(month);
    
    // Calculate start and end dates for the month
    const startDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).startOf('month');
    const endDate = moment(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`).endOf('month');
    
    console.log(`🔍 Calculating metrics for ${currentMonth}/${currentYear}`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Calculate business metrics from database
    const [
      totalLoansGiven,
      totalRepayments,
      totalInterestEarned,
      newCustomers,
      activeLoans,
      repaidLoans,
      totalOperationalCosts
    ] = await Promise.all([
      // Total loans given in the month
      Loan.countDocuments({
        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
      }),
      
      // Total repayments received in the month
      Repayment.aggregate([
        {
          $match: {
            repaymentDate: { $gte: startDate.toDate(), $lte: endDate.toDate() }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Total interest earned in the month
      Repayment.aggregate([
        {
          $match: {
            repaymentDate: { $gte: startDate.toDate(), $lte: endDate.toDate() }
          }
        },
        {
          $group: {
            _id: null,
            totalInterest: { $sum: '$interestAmount' }
          }
        }
      ]),
      
      // New customers created in the month
      Customer.countDocuments({
        createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
      }),
      
      // Active loans (not repaid)
      Loan.countDocuments({
        status: 'active'
      }),
      
      // Repaid loans
      Loan.countDocuments({
        status: 'repaid'
      }),
      
      // Total operational costs from expenses
      Expense.aggregate([
        {
          $match: {
            year: currentYear,
            month: currentMonth
          }
        },
        {
          $group: {
            _id: null,
            totalCosts: {
              $sum: {
                $add: [
                  { $ifNull: ['$salaries', 0] },
                  { $ifNull: ['$rent', 0] },
                  { $ifNull: ['$utilities', 0] },
                  { $ifNull: ['$miscellaneous', 0] }
                ]
              }
            }
          }
        }
      ])
    ]);

    // Calculate loan amounts
    const loanAmounts = await Loan.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const businessMetrics = {
      totalLoansGiven: totalLoansGiven || 0,
      totalLoanAmount: loanAmounts[0]?.totalAmount || 0,
      totalRepaymentsReceived: totalRepayments[0]?.totalAmount || 0,
      totalRepaymentCount: totalRepayments[0]?.count || 0,
      totalInterestEarned: totalInterestEarned[0]?.totalInterest || 0,
      totalOperationalCosts: totalOperationalCosts[0]?.totalCosts || 0,
      newCustomers: newCustomers || 0,
      activeLoans: activeLoans || 0,
      repaidLoans: repaidLoans || 0,
      totalProfit: (totalInterestEarned[0]?.totalInterest || 0) - (totalOperationalCosts[0]?.totalCosts || 0)
    };

    // Check if finance data already exists for this month
    let financeData = await Finance.findOne({ year: currentYear, month: currentMonth });
    
    if (!financeData) {
      // Return default data structure with calculated metrics
      financeData = {
        year: currentYear,
        month: currentMonth,
        expenses: {
          rent: 0,
          salaries: 0,
          utilities: 0,
          electricity: 0,
          water: 0,
          internet: 0,
          security: 0,
          maintenance: 0,
          officeSupplies: 0,
          miscellaneous: 0
        },
        income: {
          loanInterest: businessMetrics.totalInterestEarned,
          serviceCharges: 0,
          otherIncome: 0
        },
        balanceSheet: {
          assets: {
            cash: 0,
            loans: businessMetrics.totalLoanAmount,
            inventory: 0,
            equipment: 0,
            otherAssets: 0
          },
          liabilities: {
            accountsPayable: 0,
            loans: 0,
            otherLiabilities: 0
          },
          equity: {
            ownerEquity: 0,
            retainedEarnings: businessMetrics.totalProfit
          }
        },
        businessMetrics,
        isAutoCalculated: true
      };
    } else {
      // Update existing finance data with calculated metrics
      financeData.businessMetrics = businessMetrics;
      financeData.income.loanInterest = businessMetrics.totalInterestEarned;
      financeData.balanceSheet.assets.loans = businessMetrics.totalLoanAmount;
      financeData.balanceSheet.equity.retainedEarnings = businessMetrics.totalProfit;
    }

    console.log('✅ Business metrics calculated:', businessMetrics);

    res.json({
      success: true,
      data: financeData,
      metrics: businessMetrics,
      period: {
        year: currentYear,
        month: currentMonth,
        monthName: moment(`${currentYear}-${currentMonth}-01`).format('MMMM YYYY')
      }
    });

  } catch (error) {
    console.error('Get finance data with metrics error:', error);
    res.status(500).json({ message: error.message });
  }
};