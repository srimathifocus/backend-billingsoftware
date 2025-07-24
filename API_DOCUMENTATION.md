# Pawn Shop Billing System API Documentation

## Overview
This API provides comprehensive billing and loan management for pawn shops with features for:
- 3-step billing process (Customer → Item → Loan)
- Invoice generation
- Loan repayment with time-based interest calculation
- Active/Inactive loan management
- Transaction tracking with cash/online breakdown

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints require authentication using JWT tokens. Include in headers:
```
Authorization: Bearer <token>
```

## API Endpoints

### 1. BILLING MANAGEMENT

#### Create New Billing
```
POST /api/billing/create
```
Creates a complete billing record with customer, items, and loan information.

**Request Body:**
```json
{
  "customer": {
    "name": "John Doe",
    "phone": "9876543210",
    "address": {
      "doorNo": "123",
      "street": "Main St",
      "town": "City",
      "district": "District",
      "pincode": "123456"
    },
    "nominee": "Jane Doe"
  },
  "items": [
    {
      "code": "ITM001",
      "name": "Gold Chain",
      "category": "Jewelry",
      "carat": "22K",
      "weight": 10,
      "estimatedValue": 50000
    }
  ],
  "loan": {
    "amount": 40000,
    "interestType": "monthly",
    "interestPercent": 2.5,
    "validity": "6"
  },
  "payment": {
    "cash": 20000,
    "online": 20000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Billing created successfully",
  "data": {
    "loanId": "LN2412250001",
    "customerId": "customer_id",
    "billingRecord": {}
  }
}
```

#### Get Billing Statistics
```
GET /api/billing/stats
```
Returns today's billing statistics.

**Response:**
```json
{
  "totalLoanAmount": 100000,
  "totalCash": 50000,
  "totalOnline": 50000,
  "totalLoans": 5
}
```

### 2. LOAN MANAGEMENT

#### Get Active Loans
```
GET /api/loans/active
```
Returns all active (unpaid) loans with current interest calculation.

**Response:**
```json
[
  {
    "loanId": "LN2412250001",
    "customerId": {
      "name": "John Doe",
      "phone": "9876543210"
    },
    "amount": 40000,
    "interestPercent": 2.5,
    "currentInterest": 2000,
    "daysPassed": 30,
    "totalDue": 42000,
    "status": "active"
  }
]
```

#### Get Inactive Loans
```
GET /api/loans/inactive
```
Returns all repaid loans with repayment details.

#### Search Loans by Phone
```
GET /api/loans/search/:phone
```
Search all loans for a specific customer by phone number.

**Parameters:**
- `phone`: Customer phone number

#### Get Loan by ID
```
GET /api/loans/:id
```
Get specific loan details by loan ID or MongoDB ObjectId.

**Parameters:**
- `id`: Loan ID (e.g., "LN2412250001") or MongoDB ObjectId

#### Get Loan Statistics
```
GET /api/loans/statistics
```
Returns comprehensive loan statistics.

**Response:**
```json
{
  "totalLoans": 100,
  "activeLoans": 60,
  "inactiveLoans": 40,
  "totalActiveLoanAmount": 2000000,
  "totalInactiveLoanAmount": 1500000,
  "totalCurrentInterest": 150000,
  "paymentBreakdown": [
    {
      "_id": "active",
      "totalCash": 800000,
      "totalOnline": 1200000
    }
  ]
}
```

### 3. REPAYMENT MANAGEMENT

#### Search Loan for Repayment
```
GET /api/repayment/search/:identifier
```
Search active loan by loan ID or phone number for repayment.

**Parameters:**
- `identifier`: Loan ID (e.g., "LN2412250001") or phone number

**Response:**
```json
{
  "loan": {
    "loanId": "LN2412250001",
    "customerId": {
      "name": "John Doe",
      "phone": "9876543210"
    },
    "amount": 40000,
    "interestPercent": 2.5,
    "currentInterest": 2000,
    "daysPassed": 30,
    "totalDue": 42000
  }
}
```

#### Process Loan Repayment
```
POST /api/repayment/pay
```
Process loan repayment with automatic interest calculation.

**Request Body:**
```json
{
  "loanId": "LN2412250001",
  "payment": {
    "cash": 20000,
    "online": 22000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Loan repaid successfully",
  "data": {
    "loanId": "LN2412250001",
    "principalAmount": 40000,
    "interestAmount": 2000,
    "totalAmount": 42000,
    "daysPassed": 30,
    "payment": {
      "cash": 20000,
      "online": 22000
    }
  }
}
```

### 4. TRANSACTION MANAGEMENT

#### Get All Transactions
```
GET /api/transactions
```
Get all transactions with optional filters.

**Query Parameters:**
- `type`: "billing" or "repayment"
- `mode`: "cash" or "online"
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)

**Response:**
```json
[
  {
    "type": "billing",
    "mode": "cash",
    "amount": 20000,
    "date": "2024-12-25T10:00:00Z",
    "loanId": {
      "loanId": "LN2412250001",
      "customerId": {
        "name": "John Doe",
        "phone": "9876543210"
      }
    }
  }
]
```

#### Get Transaction Summary
```
GET /api/transactions/summary
```
Get transaction summary with breakdown by type and mode.

**Query Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)

**Response:**
```json
{
  "billing": {
    "total": 100000,
    "count": 10,
    "breakdown": {
      "cash": {
        "amount": 40000,
        "count": 5
      },
      "online": {
        "amount": 60000,
        "count": 5
      }
    }
  },
  "repayment": {
    "total": 80000,
    "count": 8,
    "breakdown": {
      "cash": {
        "amount": 30000,
        "count": 4
      },
      "online": {
        "amount": 50000,
        "count": 4
      }
    }
  }
}
```

#### Get Overall Statistics
```
GET /api/transactions/statistics
```
Get overall transaction and loan statistics.

### 5. INVOICE MANAGEMENT

#### Get Loan Invoice Data
```
GET /api/invoice/loan/:loanId
```
Get loan invoice data for display.

#### Get Repayment Invoice Data
```
GET /api/invoice/repayment/:loanId
```
Get repayment invoice data for display.

#### Generate Loan Invoice PDF
```
GET /api/invoice/loan/:loanId/pdf
```
Generate and download loan invoice PDF.

### 6. ITEM MANAGEMENT

#### Get All Items
```
GET /api/items
```
Get all items with their status.

#### Add New Item
```
POST /api/items
```
Add a new item to the system.

#### Update Item
```
PUT /api/items/:id
```
Update existing item details.

#### Delete Item
```
DELETE /api/items/:id
```
Delete an item from the system.

## Key Features

### 1. **Time-based Interest Calculation**
- Interest is calculated from loan date to current date
- Supports monthly, yearly, and daily interest rates
- Automatic calculation during repayment

### 2. **Comprehensive Loan Management**
- Active loans: Shows current interest and total due
- Inactive loans: Shows repayment history
- Search by phone number or loan ID

### 3. **Transaction Tracking**
- Complete audit trail of all transactions
- Cash vs Online payment breakdown
- Date-wise filtering and reporting

### 4. **Automatic Loan ID Generation**
- Format: LN + YYMMDD + 3-digit sequence
- Example: LN2412250001 (25th Dec 2024, 1st loan)

### 5. **PDF Invoice Generation**
- Professional loan invoices
- Includes all relevant details
- Downloadable format

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

Error responses include:
```json
{
  "message": "Error description"
}
```

## Business Logic

### Interest Calculation Formula
```
Interest = (Principal × Rate × Days) / (100 × 30)
```
Where:
- Principal: Loan amount
- Rate: Interest rate per month
- Days: Number of days from loan date to current date

### Loan Status
- **Active**: Loan is not yet repaid
- **Inactive**: Loan has been fully repaid

### Item Status
- **Available**: Item is available for loan
- **Pledged**: Item is currently pledged against a loan
- **Released**: Item has been released after repayment