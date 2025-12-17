import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

/**
 * Test endpoint to send SMS directly
 *
 * POST /api/outreach/test-sms
 * Body: { to: "+525513744632", body: "Hello from test!", from: "+1XXXXXXXXXX" }
 *
 * NOTE: This is for development/testing only. Remove in production.
 */

const TWILIO_ACCOUNT_SID =
  process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Validate Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return NextResponse.json(
        {
          error: "Missing Twilio credentials",
          help: "Set TWILIO_SID and TWILIO_AUTH_TOKEN in .env.local",
        },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { to, message, from } = body;

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { error: "Missing 'to' phone number" },
        { status: 400 },
      );
    }

    if (!from) {
      return NextResponse.json(
        {
          error: "Missing 'from' phone number",
          help: "You need a Twilio phone number. Get one at https://console.twilio.com/us1/develop/phone-numbers/manage/incoming",
        },
        { status: 400 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "Missing 'message' body" },
        { status: 400 },
      );
    }

    // Initialize Twilio client
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Send SMS
    const smsMessage = await client.messages.create({
      body: message,
      to: to,
      from: from,
    });

    console.log(`[test-sms] Sent SMS to ${to}: ${smsMessage.sid}`);

    return NextResponse.json({
      success: true,
      messageSid: smsMessage.sid,
      status: smsMessage.status,
      to: smsMessage.to,
      from: smsMessage.from,
    });
  } catch (error) {
    console.error("[test-sms] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to send SMS",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

// GET endpoint to show usage instructions
export async function GET() {
  return NextResponse.json({
    usage: "POST /outreach/api/outreach/test-sms",
    body: {
      to: "+525513744632 (your phone)",
      from: "+1XXXXXXXXXX (your Twilio number)",
      message: "Hello from SMS Outreach!",
    },
    note: "Get a Twilio phone number at https://console.twilio.com/us1/develop/phone-numbers/manage/incoming",
  });
}
