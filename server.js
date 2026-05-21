const express = require('express');
const path = require('path');
const Razorpay = require('razorpay');

const app = express();
// Render automatic apna port utha lega, nahi toh 3000 par chalega
const PORT = process.env.PORT || 3000; 

// --- MIDDLEWARE (Engine ki settings) ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Ye line aapki saari HTML files ko internet par live karti hai
app.use(express.static(__dirname)); 

// --- RAZORPAY SETUP ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});

// --- ROUTES (Website ke raaste) ---

// 1. Koi seedha website khole toh Home Page (index.html) dikhao
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. 🚀 THE FIX: Login ya Signup karne par seedha Dashboard par bhejo
app.post('/login', (req, res) => {
    res.redirect('/Dashboard.html');
});

app.post('/signup', (req, res) => {
    res.redirect('/Dashboard.html');
});

// 3. Razorpay ka Order Create karna (₹500 ka recharge)
app.post('/create-order', async (req, res) => {
    try {
        const options = {
            amount: 50000, // ₹500 (Paise mein hota hai, isliye 50000)
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7)
        };
        const order = await razorpay.orders.create(options);
        
        res.json({
            key_id: process.env.RAZORPAY_KEY_ID,
            amount: order.amount,
            order_id: order.id
        });
    } catch (error) {
        console.error("Razorpay Error:", error);
        res.status(500).json({ error: "Server error, payment gateway failed!" });
    }
});

// 4. Payment check karna (Dummy success for now)
app.post('/verify-payment', (req, res) => {
    res.json({ success: true });
});

// --- ENGINE START ---
app.listen(PORT, () => {
    console.log(`BOMB! 💣 Server is running on port ${PORT} 🚀`);
});