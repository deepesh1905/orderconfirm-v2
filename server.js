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

// 1. Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Dummy Auth Routes (Redirect to Dashboard)
app.post('/login', (req, res) => {
    res.redirect('/Dashboard.html');
});

app.post('/signup', (req, res) => {
    res.redirect('/Dashboard.html');
});

// 3. Razorpay Order Create
app.post('/create-order', async (req, res) => {
    try {
        const options = {
            amount: 50000, // ₹500
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

// 4. Verify Payment
app.post('/verify-payment', (req, res) => {
    res.json({ success: true });
});


// --- 🤖 WHATSAPP META WEBHOOK SETUP ---
const VERIFY_TOKEN = "deepesh_secret_token"; // Ye token Meta dashboard mein dalega

// 5. Meta Webhook Verification (GET)
app.get('/webhook', (req, res) => {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("BOMB! 💣 Meta Webhook Verified Successfully!");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 6. Incoming WhatsApp Messages (POST)
app.post('/webhook', (req, res) => {
    let body = req.body;
    console.log("📥 Naya WhatsApp Message Aaya:", JSON.stringify(body, null, 2));
    res.sendStatus(200); // Meta ko "OK" bolna zaroori hai
});


// --- ENGINE START ---
app.listen(PORT, () => {
    console.log(`BOMB! 💣 Server is running on port ${PORT} 🚀`);
});