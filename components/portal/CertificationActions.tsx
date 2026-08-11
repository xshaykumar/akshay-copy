"use client";

import { FileCheck2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  certificationStatusLabel,
  coachQualificationDisplayName,
  coachQualificationLabels,
  coachQualificationTypes,
  type CoachCertificationStatus,
  type CoachQualificationType,
} from "@/lib/coaches/certifications";
import formStyles from "@/components/public/public.module.css";
import styles from "./portal.module.css";

type CertificationRow = {
  id: string;
  qualificationType: string;
  qualificationTitle: string | null;
  originalFilename: string;
  sizeBytes: number;
  verificationStatus: "draft" | "submitted" | "approved" | "rejected";
  url?: string | null;
};

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? "The action could not be completed.",
    );
  }
  return body;
}

export function CoachCertificationManager({
  status,
  rejectionReason,
  reviewMessage,
  certifications,
}: {
  status: CoachCertificationStatus;
  rejectionReason?: string | null;
  reviewMessage?: string | null;
  certifications: CertificationRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [qualificationType, setQualificationType] =
    useState<CoachQualificationType>("cscs");
  const locked = ["submitted", "suspended"].includes(status);
  const addedTypes = new Set(
    certifications.map((item) => item.qualificationType),
  );
  const availableTypes = coachQualificationTypes.filter(
    (type) => !addedTypes.has(type),
  );
  const selectedQualificationType = availableTypes.includes(qualificationType)
    ? qualificationType
    : (availableTypes[0] ?? "cscs");
  const submittableCount = certifications.filter((item) =>
    ["draft", "rejected"].includes(item.verificationStatus),
  ).length;

  async function addQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const file = values.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      setMessage("Choose a certificate to upload.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setMessage("The certificate must be no larger than 1 MB.");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await responseMessage(
        await fetch("/api/coach/certifications", {
          method: "POST",
          body: values,
        }),
      );
      setAdding(false);
      setMessage("Qualification added.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The qualification could not be added.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function removeQualification(id: string) {
    if (working) return;
    setWorking(true);
    setMessage("");
    try {
      await responseMessage(
        await fetch(`/api/coach/certifications/${id}`, { method: "DELETE" }),
      );
      setMessage("Qualification removed.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The qualification could not be removed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function submitForVerification() {
    if (working || submittableCount === 0) return;
    setWorking(true);
    setMessage("");
    try {
      await responseMessage(
        await fetch("/api/coach/certifications/submit", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        }),
      );
      setMessage("Certifications submitted for admin verification.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The application could not be submitted.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={styles.certificationManager}>
      <div
        className={`${styles.activationBanner} ${
          status === "rejected"
            ? styles.activationRejected
            : status === "approved"
              ? styles.activationApproved
              : ""
        }`}
      >
        <div>
          <span>Certification Status</span>
          <strong>{certificationStatusLabel(status)}</strong>
        </div>
        <p>
          {status === "draft"
            ? "Add or update eligible qualifications, then submit them together for review."
            : status === "submitted"
              ? "Your submitted certificates are waiting for admin review."
              : status === "approved"
                ? "Your submitted certificates were accepted. Complete the activation fee step to make your profile active."
                : status === "rejected"
                  ? "Your submission needs changes before it can be resubmitted."
                  : "Your coach verification is suspended."}
        </p>
      </div>

      {status === "rejected" && rejectionReason ? (
        <div className={styles.rejectionNotice}>
          <strong>Reason for rejection</strong>
          <p>{rejectionReason}</p>
        </div>
      ) : null}
      {status === "approved" && reviewMessage ? (
        <div className={styles.acceptanceNotice}>
          <strong>Message from 360 Performance</strong>
          <p>{reviewMessage}</p>
        </div>
      ) : null}

      <div className={styles.certificationHeader}>
        <div>
          <h2>Qualifications</h2>
          <p>
            Add every eligible qualification you hold. Accepted certificates
            cannot be removed or replaced.
          </p>
        </div>
        {!locked && availableTypes.length > 0 ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus size={15} aria-hidden="true" /> Add
          </button>
        ) : null}
      </div>

      {adding && !locked ? (
        <form className={styles.certificationAddRow} onSubmit={addQualification}>
          <div className={formStyles.formGroup}>
            <label htmlFor="qualification-type">Qualification</label>
            <select
              className={formStyles.formControl}
              id="qualification-type"
              name="qualificationType"
              value={selectedQualificationType}
              onChange={(event) =>
                setQualificationType(event.target.value as CoachQualificationType)
              }
              required
            >
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {coachQualificationLabels[type]}
                </option>
              ))}
            </select>
          </div>
          {selectedQualificationType === "other" ? (
            <div className={formStyles.formGroup}>
              <label htmlFor="qualification-title">Qualification name</label>
              <input
                className={formStyles.formControl}
                id="qualification-title"
                name="qualificationTitle"
                minLength={3}
                maxLength={120}
                placeholder="Enter the qualification shown on your certificate"
                required
              />
              <small>
                Other-only qualifications are not eligible for Athlete / Executive Performance clients.
              </small>
            </div>
          ) : null}
          <div className={formStyles.formGroup}>
            <label htmlFor="qualification-file">Certificate</label>
            <input
              className={styles.fileInput}
              id="qualification-file"
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
            />
            <small>PDF, JPG, JPEG, or PNG · maximum 1 MB</small>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={working}
          >
            {working ? "Uploading…" : "Upload qualification"}
          </button>
        </form>
      ) : null}

      <div className={styles.qualificationList}>
        {certifications.length === 0 ? (
          <p className={styles.emptyQualification}>
            No qualification has been added yet.
          </p>
        ) : (
          certifications.map((certification) => {
            const qualification =
              certification.qualificationType as CoachQualificationType;
            return (
              <article key={certification.id}>
                <span>
                  <FileCheck2 size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3>
                    {coachQualificationDisplayName(
                      qualification,
                      certification.qualificationTitle,
                    )}
                  </h3>
                  <p>
                    {certification.originalFilename} ·{" "}
                    {(certification.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                    {certification.verificationStatus}
                  </p>
                </div>
                {certification.url ? (
                  <a
                    className={styles.textLink}
                    href={certification.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                ) : null}
                {!locked &&
                ["draft", "rejected"].includes(
                  certification.verificationStatus,
                ) ? (
                  <button
                    className={styles.tableIconButton}
                    type="button"
                    aria-label={`Remove ${
                      coachQualificationDisplayName(
                        qualification,
                        certification.qualificationTitle,
                      )
                    }`}
                    disabled={working}
                    onClick={() => removeQualification(certification.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {!locked && submittableCount > 0 ? (
        <div className={styles.certificationSubmitBar}>
          <p>
            Submitting sends all new or corrected files together and locks them
            during review.
          </p>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={working}
            onClick={submitForVerification}
          >
            Submit for verification
          </button>
        </div>
      ) : null}
      {message ? (
        <p className={styles.formStatus} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CoachVerificationDecision({
  coachUserId,
}: {
  coachUserId: string;
}) {
  const router = useRouter();
  const [messageText, setMessageText] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function decide(decision: "approve" | "reject") {
    if (working) return;
    if (decision === "reject" && messageText.trim().length < 5) {
      setMessage("Write a clear rejection reason of at least 5 characters.");
      return;
    }
    setWorking(true);
    setMessage("");
    try {
      await responseMessage(
        await fetch(`/api/admin/coaches/${coachUserId}/${decision}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(
            decision === "reject"
              ? { reason: messageText }
              : { message: messageText },
          ),
        }),
      );
      setMessage(
        decision === "approve"
          ? "Certificates accepted."
          : "Certificate submission rejected.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The decision could not be saved.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className={styles.verificationDecision}>
      <textarea
        className={formStyles.formTextArea}
        value={messageText}
        onChange={(event) => setMessageText(event.target.value)}
        placeholder="Optional acceptance message; required rejection reason"
        maxLength={1000}
      />
      <div>
        <button
          className={styles.primaryButton}
          type="button"
          disabled={working}
          onClick={() => decide("approve")}
        >
          Accept certificates
        </button>
        <button
          className={styles.dangerButton}
          type="button"
          disabled={working}
          onClick={() => decide("reject")}
        >
          Reject submission
        </button>
      </div>
      {message ? (
        <p className={styles.formStatus} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
