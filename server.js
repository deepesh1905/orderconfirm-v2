const express = require('express');
const path = require('path');
const Razorpay = require('razorpay');
const Groq = require('groq-sdk');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000; 

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); 

// --- KEYS & TOKENS ---
const VERIFY_TOKEN = "deepesh_secret_token";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; 
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); 

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET
});

// --- ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.post('/login', (req, res) => res.redirect('/Dashboard.html'));
app.post('/signup', (req, res) => res.redirect('/Dashboard.html'));

app.post('/create-order', async (req, res) => {
    try {
        const order = await razorpay.orders.create({ amount: 50000, currency: "INR", receipt: "rcpt_1" });
        res.json({ key_id: process.env.RAZORPAY_KEY_ID, amount: order.amount, order_id: order.id });
    } catch (error) {
        res.status(500).json({ error: "Gateway failed!" });
    }
});

app.post('/verify-payment', (req, res) => res.json({ success: true }));


// --- 🤖 WHATSAPP + GROQ AI WEBHOOK ---
app.get('/webhook', (req, res) => {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    let body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
        try {
            let entry = body.entry[0];
            let changes = entry.changes[0];
            let value = changes.value;
            
            if (value.messages && value.messages[0]) {
                let message = value.messages[0];
                let senderPhone = message.from;
                let msgText = "";

                if (message.type === "text") {
                    msgText = message.text.body;
                } else if (message.type === "interactive") {
                    msgText = message.interactive.button_reply.title;
                }

                console.log(`📥 Naya Message (${senderPhone}):`, msgText);

                if (msgText) {
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [
                            { role: "system", content: "You are a smart, professional Order Confirmation assistant. Keep your answers short, polite, and strictly in English." },
                            { role: "user", content: msgText }
                        ],
                        model: "llama-3.1-8b-instant", 
                    });
                    
                    let aiResponse = chatCompletion.choices[0].message.content;

                    await axios({
                        method: 'POST',
                        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
                        headers: {
                            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        data: {
                            messaging_product: "whatsapp",
                            to: senderPhone,
                            type: "text",
                            text: { body: aiResponse }
                        }
                    });
                    console.log("✅ English AI Reply Bhej Diya!");
                }
            }
        } catch (error) {
            // 🕵️ DETECTIVE LOGGER
            console.error("❌ ERROR AAYA HAI!");
            if (error.response && error.response.data) {
                console.error("🕵️ Asli Wajah:", JSON.stringify(error.response.data, null, 2));
            } else {
                console.error("🕵️ Wajah:", error.message);
            }
        }
    }
    res.sendStatus(200); 
});

// --- ENGINE START ---
app.listen(PORT, () => {
    console.log(`BOMB! 💣 Server running on port ${PORT} 🚀`);
});