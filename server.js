const express = require("express");
const { config } = require("./config/config");
const connectDataBase = require("./config/dbConnect");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet"); 
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const reviewRoutes = require("./routes/review.routes");
const webhookRoutes = require("./routes/payment.routes");
const autoCancelUnpaidOrders = require("./utils/cleaners/product.cronJobs");


const app = express();
const port = config.port || 4000;

//  Connect to Database
connectDataBase();

//  Middleware
app.use("/api/stripe/webhook", express.raw({ type: "*/*" }));
app.use(helmet()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
autoCancelUnpaidOrders();


app.use(cors({ 
    origin: "*",  
    credentials: true 
}));
app.use(cookieParser());

//  Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/stripe", webhookRoutes);



//  Global Error Handler
app.use((err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Handle Mongoose Validation Errors
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors).map((val) => val.message).join(", ");
    }

    // Handle MongoDB Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 400;
        message = "Duplicate value entered.";
    }

    // Handle Database Errors
    if (err.name === "MongoError") {
        statusCode = 500;
        message = "Database error occurred.";
    }

    // Handle Connection Timeout
    if (err.name === "ConnectionTimeout") {
        statusCode = 408;
        message = "Connection timeout.";
    }

    // Log errors in development
    if (process.env.NODE_ENV === "development") {
        console.error(err);
    }

    res.status(statusCode).json({
        success: false,
        message,
    });
});

//  Start Server
app.listen(port, () => {
    console.log(` Server is running on http://localhost:${port}`);
});
