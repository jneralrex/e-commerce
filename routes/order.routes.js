const express = require("express");
const router = express.Router();

const authenticate = require("../utils/authenticate");
const authorize = require("../utils/authorize");
const {   createOrder,
    getUserOrders,
    getSingleOrder,
    markOrderAsPaid,
    updateOrderStatus,
    getMyOrders,
    cancelOrder,
    filterOrders,
    adminCancelOrder,
    getAnalytics,
    // isAdmin
  } = require("../controllers/order.contoller");


// ----- User routes -----
router.post("/create", authenticate, createOrder);
router.get("/user-orders", authenticate, getMyOrders);
router.get("/:orderId", authenticate, getSingleOrder);
router.put("/:id/cancel", authenticate, cancelOrder);

// Optional user update endpoints
router.put("/:orderId/paid", authenticate, markOrderAsPaid);
router.put("/:orderId/delivered", authenticate, authorize("admin"), updateOrderStatus);

// ----- Admin routes -----
router.get("/admin/all", authenticate, authorize("admin"), getUserOrders); // all orders
router.get("/admin/filter", authenticate, authorize("admin"), filterOrders);
router.put("/admin/:id/cancel", authenticate, authorize("admin"), adminCancelOrder);
router.get("/admin/analytics", authenticate, authorize("admin"), getAnalytics);


module.exports = router;
