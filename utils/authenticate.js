const jwt = require("jsonwebtoken");
const { config } = require("../config/config");
const CustomError = require("./errorHandler");
const User = require("../models/user.model");

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer token
        if (!token) throw new CustomError(401, "Unauthorized", "AuthError");

        const decoded = jwt.verify(token, config.jwt_secret);
        const user = await User.findById(decoded.id); // Fetch user

        if (!user) throw new CustomError(401, "Users not found", "AuthError");

        req.user = user; // Attach user to request
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = authenticate;



