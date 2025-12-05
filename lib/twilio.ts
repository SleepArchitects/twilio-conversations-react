import twilio from "twilio";
import { Twilio } from "twilio";

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;

// Singleton Twilio client instance
let twilioClient: Twilio | null = null;

/**
 * Get the Twilio client instance (singleton pattern)
 * Used for server-side operations with Twilio Messaging API
 */
export function getTwilioClient(): Twilio {
  if (!twilioClient) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error(
        "Missing required Twilio credentials: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set",
      );
    }
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Validate that the Messaging Service SID is configured
 */
export function getMessagingServiceSid(): string {
  const sid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid) {
    throw new Error(
      "Missing TWILIO_MESSAGING_SERVICE_SID environment variable",
    );
  }
  return sid;
}
