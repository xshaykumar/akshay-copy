import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(request: Request) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("Razorpay environment variables are missing");
      return NextResponse.json(
        { error: "Razorpay configuration is missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const age = Number(body.age);

    if (
      !body.name ||
      !body.whatsapp ||
      !body.gender ||
      !body.location
    ) {
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

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: 29900,
      currency: "INR",
      receipt: `hillrush_${Date.now()}`,
    });

    console.log("Razorpay order created:", order.id);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
    });
  } catch (error: any) {
    console.error("RAZORPAY ERROR:", {
      statusCode: error?.statusCode,
      code: error?.error?.code,
      description: error?.error?.description,
      message: error?.message,
    });

    return NextResponse.json(
      {
        error:
          error?.error?.description ||
          error?.message ||
          "Unable to create payment order.",
      },
      { status: 500 }
    );
  }
}
