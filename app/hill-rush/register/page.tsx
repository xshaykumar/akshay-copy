"use client";

import { useState } from "react";

export default function HillRushRegistration() {
  const [loading, setLoading] = useState(false);

  return (
    <main>
      <h1>Haldwani Hill Rush Challenge 2026</h1>
      <p>4 October 2026</p>
      <p>Registration Fee: ₹299</p>

      <form>
        <input placeholder="Participant Name" required />
        <input type="number" placeholder="Age (10–17)" min="10" max="17" required />
        <input placeholder="Gender" required />
        <input placeholder="Location" required />
        <input type="tel" placeholder="WhatsApp Number" required />
        <input type="tel" placeholder="Emergency Contact" required />
        <input placeholder="Running Experience" required />

        <h3>Parent / Guardian Details</h3>

        <input placeholder="Parent / Guardian Name" required />
        <input type="tel" placeholder="Guardian WhatsApp Number" required />

        <label>
          <input type="checkbox" required />
          I am the parent/guardian and give consent for the participant to
          take part in the event.
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "PAY ₹299 & REGISTER"}
        </button>
      </form>
    </main>
  );
}
