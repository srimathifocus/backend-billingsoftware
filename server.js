/// server.js
// Load environment variables first
const dotenv = require('dotenv')
const path = require('path')
dotenv.config({ path: path.join(__dirname, '.env') })

const express = require('express')
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('./swagger.json')
const connectDB = require('./config/db')
const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const billingRoutes = require('./routes/billingRoutes')
const repaymentRoutes = require('./routes/repaymentRoutes')
const invoiceRoutes = require('./routes/invoiceRoutes')
const reportRoutes = require('./routes/reportRoutes')
const itemRoutes = require('./routes/itemRoutes')
const transactionRoutes = require('./routes/transactionsRoute')
const loanRoutes = require('./routes/loanRoutes')
const customerRoutes = require('./routes/customerRoutes')
const userRoutes = require('./routes/userRoutes')
const shopDetailsRoutes = require('./routes/shopDetailsRoutes')
const expenseRoutes = require('./routes/expenseRoutes')
const balanceSheetRoutes = require('./routes/balanceSheetRoutes')
const financeRoutes = require('./routes/financeRoutes')
const app = express()

// CORS configuration for production and development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://pawnbillingsoftwarefocus.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:1000',
      'http://localhost:1001',
    ];
    
    // Allow any localhost origin during development
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:');
    
    if (allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Connect to database
connectDB()

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/repayment', repaymentRoutes)
app.use('/api/invoice', invoiceRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/loans', loanRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/users', userRoutes)
app.use('/api/shop-details', shopDetailsRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/balance-sheet', balanceSheetRoutes)
app.use('/api/finance', financeRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() })
})

// Test endpoint for new routes
app.get('/api/test-routes', (req, res) => {
  res.json({ 
    message: 'New routes are loaded',
    routes: [
      '/api/shop-details',
      '/api/expenses', 
      '/api/balance-sheet'
    ]
  })
})

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: `
    .topbar { display: none !important; }
    .swagger-ui .info .title { color: #2c3e50; }
    .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; }
  `,
  customSiteTitle: "Pawn Shop Management API Documentation",
  customfavIcon: "https://cdn-icons-png.flaticon.com/512/1076/1076894.png"
}))

// Serve the custom HTML documentation
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger.html'))
})

// Serve swagger.json
app.get('/swagger.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'swagger.json'))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))