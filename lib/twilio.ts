import twilio from "twilio";
import { Twilio } from "twilio";

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID!;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET!;
const TWILIO_CONVERSATIONS_SERVICE_SID =
  process.env.TWILIO_CONVERSATIONS_SERVICE_SID!;

// Token TTL: 1 hour
const TOKEN_TTL = 3600;

// Singleton Twilio client instance
let twilioClient: Twilio | null = null;

/**
 * Get the Twilio client instance (singleton pattern)
 * Used for server-side operations with Twilio Conversations API
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
 * Generate an access token for the Twilio Conversations SDK (frontend)
 * @param identity - Unique identifier for the user (e.g., user ID or email)
 * @returns JWT access token string
 */
export function generateAccessToken(identity: string): string {
  if (!identity) {
    throw new Error("Identity is required for token generation");
  }

  if (!TWILIO_ACCOUNT_SID) {
    throw new Error("Missing TWILIO_ACCOUNT_SID environment variable");
  }
  if (!TWILIO_API_KEY_SID) {
    throw new Error("Missing TWILIO_API_KEY_SID environment variable");
  }
  if (!TWILIO_API_KEY_SECRET) {
    throw new Error("Missing TWILIO_API_KEY_SECRET environment variable");
  }
  if (!TWILIO_CONVERSATIONS_SERVICE_SID) {
    throw new Error(
      "Missing TWILIO_CONVERSATIONS_SERVICE_SID environment variable",
    );
  }

  // Create access token with credentials
  const accessToken = new twilio.jwt.AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    {
      identity,
      ttl: TOKEN_TTL,
    },
  );

  // Create a Conversations grant and add to token
  const chatGrant = new twilio.jwt.AccessToken.ChatGrant({
    serviceSid: TWILIO_CONVERSATIONS_SERVICE_SID,
  });

  accessToken.addGrant(chatGrant);

  return accessToken.toJwt();
}
