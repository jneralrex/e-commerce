const { cloudinary } = require("../config/config");
const User = require("../models/user.model");
const CustomError = require("../utils/errors/customErrors");

const getAllUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        if (isNaN(pageNumber) || isNaN(limitNumber)) {
            throw new CustomError(400, "Invalid pagination parameters", "ValidationError");
        }

        const fetchedUsers = await User.find()
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);
        const totalUsers = await User.countDocuments();

        res.status(200).json({
            success: true,
            users: fetchedUsers,
            totalUsers,
            totalPages: Math.ceil(totalUsers / limitNumber),
            currentPage: pageNumber
        });
    } catch (error) {
        next(error);
    }
};

const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            throw new CustomError(404, "User not found", "NotFoundError");
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            throw new CustomError(404, "User not found", "NotFoundError");
        }

        const updateData = req.body;
        if (!updateData || Object.keys(updateData).length === 0) {
            throw new CustomError(400, "No data provided for update", "ValidationError");
        }

        // Prevent password update
        if (updateData.password || updateData.otp) {
            throw new CustomError(400, "Password update is not allowed here", "ValidationError");
        }

        Object.assign(user, updateData); 
        await user.save(); 

        res.status(200).json({ 
            success: true, 
            user, 
            message: "Profile updated successfully" 
        });
    } catch (error) {
        next(error);
    }
};

const deleteFromCloudinary = async (publicId) => {
    if (!publicId) {
        console.warn("Public ID is missing for deletion");
        return false;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);

        if (!result || result.result !== "ok") {
            throw new CustomError(500, "Cloudinary deletion failed", "CloudinaryError");
        }

        return true;
    } catch (error) {
        throw new CustomError(500, `Error deleting image from Cloudinary: ${error.message}`, "CloudinaryError");
    }
};

const updateProfilePhoto = async (req, res, next) => {
    try {
        const { id: userId } = req.params;

        // Ensure a file was uploaded
        if (!req.file) {
            throw new CustomError(400, "No file uploaded", "ValidationError");
        }

        // Extract Cloudinary file details from `multer`
        const profilePhoto = req.file.path; 
        const publicId = req.file.filename; 

        if (!userId || !profilePhoto || !publicId) {
            throw new CustomError(400, "Invalid input data", "ValidationError");
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new CustomError(404, "User not found", "NotFoundError");
        }

        // Deletes old profile photo from Cloudinary if exists
        if (user.profilePics?.public_id) {
            await deleteFromCloudinary(user.profilePics.public_id);
        }

        // Updates user profile picture
        user.profilePics = { url: profilePhoto, public_id: publicId };
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile photo updated successfully",
            profilePhoto: user.profilePics.url,
        });
    } catch (error) {
        next(error);
    }
};

const rollBackImageWithErrors = async (req, res, next) => {
    const { publicId } = req.body;

    if (!publicId) {
        throw new CustomError(400, "Public ID is required to rollback an asset.", "ValidationError");
    }

    try {
        await deleteFromCloudinary(publicId);
        res.status(200).json({ success: true, message: "Asset successfully deleted from Cloudinary." });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAllUsers, getUserById, updateUser, updateProfilePhoto, rollBackImageWithErrors, deleteFromCloudinary };
