const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  student_id: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  payment_period: { type: String, required: true },
  payment_status: { type: String, enum: ["Registrado", "Acreditado", "Registrado/Sin acreditar"], required: true },
  payment_image: { type: String },
});

module.exports = mongoose.model("Payment", PaymentSchema);
