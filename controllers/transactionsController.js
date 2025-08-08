const Transaction = require("../models/transactionsModel");
const Loan = require("../models/Loan");
const Customer = require("../models/Customer");

exports.getTransactions = async (req, res) => {
  try {
    const { type, mode, startDate, endDate } = req.query;
    console.log("🔍 Transaction filter request:", { type, mode, startDate, endDate });
    
    const filter = {};
    
    if (type) filter.type = type;
    if (mode) filter.mode = mode;
    if (startDate && endDate) {
      // Create proper date range - start of startDate to end of endDate
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      
      filter.date = {
        $gte: start,
        $lte: end,
      };
    } else if (startDate) {
      // Only start date provided
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.date = { $gte: start };
    } else if (endDate) {
      // Only end date provided
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.date = { $lte: end };
    }
    
    console.log("📊 Final filter object:", filter);
    
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
    
    console.log("✅ Found transactions:", transactions.length);
    console.log("📋 Sample transaction dates:", transactions.slice(0, 3).map(t => ({ id: t._id, date: t.date, type: t.type, mode: t.mode })));
    
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
      // Create proper date range - start of startDate to end of endDate
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      
      matchStage.date = {
        $gte: start,
        $lte: end,
      };
    } else if (startDate) {
      // Only start date provided
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchStage.date = { $gte: start };
    } else if (endDate) {
      // Only end date provided
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.date = { $lte: end };
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
    
    // Get item statistics
    const Item = require('../models/Item');
    const totalItems = await Item.countDocuments();
    const pledgedItems = await Item.countDocuments({ status: 'pledged' });
    const availableItems = await Item.countDocuments({ status: 'available' });
    
    res.status(200).json({
      totalTransactions: totalStats[0] || { totalAmount: 0, totalCount: 0 },
      typeBreakdown,
      loanStats,
      totalItems,
      pledgedItems,
      availableItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};