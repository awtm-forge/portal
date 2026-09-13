import { describe, expect, it } from "vitest";
import { Phase } from "@/generated/prisma/enums";
import { journeyFor } from "@/components/portal/Journey";
import { CHIP_LABEL, fill, HOME_STATES, homeStateFor, STAGES, STAGE_NOTES, type HomeFacts } from "@/content/client-home";

const base: HomeFacts = {
  phase: Phase.BUILDING,
  hasQuestionnaire: true,
  questionnaireSubmitted: true,
  sectionsDone: 5,
  sectionsTotal: 5,
  hasProject: true,
  agreementChangeAsked: false,
  deliveryChangeAsked: false,
  day30Due: false,
  checkinScheduled: false,
  day30Done: false,
  ended: false,
};

describe("the home page's copy", () => {
  it("asks for nothing on a project that was closed early, even with the check-in due", () => {
    expect(homeStateFor({ ...base, phase: Phase.CANCELLED, ended: true, day30Due: true }).chip).toBe("waiting");
    expect(homeStateFor({ ...base, phase: Phase.CANCELLED, ended: true }).action).toBeUndefined();
  });

  it("puts the questionnaire before everything else while it is open", () => {
    const open = { ...base, phase: Phase.AGREEMENT_SENT, questionnaireSubmitted: false, sectionsDone: 2 };
    expect(homeStateFor(open).action?.path).toBe("/intake");
    expect(homeStateFor(open).key).toBe("questionnaire.resumed");
    expect(homeStateFor({ ...open, sectionsDone: 0 }).key).toBe("questionnaire.ready");
  });

  it("names the one action for each phase that has one, and none for the rest", () => {
    expect(homeStateFor({ ...base, phase: Phase.AGREEMENT_SENT }).action?.path).toBe("/agreement");
    expect(homeStateFor({ ...base, phase: Phase.IN_REVIEW }).action?.path).toBe("/review");
    expect(homeStateFor({ ...base, phase: Phase.DELIVERED, day30Due: true }).action?.path).toBe("/day30");
    expect(homeStateFor({ ...base, phase: Phase.BUILDING }).action).toBeUndefined();
    expect(homeStateFor({ ...base, phase: Phase.AGREED }).action).toBeUndefined();
  });

  it("tells a brand new client what is happening before the questionnaire is up", () => {
    for (const phase of [null, Phase.INTAKE]) {
      const s = homeStateFor({ ...base, phase, hasQuestionnaire: false, questionnaireSubmitted: false, hasProject: phase !== null });
      expect(s.key).toBe("questionnaire.writing");
      expect(s.body).toMatch(/questionnaire/i);
    }
  });

  it("separates the agreement being written from the agreement being changed", () => {
    expect(homeStateFor({ ...base, phase: Phase.AGREEMENT_DRAFT }).key).toBe("agreement.preparing");
    expect(homeStateFor({ ...base, phase: Phase.AGREEMENT_DRAFT, agreementChangeAsked: true }).key).toBe("agreement.changes");
  });

  it("says we are making the changes when the client sent the delivery back", () => {
    expect(homeStateFor({ ...base, phase: Phase.BUILDING, deliveryChangeAsked: true }).key).toBe("delivery.changes");
    expect(homeStateFor({ ...base, phase: Phase.BUILDING }).key).toBe("build.running");
  });

  it("only ever says Done when the whole job is done", () => {
    const done = Object.values(HOME_STATES).filter((s) => s.chip === "done");
    expect(done.map((s) => s.key).sort()).toEqual(["delivery.done", "month.done"]);
  });

  it("never offers a button unless something is needed", () => {
    for (const state of Object.values(HOME_STATES)) {
      if (state.action) expect(state.chip, state.key).toBe("action");
    }
  });

  it("reaches every state it carries, so no copy rots unseen", () => {
    const bools = [true, false];
    const reachable = new Set<string>();
    for (const phase of [null, ...Object.values(Phase)]) {
      for (const hasQuestionnaire of bools) {
        for (const questionnaireSubmitted of bools) {
          for (const sectionsDone of [0, 2]) {
            for (const hasProject of bools) {
              for (const flags of bools.flatMap((a) => bools.flatMap((b) => bools.flatMap((c) => bools.flatMap((d) => bools.map((e) => [a, b, c, d, e] as const)))))) {
                const [agreementChangeAsked, deliveryChangeAsked, day30Due, day30Done, checkinScheduled] = flags;
                reachable.add(homeStateFor({
                  phase,
                  hasQuestionnaire,
                  questionnaireSubmitted,
                  sectionsDone,
                  sectionsTotal: 5,
                  hasProject,
                  agreementChangeAsked,
                  deliveryChangeAsked,
                  day30Due,
                  day30Done,
                  checkinScheduled,
                  ended: phase === Phase.CANCELLED || phase === Phase.CLOSED,
                }).key);
              }
            }
          }
        }
      }
    }
    const orphans = Object.keys(HOME_STATES).filter((k) => !reachable.has(k));
    expect(orphans, `states nothing can reach: ${orphans.join(", ")}`).toEqual([]);
  });

  it("writes in the house voice: sentence case, second person, no shouting", () => {
    for (const state of Object.values(HOME_STATES)) {
      expect(state.headline, state.key).not.toMatch(/[!]/);
      expect(state.body, state.key).not.toMatch(/[!]/);
      // No em dashes anywhere, in copy as much as in code.
      expect(state.headline + state.body, state.key).not.toMatch(/—/);
      // A headline is a sentence, not a label shouted in capitals.
      expect(state.headline, state.key).not.toBe(state.headline.toUpperCase());
    }
  });

  it("gives every stage a note with a length of time, for the rail and for How this works", () => {
    for (const stage of STAGES) {
      expect(STAGE_NOTES[stage.key].what.length, stage.key).toBeGreaterThan(20);
      expect(STAGE_NOTES[stage.key].how_long.length, stage.key).toBeGreaterThan(3);
    }
  });

  it("names the check-in in words a client understands", () => {
    expect(STAGES.map((s) => s.label)).toEqual(["Questionnaire", "Agreement", "Build", "Delivery", "Check-in"]);
    expect(CHIP_LABEL.action).toBe("Action needed");
  });
});

describe("filling a line", () => {
  it("drops the whole line rather than print a gap where a date should be", () => {
    expect(fill("Expect it by {date}.", { date: null })).toBeNull();
    expect(fill("Expect it by {date}.", { date: "" })).toBeNull();
    expect(fill("Expect it by {date}.", { date: "Tue 16 Sep" })).toBe("Expect it by Tue 16 Sep.");
  });

  it("drops a line whose placeholder nobody filled", () => {
    expect(fill("You are {done} of {total} in.", { done: 2 })).toBeNull();
    expect(fill("You are {done} of {total} in.", { done: 2, total: 5 })).toBe("You are 2 of 5 in.");
  });

  it("leaves a line with no placeholders alone", () => {
    expect(fill("We are building it.", {})).toBe("We are building it.");
  });
});

describe("the journey", () => {
  it("is absent for a cancelled project and complete for a closed one", () => {
    expect(journeyFor(Phase.CANCELLED, { intakeSubmitted: true, day30Done: false })).toBeNull();
    expect(journeyFor(Phase.CLOSED, { intakeSubmitted: true, day30Done: false })).toEqual({ now: null, done: ["questionnaire", "agreement", "build", "delivery", "month"] });
  });

  it("puts the rail's current stage on the same stage as the card's copy", () => {
    const pairs: [Phase, string][] = [
      [Phase.INTAKE, "questionnaire"],
      [Phase.AGREEMENT_SENT, "agreement"],
      [Phase.BUILDING, "build"],
      [Phase.IN_REVIEW, "delivery"],
    ];
    for (const [phase, stage] of pairs) {
      const j = journeyFor(phase, { intakeSubmitted: true, day30Done: false });
      const copy = homeStateFor({ ...base, phase, hasQuestionnaire: phase === Phase.INTAKE ? false : true });
      expect(j?.now, `${phase}`).toBe(stage);
      expect(copy.stage, `${phase}`).toBe(stage);
    }
  });
});
