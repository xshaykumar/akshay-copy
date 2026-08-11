import { describe, expect, it } from "vitest";
import {
  googleMeetUrlFromCode,
  parseGoogleMeetUrl,
} from "../lib/meetings/google-meet";

describe("Google Meet links", () => {
  it("accepts and normalizes a Google Meet URL", () => {
    expect(
      parseGoogleMeetUrl(" https://meet.google.com/abc-defg-hij?authuser=0 "),
    ).toEqual({
      code: "abc-defg-hij",
      url: "https://meet.google.com/abc-defg-hij",
    });
  });

  it("rejects lookalike hosts, insecure URLs, and invalid codes", () => {
    expect(parseGoogleMeetUrl("https://meet.google.com.example/abc-defg-hij")).toBeNull();
    expect(parseGoogleMeetUrl("http://meet.google.com/abc-defg-hij")).toBeNull();
    expect(parseGoogleMeetUrl("https://meet.google.com/not-a-code")).toBeNull();
  });

  it("builds a canonical URL only from a valid Meet code", () => {
    expect(googleMeetUrlFromCode("ABC-DEFG-HIJ")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
    expect(googleMeetUrlFromCode("invalid")).toBeNull();
  });
});
