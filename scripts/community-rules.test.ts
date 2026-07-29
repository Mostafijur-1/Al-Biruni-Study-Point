import assert from "node:assert/strict";
import test from "node:test";

import {
  MINIMUM_MISSION_CONTRIBUTION,
  calculateClassMissionTarget,
  canClaimClassMission,
  safeCommunityName,
} from "../lib/community/rules.ts";

test("class mission target scales with class size and stays attainable", () => {
  assert.equal(calculateClassMissionTarget(0), 100);
  assert.equal(calculateClassMissionTarget(20), 400);
  assert.equal(calculateClassMissionTarget(500), 1_000);
});

test("shared reward requires both class completion and personal contribution", () => {
  assert.equal(
    canClaimClassMission({
      classProgress: 400,
      classTarget: 400,
      studentContribution: MINIMUM_MISSION_CONTRIBUTION,
    }),
    true,
  );
  assert.equal(
    canClaimClassMission({
      classProgress: 399,
      classTarget: 400,
      studentContribution: 20,
    }),
    false,
  );
  assert.equal(
    canClaimClassMission({
      classProgress: 500,
      classTarget: 400,
      studentContribution: 9,
    }),
    false,
  );
});

test("community names hide all but the first name and last initial", () => {
  assert.equal(safeCommunityName("Nusrat Jahan Mim"), "Nusrat M…");
  assert.equal(safeCommunityName("Rafi"), "Rafi");
  assert.equal(safeCommunityName("   "), "শিক্ষার্থী");
});
