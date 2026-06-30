import { describe, expect, it } from "vitest";
import { parseTranscriptText } from "../src/transcribe.js";
import { OfflineSummarizationProvider } from "../src/summarize.js";
import { formatMinutes, MINUTES_STYLES } from "../src/minutes.js";
import type { Meeting } from "../src/types.js";

describe("transcribe", () => {
  it("parses speaker-labelled lines", () => {
    const r = parseTranscriptText("Amaka: We agreed to ship Friday.\nTunde: Action item for QA.");
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]?.speaker).toBe("Amaka");
  });
});

describe("summarize", () => {
  it("extracts summary offline", async () => {
    const provider = new OfflineSummarizationProvider();
    const result = await provider.summarize({
      title: "Sprint Planning",
      attendees: ["Ada"],
      transcript: [
        { text: "We decided to prioritize the payment webhook fix." },
        { text: "Tunde will follow up with Paystack by Friday." },
      ],
    });
    expect(result.summary).toContain("Sprint Planning");
    expect(result.decisions.length + result.actionItems.length).toBeGreaterThan(0);
  });
});

describe("minutes", () => {
  const meeting: Meeting = {
    id: "1",
    title: "Board Review",
    date: "2026-06-30",
    attendees: ["Chair", "Secretary"],
    transcript: [{ speaker: "Chair", text: "Motion carried on budget." }],
    summary: "Budget approved.",
    actionItems: [{ id: "a1", owner: "Finance", task: "Publish report", status: "open" }],
    decisions: ["Budget approved for Q3."],
    style: "formal",
    createdAt: "",
    updatedAt: "",
  };

  it("formats all styles", () => {
    for (const style of MINUTES_STYLES) {
      const md = formatMinutes(meeting, style);
      expect(md).toContain("Board Review");
    }
  });
});
