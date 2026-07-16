const express = require("express");
const { config } = require("./config/config");
const connectDataBase = require("./config/dbConnect");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const errorHandler = require("./utils/errors/errorHandler");

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

// ================================
// Connect to Database
// ================================
connectDataBase();

// ================================
// Middleware
// ================================
app.use("/api/stripe/webhook", express.raw({ type: "*/*" }));

app.use(helmet());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

autoCancelUnpaidOrders();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5176",
      "https://sartorhealth-com.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(cookieParser());

// ================================
// Routes
// ================================
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/stripe", webhookRoutes);

// Health check
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

// Global Error Handler
app.use(errorHandler);

// ================================
// Start Server
// ================================
app.listen(port, () => {
  console.log(` Server running on port ${port}`);
});