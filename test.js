const axios = require('axios');

async function runSaaSTest() {
    try {
        console.log("⏳ 1. Naya Seller (Dukandar) ID bana rahe hain...");
        
        // Step 1: Ek naya account banana taaki 'seller_id' aur Free Trial mil sake
        const signupRes = await axios.post('https://orderconfirm-v2.onrender.com/api/signup', {
            name: "Test User",
            email: "test" + Date.now() + "@gmail.com", // Har baar naya email
            phone: "1234567890",
            business: "Test Biz",
            password: "password123"
        });
        
        const sellerId = signupRes.data.seller._id;
        console.log("✅ Seller Ban Gaya! ID:", sellerId);
        console.log("⏳ 2. WhatsApp Message Bhej Rahe Hain...");

        // Step 2: Usi ID ka use karke WhatsApp bhejna
        const msgRes = await axios.post('https://orderconfirm-v2.onrender.com/api/send-confirmation', {
            customer_name: "Boss",
            total_amount: "1999",
            phone_number: "916390247001", // 🔴 Yahan aapka verified number hai
            seller_id: sellerId // Ye upar banayi hui ID automatically lag jayegi
        });

        console.log("✅ BOOM Result:", msgRes.data.message);

    } catch (error) {
        console.error("❌ Error:", error.response ? error.response.data : error.message);
    }
}

runSaaSTest();