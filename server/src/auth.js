import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";
import { OtpChallenge, PasswordReset, User } from "./models.js";
import {
  createOtp,
  createPasswordResetToken,
  createSessionToken,
  hashOtp,
  hashPassword,
  hashResetToken,
  normalizeEmail,
  safeEqualHex,
  verifyPassword,
  verifySessionToken
} from "./security.js";
import { DeliveryConfigurationError, sendOtp, sendPasswordReset } from "./delivery.js";

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const MAX_OTP_SENDS_PER_WINDOW = 5;
const MAX_OTP_ATTEMPTS = 5;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

function safeUser(user) {
  return { id: String(user._id), displayName: user.displayName, email: user.email };
}

function setSessionCookie(res, userId, remember = true) {
  const maxAge = remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  res.cookie(config.sessionCookie, createSessionToken(userId, config.jwtSecret, Date.now(), maxAge), {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[config.sessionCookie];
  const claims = verifySessionToken(token, config.jwtSecret);
  if (!claims) return res.status(401).json({ detail: "Please sign in to continue." });
  try {
    const user = await User.findById(claims.sub);
    if (!user) return res.status(401).json({ detail: "Your session is no longer valid. Please sign in again." });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function validPassword(password) {
  const length = typeof password === "string" ? Array.from(password).length : 0;
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

function setTransientCookie(res, name, value, maxAge) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

function clearTransientCookie(res, name) {
  res.clearCookie(name, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/" });
}

export function createAuthRouter({
  UserModel = User,
  OtpModel = OtpChallenge,
  ResetModel = PasswordReset,
  deliverOtp = sendOtp,
  deliverPasswordReset = sendPasswordReset,
  oauthClient = new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleRedirectUri)
} = {}) {
const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { detail: "Too many verification attempts. Please wait 15 minutes and try again." }
});

router.post("/request-otp", authRateLimit, async (req, res, next) => {
  try {
    const { intent, displayName, password } = req.body || {};
    if (!["login", "register"].includes(intent)) return res.status(400).json({ detail: "Choose login or register." });
    if (req.body?.channel !== undefined && req.body.channel !== "email") return res.status(400).json({ detail: "Only email verification is supported." });
    const identity = normalizeEmail(req.body?.identifier);
    const name = String(displayName || "").trim();
    if (intent === "register" && (!name || name.length > 60)) {
      return res.status(400).json({ detail: "Enter a name between 1 and 60 characters." });
    }
    if (password !== undefined && intent !== "register") return res.status(400).json({ detail: "Password is only used when creating an account." });
    if (password !== undefined && !validPassword(password)) return res.status(400).json({ detail: "Use a password between 8 and 128 characters." });

    const user = await UserModel.findOne({ email: identity });
    if (intent === "register" && user) return res.status(409).json({ detail: "An account already uses this contact. Sign in instead." });
    if (intent === "login" && !user) return res.status(404).json({ detail: "No account uses this contact. Register first." });

    const now = new Date();
    const existing = await OtpModel.findOne({ identity, intent });
    if (existing && now.getTime() - existing.sentAt.getTime() < RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - existing.sentAt.getTime())) / 1000);
      return res.status(429).json({ detail: `Wait ${retryAfter} seconds before requesting another code.`, retryAfter });
    }
    const withinWindow = existing?.windowStarted && now.getTime() - existing.windowStarted.getTime() < OTP_WINDOW_MS;
    const windowStarted = withinWindow ? existing.windowStarted : now;
    const sendCount = withinWindow ? existing.sendCount || 0 : 0;
    if (sendCount >= MAX_OTP_SENDS_PER_WINDOW) {
      const retryAfter = Math.ceil((OTP_WINDOW_MS - (now.getTime() - windowStarted.getTime())) / 1000);
      return res.status(429).json({ detail: "Too many codes have been requested for this contact. Please try again later.", retryAfter });
    }

    const { code, codeHash } = createOtp(config.otpSecret);
    const passwordHash = password === undefined ? existing?.passwordHash : await hashPassword(password);
    await OtpModel.findOneAndUpdate(
      { identity, intent },
      { $set: { codeHash, displayName: name, passwordHash, attempts: 0, sendCount: sendCount + 1, windowStarted, sentAt: now, expiresAt: new Date(now.getTime() + OTP_WINDOW_MS) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    try {
      await deliverOtp({ identity, code });
    } catch (error) {
      await OtpModel.deleteOne({ identity, intent, codeHash });
      if (error instanceof DeliveryConfigurationError) return res.status(503).json({ detail: error.message });
      console.error("OTP delivery failed:", error?.code || error?.name || "provider error");
      return res.status(502).json({ detail: "Could not send the verification code. Check your provider settings and try again." });
    }
    return res.json({ message: "A verification code was sent to your email.", expiresInSeconds: OTP_LIFETIME_MS / 1000, retryAfter: RESEND_COOLDOWN_MS / 1000 });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Enter ") || error.message.startsWith("Choose "))) {
      return res.status(400).json({ detail: error.message });
    }
    return next(error);
  }
});

router.post("/password/login", authRateLimit, async (req, res, next) => {
  try {
    const identity = normalizeEmail(req.body?.identifier);
    const password = req.body?.password;
    if (typeof password !== "string" || password.length > 1024) {
      return res.status(401).json({ detail: "Email or password is incorrect." });
    }
    const user = await UserModel.findOne({ email: identity });
    if (!user?.passwordHash || !await verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ detail: "Email or password is incorrect." });
    }
    setSessionCookie(res, user._id, req.body?.remember !== false);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Enter ")) return res.status(400).json({ detail: error.message });
    return next(error);
  }
});

router.post("/password/reset-request", authRateLimit, async (req, res, next) => {
  try {
    const identity = normalizeEmail(req.body?.identifier);
    const user = await UserModel.findOne({ email: identity });
    if (!user) return res.json({ message: "If an account exists for that email, a password reset link is on its way." });

    const { token, tokenHash } = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await ResetModel.findOneAndUpdate(
      { identity },
      { $set: { tokenHash, expiresAt } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    try {
      const resetUrl = new URL("/reset-password", config.clientOrigin);
      resetUrl.searchParams.set("token", token);
      await deliverPasswordReset({ identity, resetUrl: resetUrl.toString() });
    } catch (error) {
      await ResetModel.deleteOne({ identity, tokenHash });
      if (error instanceof DeliveryConfigurationError) return res.status(503).json({ detail: error.message });
      console.error("Password reset email failed:", error?.code || error?.name || "provider error");
      return res.status(502).json({ detail: "Could not send the password reset email. Please try again later." });
    }
    return res.json({ message: "If an account exists for that email, a password reset link is on its way." });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Enter ")) return res.status(400).json({ detail: error.message });
    return next(error);
  }
});

router.post("/password/reset", authRateLimit, async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    const password = req.body?.password;
    if (!/^[\w-]{40,60}$/.test(token)) return res.status(400).json({ detail: "This password reset link is invalid or expired. Request a new one." });
    if (!validPassword(password)) return res.status(400).json({ detail: "Use a password between 8 and 128 characters." });

    const challenge = await ResetModel.findOneAndDelete({
      tokenHash: hashResetToken(token),
      expiresAt: { $gt: new Date() }
    });
    if (!challenge) return res.status(400).json({ detail: "This password reset link is invalid or expired. Request a new one." });
    const passwordHash = await hashPassword(password);
    const user = await UserModel.findOneAndUpdate(
      { email: challenge.identity },
      { $set: { passwordHash } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(400).json({ detail: "This account no longer exists. Request a new password reset link." });
    setSessionCookie(res, user._id);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get("/google", (req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.redirect(`${config.clientOrigin}/?authError=google_not_configured`);
  }
  const state = randomBytes(32).toString("base64url");
  setTransientCookie(res, "meetflow_oauth_state", state, 10 * 60 * 1000);
  return res.redirect(oauthClient.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state
  }));
});

router.get("/google/callback", async (req, res, next) => {
  const loginUrl = new URL("/", config.clientOrigin);
  const returnedState = String(req.query?.state || "");
  const storedState = req.cookies?.meetflow_oauth_state || "";
  clearTransientCookie(res, "meetflow_oauth_state");
  if (req.query?.error === "access_denied") {
    loginUrl.searchParams.set("authError", "google_cancelled");
    return res.redirect(loginUrl.toString());
  }
  if (!storedState || !returnedState || !safeEqualHex(
    createHash("sha256").update(storedState).digest("hex"),
    createHash("sha256").update(returnedState).digest("hex")
  )) {
    loginUrl.searchParams.set("authError", "google_failed");
    return res.redirect(loginUrl.toString());
  }
  try {
    const { tokens } = await oauthClient.getToken(String(req.query?.code || ""));
    if (!tokens.id_token) throw new Error("Google did not return an ID token.");
    const ticket = await oauthClient.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      loginUrl.searchParams.set("authError", "google_unverified");
      return res.redirect(loginUrl.toString());
    }
    const identity = normalizeEmail(profile.email);
    let user = await UserModel.findOne({ $or: [{ googleId: profile.sub }, { email: identity }] });
    let isNewUser = false;
    if (!user) {
      user = await UserModel.create({
        displayName: String(profile.name || "Meetflow user").trim().slice(0, 60) || "Meetflow user",
        email: identity,
        googleId: profile.sub,
        verifiedAt: new Date()
      });
      isNewUser = true;
    } else if (user.googleId && user.googleId !== profile.sub) {
      loginUrl.searchParams.set("authError", "google_account_conflict");
      return res.redirect(loginUrl.toString());
    } else if (!user.googleId) {
      user.googleId = profile.sub;
      await user.save();
    }
    setSessionCookie(res, user._id);
    const welcomeUrl = new URL("/welcome", config.clientOrigin);
    if (!isNewUser) {
      welcomeUrl.searchParams.set("returning", "1");
      welcomeUrl.searchParams.set("next", "/meetings");
    }
    return res.redirect(welcomeUrl.toString());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Enter ")) {
      loginUrl.searchParams.set("authError", "google_failed");
      return res.redirect(loginUrl.toString());
    }
    return next(error);
  }
});

router.post("/verify-otp", authRateLimit, async (req, res, next) => {
  try {
    const { intent } = req.body || {};
    if (!["login", "register"].includes(intent)) return res.status(400).json({ detail: "Choose login or register." });
    if (req.body?.channel !== undefined && req.body.channel !== "email") return res.status(400).json({ detail: "Only email verification is supported." });
    const identity = normalizeEmail(req.body?.identifier);
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ detail: "Enter the 6-digit verification code." });

    const now = new Date();
    const challenge = await OtpModel.findOneAndUpdate(
      { identity, intent, sentAt: { $gt: new Date(now.getTime() - OTP_LIFETIME_MS) }, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!challenge) return res.status(400).json({ detail: "The code expired or is no longer valid. Request a new one." });
    if (!safeEqualHex(challenge.codeHash, hashOtp(config.otpSecret, code))) {
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - challenge.attempts);
      return res.status(400).json({ detail: remaining ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "Too many incorrect codes. Request a new one." });
    }

    const consumed = await OtpModel.findOneAndDelete({ _id: challenge._id, codeHash: challenge.codeHash, attempts: challenge.attempts });
    if (!consumed) return res.status(400).json({ detail: "This code has already been used. Request a new one." });

    const contact = { email: identity };
    let user;
    if (intent === "register") {
      user = await UserModel.create({
        ...contact,
        displayName: challenge.displayName,
        passwordHash: challenge.passwordHash,
        verifiedAt: now
      });
    } else {
      user = await UserModel.findOne(contact);
      if (!user) return res.status(404).json({ detail: "This account no longer exists. Please register." });
    }
    setSessionCookie(res, user._id);
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ detail: "An account already uses this contact. Sign in instead." });
    if (error instanceof Error && (error.message.startsWith("Enter ") || error.message.startsWith("Choose "))) {
      return res.status(400).json({ detail: error.message });
    }
    return next(error);
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
router.post("/logout", (_req, res) => {
  res.clearCookie(config.sessionCookie, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax", path: "/" });
  res.json({ ok: true });
});
return router;
}

export const authRouter = createAuthRouter();
