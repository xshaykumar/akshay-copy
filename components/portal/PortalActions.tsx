"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  assessmentGenderLabels,
  assessmentGenders,
  assessmentGoalLabels,
  assessmentGoals,
  type PreCoachingDraftResponses,
} from "@/lib/assessments/pre-coaching";
import portalStyles from "./portal.module.css";
import formStyles from "@/components/public/public.module.css";

type ApiErrorBody = {
  error?: { message?: string; fields?: Record<string, string> };
};

class ApiActionError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function requestJson(
  url: string,
  options: RequestInit & { idempotent?: boolean } = {},
) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.idempotent) headers.set("Idempotency-Key", crypto.randomUUID());
  const response = await fetch(url, { ...options, headers });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiActionError(
      body.error?.message ?? "The action could not be completed.",
      body.error?.fields,
    );
  }
  return body;
}

export function ActionButton({
  url,
  body,
  children,
  tone = "primary",
  idempotent = true,
  confirmMessage,
}: {
  url: string;
  body?: Record<string, unknown>;
  children: ReactNode;
  tone?: "primary" | "secondary";
  idempotent?: boolean;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function run() {
    if (working) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setWorking(true);
    setMessage("");
    try {
      await requestJson(url, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
        idempotent,
      });
      setMessage("Completed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <span>
      <button
        className={
          tone === "primary"
            ? portalStyles.primaryButton
            : portalStyles.secondaryButton
        }
        type="button"
        disabled={working}
        onClick={run}
      >
        {working ? "Working…" : children}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </span>
  );
}

export type CoachProfileValues = {
  yearsExperience: number | null;
  languages: string[];
  coachingModes: string[];
  locationLabel: string | null;
  acceptingClients: boolean;
  active: boolean;
  specialties: string[];
};

export function CoachProfileForm({ profile }: { profile: CoachProfileValues }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setWorking(true);
    setMessage("");
    setMessageIsError(false);
    setFieldErrors({});
    try {
      await requestJson("/api/coach/profile", {
        method: "PATCH",
        body: JSON.stringify({
          yearsExperience: Number(values.get("yearsExperience")),
          languages: String(values.get("languages") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
          coachingModes: values.getAll("coachingModes"),
          locationLabel: String(values.get("locationLabel") ?? "").trim() || null,
          specialties: String(values.get("specialties") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
          acceptingClients: values.get("acceptingClients") === "on",
        }),
      });
      setMessage("Profile saved.");
      router.refresh();
    } catch (error) {
      setMessageIsError(true);
      if (error instanceof ApiActionError) setFieldErrors(error.fields);
      setMessage(error instanceof Error ? error.message : "Profile could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={formStyles.authForm} onSubmit={submit}>
      <div className={`${formStyles.formNotice} ${formStyles.formNoticeInfo}`}><strong>Complete your coaching details</strong><span>Fields marked as required must be valid before the profile can be saved. Any problem will be shown below the exact field.</span></div>
      <p>Profile Activation Status: <strong className={profile.active ? portalStyles.activationTextActive : portalStyles.activationTextInactive}>{profile.active ? "Active" : "Inactive"}</strong></p>
      <div className={formStyles.formGroup}><label htmlFor="coach-experience">Years of experience</label><input className={formStyles.formControl} id="coach-experience" name="yearsExperience" type="number" min={0} max={70} defaultValue={profile.yearsExperience ?? 0} aria-invalid={Boolean(fieldErrors.yearsExperience)} required />{fieldErrors.yearsExperience ? <p className={formStyles.fieldError}>{fieldErrors.yearsExperience}</p> : null}</div>
      <div className={formStyles.formGroup}><label htmlFor="coach-languages">Languages</label><input className={formStyles.formControl} id="coach-languages" name="languages" defaultValue={profile.languages.join(", ")} aria-invalid={Boolean(fieldErrors.languages)} required /><p className={formStyles.fieldHint}>Separate multiple languages with commas, for example: English, Hindi.</p>{fieldErrors.languages ? <p className={formStyles.fieldError}>{fieldErrors.languages}</p> : null}</div>
      <div className={formStyles.formGroup}><label htmlFor="coach-specialties">Specialties</label><input className={formStyles.formControl} id="coach-specialties" name="specialties" defaultValue={profile.specialties.join(", ")} aria-invalid={Boolean(fieldErrors.specialties)} required /><p className={formStyles.fieldHint}>Separate multiple specialties with commas.</p>{fieldErrors.specialties ? <p className={formStyles.fieldError}>{fieldErrors.specialties}</p> : null}</div>
      <fieldset><legend>Coaching modes</legend><label><input type="checkbox" name="coachingModes" value="online" defaultChecked={profile.coachingModes.includes("online")} /> Online</label>{" "}<label><input type="checkbox" name="coachingModes" value="offline" defaultChecked={profile.coachingModes.includes("offline")} /> Offline</label></fieldset>
      {fieldErrors.coachingModes ? <p className={formStyles.fieldError}>{fieldErrors.coachingModes}</p> : null}
      <div className={formStyles.formGroup}><label htmlFor="coach-location">Location</label><input className={formStyles.formControl} id="coach-location" name="locationLabel" defaultValue={profile.locationLabel ?? ""} /></div>
      <label><input type="checkbox" name="acceptingClients" defaultChecked={profile.acceptingClients} disabled={!profile.active} /> Accepting new clients {profile.active ? "" : "(available after certification or an admin waiver and a current activation)"}</label>
      <div><button className={portalStyles.primaryButton} type="submit" disabled={working}>{working ? "Saving…" : "Save profile"}</button></div>
      {message ? <div role={messageIsError ? "alert" : "status"} className={`${formStyles.formNotice} ${messageIsError ? formStyles.formNoticeError : formStyles.formNoticeSuccess}`}><strong>{messageIsError ? "Profile not saved" : "Saved"}</strong><span>{message}</span></div> : null}
    </form>
  );
}

export type SwitchCoachOption = {
  userId: string;
  displayName: string;
  availableDays: string[];
  availableTimeSlots: string[];
  location: string;
};

export function CoachSwitchRequestForm({
  assignmentId,
  coaches,
}: {
  assignmentId: string;
  coaches: SwitchCoachOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setWorking(true);
    setMessage("");
    try {
      await requestJson("/api/replacements", {
        method: "POST",
        idempotent: true,
        body: JSON.stringify({
          assignmentId,
          desiredCoachUserId: values.get("desiredCoachUserId"),
          reasonCode: values.get("reasonCode"),
          reason: values.get("reason"),
        }),
      });
      setMessage("Switch request sent. The selected coach has two days to respond.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The switch request could not be submitted.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (coaches.length === 0) {
    return <p>No other active coach currently has visible availability.</p>;
  }

  return (
    <form className={portalStyles.switchRequestForm} onSubmit={submit}>
      <fieldset>
        <legend>Select the coach you want for the next 30-day cycle</legend>
        <div className={portalStyles.switchCoachGrid}>
          {coaches.map((coach) => (
            <label className={portalStyles.switchCoachOption} key={coach.userId}>
              <input
                type="radio"
                name="desiredCoachUserId"
                value={coach.userId}
                required
              />
              <span>
                <strong>{coach.displayName}</strong>
                <small>{coach.location}</small>
                <small>
                  {coach.availableDays.join(", ")} ·{" "}
                  {coach.availableTimeSlots.join(", ")}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={formStyles.formGroup}>
        <label htmlFor="switch-reason-code">Primary reason</label>
        <select
          className={formStyles.formControl}
          id="switch-reason-code"
          name="reasonCode"
          required
        >
          <option value="availability">Availability</option>
          <option value="coaching_fit">Coaching fit</option>
          <option value="communication">Communication</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className={formStyles.formGroup}>
        <label htmlFor="switch-reason">Explain why you want to switch</label>
        <textarea
          className={formStyles.formTextArea}
          id="switch-reason"
          name="reason"
          minLength={10}
          maxLength={2000}
          required
        />
      </div>
      <button
        className={portalStyles.primaryButton}
        type="submit"
        disabled={working}
      >
        {working ? "Sending…" : "Send switch request"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

export function AssessmentForm({
  initialResponses = {},
  completedAt,
}: {
  initialResponses?: PreCoachingDraftResponses;
  completedAt?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [hasMedicalCondition, setHasMedicalCondition] = useState(
    initialResponses.hasMedicalCondition ?? false,
  );

  function optionalNumber(values: FormData, name: string) {
    const value = String(values.get(name) ?? "").trim();
    return value ? Number(value) : undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const intendedStatus = values.get("intent") === "submit" ? "submitted" : "draft";
    const medicalReport = values.get("medicalReport");
    const hasReport = medicalReport instanceof File && medicalReport.size > 0;
    const responses = {
      age: optionalNumber(values, "age"),
      gender: values.get("gender") || undefined,
      heightCm: optionalNumber(values, "heightCm"),
      weightKg: optionalNumber(values, "weightKg"),
      goals: values.getAll("goals"),
      otherGoal: String(values.get("otherGoal") ?? "").trim() || undefined,
      experience: values.get("experience") || undefined,
      hasMedicalCondition: values.get("hasMedicalCondition") === "yes",
      medicalDetails: String(values.get("medicalDetails") ?? "").trim() || undefined,
      dietaryPreference: values.get("dietaryPreference") || undefined,
      trainingDaysPerWeek: optionalNumber(values, "trainingDaysPerWeek"),
      preferredTrainingTime: values.get("preferredTrainingTime") || undefined,
      additionalInformation:
        String(values.get("additionalInformation") ?? "").trim() || undefined,
      declarationAccepted: values.get("declarationAccepted") === "on",
    };

    if (
      intendedStatus === "submitted" &&
      responses.hasMedicalCondition &&
      !responses.medicalDetails &&
      !hasReport
    ) {
      setMessage("Describe your medical condition or choose a report to upload.");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const firstStatus = hasReport ? "draft" : intendedStatus;
      const saved = (await requestJson("/api/assessments", {
        method: "POST",
        body: JSON.stringify({
          status: firstStatus,
          responses,
        }),
      })) as ApiErrorBody & { assessment?: { id?: string } };

      if (hasReport) {
        const assessmentId = saved.assessment?.id;
        if (!assessmentId) throw new Error("The assessment could not be prepared for upload.");
        const upload = new FormData();
        upload.set("kind", "assessment-report");
        upload.set("relationId", assessmentId);
        upload.set("file", medicalReport);
        const uploadResponse = await fetch("/api/files/upload", {
          method: "POST",
          body: upload,
        });
        const uploadBody = (await uploadResponse.json().catch(() => ({}))) as ApiErrorBody;
        if (!uploadResponse.ok) {
          throw new Error(uploadBody.error?.message ?? "The medical report could not be uploaded.");
        }

        if (intendedStatus === "submitted") {
          await requestJson("/api/assessments", {
            method: "POST",
            body: JSON.stringify({ status: "submitted", responses }),
          });
        }
      }

      setMessage(
        intendedStatus === "submitted"
          ? "Health assessment submitted."
          : "Draft saved. Complete every required field before submitting the assessment.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assessment could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={portalStyles.assessmentForm} onSubmit={submit}>
      {completedAt ? (
        <div className={portalStyles.assessmentComplete} role="status">
          <strong>Assessment complete</strong>
          <span>Submitted {new Date(completedAt).toLocaleDateString()}. Update it whenever your health changes.</span>
        </div>
      ) : (
        <div className={portalStyles.assessmentRequired} role="status">
          <strong>Optional health assessment</strong>
          <span>Your answers stay private and are only available to authorized coaching staff.</span>
        </div>
      )}

      <section className={portalStyles.assessmentSection} aria-labelledby="assessment-personal">
        <div className={portalStyles.assessmentSectionHeading}>
          <span>01</span>
          <div><h2 id="assessment-personal">Personal information</h2><p>Tell us the basics needed to plan training safely.</p></div>
        </div>
        <div className={portalStyles.assessmentGrid}>
          <div className={formStyles.formGroup}><label htmlFor="assessment-age">Age</label><input className={formStyles.formControl} id="assessment-age" name="age" type="number" min={13} max={100} defaultValue={initialResponses.age ?? ""} required /></div>
          <div className={formStyles.formGroup}><label htmlFor="assessment-gender">Gender</label><select className={formStyles.formControl} id="assessment-gender" name="gender" defaultValue={initialResponses.gender ?? ""} required><option value="" disabled>Select gender</option>{assessmentGenders.map((gender) => <option key={gender} value={gender}>{assessmentGenderLabels[gender]}</option>)}</select></div>
          <div className={formStyles.formGroup}><label htmlFor="assessment-height">Height (cm)</label><input className={formStyles.formControl} id="assessment-height" name="heightCm" type="number" min={80} max={250} step="0.1" defaultValue={initialResponses.heightCm ?? ""} required /></div>
          <div className={formStyles.formGroup}><label htmlFor="assessment-weight">Weight (kg)</label><input className={formStyles.formControl} id="assessment-weight" name="weightKg" type="number" min={25} max={400} step="0.1" defaultValue={initialResponses.weightKg ?? ""} required /></div>
        </div>
      </section>

      <fieldset className={portalStyles.assessmentSection}>
        <legend className={portalStyles.assessmentSectionHeading}><span>02</span><span><strong>Goal</strong><small>Select one or more.</small></span></legend>
        <div className={portalStyles.assessmentChoices}>
          {assessmentGoals.map((goal) => <label className={portalStyles.assessmentChoice} key={goal}><input type="checkbox" name="goals" value={goal} defaultChecked={initialResponses.goals?.includes(goal)} /><span>{assessmentGoalLabels[goal]}</span></label>)}
        </div>
        <div className={formStyles.formGroup}><label htmlFor="assessment-other-goal">If other, describe your goal</label><input className={formStyles.formControl} id="assessment-other-goal" name="otherGoal" maxLength={300} defaultValue={initialResponses.otherGoal ?? ""} /></div>
      </fieldset>

      <fieldset className={portalStyles.assessmentSection}>
        <legend className={portalStyles.assessmentSectionHeading}><span>03</span><span><strong>Experience</strong><small>Choose your current training level.</small></span></legend>
        <div className={portalStyles.assessmentChoicesThree}>
          {["beginner", "intermediate", "advanced"].map((experience) => <label className={portalStyles.assessmentChoice} key={experience}><input type="radio" name="experience" value={experience} defaultChecked={initialResponses.experience === experience} required /><span>{experience[0].toUpperCase() + experience.slice(1)}</span></label>)}
        </div>
      </fieldset>

      <fieldset className={portalStyles.assessmentSection}>
        <legend className={portalStyles.assessmentSectionHeading}><span>04</span><span><strong>Medical &amp; injury</strong><small>Share information that can affect safe coaching.</small></span></legend>
        <p className={portalStyles.assessmentQuestion}>Do you have any medical condition?</p>
        <div className={portalStyles.assessmentChoicesThree}>
          <label className={portalStyles.assessmentChoice}><input type="radio" name="hasMedicalCondition" value="no" checked={!hasMedicalCondition} onChange={() => setHasMedicalCondition(false)} required /><span>No</span></label>
          <label className={portalStyles.assessmentChoice}><input type="radio" name="hasMedicalCondition" value="yes" checked={hasMedicalCondition} onChange={() => setHasMedicalCondition(true)} required /><span>Yes</span></label>
        </div>
        {hasMedicalCondition ? <div className={portalStyles.medicalContextGrid}>
          <div className={formStyles.formGroup}><label htmlFor="assessment-medical-details">Describe the condition or injury</label><textarea className={formStyles.formTextArea} id="assessment-medical-details" name="medicalDetails" maxLength={4000} defaultValue={initialResponses.medicalDetails ?? ""} /></div>
          <div className={formStyles.formGroup}><label htmlFor="assessment-medical-report">Or upload a medical report</label><input className={portalStyles.fileInput} id="assessment-medical-report" name="medicalReport" type="file" accept="application/pdf,image/jpeg,image/png" /><small>PDF, JPG or PNG · maximum 10 MB</small></div>
        </div> : null}
      </fieldset>

      <section className={portalStyles.assessmentSection} aria-labelledby="assessment-routine">
        <div className={portalStyles.assessmentSectionHeading}><span>05</span><div><h2 id="assessment-routine">Diet &amp; routine</h2><p>Help your coach fit the plan around your week.</p></div></div>
        <div className={portalStyles.assessmentGrid}>
          <div className={formStyles.formGroup}><label htmlFor="assessment-diet">Dietary preference</label><select className={formStyles.formControl} id="assessment-diet" name="dietaryPreference" defaultValue={initialResponses.dietaryPreference ?? ""} required><option value="" disabled>Select preference</option><option value="vegetarian">Vegetarian</option><option value="non_vegetarian">Non-Vegetarian</option><option value="vegan">Vegan</option></select></div>
          <div className={formStyles.formGroup}><label htmlFor="assessment-days">Training days per week</label><select className={formStyles.formControl} id="assessment-days" name="trainingDaysPerWeek" defaultValue={initialResponses.trainingDaysPerWeek ?? ""} required><option value="" disabled>Select days</option>{[1,2,3,4,5,6,7].map((day) => <option key={day} value={day}>{day} {day === 1 ? "day" : "days"}</option>)}</select></div>
          <div className={`${formStyles.formGroup} ${portalStyles.assessmentFull}`}><label htmlFor="assessment-time">Preferred training time</label><select className={formStyles.formControl} id="assessment-time" name="preferredTrainingTime" defaultValue={initialResponses.preferredTrainingTime ?? ""} required><option value="" disabled>Select a time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="flexible">Flexible</option></select></div>
        </div>
      </section>

      <section className={portalStyles.assessmentSection} aria-labelledby="assessment-additional">
        <div className={portalStyles.assessmentSectionHeading}><span>06</span><div><h2 id="assessment-additional">Additional information</h2><p>Include anything your coach should know before creating your workout or diet plan.</p></div></div>
        <div className={formStyles.formGroup}><label htmlFor="assessment-additional-info">Notes for your coach</label><textarea className={formStyles.formTextArea} id="assessment-additional-info" name="additionalInformation" maxLength={4000} defaultValue={initialResponses.additionalInformation ?? ""} /></div>
      </section>

      <label className={portalStyles.assessmentDeclaration}>
        <input type="checkbox" name="declarationAccepted" defaultChecked={initialResponses.declarationAccepted} required />
        <span>I confirm that the information provided is accurate and I will inform my coach if my health condition changes.</span>
      </label>

      <div className={portalStyles.assessmentActions}>
        <button className={portalStyles.secondaryButton} type="submit" name="intent" value="draft" formNoValidate disabled={working}>Save draft</button>
        <button className={portalStyles.primaryButton} type="submit" name="intent" value="submit" disabled={working}>{working ? "Saving…" : completedAt ? "Update assessment" : "Submit assessment"}</button>
      </div>
      {message ? <p className={portalStyles.assessmentMessage} role="status">{message}</p> : null}
    </form>
  );
}

export function SessionCreateForm({
  assignments,
  defaultAssignmentId,
}: {
  assignments: { id: string; clientName: string; preferredTime: string | null }[];
  defaultAssignmentId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const initialAssignment =
    assignments.find((assignment) => assignment.id === defaultAssignmentId) ??
    assignments[0];
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    initialAssignment?.id ?? "",
  );
  const [sessionTime, setSessionTime] = useState(
    initialAssignment?.preferredTime ?? "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const sessionDate = String(values.get("sessionDate") ?? "");
    const selectedTime = String(values.get("sessionTime") ?? "");
    const startsAt = new Date(`${sessionDate}T${selectedTime}`);
    const duration = Number(values.get("durationMinutes"));
    if (!sessionDate || !selectedTime || Number.isNaN(startsAt.getTime())) {
      setMessage("Select a valid session date and time.");
      return;
    }
    try {
      await requestJson("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          assignmentId: values.get("assignmentId"),
          title: values.get("title"),
          mode: values.get("mode"),
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
          meetingUrl: values.get("meetingUrl"),
        }),
      });
      event.currentTarget.reset();
      setMessage("Session scheduled.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Session could not be scheduled.");
    }
  }

  if (assignments.length === 0) {
    return <p>No active client assignment is available.</p>;
  }
  return (
    <form className={formStyles.authForm} onSubmit={submit}>
      <div className={formStyles.formGroup}><label htmlFor="session-client">Client</label><select className={formStyles.formControl} id="session-client" name="assignmentId" value={selectedAssignmentId} onChange={(event) => {
        const assignmentId = event.target.value;
        setSelectedAssignmentId(assignmentId);
        setSessionTime(assignments.find((assignment) => assignment.id === assignmentId)?.preferredTime ?? "");
      }}>{assignments.map((assignment) => <option value={assignment.id} key={assignment.id}>{assignment.clientName}</option>)}</select></div>
      <div className={formStyles.formGroup}><label htmlFor="session-title">Title</label><input className={formStyles.formControl} id="session-title" name="title" required /></div>
      <div className={portalStyles.scheduleDateTimeFields}>
        <div className={formStyles.formGroup}><label htmlFor="session-date">Date</label><input className={formStyles.formControl} id="session-date" name="sessionDate" type="date" required /></div>
        <div className={formStyles.formGroup}><label htmlFor="session-time">Time</label><input className={formStyles.formControl} id="session-time" name="sessionTime" type="time" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} required /><small>Prefilled from the client&apos;s selected slot. You may change it for this session.</small></div>
      </div>
      <div className={formStyles.formGroup}><label htmlFor="session-duration">Duration</label><select className={formStyles.formControl} id="session-duration" name="durationMinutes" defaultValue="60"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></div>
      <div className={formStyles.formGroup}><label htmlFor="session-mode">Mode</label><select className={formStyles.formControl} id="session-mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value as "online" | "offline")}><option value="online">Online</option><option value="offline">Offline</option></select></div>
      {mode === "online" ? (
        <div className={formStyles.formGroup}>
          <label htmlFor="session-meeting-url">Google Meet link</label>
          <input className={formStyles.formControl} id="session-meeting-url" name="meetingUrl" type="url" inputMode="url" placeholder="https://meet.google.com/abc-defg-hij" required />
          <small>
            Create a new meeting at{" "}
            <a href="https://meet.google.com/" target="_blank" rel="noreferrer">Google Meet</a>,
            then paste its link here. It will appear securely in the client&apos;s schedule.
          </small>
        </div>
      ) : null}
      <button className={portalStyles.primaryButton} type="submit">Schedule session</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
