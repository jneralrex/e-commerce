const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/order.model");
// const CustomError = require("../utils/customError");
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const createCheckoutSession = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId).populate("items.product");
    if (!order) return next(new CustomError(404, "Order not found"));

    const line_items = order.items.map(item => ({
      price_data: {
        currency: "ngn", 
        product_data: {
          name: item.product.name,
        },
        unit_amount: Math.round(item.product.discountedPrice * 100), // cents
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.FRONTEND_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_CANCEL_URL}`,
      metadata: {
        orderId: order._id.toString(),
        userId: order.user.toString(),
      }
    });

    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    next(error);
  }
};



const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.warn("No orderId in metadata");
      return res.status(400).send("Missing order metadata");
    }

    // ✅ Update order paymentStatus to Paid
    await Order.findByIdAndUpdate(orderId, { paymentStatus: "Paid" });

    console.log(`✅ Payment confirmed for order ${orderId}`);
  }

  res.status(200).json({ received: true });
};
;


module.exports = {
  createCheckoutSession,
  stripeWebhookHandler
};
