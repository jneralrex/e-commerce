const CustomError = require("./errorHandler");

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new CustomError(403, "Access denied", "ForbiddenError"));
    }
    next();
  };
};

module.exports = authorize;
