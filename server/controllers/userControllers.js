import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Razorpay from 'razorpay'

import userModel from '../models/userModel.js'
import transactionModel from '../models/transactionModel.js'

// Initialize Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})

// REGISTER USER
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.json({ success: false, message: 'Missing Details' })
    }

    const existingUser = await userModel.findOne({ email })
    if (existingUser) {
      return res.json({ success: false, message: 'User already exists' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await new userModel({ name, email, password: hashedPassword }).save()
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

    res.json({ success: true, token, user: { name: user.name } })
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// LOGIN USER
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await userModel.findOne({ email })

    if (!user) return res.json({ success: false, message: 'User does not exist' })

    const isMatch = await bcrypt.compare(password, user.password)

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
      res.json({ success: true, token, user: { name: user.name } })
    } else {
      res.json({ success: false, message: 'Invalid Credentials' })
    }
  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}

// GET USER CREDITS
const userCredits = async (req, res) => {
  try {
    const { userId } = req.body
    const user = await userModel.findById(userId)

    if (!user) {
      return res.json({ success: false, message: 'User not found' })
    }

    res.json({
      success: true,
      credits: user.creditBalance,
      user: { name: user.name }
    })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// INITIATE PAYMENT
const paymentRazorpay = async (req, res) => {
  try {
    const { userId, planId } = req.body
    if (!userId || !planId) return res.json({ success: false, message: 'Missing Details' })

    let plan, credits, amount
    switch (planId) {
      case 'Basic':
        plan = 'Basic'
        credits = 100
        amount = 10
        break
      case 'Advanced':
        plan = 'Advanced'
        credits = 500
        amount = 50
        break
      case 'Business':
        plan = 'Business'
        credits = 5000
        amount = 250
        break
      default:
        return res.json({ success: false, message: 'Invalid Plan' })
    }

    // Create transaction document
    const transaction = await transactionModel.create({
      userId,
      plan,
      amount,
      credits,
      date: Date.now()
    })

    const options = {
      amount: amount * 100, // in paisa / cents
      currency: process.env.CURRENCY || "USD",
      receipt: transaction._id.toString()
    }

    // Create Razorpay order
    razorpayInstance.orders.create(options, (err, order) => {
      if (err) {
        return res.json({ success: false, message: err.message })
      }
      res.json({ success: true, order })
    })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// VERIFY PAYMENT
const verifyRazorpay = async (req, res) => {
  try {
    const { order_id } = req.body
    if (!order_id) return res.status(400).json({ success: false, message: "`order_id` is missing" })

    // Fetch order info from Razorpay
    const orderInfo = await razorpayInstance.orders.fetch(order_id)

    if (orderInfo.status === "paid") {
      const transaction = await transactionModel.findById(orderInfo.receipt)
      if (!transaction) return res.json({ success: false, message: "Transaction not found" })

      if (transaction.payment) return res.json({ success: false, message: "Payment already processed" })

      // Add credits to user
      await userModel.findByIdAndUpdate(transaction.userId, {
        $inc: { creditBalance: transaction.credits }
      })

      // Mark transaction as paid
      await transactionModel.findByIdAndUpdate(transaction._id, { payment: true })

      return res.json({ success: true, message: "Credits Added Successfully" })
    } else {
      return res.json({ success: false, message: "Payment not completed" })
    }
  } catch (error) {
    console.error("Verification Error:", error)
    res.status(500).json({ success: false, message: "Internal Server Error" })
  }
}

export {
  registerUser,
  loginUser,
  userCredits,
  paymentRazorpay,
  verifyRazorpay
}
