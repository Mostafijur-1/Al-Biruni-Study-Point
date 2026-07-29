export const LAB_XP_REWARD = 35;

export type ScienceLabId = "motion" | "circuit" | "mole";

export type LabInputValues =
  | { velocity: number; time: number }
  | { voltage: number; resistance: number }
  | { moles: number; molarMass: number };

export const SCIENCE_LABS = {
  motion: {
    id: "motion",
    title: "গতি গবেষণাগার",
    subject: "পদার্থবিজ্ঞান",
    description: "বেগ ও সময় বদলে সরণ কীভাবে পরিবর্তিত হয় দেখুন।",
    challenge: "বেগ ও সময় এমনভাবে সেট করুন যেন বস্তুটি ৬০ মিটার যায়।",
    target: 60,
    unit: "m",
    xp: LAB_XP_REWARD,
  },
  circuit: {
    id: "circuit",
    title: "ওহমের সূত্র ল্যাব",
    subject: "পদার্থবিজ্ঞান",
    description: "ভোল্টেজ ও রোধ বদলে কারেন্ট এবং ক্ষমতা পর্যবেক্ষণ করুন।",
    challenge: "ভোল্টেজ ও রোধ এমনভাবে সেট করুন যেন কারেন্ট ২ অ্যাম্পিয়ার হয়।",
    target: 2,
    unit: "A",
    xp: LAB_XP_REWARD,
  },
  mole: {
    id: "mole",
    title: "মোল ও ভর ল্যাব",
    subject: "রসায়ন",
    description: "মোল ও মোলার ভর থেকে পদার্থের মোট ভর বের করুন।",
    challenge: "পানি বেছে নিয়ে পরিমাণ এমনভাবে সেট করুন যেন ভর ৩৬ গ্রাম হয়।",
    target: 36,
    unit: "g",
    xp: LAB_XP_REWARD,
  },
} as const;

export const SCIENCE_LAB_IDS = Object.keys(SCIENCE_LABS) as ScienceLabId[];

export function calculateMotionDistance(velocity: number, time: number) {
  return velocity * time;
}

export function calculateCircuitValues(voltage: number, resistance: number) {
  if (resistance <= 0) return { current: 0, power: 0 };
  const current = voltage / resistance;
  return {
    current,
    power: voltage * current,
  };
}

export function calculateMolarMass(moles: number, molarMass: number) {
  return moles * molarMass;
}

function isWholeNumberInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isHalfStepInRange(value: number, min: number, max: number) {
  return (
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    Number.isInteger(value * 2)
  );
}

export function validateLabMastery(
  labId: ScienceLabId,
  values: LabInputValues,
) {
  if (labId === "motion" && "velocity" in values && "time" in values) {
    if (
      !isWholeNumberInRange(values.velocity, 2, 20) ||
      !isWholeNumberInRange(values.time, 1, 10)
    ) {
      return { valid: false as const, result: 0 };
    }
    const result = calculateMotionDistance(values.velocity, values.time);
    return {
      valid: result === SCIENCE_LABS.motion.target,
      result,
    };
  }

  if (labId === "circuit" && "voltage" in values && "resistance" in values) {
    if (
      !isWholeNumberInRange(values.voltage, 3, 24) ||
      !isWholeNumberInRange(values.resistance, 2, 20)
    ) {
      return { valid: false as const, result: 0 };
    }
    const result = calculateCircuitValues(
      values.voltage,
      values.resistance,
    ).current;
    return {
      valid: Math.abs(result - SCIENCE_LABS.circuit.target) < 0.001,
      result,
    };
  }

  if (labId === "mole" && "moles" in values && "molarMass" in values) {
    if (
      !isHalfStepInRange(values.moles, 0.5, 5) ||
      ![18, 44, 58.5].includes(values.molarMass)
    ) {
      return { valid: false as const, result: 0 };
    }
    const result = calculateMolarMass(values.moles, values.molarMass);
    return {
      valid:
        values.molarMass === 18 &&
        Math.abs(result - SCIENCE_LABS.mole.target) < 0.001,
      result,
    };
  }

  return { valid: false as const, result: 0 };
}
