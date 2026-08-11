const GOOGLE_MEET_HOSTNAME = "meet.google.com";
const GOOGLE_MEET_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function parseGoogleMeetUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== GOOGLE_MEET_HOSTNAME
  ) {
    return null;
  }

  const code = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!code || !GOOGLE_MEET_CODE.test(code)) return null;

  return {
    code,
    url: `https://${GOOGLE_MEET_HOSTNAME}/${code}`,
  };
}

export function googleMeetUrlFromCode(code: string) {
  const normalized = code.trim().toLowerCase();
  return GOOGLE_MEET_CODE.test(normalized)
    ? `https://${GOOGLE_MEET_HOSTNAME}/${normalized}`
    : null;
}
