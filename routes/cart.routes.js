const router = require("express").Router();
const {
  addToCart,
  getUserCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
} = require("../controllers/cart.controller");

const authenticate = require("../utils/authenticate");

router.use(authenticate);

router.post("/add", addToCart);
router.get("/", getUserCart);
router.patch("/update", updateCartItemQuantity);
router.delete("/remove/:productId", removeFromCart);
router.delete("/clear", clearCart);

module.exports = router;
