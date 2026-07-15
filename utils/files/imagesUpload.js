// utils/imageUpload.js

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../../config/config");

const productImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "product-images",
    format: "webp",
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto:low" },
      { fetch_format: "webp" },
      { bytes_limit: 1024000 }
    ]
  }
});

const categoryImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "category-images",
    format: "webp",
    transformation: [
      { width: 500, height: 500, crop: "limit" },
      { quality: "auto:low" },
      { fetch_format: "webp" },
      { bytes_limit: 512000 }
    ]
  }
});

const uploadProductImages = multer({ storage: productImageStorage });
const uploadCategoryImages = multer({ storage: categoryImageStorage });

module.exports = {
  uploadProductImages,
  uploadCategoryImages
};
