import "dotenv/config";

const requiredSecrets = ["JWT_SECRET", "OTP_SECRET"];
for (const name of requiredSecrets) {
  const value = process.env[name];
  if (!value || value.length < 32 || value.startsWith("replace-with-")) {
    throw new Error(`${name} must be configured with a random value of at least 32 characters.`);
  }
}

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Set it in your environment or .env file.");
}

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const vercelOrigin = vercelHost ? `https://${vercelHost}` : "";
const clientOrigin = process.env.CLIENT_ORIGIN || vercelOrigin || "http://127.0.0.1:5173";

export const config = Object.freeze({
  port: Number(process.env.PORT || 8000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  otpSecret: process.env.OTP_SECRET,
  clientOrigin,
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || `${clientOrigin}/api/auth/google/callback`,
  sessionCookie: "meetflow_session"
});
