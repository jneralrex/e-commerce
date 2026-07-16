const CustomError = require("./customErrors");

module.exports = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let type = err.type || "ServerError";
  let details = err.details || null;

  // Handle special cases
  if (!(err instanceof CustomError)) {
    if (err.name === "ValidationError") {
      statusCode = 400;
      message = Object.values(err.errors).map(val => val.message).join(", ");
    }

    if (err.code === 11000) {
      statusCode = 400;
      message = "Duplicate value entered.";
    }

    if (err.name === "MongoError") {
      statusCode = 500;
      message = "Database error occurred.";
    }

    if (err.name === "ConnectionTimeout") {
      statusCode = 408;
      message = "Connection timeout.";
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: { message, type, details },
  });
};
