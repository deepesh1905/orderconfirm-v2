const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// 🔴 1. APNI PERMANENT DETAILS YAHAN DAALEIN
// ==========================================
const WHATSAPP_TOKEN = 'EAAOKe6ONLJQBRttyJZBFBEzq5bu75DxiZCQoJJHHqOg5XtbMIh0BARGkwWZCwp2zadeZBLHN6BhDbS4Rli6v9VHRe9acoZCuNvoMJsHiGeZAYdUqLZAAyxjLdW4eCSZCQY6GJzAXTkS5MXpoExhwNlZChvLIxRHrenX1Aa1PZCDsYC1k2Ybuehhm9laShlpxPWj4tj8QZDZD';
const PHONE_NUMBER_ID = '1106763835856433'; 
const VERIFY_TOKEN = 'mera_secret_token_123'; // Meta Webhook verify karne ke liye

// ==========================================
// 🚀 2. OUTBOUND: Naya Order Aane Par Message Bhejna
// ==========================================
app.post('/new-order', async (req, res) => {
    const { customer_name, total_amount, phone_number } = req.body;

    if (!phone_number || !customer_name || !total_amount) {
        return res.status(400).send('❌ Order details missing hain!');
    }

    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: phone_number,
                type: 'template',
                template: {
                    name: 'order_confirm_bot', // Aapka Naya Approved Template
                    language: { code: 'en_US' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: customer_name },
                                { type: 'text', text: total_amount.toString() }
                            ]
                        }
                    ]
                }
            }
        });
        console.log(`✅ Message successfully sent to: ${phone_number}`);
        res.status(200).send('Template Sent!');
    } catch (error) {
        console.error('❌ Error sending message:', error.response ? error.response.data : error.message);
        res.status(500).send('Error');
    }
});

// ==========================================
// 🔐 3. INBOUND: Meta Webhook Verification
// ==========================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook Verified by Meta!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ==========================================
// 📥 4. INBOUND: Customer Ke Replies Aur Buttons Catch Karna
// ==========================================
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            const message = body.entry[0].changes[0].value.messages[0];
            const fromNumber = message.from;

            // Agar customer ne Button (Quick Reply/Custom) dabaya hai
            if (message.type === 'button') {
                const buttonText = message.button.text;

                if (buttonText === '✅ Yes, Dispatch It') {
                    console.log(`🎉 ORDER CONFIRMED BY: ${fromNumber}`);
                    // Yahan aap Shopify ko API bhej sakte hain ki order "Confirmed" mark kar do
                } 
                else if (buttonText === '❌ Cancel Order') {
                    console.log(`⚠️ ORDER CANCELLED BY: ${fromNumber}`);
                    // Yahan aap order ko "Cancelled" mark kar sakte hain
                }
            }
            
            // Agar customer ne normal text message (Jaise "Hii") bheja hai
            else if (message.type === 'text') {
                const textMessage = message.text.body;
                console.log(`💬 Text from ${fromNumber}: ${textMessage}`);
                // Yahan aapka Groq AI wala code aayega jo usse baatcheet karega
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// ==========================================
// 🌍 5. Server Start Karna
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 MASTER SERVER IS RUNNING ON PORT ${PORT}`);
});