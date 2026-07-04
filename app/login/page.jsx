"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import toast from "react-hot-toast";
import styles from "./login.module.css";

// ─── Constants (module scope — not re-created on each render) ─────────────────
const PERMS = [
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "instagram_basic",
];

const FEATURES = [
  { icon: "⚡", label: "Smart Automation",  sub: "Rules run 24 / 7"       },
  { icon: "📊", label: "Unified Dashboard", sub: "All accounts, one view" },
  { icon: "🔔", label: "Budget Sentinel",   sub: "Instant ROAS alerts"    },
];

const OAUTH_ERROR_MSGS = {
  OAuthAccountNotLinked: "Account exists with a different provider",
  OAuthCallback:         "Error during Facebook login",
  AccessDenied:          "Login cancelled",
  Configuration:         "Server error — contact support",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Persist the last-used tab so returning users skip the switch */
function getSavedTab() {
  if (typeof window === "undefined") return "social";
  return localStorage.getItem("admigo_loginTab") ?? "social";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [tab,         setTab]         = useState(getSavedTab);
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [ready,       setReady]       = useState(false);
  const [liveMsg,     setLiveMsg]     = useState("");
  const [emailErr,    setEmailErr]    = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const emailRef    = useRef(null);
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { status }   = useSession();

  // ── Mount: animation + URL error params ──────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);

    const err = searchParams.get("error");
    const ok  = searchParams.get("success");

    if (err) {
      const msg = OAUTH_ERROR_MSGS[err] ?? "Login failed. Please try again.";
      toast.error(msg);
      announce(msg);
      window.history.replaceState({}, "", "/login");
    }
    if (ok === "true") {
      toast.success("Connected!");
      announce("Connected!");
      window.history.replaceState({}, "", "/login");
    }

    return () => clearTimeout(t);
  }, [searchParams]);

  // ── Redirect if already authenticated ────────────────────────────────────
  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard");
  }, [status, router]);

  // ── Auto-focus email input when email tab activates ───────────────────────
  useEffect(() => {
    if (tab === "email") emailRef.current?.focus();
  }, [tab]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Post to ARIA live region, auto-clear after 4 s */
  const announce = useCallback((msg) => {
    setLiveMsg(msg);
    setTimeout(() => setLiveMsg(""), 4000);
  }, []);

  /** Switch tab + persist preference */
  function switchTab(t) {
    setTab(t);
    if (typeof window !== "undefined") localStorage.setItem("admigo_loginTab", t);
    setEmailErr("");
    setPasswordErr("");
  }

  /** Single DRY helper for all OAuth providers */
  async function signInWith(provider) {
    setBusy(true);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error(`[LoginPage] ${provider} sign-in error:`, err);
      toast.error("Social login failed. Please try again or use email.");
      announce("Social login failed. Please try again or use email.");
    } finally {
      setBusy(false);
    }
  }

  /** Email / password sign-in */
  async function handleEmail(e) {
    e?.preventDefault();

    // Client-side validation with inline errors
    let valid = true;
    if (!email) {
      setEmailErr("Email address is required"); valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailErr("Enter a valid email address"); valid = false;
    } else {
      setEmailErr("");
    }

    if (!password) {
      setPasswordErr("Password is required"); valid = false;
    } else {
      setPasswordErr("");
    }

    if (!valid) return;

    setBusy(true);
    try {
      const r = await signIn("credentials", { redirect: false, email, password });
      if (r?.error) {
        const msg = r.error === "CredentialsSignin"
          ? "Incorrect email or password"
          : r.error;
        toast.error(msg);
        announce(msg);
        setEmailErr(msg);
      } else if (r?.ok) {
        toast.success("Welcome back!");
        announce("Welcome back!");
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("[LoginPage] credentials sign-in error:", err);
      const msg = "Something went wrong. Please try again.";
      toast.error(msg);
      announce(msg);
    } finally {
      setBusy(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ARIA live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {liveMsg}
      </div>

      {/* ══ SIDEBAR ══ */}
      <aside className={styles.sidebar} aria-label="Admigo branding">

        <Link href="/" className={`${styles.sbLogo} ${styles.fade} ${styles.d0} ${ready ? styles.in : ""}`}>
          <div className={styles.sbLogoBox}>
            <Image src="/admigo.png" alt="Admigo.net" width={36} height={36} style={{ objectFit: "contain" }} />
          </div>
          <div>
            <div className={styles.sbName}>Admigo.net</div>
            <div className={styles.sbTag}>Automate. Optimize. Scale.</div>
          </div>
        </Link>

        <div className={styles.sbBody}>
          <div className={`${styles.sbBadge} ${styles.fade} ${styles.d1} ${ready ? styles.in : ""}`}>
            <span className={styles.pulse} />
            Meta Advanced Access · Verified
          </div>

          <h2 className={`${styles.sbTitle} ${styles.fade} ${styles.d2} ${ready ? styles.in : ""}`}>
            Meta Ads<br />on <span className={styles.ice}>Autopilot.</span>
          </h2>

          <div className={`${styles.sbFeats} ${styles.fade} ${styles.d3} ${ready ? styles.in : ""}`}>
            {FEATURES.map(f => (
              <div className={styles.sbFeat} key={f.label}>
                <div className={styles.sbFeatIco} aria-hidden="true">{f.icon}</div>
                <div>
                  <div className={styles.sbFeatLabel}>{f.label}</div>
                  <div className={styles.sbFeatSub}>{f.sub}</div>
                </div>
                <span className={styles.sbFeatDot} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.sbFoot} ${styles.fade} ${styles.d4} ${ready ? styles.in : ""}`}>
          <div className={styles.sbFootCo}>MARCADEO MEDIA PRIVATE LIMITED</div>
          <div className={styles.sbFootLinks}>
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:admin@realfam.co.in">Contact</a>
          </div>
        </div>
      </aside>

      {/* ══ FORM PANEL ══ */}
      <main className={styles.panel}>

        <div className={`${styles.topbar} ${styles.fade} ${styles.d0} ${ready ? styles.in : ""}`}>
          <Link href="/" className={styles.topbarLink}>← Home</Link>
          <span className={styles.topbarReg}>
            New here? <Link href="/register">Register free →</Link>
          </span>
        </div>

        <div className={`${styles.formWrap} ${styles.fade} ${styles.d1} ${ready ? styles.in : ""}`}>

          <div className={styles.eyebrow}>Sign in</div>
          <h1 className={styles.fTitle}>
            Welcome to <span className={styles.fTitleAccent}>Admigo</span>
          </h1>
          <p className={styles.fSub}>
            Access your Meta ads dashboard and automation rules.
          </p>

          {/* ── Tabs ───────────────────────────────────────────────────────── */}
          <div className={styles.tabs} role="tablist" aria-label="Login method">
            {[
              { id: "social", label: "Social Login"     },
              { id: "email",  label: "Email & Password" },
            ].map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                className={`${styles.tab} ${tab === id ? styles.tabOn : ""}`}
                onClick={() => switchTab(id)}
                disabled={busy}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Social panel ───────────────────────────────────────────────── */}
          <div role="tabpanel" id="panel-social" aria-labelledby="tab-social" hidden={tab !== "social"}>

            <button
              className={`${styles.btn} ${styles.btnFb}`}
              onClick={() => signInWith("facebook")}
              disabled={busy}
              aria-label="Continue with Facebook"
            >
              <Image src="/fblogo.webp" alt="" width={18} height={18} style={{ borderRadius: "4px", flexShrink: 0 }} aria-hidden="true" />
              {busy ? <><span className={styles.spin} aria-hidden="true" />Connecting…</> : "Continue with Facebook"}
            </button>

            <button
              className={`${styles.btn} ${styles.btnGg}`}
              onClick={() => signInWith("google")}
              disabled={busy}
              aria-label="Continue with Google"
            >
              <GoogleIcon />
              {busy ? <><span className={`${styles.spin} ${styles.spinDark}`} aria-hidden="true" />Connecting…</> : "Continue with Google"}
            </button>

            {/* Meta App Review — data disclosure (required for Advanced Access) */}
            <div className={styles.disclosure} role="note" aria-label="Meta data access disclosure">
              <div className={styles.discHd}>
                <span className={styles.discI} aria-hidden="true">ℹ</span>
                What Admigo accesses via Facebook
              </div>
              <div className={styles.discPerms}>
                {PERMS.map(p => <span className={styles.dp} key={p}>{p}</span>)}
              </div>
              <p className={styles.discNote}>
                We only access your ad accounts, campaigns &amp; Pages to power
                automation and reporting. We never post on your behalf or read
                personal data.{" "}
                <Link href="/privacy-policy">Privacy Policy →</Link>
              </p>
            </div>
          </div>

          {/* ── Email panel ────────────────────────────────────────────────── */}
          <div role="tabpanel" id="panel-email" aria-labelledby="tab-email" hidden={tab !== "email"}>
            <form onSubmit={handleEmail} noValidate>

              {/* Email field */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="e-email">Email address</label>
                <input
                  ref={emailRef}
                  id="e-email"
                  type="email"
                  className={`${styles.fieldInput} ${emailErr ? styles.fieldInputError : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(""); }}
                  disabled={busy}
                  autoComplete="email"
                  required
                  aria-describedby={emailErr ? "e-email-err" : undefined}
                  aria-invalid={!!emailErr}
                />
                {emailErr && (
                  <span id="e-email-err" role="alert" className={styles.fieldError}>
                    {emailErr}
                  </span>
                )}
              </div>

              {/* Password field */}
              <div className={styles.field}>
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel} htmlFor="e-pass">Password</label>
                  <Link href="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
                </div>
                <div className={styles.passwordWrap}>
                  <input
                    id="e-pass"
                    type={showPass ? "text" : "password"}
                    className={`${styles.fieldInput} ${passwordErr ? styles.fieldInputError : ""}`}
                    placeholder="Your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPasswordErr(""); }}
                    disabled={busy}
                    autoComplete="current-password"
                    required
                    aria-describedby={passwordErr ? "e-pass-err" : undefined}
                    aria-invalid={!!passwordErr}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {passwordErr && (
                  <span id="e-pass-err" role="alert" className={styles.fieldError}>
                    {passwordErr}
                  </span>
                )}
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={busy}>
                {busy
                  ? <><span className={styles.spin} aria-hidden="true" />Please wait…</>
                  : <>Sign In <span className={styles.arr} aria-hidden="true">→</span></>
                }
              </button>

              <div className={styles.or} aria-hidden="true">or</div>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnFb}`}
                onClick={() => signInWith("facebook")}
                disabled={busy}
                aria-label="Continue with Facebook"
              >
                <Image src="/fblogo.webp" alt="" width={17} height={17} style={{ borderRadius: "4px", flexShrink: 0 }} aria-hidden="true" />
                {busy ? "Connecting…" : "Continue with Facebook"}
              </button>

            </form>
          </div>

          <p className={styles.reg}>
            Don&apos;t have an account?{" "}
            <Link href="/register">Create one free →</Link>
          </p>
        </div>

        <div className={`${styles.pfooter} ${styles.fade} ${styles.d5} ${ready ? styles.in : ""}`}>
          <div className={styles.pfooterInner}>
            <div className={styles.pfooterLinks}>
              <Link href="/privacy-policy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <a href="mailto:admin@realfam.co.in">Contact</a>
            </div>
            <span className={styles.pfooterCopy}>
              © {new Date().getFullYear()} MARCADEO MEDIA PRIVATE LIMITED
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
