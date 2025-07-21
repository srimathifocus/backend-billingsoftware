const Transaction = require("../models/transactionsModel");
const Loan = require("../models/Loan");
const Customer = require("../models/Customer");

exports.getTransactions = async (req, res) => {
  try {
    const { type, mode, startDate, endDate } = req.query;
    const filter = {};
    
    if (type) filter.type = type;
    if (mode) filter.mode = mode;
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const transactions = await Transaction.find(filter)
      .populate({
        path: 'loanId',
        select: 'loanId customerId amount',
        populate: {
          path: 'customerId',
          select: 'name phone'
        }
      })
      .sort({ date: -1 });
    
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTransactionSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    const summary = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: '$type',
            mode: '$mode'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          modes: {
            $push: {
              mode: '$_id.mode',
              amount: '$totalAmount',
              count: '$count'
            }
          },
          totalAmount: { $sum: '$totalAmount' },
          totalCount: { $sum: '$count' }
        }
      }
    ]);
    
    // Format the response to match frontend expectations
    const formattedSummary = {
      billing: {
        total: 0,
        count: 0,
        breakdown: {
          cash: { amount: 0, count: 0 },
          online: { amount: 0, count: 0 }
        }
      },
      repayment: {
        total: 0,
        count: 0,
        breakdown: {
          cash: { amount: 0, count: 0 },
          online: { amount: 0, count: 0 }
        }
      }
    };
    
    summary.forEach(item => {
      const type = item._id;
      if (type === 'billing' || type === 'repayment') {
        formattedSummary[type].total = item.totalAmount;
        formattedSummary[type].count = item.totalCount;
        
        item.modes.forEach(mode => {
          if (mode.mode === 'cash' || mode.mode === 'online') {
            formattedSummary[type].breakdown[mode.mode] = {
              amount: mode.amount,
              count: mode.count
            };
          }
        });
      }
    });
    
    res.status(200).json(formattedSummary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOverallStatistics = async (req, res) => {
  try {
    // Get overall transaction statistics
    const totalStats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);
    
    // Get breakdown by type and mode
    const typeBreakdown = await Transaction.aggregate([
      {
        $group: {
          _id: {
            type: '$type',
            mode: '$mode'
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get loan statistics
    const loanStats = await Loan.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalCash: { $sum: '$payment.cash' },
          totalOnline: { $sum: '$payment.online' }
        }
      }
    ]);
    
    res.status(200).json({
      totalTransactions: totalStats[0] || { totalAmount: 0, totalCount: 0 },
      typeBreakdown,
      loanStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};