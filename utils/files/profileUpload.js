const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../../config/config");

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "profile_picture",
      resource_type: "image",
      format: "webp", // Convert all images to WebP
      transformation: [
        { width: 500, height: 500, crop: "limit" }, 
        { quality: "auto:low" }, 
        { fetch_format: "webp" },
        { bytes_limit: 1024000 } // Ensure final image is under 1MB
      ],
      
    },
  });
  

  

const profileUpload = multer({ storage });

module.exports = profileUpload;