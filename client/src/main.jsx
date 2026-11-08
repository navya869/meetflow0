import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft, ArrowRight, AudioLines, Check, Eye, EyeOff, LockKeyhole, Mail,
  MessageCircle, ShieldCheck, Sparkles, Users, Video
} from "lucide-react";
import "./style.css";

async function requestApi(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function dashboardDestination() {
  const query = new URLSearchParams(location.search);
  const next = query.get("next");
  if (next?.startsWith("/") && !next.startsWith("//")) return next;
  const code = query.get("meeting");
  return code ? `/meetings?meeting=${encodeURIComponent(code)}` : "/meetings";
}

function welcomeDestination(returning = false) {
  const query = new URLSearchParams({ next: dashboardDestination() });
  if (returning) query.set("returning", "1");
  return `/welcome?${query}`;
}

function Brand({ compact = false }) {
  return <a className={`brand${compact ? " brand-compact" : ""}`} href="/" aria-label="Meetflow home">
    <img src="/meetflow-logo.svg" alt="" />
    <span>Meetflow</span>
  </a>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 6)" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.51-4.16 7.11-10.29 7.11-17.7Z" />
    <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.19a23.9 23.9 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 6)" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-5.99c-2.15 1.45-4.9 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -6)" />
  </svg>;
}

function BrandStory() {
  return <aside className="auth-story">
    <div className="story-glow story-glow-one" />
    <div className="story-glow story-glow-two" />
    <div className="story-copy">
      <span className="eyebrow"><span className="pulse-dot" /> YOUR SPACE TO CONNECT</span>
      <h1>Better meetings.<br /><span>Bigger ideas.</span></h1>
      <p>Bring your people together with clear conversations and room-ready collaboration.</p>
      <div className="story-points">
        <div><span className="story-icon"><Video size={18} /></span><span><b>Meet in seconds</b><small>One shared link gets your team together.</small></span></div>
        <div><span className="story-icon"><Users size={18} /></span><span><b>Make room for ideas</b><small>Meet, share, and create in one space.</small></span></div>
        <div><span className="story-icon"><ShieldCheck size={18} /></span><span><b>Private by design</b><small>Your account and conversations stay protected.</small></span></div>
      </div>
    </div>
    <div className="connection-visual" aria-hidden="true">
      <div className="connection-ring ring-outer" /><div className="connection-ring ring-inner" />
      <svg className="connection-path" viewBox="0 0 430 280" fill="none">
        <path d="M66 180C88 62 183 49 216 134S324 223 371 89" />
        <path d="M66 180C112 249 228 242 267 159S334 96 371 89" />
      </svg>
      <div className="connection-node node-top"><MessageCircle size={16} /></div>
      <div className="connection-node node-right"><AudioLines size={17} /></div>
      <div className="connection-node node-left"><Users size={16} /></div>
      <div className="connection-call">
        <div className="call-label"><span><i /> LIVE ROOM</span><span>04:28</span></div>
        <div className="call-person"><div className="call-avatar">AM</div><div className="call-name">Alex Morgan<small>Sharing an idea</small></div></div>
        <div className="call-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="call-people"><span>JK</span><span>RL</span><span>+2</span><b><Video size={13} /></b></div>
      </div>
      <div className="connection-caption"><span className="caption-pulse" /> Four voices. One great idea.</div>
    </div>
  </aside>;
}

function AuthShell({ children, title, description, backLink, variant = "default" }) {
  return <div className="auth-page">
    <header className="auth-header">
      <Brand />
      <span className="secure-label"><ShieldCheck size={15} /> Secure workspace</span>
    </header>
    <main className={`auth-layout auth-layout-${variant}`}>
      <BrandStory />
      <section className="auth-card" aria-labelledby="authTitle">
        <Brand compact />
        {backLink && <a className="back-link" href={backLink.href}><ArrowLeft size={15} /> {backLink.label}</a>}
        <div className="card-heading">
          <span className="card-kicker"><Sparkles size={14} /> MEETFLOW</span>
          <h2 id="authTitle">{title}</h2>
          <p className="card-description">{description}</p>
        </div>
        {children}
        <div className="privacy-note"><LockKeyhole size={13} /> Your account is protected with secure encryption.</div>
      </section>
    </main>
    <footer className="auth-footer"><span>© Meetflow · Built for better conversations</span><span>Secure, connected, together</span></footer>
  </div>;
}

function FormMessage({ error, success }) {
  if (error) return <p className="form-message error" role="alert">{error}</p>;
  if (success) return <p className="form-message success" role="status">{success}</p>;
  return null;
}

function PasswordField({ label, value, onChange, autoComplete, placeholder, visible, onToggle, required = true, minLength }) {
  return <label className="field">
    <span>{label}</span>
    <span className="input-wrap">
      <LockKeyhole className="input-icon" size={16} aria-hidden="true" />
      <input
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={128}
        required={required}
      />
      <button className="visibility-button" type="button" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  </label>;
}

function GoogleButton() {
  return <a className="google-button" href="/api/auth/google"><GoogleMark /> Continue with Google</a>;
}

function Divider() {
  return <div className="auth-divider"><span /> <b>or continue with email</b> <span /></div>;
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");

  useEffect(() => {
    const reason = new URLSearchParams(location.search).get("authError");
    const messages = {
      google_not_configured: "Google sign-in is not configured yet. Contact your administrator.",
      google_cancelled: "Google sign-in was cancelled. You can try again or use email.",
      google_failed: "Google sign-in could not be completed. Please try again.",
      google_unverified: "Use a Google account with a verified email address.",
      google_account_conflict: "This email is already linked to a different Google account."
    };
    if (reason) setGoogleError(messages[reason] || messages.google_failed);
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestApi("/api/auth/password/login", { identifier: email.trim(), password, remember });
      location.replace(welcomeDestination(true));
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  return <AuthShell variant="login" title="Welcome back" description="Sign in to pick up right where you left off.">
    <GoogleButton />
    <FormMessage error={googleError} />
    <Divider />
    <form onSubmit={submit} className="auth-form">
      <label className="field">
        <span>Email address</span>
        <span className="input-wrap"><Mail className="input-icon" size={16} aria-hidden="true" />
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required />
        </span>
      </label>
      <PasswordField label="Password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" visible={visible} onToggle={() => setVisible(value => !value)} />
      <p className="password-hint">If you signed up with Google or an email code, use that sign-in method instead.</p>
      <div className="form-options">
        <label className="check-label"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Remember me</span></label>
        <a href="/forgot-password">Forgot password?</a>
      </div>
      <FormMessage error={error} />
      <button className="submit-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
    </form>
    <p className="auth-switch">Don’t have an account? <a href="/register">Create account</a></p>
    <button className="text-button otp-link" type="button" onClick={() => location.assign("/verify-email?intent=login")}>Sign in with an email code instead</button>
  </AuthShell>;
}

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) return setError("Your passwords don’t match.");
    setBusy(true);
    setError("");
    try {
      await requestApi("/api/auth/request-otp", { intent: "register", displayName: name.trim(), identifier: email.trim(), password });
      const query = new URLSearchParams({ intent: "register", email: email.trim(), name: name.trim() });
      location.assign(`/verify-email?${query}`);
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  return <AuthShell variant="register" title="Create your account" description="Start bringing your team together, one great meeting at a time.">
    <GoogleButton />
    <Divider />
    <form onSubmit={submit} className="auth-form">
      <label className="field"><span>Full name</span><span className="input-wrap"><Users className="input-icon" size={16} aria-hidden="true" />
        <input autoComplete="name" maxLength="60" value={name} onChange={event => setName(event.target.value)} placeholder="Alex Morgan" required />
      </span></label>
      <label className="field"><span>Email address</span><span className="input-wrap"><Mail className="input-icon" size={16} aria-hidden="true" />
        <input type="email" autoComplete="email" inputMode="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required />
      </span></label>
      <PasswordField label="Password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} visible={visible} onToggle={() => setVisible(value => !value)} />
      <PasswordField label="Confirm password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Re-enter your password" visible={visible} onToggle={() => setVisible(value => !value)} />
      <p className="password-hint">Use at least 8 characters. Choose a password that works for you.</p>
      <label className="check-label terms-check"><input type="checkbox" checked={agree} onChange={event => setAgree(event.target.checked)} required /><span>I agree to the Terms and Conditions</span></label>
      <FormMessage error={error} />
      <button className="submit-button" type="submit" disabled={busy || !agree}>{busy ? "Sending verification code…" : "Create account"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
    </form>
    <p className="auth-switch">Already have an account? <a href="/">Sign in</a></p>
  </AuthShell>;
}

function VerifyPage() {
  const query = new URLSearchParams(location.search);
  const intent = query.get("intent") === "register" ? "register" : "login";
  const [email, setEmail] = useState(query.get("email") || "");
  const [name] = useState(query.get("name") || "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(Boolean(query.get("email")));
  const [busy, setBusy] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!retryIn) return undefined;
    const timer = window.setTimeout(() => setRetryIn(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);

  async function sendCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestApi("/api/auth/request-otp", { intent, identifier: email.trim(), displayName: name });
      setSent(true);
      setRetryIn(result.retryAfter || 30);
      setNotice(result.message || "A verification code has been sent to your email.");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestApi("/api/auth/verify-otp", { intent, identifier: email.trim(), code });
      location.assign(welcomeDestination(intent === "login"));
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestApi("/api/auth/request-otp", { intent, identifier: email.trim(), displayName: name });
      setRetryIn(result.retryAfter || 30);
      setNotice("A new verification code has been sent.");
      setCode("");
    } catch (reason) {
      setError(reason.message);
      const wait = reason.message.match(/Wait (\d+) seconds/);
      if (wait) setRetryIn(Number(wait[1]));
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell title={sent ? "Check your inbox" : "Sign in with a code"} description={sent ? <>Enter the six-digit code sent to <b className="inline-email">{email}</b>.</> : "We’ll email you a one-time code to securely access your account."} backLink={{ href: intent === "register" ? "/register" : "/", label: "Back to sign in" }}>
    {!sent ? <form onSubmit={sendCode} className="auth-form">
      <label className="field"><span>Email address</span><span className="input-wrap"><Mail className="input-icon" size={16} />
        <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required />
      </span></label>
      <FormMessage error={error} />
      <button className="submit-button" type="submit" disabled={busy}>{busy ? "Sending code…" : "Send sign-in code"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
    </form> : <form onSubmit={verifyCode} className="auth-form">
      <label className="field"><span>6-digit verification code</span><input className="otp-input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></label>
      <FormMessage error={error} success={notice} />
      <button className="submit-button" type="submit" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify email"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
      <div className="code-actions"><button type="button" onClick={resendCode} disabled={busy || retryIn > 0}>{retryIn ? `Resend code in ${retryIn}s` : "Resend code"}</button><button type="button" onClick={() => { setSent(false); setCode(""); setError(""); setNotice(""); }}>Change email</button></div>
    </form>}
  </AuthShell>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestApi("/api/auth/password/reset-request", { identifier: email.trim() });
      setNotice(result.message);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell title="Reset your password" description="No worries. Enter the email linked to your account and we’ll send you a reset link." backLink={{ href: "/", label: "Back to login" }}>
    <form onSubmit={submit} className="auth-form">
      <label className="field"><span>Email address</span><span className="input-wrap"><Mail className="input-icon" size={16} />
        <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" required />
      </span></label>
      <FormMessage error={error} success={notice} />
      <button className="submit-button" type="submit" disabled={busy}>{busy ? "Sending reset link…" : "Send password reset link"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
    </form>
  </AuthShell>;
}

function ResetPasswordPage() {
  const token = new URLSearchParams(location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!token) return setError("This reset link is invalid. Request a new one.");
    if (password !== confirm) return setError("Your passwords don’t match.");
    setBusy(true);
    setError("");
    try {
      await requestApi("/api/auth/password/reset", { token, password });
      location.replace(welcomeDestination(true));
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  }

  return <AuthShell title="Choose a new password" description="Create a strong password to secure your Meetflow account." backLink={{ href: "/forgot-password", label: "Request another link" }}>
    <form onSubmit={submit} className="auth-form">
      <PasswordField label="New password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" minLength={8} visible={visible} onToggle={() => setVisible(value => !value)} />
      <PasswordField label="Confirm new password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" placeholder="Re-enter your password" visible={visible} onToggle={() => setVisible(value => !value)} />
      <p className="password-hint">Use at least 8 characters. Choose a password that works for you.</p>
      <FormMessage error={error} />
      <button className="submit-button" type="submit" disabled={busy || !token}>{busy ? "Updating password…" : "Update password"} {busy ? <span className="spinner" /> : <ArrowRight size={17} />}</button>
    </form>
  </AuthShell>;
}

function WelcomePage() {
  const [validating, setValidating] = useState(true);
  const returning = new URLSearchParams(location.search).get("returning") === "1";
  useEffect(() => {
    requestApi("/api/auth/me")
      .then(() => setValidating(false))
      .catch(() => location.replace("/"));
  }, []);

  return <div className="welcome-page">
    <div className="welcome-celebration" aria-hidden="true">
      <div className="celebration-ring celebration-ring-one" /><div className="celebration-ring celebration-ring-two" />
      {Array.from({ length: 14 }, (_, index) => <i key={index} className={`confetti confetti-${index + 1}`} />)}
      <span className="celebration-orb orb-one" /><span className="celebration-orb orb-two" /><span className="celebration-orb orb-three" />
    </div>
    <div className="welcome-card">
      <Brand />
      <div className="welcome-success"><span><Check size={32} strokeWidth={2.5} /></span><i className="success-spark spark-one" /><i className="success-spark spark-two" /><i className="success-spark spark-three" /></div>
      <span className="card-kicker"><Sparkles size={14} /> {returning ? "WELCOME BACK" : "YOU’RE ALL SET"}</span>
      <h1>{returning ? "Welcome back" : "Welcome to Meetflow"}</h1>
      <p>{returning ? "You’re signed in and ready to pick up where your team left off." : "Your account is ready. It’s time to bring your best conversations to life."}</p>
      <a className="submit-button welcome-cta" href={validating ? undefined : dashboardDestination()} aria-disabled={validating}>{validating ? "Getting things ready…" : returning ? "Go to your workspace" : "Get started"} {validating ? <span className="spinner" /> : <ArrowRight size={17} />}</a>
      <div className="welcome-proof"><ShieldCheck size={15} /> Your workspace is ready and waiting.</div>
    </div>
  </div>;
}

function AuthApp() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const welcome = path === "/welcome";
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    if (welcome) return undefined;
    let active = true;
    requestApi("/api/auth/me")
      .then(() => { if (active) location.replace(dashboardDestination()); })
      .catch(reason => {
        if (active && reason.status !== 401) setSessionError(reason.message);
      });
    return () => { active = false; };
  }, [welcome]);

  const page = welcome ? <WelcomePage />
    : path === "/register" ? <RegisterPage />
      : path === "/forgot-password" ? <ForgotPasswordPage />
        : path === "/reset-password" ? <ResetPasswordPage />
          : path === "/verify-email" ? <VerifyPage />
            : <LoginPage />;
  return <>{sessionError && <p className="session-error" role="alert">{sessionError}</p>}{page}</>;
}

createRoot(document.getElementById("root")).render(<AuthApp />);
