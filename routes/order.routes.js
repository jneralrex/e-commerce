const express = require("express");
const router = express.Router();

const authenticate = require("../utils/authenticate");
const authorize = require("../utils/authorize");
const {   createOrder,
    getAllOrders,
    getSingleOrder,
    updateOrderStatus,
    getMyOrders,
    cancelOrder,
    filterOrders,
    adminCancelOrder,
    getAnalytics,
  } = require("../controllers/order.contoller");


// ----- User routes -----
router.post("/create", authenticate, createOrder);
router.get("/user-orders", authenticate, getMyOrders);
router.get("/:id", authenticate, getSingleOrder);
router.put("/:id/cancel", authenticate, cancelOrder);


// ----- Admin routes -----
router.patch("/admin/update/:id", authenticate, authorize("admin"), updateOrderStatus);
router.get("/admin/all", authenticate, authorize("admin"), getAllOrders);
router.get("/admin/filter", authenticate, authorize("admin"), filterOrders);
router.put("/admin/:id/cancel", authenticate, authorize("admin"), adminCancelOrder);
router.get("/admin/analytics", authenticate, authorize("admin"), getAnalytics);

module.exports = router;
