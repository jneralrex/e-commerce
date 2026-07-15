class CustomError extends Error {
    constructor(statusCode = 500, message = "An error occurred", type = "Generic Error", details = null) {
        super(message);
        this.statusCode = statusCode;
        this.type = type;
        this.details = details;
    }
}

module.exports = CustomError;
