const axios = require('axios');

axios.post('https://orderconfirm-v2.onrender.com/api/send-confirmation', {
    customer_name: "Test Customer",
    total_amount: "599",
    phone_number: "916390247001"  // Apna number daalo
})
.then(response => console.log("✅ BOOM Result:", response.data))
.catch(error => console.log("❌ Error:", error.message));