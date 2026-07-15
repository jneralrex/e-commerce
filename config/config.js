require("dotenv").config();
const cloudinary = require("cloudinary").v2;

const config = {
mongo_uri: process.env.MONGO_URI,
port: process.env.PORT,
jwt_secret: process.env.JWT_SECRET,
refresh_secret: process.env.REFRESH_SECRET,
email_pass: process.env.EMAIL_PASS,
email_host: process.env.EMAIL_HOST,
email_port: process.env.EMAIL_PORT,
email_user: process.env.EMAIL_USER,
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = {config, cloudinary}