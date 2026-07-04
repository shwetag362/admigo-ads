"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "account", label: "Account"  },
  { id: "profile", label: "Profile"  },
  { id: "done",    label: "Done"     },
];

const BENEFITS = [
  { icon: "🚀", label: "Free 14-day trial",    sub: "No credit card required"     },
  { icon: "🔒", label: "Enterprise security",  sub: "SOC 2 · GDPR compliant"      },
  { icon: "⚡", label: "Live in 5 minutes",    sub: "Connect your first ad account" },
];

const PASSWORD_RULES = [
  { id: "len",   test: (p) => p.length >= 8,            label: "At least 8 characters" },
  { id: "upper", test: (p) => /[A-Z]/.test(p),          label: "One uppercase letter"  },
  { id: "num",   test: (p) => /[0-9]/.test(p),          label: "One number"            },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Component ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();

  const [tab,       setTab]      = useState("social");
  const [busy,      setBusy]     = useState(false);
  const [ready,     setReady]    = useState(false);
  const [liveMsg,   setLiveMsg]  = useState("");

  // Form fields
  const [name,      setName]     = useState("");
  const [email,     setEmail]    = useState("");
  const [password,  setPassword] = useState("");
  const [showPass,  setShowPass] = useState(false);

  // Field errors
  const [nameErr,   setNameErr]  = useState("");
  const [emailErr,  setEmailErr] = useState("");
  const [passErr,   setPassErr]  = useState("");

  // General error (server-side)
  const [serverErr, setServerErr] = useState("");

  const nameRef  = useRef(null);
  const emailRef = useRef(null);

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Auto-focus first field when email tab opens ───────────────────────────
  useEffect(() => {
    if (tab === "email") nameRef.current?.focus();
  }, [tab]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const announce = useCallback((msg) => {
    setLiveMsg(msg);
    setTimeout(() => setLiveMsg(""), 4000);
  }, []);

  function switchTab(t) {
    setTab(t);
    setNameErr(""); setEmailErr(""); setPassErr(""); setServerErr("");
  }

  /** Password strength (0–3) */
  const strength = PASSWORD_RULES.filter(r => r.test(password)).length;

  /** Single DRY OAuth helper */
  async function signInWith(provider) {
    setBusy(true);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error(`[RegisterPage] ${provider} error:`, err);
      announce("Social sign-up failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Email registration */
  async function handleEmailSignup(e) {
    e.preventDefault();
    setServerErr("");

    // Client-side validation
    let valid = true;
    if (!name.trim()) {
      setNameErr("Full name is required"); valid = false;
    } else { setNameErr(""); }

    if (!email) {
      setEmailErr("Email address is required"); valid = false;
    } else if (!EMAIL_REGEX.test(email)) {
      setEmailErr("Enter a valid email address"); valid = false;
    } else { setEmailErr(""); }

    if (!password) {
      setPassErr("Password is required"); valid = false;
    } else if (strength < 3) {
      setPassErr("Password doesn't meet all requirements"); valid = false;
    } else { setPassErr(""); }

    if (!valid) return;

    setBusy(true);
    try {
      // Step 1 — create account
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        const msg = signupData.error || "Signup failed. Please try again.";
        setServerErr(msg);
        announce(msg);
        return;
      }

      // Step 2 — auto sign-in
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        const msg = "Account created! Please sign in to continue.";
        setServerErr(msg);
        announce(msg);
        router.push("/login");
        return;
      }

      if (signInResult?.ok) {
        announce("Account created! Redirecting…");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("[RegisterPage] signup error:", err);
      const msg = "Something went wrong. Please try again.";
      setServerErr(msg);
      announce(msg);
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ARIA live region */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {liveMsg}
      </div>

      {/* ══ SIDEBAR ══ */}
      <aside className={styles.sidebar} aria-label="Admigo registration benefits">

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
            Join 2,400+ marketers
          </div>

          <h2 className={`${styles.sbTitle} ${styles.fade} ${styles.d2} ${ready ? styles.in : ""}`}>
            Start growing<br />your <span className={styles.ice}>Meta ads.</span>
          </h2>

          <div className={`${styles.sbBenefits} ${styles.fade} ${styles.d3} ${ready ? styles.in : ""}`}>
            {BENEFITS.map(b => (
              <div className={styles.sbBenefit} key={b.label}>
                <div className={styles.sbBenefitIco} aria-hidden="true">{b.icon}</div>
                <div>
                  <div className={styles.sbBenefitLabel}>{b.label}</div>
                  <div className={styles.sbBenefitSub}>{b.sub}</div>
                </div>
                <span className={styles.sbBenefitDot} aria-hidden="true" />
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className={`${styles.sbProof} ${styles.fade} ${styles.d4} ${ready ? styles.in : ""}`}>
            <div className={styles.sbProofAvatars} aria-hidden="true">
              {["#4A6FFF","#22C55E","#F59E0B","#EF4444"].map((c, i) => (
                <span key={i} className={styles.sbAvatar} style={{ background: c, zIndex: 4 - i }} />
              ))}
            </div>
            <span className={styles.sbProofText}>
              Trusted by teams at 150+ agencies
            </span>
          </div>
        </div>

        <div className={`${styles.sbFoot} ${styles.fade} ${styles.d5} ${ready ? styles.in : ""}`}>
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
          <span className={styles.topbarLogin}>
            Have an account? <Link href="/login">Sign in →</Link>
          </span>
        </div>

        <div className={`${styles.formWrap} ${styles.fade} ${styles.d1} ${ready ? styles.in : ""}`}>

          <div className={styles.eyebrow}>Create account</div>
          <h1 className={styles.fTitle}>
            Join <span className={styles.fTitleAccent}>Admigo</span>
          </h1>
          <p className={styles.fSub}>
            Set up your account in under 2 minutes. No credit card needed.
          </p>

          {/* Server error banner */}
          {serverErr && (
            <div className={styles.serverErr} role="alert">
              <span className={styles.serverErrIcon} aria-hidden="true">⚠</span>
              {serverErr}
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className={styles.tabs} role="tablist" aria-label="Registration method">
            {[
              { id: "social", label: "One-click" },
              { id: "email",  label: "Email"     },
            ].map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                id={`rtab-${id}`}
                aria-selected={tab === id}
                aria-controls={`rpanel-${id}`}
                className={`${styles.tab} ${tab === id ? styles.tabOn : ""}`}
                onClick={() => switchTab(id)}
                disabled={busy}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Social panel ─────────────────────────────────────────────── */}
          <div role="tabpanel" id="rpanel-social" aria-labelledby="rtab-social" hidden={tab !== "social"}>

            <button
              className={`${styles.btn} ${styles.btnFb}`}
              onClick={() => signInWith("facebook")}
              disabled={busy}
              aria-label="Continue with Facebook"
            >
              <Image src="/fblogo.webp" alt="" width={18} height={18} style={{ borderRadius: "4px", flexShrink: 0 }} aria-hidden="true" />
              {busy
                ? <><span className={styles.spin} aria-hidden="true" />Connecting…</>
                : "Continue with Facebook"
              }
            </button>

            <button
              className={`${styles.btn} ${styles.btnGg}`}
              onClick={() => signInWith("google")}
              disabled={busy}
              aria-label="Continue with Google"
            >
              <GoogleIcon />
              {busy
                ? <><span className={`${styles.spin} ${styles.spinDark}`} aria-hidden="true" />Connecting…</>
                : "Continue with Google"
              }
            </button>

            <div className={styles.divider} aria-hidden="true">
              <span>Secure · Instant · Free</span>
            </div>

            <p className={styles.legalNote}>
              By continuing you agree to our{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy-policy">Privacy Policy</Link>.
            </p>
          </div>

          {/* ── Email panel ──────────────────────────────────────────────── */}
          <div role="tabpanel" id="rpanel-email" aria-labelledby="rtab-email" hidden={tab !== "email"}>
            <form onSubmit={handleEmailSignup} noValidate>

              {/* Full name */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="r-name">Full name</label>
                <input
                  ref={nameRef}
                  id="r-name"
                  type="text"
                  className={`${styles.fieldInput} ${nameErr ? styles.fieldInputError : ""}`}
                  placeholder="Jane Smith"
                  value={name}
                  onChange={e => { setName(e.target.value); setNameErr(""); }}
                  disabled={busy}
                  autoComplete="name"
                  required
                  aria-describedby={nameErr ? "r-name-err" : undefined}
                  aria-invalid={!!nameErr}
                />
                {nameErr && (
                  <span id="r-name-err" role="alert" className={styles.fieldError}>{nameErr}</span>
                )}
              </div>

              {/* Email */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="r-email">Email address</label>
                <input
                  ref={emailRef}
                  id="r-email"
                  type="email"
                  className={`${styles.fieldInput} ${emailErr ? styles.fieldInputError : ""}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailErr(""); }}
                  disabled={busy}
                  autoComplete="email"
                  required
                  aria-describedby={emailErr ? "r-email-err" : undefined}
                  aria-invalid={!!emailErr}
                />
                {emailErr && (
                  <span id="r-email-err" role="alert" className={styles.fieldError}>{emailErr}</span>
                )}
              </div>

              {/* Password */}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="r-pass">Password</label>
                <div className={styles.passwordWrap}>
                  <input
                    id="r-pass"
                    type={showPass ? "text" : "password"}
                    className={`${styles.fieldInput} ${passErr ? styles.fieldInputError : ""}`}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPassErr(""); }}
                    disabled={busy}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-describedby="r-pass-rules"
                    aria-invalid={!!passErr}
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

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className={styles.strengthWrap} aria-hidden="true">
                    <div className={styles.strengthBar}>
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className={`${styles.strengthSegment} ${
                            i < strength
                              ? strength === 1 ? styles.strengthWeak
                              : strength === 2 ? styles.strengthMed
                              : styles.strengthStrong
                              : ""
                          }`}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel}>
                      {strength === 0 ? "" : strength === 1 ? "Weak" : strength === 2 ? "Fair" : "Strong"}
                    </span>
                  </div>
                )}

                {/* Password rules */}
                <ul id="r-pass-rules" className={styles.passRules}>
                  {PASSWORD_RULES.map(r => (
                    <li
                      key={r.id}
                      className={`${styles.passRule} ${r.test(password) ? styles.passRuleOk : ""}`}
                    >
                      <span className={styles.passRuleDot} aria-hidden="true" />
                      {r.label}
                    </li>
                  ))}
                </ul>

                {passErr && (
                  <span role="alert" className={styles.fieldError}>{passErr}</span>
                )}
              </div>

              <button type="submit" className={styles.btnSubmit} disabled={busy}>
                {busy
                  ? <><span className={styles.spin} aria-hidden="true" />Creating account…</>
                  : <>Create account <span className={styles.arr} aria-hidden="true">→</span></>
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

          <p className={styles.loginNudge}>
            Already have an account?{" "}
            <Link href="/login">Sign in →</Link>
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