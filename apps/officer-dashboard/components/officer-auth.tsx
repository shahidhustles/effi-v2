"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthSlideshow } from "./auth-slideshow";

type AuthView =
  | { kind: "credentials"; mode: "sign-in" | "sign-up" }
  | { kind: "verify-sign-up"; emailAddress: string }
  | { kind: "verify-sign-in"; emailAddress: string };

export function OfficerAuth() {
  const router = useRouter();
  const { signIn, errors: signInErrors, fetchStatus: signInStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpStatus } = useSignUp();
  const [view, setView] = useState<AuthView>({ kind: "credentials", mode: "sign-in" });
  const [message, setMessage] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const isBusy = signInStatus === "fetching" || signUpStatus === "fetching";

  const finishSignIn = async () => {
    const { error } = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const destination = decorateUrl("/");
        router.replace(destination);
      },
    });
    if (error) setMessage(error.message);
  };

  const finishSignUp = async () => {
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const destination = decorateUrl("/");
        router.replace(destination);
      },
    });
    if (error) setMessage(error.message);
  };

  const handleCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const normalizedEmail = emailAddress.trim();

    if (view.kind !== "credentials") return;
    if (view.mode === "sign-in") {
      const { error } = await signIn.password({ emailAddress: normalizedEmail, password });
      if (error) return;
      if (signIn.status === "complete") {
        await finishSignIn();
        return;
      }
      if (signIn.status === "needs_second_factor") {
        const supportsEmailCode = signIn.supportedSecondFactors.some((factor) => factor.strategy === "email_code");
        if (!supportsEmailCode) {
          setMessage("This account needs a second factor that is not available on this screen. Contact your Effi administrator.");
          return;
        }
        const { error: codeError } = await signIn.mfa.sendEmailCode();
        if (!codeError) setView({ kind: "verify-sign-in", emailAddress: normalizedEmail });
        return;
      }
      setMessage("Clerk needs another sign-in step that this officer screen does not support yet.");
      return;
    }

    const { error } = await signUp.password({ emailAddress: normalizedEmail, password });
    if (error) return;
    if (signUp.status === "complete") {
      await finishSignUp();
      return;
    }
    if (signUp.unverifiedFields.includes("email_address")) {
      const { error: codeError } = await signUp.verifications.sendEmailCode();
      if (!codeError) setView({ kind: "verify-sign-up", emailAddress: normalizedEmail });
      return;
    }
    setMessage("Clerk needs more account information. Ask your Effi administrator to review the sign-up settings.");
  };

  const handleVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (view.kind === "verify-sign-up") {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (!error && signUp.status === "complete") await finishSignUp();
      return;
    }
    if (view.kind === "verify-sign-in") {
      const { error } = await signIn.mfa.verifyEmailCode({ code });
      if (!error && signIn.status === "complete") await finishSignIn();
    }
  };

  const handleGoogle = async () => {
    setMessage(null);
    if (view.kind === "credentials" && view.mode === "sign-up") {
      const { error } = await signUp.sso({ strategy: "oauth_google", redirectUrl: "/", redirectCallbackUrl: "/sso-callback" });
      if (error) setMessage(error.message);
      return;
    }
    const { error } = await signIn.sso({ strategy: "oauth_google", redirectUrl: "/", redirectCallbackUrl: "/sso-callback" });
    if (error) setMessage(error.message);
  };

  const switchMode = async (mode: "sign-in" | "sign-up") => {
    setMessage(null);
    await Promise.all([signIn.reset(), signUp.reset()]);
    setView({ kind: "credentials", mode });
  };

  const fieldError = view.kind === "credentials" && view.mode === "sign-up"
    ? signUpErrors.fields.emailAddress ?? signUpErrors.fields.password ?? signUpErrors.fields.captcha
    : signInErrors.fields.identifier ?? signInErrors.fields.password;
  const verificationError = view.kind === "verify-sign-up" ? signUpErrors.fields.code : signInErrors.fields.code;
  const globalError = view.kind === "credentials" && view.mode === "sign-up"
    ? signUpErrors.global?.[0]
    : signInErrors.global?.[0];
  const visibleError = message ?? verificationError?.longMessage ?? verificationError?.message ?? fieldError?.longMessage ?? fieldError?.message ?? globalError?.longMessage ?? globalError?.message;

  return (
    <main className="auth-layout">
      <AuthSlideshow />
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <div className="auth-form-wrap">
          <p className="auth-mobile-brand">Effi</p>
          {view.kind === "credentials" ? (
            <>
              <div className="auth-mode-switch" role="tablist" aria-label="Account access">
                <button role="tab" aria-selected={view.mode === "sign-in"} onClick={() => void switchMode("sign-in")}>Sign in</button>
                <button role="tab" aria-selected={view.mode === "sign-up"} onClick={() => void switchMode("sign-up")}>Create account</button>
              </div>
              <header className="auth-heading">
                <h1 id="auth-title">{view.mode === "sign-in" ? "Welcome back." : "Join the officer workspace."}</h1>
                <p>{view.mode === "sign-in" ? "Sign in to review confirmed reports and move cases forward." : "Create an account, then ask an Effi administrator for officer access."}</p>
              </header>
              <button type="button" className="auth-google-button" onClick={() => void handleGoogle()} disabled={isBusy}>
                <svg className="auth-google-mark" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                  <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
                  <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
                </svg>
                Continue with Google
              </button>
              <div className="auth-divider"><span>or use email</span></div>
              <form className="auth-form" onSubmit={(event) => void handleCredentials(event)}>
                <label htmlFor="officer-email">Work email</label>
                <input id="officer-email" name="emailAddress" type="email" autoComplete="email" required value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} aria-invalid={Boolean(signInErrors.fields.identifier ?? signUpErrors.fields.emailAddress)} />
                <label htmlFor="officer-password">Password</label>
                <input id="officer-password" name="password" type="password" autoComplete={view.mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(signInErrors.fields.password ?? signUpErrors.fields.password)} />
                {view.mode === "sign-up" ? <div id="clerk-captcha" data-cl-theme="light" data-cl-size="flexible" /> : null}
                {visibleError ? <p className="auth-error" role="alert">{visibleError}</p> : null}
                <button className="auth-submit" type="submit" disabled={isBusy}>
                  {isBusy ? "Please wait" : view.mode === "sign-in" ? "Open case inbox" : "Create officer account"}
                </button>
              </form>
              <p className="auth-access-note">Case data is restricted to approved officer accounts.</p>
            </>
          ) : (
            <>
              <header className="auth-heading">
                <h1 id="auth-title">Check your email.</h1>
                <p>Enter the verification code sent to {view.emailAddress}.</p>
              </header>
              <form className="auth-form" onSubmit={(event) => void handleVerification(event)}>
                <label htmlFor="officer-code">Verification code</label>
                <input id="officer-code" name="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} aria-invalid={Boolean(verificationError)} />
                {visibleError ? <p className="auth-error" role="alert">{visibleError}</p> : null}
                <button className="auth-submit" type="submit" disabled={isBusy}>{isBusy ? "Checking code" : "Verify account"}</button>
                <button className="auth-back-button" type="button" onClick={() => void switchMode(view.kind === "verify-sign-in" ? "sign-in" : "sign-up")}>Use a different email</button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
