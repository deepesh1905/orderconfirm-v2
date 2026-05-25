const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Razorpay = require('razorpay');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// =====================
// MongoDB Connection
// =====================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('BOMB! 🔥 MongoDB Connected!'))
  .catch(err => console.log('MongoDB Error:', err));

// =====================
// Database Models
// =====================
const SellerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  business: String,
  password: String,
  apiKey: String,
  wallet: { type: Number, default: 0 },
  freeTrialUsed: { type: Number, default: 0 },
  freeTrialLimit: { type: Number, default: 10 },
  totalOrders: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const OrderSchema = new mongoose.Schema({
  sellerId: String,
  customerName: String,
  totalAmount: String,
  phoneNumber: String,
  status: { type: String, default: 'sent' },
  createdAt: { type: Date, default: Date.now }
});

const Seller = mongoose.model('Seller', SellerSchema);
const Order = mongoose.model('Order', OrderSchema);

// =====================
// Razorpay Setup
// =====================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET
});

// =====================
// Middleware - Auth
// =====================
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.sellerId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// =====================
// 1. SIGNUP ROUTE
// =====================
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, phone, business, password } = req.body;
    const existing = await Seller.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = 'sk_live_' + Math.random().toString(36).substr(2, 20);

    const seller = new Seller({
      name, email, phone, business,
      password: hashedPassword,
      apiKey
    });

    await seller.save();
    const token = jwt.sign({ id: seller._id }, process.env.JWT_SECRET);
    res.json({ token, seller });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// 2. LOGIN ROUTE
// =====================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const seller = await Seller.findOne({ email });
    if (!seller) return res.status(400).json({ message: 'Email not found' });

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) return res.status(400).json({ message: 'Wrong password' });

    const token = jwt.sign({ id: seller._id }, process.env.JWT_SECRET);
    res.json({ token, seller });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// 3. DASHBOARD DATA
// =====================
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const seller = await Seller.findById(req.sellerId);
    const orders = await Order.find({ sellerId: req.sellerId });
    res.json({ seller, orders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// 4. SEND CONFIRMATION (OUTBOUND)
// =====================
app.post('/api/send-confirmation', async (req, res) => {
  try {
    const { customer_name, total_amount, phone_number, seller_id } = req.body;

    const seller = await Seller.findById(seller_id);
    if (!seller) return res.status(404).json({ message: 'Seller not found' });

    if (seller.freeTrialUsed < seller.freeTrialLimit) {
      seller.freeTrialUsed += 1;
    } else if (seller.wallet >= 3) {
      seller.wallet -= 3;
    } else {
      return res.status(400).json({ message: 'Wallet empty! Recharge karo' });
    }

    seller.totalOrders += 1;
    await seller.save();

    await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "template",
        template: {
          name: "order_confirm_bot",
          language: { code: "en_US" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: customer_name },
              { type: "text", text: total_amount }
            ]
          }]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const order = new Order({
      sellerId: seller_id,
      customerName: customer_name,
      totalAmount: total_amount,
      phoneNumber: phone_number
    });
    await order.save();

    res.json({ success: true, message: 'Template Sent!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// 5. RAZORPAY - CREATE ORDER
// =====================
app.post('/api/create-order', authMiddleware, async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 50000, 
      currency: 'INR',
      receipt: 'receipt_' + Date.now()
    });
    res.json({ 
      orderId: order.id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// 6. RAZORPAY - VERIFY PAYMENT
// =====================
app.post('/api/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    
    const crypto = require('crypto');
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      await Seller.findByIdAndUpdate(req.sellerId, {
        $inc: { wallet: 500 }
      });
      res.json({ success: true, message: 'Payment verified! ₹500 added' });
    } else {
      res.status(400).json({ message: 'Invalid payment' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// 7. WHATSAPP WEBHOOK (INBOUND + BUTTON CATCHING)
// =====================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === 'orderconfirm123') {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];

      if (message) {
        const fromNumber = message.from;

        // 🔘 JAB CUSTOMER TEMPLATE BUTTON DABAYE
        if (message.type === 'button') {
          const buttonText = message.button.text;
          console.log(`🔘 Button Clicked: ${buttonText} by ${fromNumber}`);

          if (buttonText === 'Yes, Dispatch It') {
            await Order.findOneAndUpdate(
              { phoneNumber: fromNumber },
              { status: 'Confirmed' },
              { sort: { createdAt: -1 } } 
            );
            console.log('✅ JADOO! Order Confirmed in Database!');
          } 
          else if (buttonText === 'Cancel Order') {
            await Order.findOneAndUpdate(
              { phoneNumber: fromNumber },
              { status: 'Cancelled' },
              { sort: { createdAt: -1 } }
            );
            console.log('❌ ALERT! Order Cancelled in Database!');
          }
        }
        
        // 💬 JAB CUSTOMER NORMAL TEXT BHEJE (Jaise "Hii")
        else if (message.type === 'text') {
          const text = message.text?.body?.toLowerCase();
          console.log(`📩 Naya Text Message (${fromNumber}): ${text}`);
          
          await axios.post(
            `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
              messaging_product: "whatsapp",
              to: fromNumber,
              type: "text",
              text: { body: "Hello Boss! Aapka order update ho raha hai. 🛍️" }
            },
            { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
          );
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.log('Webhook Error:', err.message);
    res.sendStatus(500);
  }
});

// =====================
// SERVER START
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`BOMB! 🚀 Master Server running on port ${PORT}`);
});