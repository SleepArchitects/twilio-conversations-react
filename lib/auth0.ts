import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { createPlainSessionObject } from "./auth/claims-transformer";

export const auth0 = new Auth0Client({
  // Remove trailing slashes and protocol prefixes to avoid mismatches
  appBaseUrl: process.env.NEXT_PUBLIC_APP_BASE_URL?.replace(/\/$/, ""),
  domain: process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, ""),
  // Boolean value to enable the /auth/access-token endpoint for use in the client app.
  enableAccessTokenEndpoint: true,
  logoutStrategy: "auto", // Use v2 logout strategy
  authorizationParameters: {
    audience: "multiple-apis",
  },
  httpTimeout: 5000,
  // Transform namespaced claims to plain properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beforeSessionSaved: async (session: any) => {
    const transformedSession = createPlainSessionObject(session);
    return transformedSession;
  },
});
