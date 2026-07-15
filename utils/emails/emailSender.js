const { SendMailClient } = require("zeptomail");
const { config } = require("../../config/config");

const client = new SendMailClient({
    url: "https://api.zeptomail.com/",
    token: config.email_pass
});

/**
 * Sends transactional emails using Zoho ZeptoMail Node SDK.
 */
const sendEmail = async (email, subject, message, username = "User") => {
    try {
       const response = await client.sendMail({
    
    "from": {
        "address": "noreply@sartorhealth.com",
        "name": "Sartor Health"
    },
    "to": [
        {
            "email_address": {
                "address": email.trim(),
                "name": username
            }
        }
    ],
    "subject": subject,
    "htmlbody": `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="https://res.cloudinary.com/dwua55lnu/image/upload/f_png/v1753376622/logo_kn8bxg.png" alt="Sartor" style="max-width: 140px; height: auto; display: block; margin: 0 auto; border: 0;">
            </div>
            <div>
                ${message}
            </div>
            <p style="font-size: 14px; color: #dc2626;">Please ignore if you didn't request this email.</p>
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #a0aec0;">
                <p>© 2026 Sartor Health. All rights reserved.</p>
            </div>
        </div>
    `
});

        console.log("[ZeptoMail SDK] Dispatched successfully:", response);
        return { success: true, data: response };

    } catch (error) {
        const errorMsg = error.message || JSON.stringify(error);
        console.error("[ZeptoMail SDK] Delivery failed:", errorMsg);
        return { success: false, error: errorMsg };
    }
};

module.exports = sendEmail;
