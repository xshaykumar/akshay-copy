"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env/browser";
import styles from "@/components/public/public.module.css";

type ApiResult = {
  destination?: string;
  requiresEmailConfirmation?: boolean;
  factorId?: string;
  challengeId?: string;
  qrCode?: string;
  secret?: string;
  error?: { message?: string; fields?: Record<string, string> };
};

class ApiFormError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as ApiResult;
  if (!response.ok) {
    throw new ApiFormError(
      result.error?.message ?? "The request could not be completed.",
      result.error?.fields,
    );
  }
  return result;
}

function FormMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`${styles.formNotice} ${error ? styles.formNoticeError : styles.formNoticeSuccess}`}
    >
      <strong>{error ? "Please check the form" : "Next step"}</strong>
      <span>{error || success}</span>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className={styles.fieldError}>{message}</p> : null;
}

function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  ariaInvalid,
  visibilityLabel = "password",
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  ariaInvalid?: boolean;
  visibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const actionLabel = `${visible ? "Hide" : "Show"} ${visibilityLabel}`;

  return (
    <div className={styles.passwordControl}>
      <input
        className={styles.formControl}
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        aria-invalid={ariaInvalid || undefined}
        required
      />
      <button
        className={styles.passwordVisibility}
        type="button"
        aria-label={actionLabel}
        aria-controls={id}
        aria-pressed={visible}
        title={actionLabel}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function LoginForm({
  initialError = "",
  initialSuccess = "",
}: {
  initialError?: string;
  initialSuccess?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState(initialSuccess);
  const [submitting, setSubmitting] = useState(false);
  const googleEnabled =
    getPublicEnv().NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await postJson("/api/auth/login", {
        identifier: values.get("identifier"),
        password: values.get("password"),
      });
      const requested = new URLSearchParams(window.location.search).get("next");
      const safeRequested =
        requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : null;
      router.push(safeRequested ?? result.destination ?? "/client");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function googleSignIn() {
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) setError("Google sign-in could not be started.");
  }

  return (
    <>
      <form className={styles.authForm} onSubmit={submit}>
        <div className={styles.formGroup}>
          <label htmlFor="login-identifier">Email address or username</label>
          <input
            className={styles.formControl}
            id="login-identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            required
          />
          <p className={styles.formHint}>Use the email address or username registered to your account.</p>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="login-password">Password</label>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
          />
        </div>
        <FormMessage error={error} success={success} />
        <button className={styles.authSubmit} type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {googleEnabled ? (
        <>
          <div className={styles.authDivider}>or</div>
          <button className={styles.socialAuth} type="button" onClick={googleSignIn}>
            <span className={styles.socialMark}>G</span> Continue with Google
          </button>
        </>
      ) : null}
    </>
  );
}

export function RegisterForm({
  role,
  onRoleChange,
}: {
  role: "client" | "coach";
  onRoleChange: (role: "client" | "coach") => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setSuccess("");
    setFieldErrors({});
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmPassword") ?? "");
    if (password !== confirmation) {
      setPasswordMismatch(true);
      setFieldErrors({ confirmPassword: "The two passwords must match." });
      setSubmitting(false);
      setError("Passwords do not match.");
      return;
    }
    setPasswordMismatch(false);
    try {
      const result = await postJson("/api/auth/register", {
        displayName: values.get("displayName"),
        username: values.get("username"),
        email: values.get("email"),
        mobile: values.get("mobile"),
        password,
        role,
        ...(role === "client"
          ? {
              state: values.get("state"),
              city: values.get("city"),
              district: values.get("district"),
            }
          : {}),
        acceptedTerms: values.get("acceptedTerms") === "on",
      });
      if (result.requiresEmailConfirmation) {
        setSuccess("Your account has been created. Open the verification email from 360 Performance and click the confirmation link. After your email is confirmed, return here and sign in.");
      } else {
        router.push(result.destination ?? "/client");
        router.refresh();
      }
    } catch (caught) {
      if (caught instanceof ApiFormError) setFieldErrors(caught.fields);
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.roleChooser} role="group" aria-label="Choose account type">
        {(["client", "coach"] as const).map((value) => (
          <button
            key={value}
            className={styles.roleOption}
            type="button"
            aria-pressed={role === value}
            data-selected={role === value ? "true" : "false"}
            onClick={() => onRoleChange(value)}
          >
            <span>
              <strong>
                {value === "client" ? "Create your account" : "Apply as coach"}
              </strong>
              <span>{value === "client" ? "Find coaching for my goals" : "Apply to join the platform"}</span>
            </span>
          </button>
        ))}
      </div>
      <form className={styles.authForm} onSubmit={submit}>
        <div className={styles.formGroup}>
          <label htmlFor="register-name">Full name</label>
          <input className={styles.formControl} id="register-name" name="displayName" autoComplete="name" aria-invalid={Boolean(fieldErrors.displayName)} required />
          <FieldError message={fieldErrors.displayName} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-username">Username</label>
          <input className={styles.formControl} id="register-username" name="username" autoComplete="username" pattern="[a-z][a-z0-9_]{2,29}" title="Use 3-30 characters, start with a lowercase letter, and use only lowercase letters, numbers, or underscores." aria-invalid={Boolean(fieldErrors.username)} required />
          <p className={styles.fieldHint}>3-30 characters. Start with a lowercase letter; use lowercase letters, numbers, or underscores.</p>
          <FieldError message={fieldErrors.username} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-email">Email address</label>
          <input className={styles.formControl} id="register-email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} required />
          <FieldError message={fieldErrors.email} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-mobile">Mobile number</label>
          <input
            className={styles.formControl}
            id="register-mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={18}
            pattern="(?:\\+91|91)?[6-9][0-9]{9}"
            title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9. You may optionally include +91."
            onInvalid={(event) => event.currentTarget.setCustomValidity("Enter exactly 10 digits, starting with 6, 7, 8, or 9. You may include +91.")}
            onInput={(event) => event.currentTarget.setCustomValidity("")}
            aria-invalid={Boolean(fieldErrors.mobile)}
            required
          />
          <p className={styles.fieldHint}>Enter exactly 10 digits, starting with 6, 7, 8, or 9. You may include +91.</p>
          <FieldError message={fieldErrors.mobile} />
        </div>
        {role === "client" ? (
          <>
            <div className={styles.formGroup}>
              <label htmlFor="register-state">State</label>
              <input
                className={styles.formControl}
                id="register-state"
                name="state"
                autoComplete="address-level1"
                minLength={2}
                maxLength={80}
                aria-invalid={Boolean(fieldErrors.state)}
                required
              />
              <FieldError message={fieldErrors.state} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="register-city">City</label>
              <input
                className={styles.formControl}
                id="register-city"
                name="city"
                autoComplete="address-level2"
                minLength={2}
                maxLength={80}
                aria-invalid={Boolean(fieldErrors.city)}
                required
              />
              <FieldError message={fieldErrors.city} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="register-district">District</label>
              <input
                className={styles.formControl}
                id="register-district"
                name="district"
                autoComplete="address-level3"
                minLength={2}
                maxLength={80}
                aria-invalid={Boolean(fieldErrors.district)}
                required
              />
              <FieldError message={fieldErrors.district} />
            </div>
          </>
        ) : null}
        <div className={styles.formGroup}>
          <label htmlFor="register-password">Create password</label>
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            ariaInvalid={Boolean(fieldErrors.password)}
          />
          <p className={styles.fieldHint}>Use at least 6 characters.</p>
          <FieldError message={fieldErrors.password} />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-password-confirmation">Confirm password</label>
          <PasswordInput
            id="register-password-confirmation"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={6}
            ariaInvalid={passwordMismatch || Boolean(fieldErrors.confirmPassword)}
            visibilityLabel="password confirmation"
          />
          <FieldError message={fieldErrors.confirmPassword} />
        </div>
        <label className={styles.checkRow}>
          <input name="acceptedTerms" type="checkbox" required />
          <span>
            I agree to the <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <FormMessage error={error} success={success} />
        <button className={styles.authSubmit} type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </>
  );
}

export function CompleteProfileForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<"client" | "coach">("client");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const result = await postJson("/api/auth/complete-profile", {
        displayName: values.get("displayName"),
        username: values.get("username"),
        mobile: values.get("mobile"),
        role,
        ...(role === "client"
          ? {
              state: values.get("state"),
              city: values.get("city"),
              district: values.get("district"),
            }
          : {}),
      });
      router.push(result.destination ?? "/client");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiFormError) setFieldErrors(caught.fields);
      setError(caught instanceof Error ? caught.message : "Profile setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={submit}>
      <div className={styles.formGroup}>
        <label htmlFor="profile-name">Full name</label>
        <input className={styles.formControl} id="profile-name" name="displayName" aria-invalid={Boolean(fieldErrors.displayName)} required />
        <FieldError message={fieldErrors.displayName} />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="profile-username">Username</label>
        <input className={styles.formControl} id="profile-username" name="username" pattern="[a-z][a-z0-9_]{2,29}" title="Use 3-30 characters, start with a lowercase letter, and use only lowercase letters, numbers, or underscores." aria-invalid={Boolean(fieldErrors.username)} required />
        <p className={styles.fieldHint}>3-30 characters. Start with a lowercase letter; use lowercase letters, numbers, or underscores.</p>
        <FieldError message={fieldErrors.username} />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="profile-mobile">Mobile number</label>
        <input
          className={styles.formControl}
          id="profile-mobile"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={18}
          pattern="(?:\\+91|91)?[6-9][0-9]{9}"
          title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9. You may optionally include +91."
          onInvalid={(event) => event.currentTarget.setCustomValidity("Enter exactly 10 digits, starting with 6, 7, 8, or 9. You may include +91.")}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
          aria-invalid={Boolean(fieldErrors.mobile)}
          required
        />
        <p className={styles.fieldHint}>Enter exactly 10 digits, starting with 6, 7, 8, or 9. You may include +91.</p>
        <FieldError message={fieldErrors.mobile} />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="profile-role">Account type</label>
        <select className={styles.formControl} id="profile-role" value={role} onChange={(event) => setRole(event.target.value as "client" | "coach")}>
          <option value="client">Client</option>
          <option value="coach">Coach</option>
        </select>
      </div>
      {role === "client" ? (
        <>
          <div className={styles.formGroup}>
            <label htmlFor="profile-state">State</label>
            <input
              className={styles.formControl}
              id="profile-state"
              name="state"
              autoComplete="address-level1"
              minLength={2}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.state)}
              required
            />
            <FieldError message={fieldErrors.state} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="profile-city">City</label>
            <input
              className={styles.formControl}
              id="profile-city"
              name="city"
              autoComplete="address-level2"
              minLength={2}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.city)}
              required
            />
            <FieldError message={fieldErrors.city} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="profile-district">District</label>
            <input
              className={styles.formControl}
              id="profile-district"
              name="district"
              autoComplete="address-level3"
              minLength={2}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.district)}
              required
            />
            <FieldError message={fieldErrors.district} />
          </div>
        </>
      ) : null}
      <FormMessage error={error} />
      <button className={styles.authSubmit} type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Complete profile"}
      </button>
    </form>
  );
}

export function MfaForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);

  async function prepare() {
    setError("");
    setWorking(true);
    try {
      const result = await postJson("/api/auth/mfa/enroll", {});
      if (!result.factorId) throw new Error("MFA factor was not returned.");
      setFactorId(result.factorId);
      setChallengeId(result.challengeId ?? "");
      setQrCode(result.qrCode ?? "");
      setReady(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MFA setup failed.");
    } finally {
      setWorking(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    setError("");
    try {
      const result = await postJson("/api/auth/mfa/verify", {
        factorId,
        challengeId: challengeId || undefined,
        code: String(code),
      });
      router.push(result.destination ?? "/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MFA verification failed.");
    }
  }

  if (!ready) {
    return (
      <>
        <FormMessage error={error} />
        <button className={styles.authSubmit} type="button" onClick={prepare} disabled={working}>
          {working ? "Preparing…" : "Set up or verify MFA"}
        </button>
      </>
    );
  }

  return (
    <form className={styles.authForm} onSubmit={verify}>
      {qrCode ? <img src={qrCode} alt="Authenticator enrollment QR code" width={220} height={220} /> : null}
      <div className={styles.formGroup}>
        <label htmlFor="mfa-code">Six-digit authenticator code</label>
        <input className={styles.formControl} id="mfa-code" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required />
      </div>
      <FormMessage error={error} />
      <button className={styles.authSubmit} type="submit">Verify and continue</button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await postJson("/api/auth/forgot-password", { email });
      setSuccess("If that account exists, a secure reset link has been sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={submit}>
      <div className={styles.formGroup}>
        <label htmlFor="recovery-email">Email address</label>
        <input
          className={styles.formControl}
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <FormMessage error={error} success={success} />
      <button className={styles.authSubmit} type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") ?? "");
    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== String(values.get("confirmation") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError("The reset session is invalid or expired. Request a new link.");
      return;
    }
    router.push("/login?password=updated");
    router.refresh();
  }

  return (
    <form className={styles.authForm} onSubmit={submit}>
      <div className={styles.formGroup}>
        <label htmlFor="new-password">New password</label>
        <PasswordInput id="new-password" name="password" minLength={6} autoComplete="new-password" visibilityLabel="new password" />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="new-password-confirmation">Confirm new password</label>
        <PasswordInput id="new-password-confirmation" name="confirmation" minLength={6} autoComplete="new-password" visibilityLabel="new password confirmation" />
      </div>
      <FormMessage error={error} />
      <button className={styles.authSubmit} type="submit" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
