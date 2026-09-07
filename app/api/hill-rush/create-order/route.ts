import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const age = Number(body.age);

    if (!body.name || !body.whatsapp || !body.gender || !body.location) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(age) || age < 18) {
      return NextResponse.json(
        { error: "Participants must be 18 years or older." },
        { status: 400 }
      );
    }

    const order = await razorpay.orders.create({
      amount: 29900,
      currency: "INR",
      receipt: `hillrush_${Date.now()}`,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);

    return NextResponse.json(
      { error: "Unable to create payment order." },
      { status: 500 }
    );
  }
}
