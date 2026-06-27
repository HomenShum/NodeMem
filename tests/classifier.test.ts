import { describe, it, expect } from "vitest";
import {
  classifyNoteworthy,
  normalizeEntityKey,
  CLASSIFIER_VERSION,
  SIGNAL,
} from "../src/core/classifier.js";

describe("classifyNoteworthy", () => {
  it("detects organization candidates with suffix", () => {
    const f = classifyNoteworthy("CardioNova Inc just raised their Series A");
    expect(f.entities.length).toBeGreaterThan(0);
    expect(f.entities[0].displayName).toBe("CardioNova Inc");
    expect(f.signals).toContain(SIGNAL.ORG_CANDIDATE);
    expect(f.signals).toContain(SIGNAL.FINANCE_SIGNAL);
  });

  it("detects person interaction signals", () => {
    const f = classifyNoteworthy("Met with the founder last week about their runway");
    expect(f.signals).toContain(SIGNAL.PERSON_INTERACTION);
    expect(f.signals).toContain(SIGNAL.FINANCE_SIGNAL);
  });

  it("detects source URLs", () => {
    const f = classifyNoteworthy("Check out https://example.com for more info");
    expect(f.signals).toContain(SIGNAL.SOURCE_URL);
  });

  it("detects open questions and tasks", () => {
    const f = classifyNoteworthy("Need to verify the source and follow up on the reference");
    expect(f.signals).toContain(SIGNAL.OPEN_QUESTION_OR_TASK);
  });

  it("returns ignore for low-signal text", () => {
    const f = classifyNoteworthy("hello world");
    expect(f.action).toBe("ignore");
    expect(f.score).toBeLessThan(0.35);
  });

  it("returns start_research_job for high-signal text", () => {
    const text = "Met with CardioNova founder about their Series A funding. They announced a pilot at three hospitals. Need to verify their runway. See https://example.com";
    const f = classifyNoteworthy(text);
    expect(f.score).toBeGreaterThanOrEqual(0.70);
    expect(f.action).toBe("start_research_job");
    expect(f.signals.length).toBeGreaterThanOrEqual(4);
  });

  it("is deterministic — same input produces same output", () => {
    const text = "Stripe announced their Series B funding raise";
    const f1 = classifyNoteworthy(text);
    const f2 = classifyNoteworthy(text);
    expect(f1).toEqual(f2);
  });

  it("pins classifier version", () => {
    expect(CLASSIFIER_VERSION).toBe("noteworthy-v1");
  });

  it("filters stop names", () => {
    const f = classifyNoteworthy("The Next Series will be announced");
    // "The" and "Next" and "Series" are stop names
    expect(f.entities.length).toBe(0);
  });
});

describe("normalizeEntityKey", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeEntityKey("CardioNova")).toBe("cardionova");
    expect(normalizeEntityKey("Foo Bar Baz")).toBe("foo-bar-baz");
    expect(normalizeEntityKey("A.B.C!")).toBe("a-b-c");
  });

  it("returns 'unknown' for empty strings", () => {
    expect(normalizeEntityKey("")).toBe("unknown");
    expect(normalizeEntityKey("   ")).toBe("unknown");
  });
});
