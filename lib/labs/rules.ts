import type { SchoolLevel } from "@/lib/content/syllabus";

export const LAB_XP_REWARD = 30;

export type LabInputValues = Record<string, number>;

export type LabControl = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  initial: number;
  choices?: Array<{ value: number; label: string }>;
};

type ScienceLabDefinition = {
  id: string;
  title: string;
  family: "physics" | "chemistry" | "math" | "ict";
  subject: Record<SchoolLevel, string>;
  chapter: Record<SchoolLevel, string>;
  description: string;
  challenge: string;
  formula: string;
  insight: string;
  target: number;
  tolerance: number;
  unit: string;
  resultLabel: string;
  xp: number;
  controls: LabControl[];
};

const control = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string,
  initial: number,
  choices?: Array<{ value: number; label: string }>,
): LabControl => ({
  key,
  label,
  min,
  max,
  step,
  unit,
  initial,
  choices,
});

export const SCIENCE_LABS = {
  motion: {
    id: "motion",
    title: "গতি গবেষণাগার",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ১ম পত্র" },
    chapter: { ssc: "Chapter 2: Motion", hsc: "Chapter 3: Dynamics" },
    description: "বেগ ও সময় বদলে চলন্ত বস্তুর সরণ পর্যবেক্ষণ করুন।",
    challenge: "বস্তুটিকে ঠিক ৬০ মিটার সরান।",
    formula: "s = v × t",
    insight: "একই সময়ে বেগ দ্বিগুণ করলে সরণও দ্বিগুণ হয়।",
    target: 60,
    tolerance: 0.001,
    unit: "m",
    resultLabel: "সরণ",
    xp: LAB_XP_REWARD,
    controls: [
      control("velocity", "বেগ", 2, 20, 1, "m/s", 10),
      control("time", "সময়", 1, 10, 1, "s", 4),
    ],
  },
  force: {
    id: "force",
    title: "নিউটনের বল মিশন",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ১ম পত্র" },
    chapter: { ssc: "Chapter 3: Force", hsc: "Chapter 4: Newtonian Mechanics" },
    description: "ভর ও ত্বরণ বদলে বলের প্রতিক্রিয়া দেখুন।",
    challenge: "২৪ নিউটন বল তৈরি করুন।",
    formula: "F = m × a",
    insight: "ভর বেশি হলে একই ত্বরণ তুলতে বেশি বল প্রয়োজন।",
    target: 24,
    tolerance: 0.001,
    unit: "N",
    resultLabel: "বল",
    xp: LAB_XP_REWARD,
    controls: [
      control("mass", "ভর", 1, 12, 1, "kg", 4),
      control("acceleration", "ত্বরণ", 1, 10, 1, "m/s²", 4),
    ],
  },
  energy: {
    id: "energy",
    title: "গতিশক্তি র‍্যাম্প",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ১ম পত্র" },
    chapter: {
      ssc: "Chapter 4: Work, Power and Energy",
      hsc: "Chapter 5: Work, Energy and Power",
    },
    description: "ভর ও বেগ দিয়ে গতিশক্তির দ্রুত বৃদ্ধি দেখুন।",
    challenge: "ঠিক ১০০ জুল গতিশক্তি তৈরি করুন।",
    formula: "Eₖ = ½mv²",
    insight: "বেগ দ্বিগুণ হলে গতিশক্তি চার গুণ হয়।",
    target: 100,
    tolerance: 0.001,
    unit: "J",
    resultLabel: "গতিশক্তি",
    xp: LAB_XP_REWARD,
    controls: [
      control("mass", "ভর", 1, 10, 1, "kg", 4),
      control("velocity", "বেগ", 1, 10, 1, "m/s", 5),
    ],
  },
  pressure: {
    id: "pressure",
    title: "চাপ ও ক্ষেত্রফল স্টুডিও",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ১ম পত্র" },
    chapter: {
      ssc: "Chapter 5: State of Matter and Pressure",
      hsc: "Chapter 7: Structural Properties of Matter",
    },
    description: "একই বল ছোট-বড় ক্ষেত্রফলে প্রয়োগ করে চাপ তুলনা করুন।",
    challenge: "২০ প্যাসকেল চাপ তৈরি করুন।",
    formula: "P = F ÷ A",
    insight: "ক্ষেত্রফল কমলে একই বলের চাপ বেড়ে যায়।",
    target: 20,
    tolerance: 0.001,
    unit: "Pa",
    resultLabel: "চাপ",
    xp: LAB_XP_REWARD,
    controls: [
      control("force", "প্রয়োগকৃত বল", 20, 120, 10, "N", 60),
      control("area", "ক্ষেত্রফল", 1, 10, 1, "m²", 4),
    ],
  },
  wave: {
    id: "wave",
    title: "তরঙ্গ টানেল",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ১ম পত্র" },
    chapter: { ssc: "Chapter 7: Waves and Sound", hsc: "Chapter 9: Waves" },
    description: "কম্পাঙ্ক ও তরঙ্গদৈর্ঘ্য বদলে তরঙ্গের গতি দেখুন।",
    challenge: "২০ মিটার/সেকেন্ড তরঙ্গবেগ তৈরি করুন।",
    formula: "v = f × λ",
    insight: "একই মাধ্যমে কম্পাঙ্ক ও তরঙ্গদৈর্ঘ্য পরস্পর সম্পর্কিত।",
    target: 20,
    tolerance: 0.001,
    unit: "m/s",
    resultLabel: "তরঙ্গবেগ",
    xp: LAB_XP_REWARD,
    controls: [
      control("frequency", "কম্পাঙ্ক", 1, 10, 1, "Hz", 5),
      control("wavelength", "তরঙ্গদৈর্ঘ্য", 1, 8, 0.5, "m", 3),
    ],
  },
  circuit: {
    id: "circuit",
    title: "ওহমের সূত্র সার্কিট",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ২য় পত্র" },
    chapter: {
      ssc: "Chapter 11: Current Electricity",
      hsc: "Chapter 3: Current Electricity",
    },
    description: "ভোল্টেজ ও রোধ বদলে কারেন্ট এবং বাল্বের উজ্জ্বলতা দেখুন।",
    challenge: "ঠিক ২ অ্যাম্পিয়ার কারেন্ট প্রবাহিত করুন।",
    formula: "I = V ÷ R",
    insight: "রোধ বাড়লে একই ভোল্টেজে কারেন্ট কমে।",
    target: 2,
    tolerance: 0.001,
    unit: "A",
    resultLabel: "কারেন্ট",
    xp: LAB_XP_REWARD,
    controls: [
      control("voltage", "ভোল্টেজ", 3, 24, 1, "V", 9),
      control("resistance", "রোধ", 2, 20, 1, "Ω", 6),
    ],
  },
  optics: {
    id: "optics",
    title: "লেন্স ও আলোকরশ্মি 3D",
    family: "physics",
    subject: { ssc: "পদার্থবিজ্ঞান", hsc: "পদার্থবিজ্ঞান ২য় পত্র" },
    chapter: {
      ssc: "Chapter 9: Refraction of Light",
      hsc: "Chapter 6: Geometrical Optics",
    },
    description: "ফোকাল দৈর্ঘ্য ও বস্তুর দূরত্ব বদলে প্রতিচ্ছবির অবস্থান দেখুন।",
    challenge: "প্রতিচ্ছবিকে লেন্স থেকে ৩০ সেন্টিমিটারে আনুন।",
    formula: "v = fu ÷ (u − f)",
    insight: "বস্তু ফোকাসের কাছে এলে প্রতিচ্ছবি অনেক দূরে সরে যায়।",
    target: 30,
    tolerance: 0.01,
    unit: "cm",
    resultLabel: "প্রতিচ্ছবির দূরত্ব",
    xp: LAB_XP_REWARD,
    controls: [
      control("focalLength", "ফোকাল দৈর্ঘ্য", 5, 15, 1, "cm", 10),
      control("objectDistance", "বস্তুর দূরত্ব", 12, 40, 1, "cm", 20),
    ],
  },
  atom: {
    id: "atom",
    title: "পরমাণু নির্মাতা 3D",
    family: "chemistry",
    subject: { ssc: "রসায়ন", hsc: "রসায়ন ১ম পত্র" },
    chapter: {
      ssc: "Chapter 3: Structure of Matter",
      hsc: "Chapter 3: Periodic Properties and Chemical Bond",
    },
    description: "প্রোটন, নিউট্রন ও ইলেকট্রন সাজিয়ে একটি স্থিতিশীল পরমাণু বানান।",
    challenge: "৮ প্রোটন, ৮ নিউট্রন ও ৮ ইলেকট্রন দিয়ে অক্সিজেন-১৬ তৈরি করুন।",
    formula: "A = p + n",
    insight: "প্রোটন মৌল নির্ধারণ করে; নিউট্রন বদলালে আইসোটোপ তৈরি হয়।",
    target: 16,
    tolerance: 0.001,
    unit: "",
    resultLabel: "ভরসংখ্যা",
    xp: LAB_XP_REWARD,
    controls: [
      control("protons", "প্রোটন", 1, 12, 1, "", 6),
      control("neutrons", "নিউট্রন", 0, 14, 1, "", 6),
      control("electrons", "ইলেকট্রন", 0, 12, 1, "", 6),
    ],
  },
  mole: {
    id: "mole",
    title: "মোল ও ভর ল্যাব",
    family: "chemistry",
    subject: { ssc: "রসায়ন", hsc: "রসায়ন ২য় পত্র" },
    chapter: {
      ssc: "Chapter 6: Concept of Mole and Chemical Counting",
      hsc: "Chemistry 2nd Paper - Chapter 3: Quantitative Chemistry",
    },
    description: "মোল ও মোলার ভর থেকে পদার্থের মোট ভর বের করুন।",
    challenge: "পানি বেছে নিয়ে ঠিক ৩৬ গ্রাম নমুনা তৈরি করুন।",
    formula: "m = n × M",
    insight: "একই মোল হলেও পদার্থভেদে মোলার ভর আলাদা হয়।",
    target: 36,
    tolerance: 0.001,
    unit: "g",
    resultLabel: "মোট ভর",
    xp: LAB_XP_REWARD,
    controls: [
      control("moles", "পদার্থের পরিমাণ", 0.5, 5, 0.5, "mol", 1),
      control(
        "molarMass",
        "পদার্থ",
        18,
        58.5,
        0.5,
        "g/mol",
        18,
        [
          { value: 18, label: "পানি (H₂O)" },
          { value: 44, label: "কার্বন ডাই-অক্সাইড (CO₂)" },
          { value: 58.5, label: "সোডিয়াম ক্লোরাইড (NaCl)" },
        ],
      ),
    ],
  },
  reaction: {
    id: "reaction",
    title: "বিক্রিয়ার গতি চেম্বার",
    family: "chemistry",
    subject: { ssc: "রসায়ন", hsc: "রসায়ন ১ম পত্র" },
    chapter: {
      ssc: "Chapter 7: Chemical Reactions",
      hsc: "Chapter 4: Chemical Changes",
    },
    description: "তাপমাত্রা ও ঘনমাত্রা বদলে কণার সংঘর্ষের হার দেখুন।",
    challenge: "বিক্রিয়ার আপেক্ষিক হার ১২-তে নিন।",
    formula: "হার = T × C ÷ 10",
    insight: "তাপমাত্রা বাড়লে কণার কার্যকর সংঘর্ষের সংখ্যা বাড়ে।",
    target: 12,
    tolerance: 0.001,
    unit: "rate",
    resultLabel: "আপেক্ষিক হার",
    xp: LAB_XP_REWARD,
    controls: [
      control("temperature", "তাপমাত্রা", 20, 80, 10, "°C", 30),
      control("concentration", "ঘনমাত্রা", 1, 4, 1, "mol/L", 2),
    ],
  },
  ph: {
    id: "ph",
    title: "pH রঙের গোয়েন্দা",
    family: "chemistry",
    subject: { ssc: "রসায়ন", hsc: "রসায়ন ২য় পত্র" },
    chapter: {
      ssc: "Chapter 9: Acid-Base Equilibrium",
      hsc: "Chemistry 2nd Paper - Chapter 1: Environmental Chemistry",
    },
    description: "হাইড্রোজেন আয়নের ঘনমাত্রা বদলে দ্রবণের রঙ ও অম্লত্ব দেখুন।",
    challenge: "pH ৩-এর একটি অম্লীয় দ্রবণ তৈরি করুন।",
    formula: "pH = −log₁₀[H⁺]",
    insight: "pH এক ধাপ কমা মানে অম্লত্ব দশ গুণ বৃদ্ধি।",
    target: 3,
    tolerance: 0.001,
    unit: "pH",
    resultLabel: "pH",
    xp: LAB_XP_REWARD,
    controls: [
      control("phValue", "হাইড্রোজেন ঘনমাত্রার সূচক", 1, 14, 1, "pH", 7),
    ],
  },
  solution: {
    id: "solution",
    title: "দ্রবণ মিশ্রণ স্টেশন",
    family: "chemistry",
    subject: { ssc: "রসায়ন", hsc: "রসায়ন ১ম পত্র" },
    chapter: {
      ssc: "Chapter 12: Chemistry in Our Lives",
      hsc: "Chapter 5: Working Chemistry",
    },
    description: "দ্রবের মোল ও আয়তন বদলে মোলারিটি নিয়ন্ত্রণ করুন।",
    challenge: "২ মোলার ঘনমাত্রার দ্রবণ তৈরি করুন।",
    formula: "M = n ÷ V",
    insight: "একই দ্রব কম আয়তনে মেশালে ঘনমাত্রা বেড়ে যায়।",
    target: 2,
    tolerance: 0.001,
    unit: "M",
    resultLabel: "মোলারিটি",
    xp: LAB_XP_REWARD,
    controls: [
      control("moles", "দ্রবের পরিমাণ", 0.25, 2, 0.25, "mol", 0.5),
      control("volume", "দ্রবণের আয়তন", 0.25, 2, 0.25, "L", 1),
    ],
  },
  vector: {
    id: "vector",
    title: "ভেক্টর নেভিগেশন",
    family: "math",
    subject: { ssc: "উচ্চতর গণিত", hsc: "উচ্চতর গণিত ১ম পত্র" },
    chapter: {
      ssc: "Chapter 12: Planar Vector",
      hsc: "Chapter 2: Vectors",
    },
    description: "x ও y উপাংশ বদলে ভেক্টরের দিক ও মান দেখুন।",
    challenge: "৩-৪ উপাংশ ব্যবহার করে ৫ একক ভেক্টর তৈরি করুন।",
    formula: "|v| = √(x² + y²)",
    insight: "লম্ব উপাংশ দুটি পিথাগোরাসের সূত্রে মোট মান তৈরি করে।",
    target: 5,
    tolerance: 0.001,
    unit: "unit",
    resultLabel: "ভেক্টরের মান",
    xp: LAB_XP_REWARD,
    controls: [
      control("x", "x উপাংশ", 0, 10, 1, "", 2),
      control("y", "y উপাংশ", 0, 10, 1, "", 2),
    ],
  },
  trigonometry: {
    id: "trigonometry",
    title: "ত্রিকোণমিতিক তরঙ্গ মঞ্চ",
    family: "math",
    subject: { ssc: "উচ্চতর গণিত", hsc: "উচ্চতর গণিত ১ম পত্র" },
    chapter: {
      ssc: "Chapter 8: Trigonometry",
      hsc: "Chapter 8: Functions and Graphs of Functions",
    },
    description: "অ্যামপ্লিটিউড ও কম্পাঙ্ক বদলে চলমান সাইন তরঙ্গ গড়ুন।",
    challenge: "তরঙ্গ সূচক ৬ তৈরি করুন।",
    formula: "সূচক = A × f",
    insight: "অ্যামপ্লিটিউড উচ্চতা এবং কম্পাঙ্ক দোলনের ঘনত্ব নিয়ন্ত্রণ করে।",
    target: 6,
    tolerance: 0.001,
    unit: "index",
    resultLabel: "তরঙ্গ সূচক",
    xp: LAB_XP_REWARD,
    controls: [
      control("amplitude", "অ্যামপ্লিটিউড", 1, 5, 1, "", 2),
      control("frequency", "কম্পাঙ্ক", 1, 6, 1, "", 2),
    ],
  },
  probability: {
    id: "probability",
    title: "সম্ভাবনা স্পিনার",
    family: "math",
    subject: { ssc: "উচ্চতর গণিত", hsc: "উচ্চতর গণিত ২য় পত্র" },
    chapter: {
      ssc: "Chapter 14: Probability",
      hsc: "Chapter 10: Probability",
    },
    description: "অনুকূল ও মোট ফল বদলে সম্ভাবনার চাকা তৈরি করুন।",
    challenge: "ঠিক ৫০% সম্ভাবনার একটি ঘটনা বানান।",
    formula: "P = অনুকূল ফল ÷ মোট ফল",
    insight: "অনুকূল ফল মোট ফলের অর্ধেক হলে সম্ভাবনা ৫০%।",
    target: 50,
    tolerance: 0.01,
    unit: "%",
    resultLabel: "সম্ভাবনা",
    xp: LAB_XP_REWARD,
    controls: [
      control("favorable", "অনুকূল ফল", 1, 10, 1, "", 2),
      control("total", "মোট ফল", 2, 12, 1, "", 6),
    ],
  },
  binary: {
    id: "binary",
    title: "বাইনারি বিট নির্মাতা",
    family: "ict",
    subject: {
      ssc: "তথ্য ও যোগাযোগ প্রযুক্তি",
      hsc: "তথ্য ও যোগাযোগ প্রযুক্তি",
    },
    chapter: {
      ssc: "Chapter 2: Computer and Computer Security",
      hsc: "Chapter 3: Number Systems and Digital Devices",
    },
    description: "ছয়টি বিট অন-অফ করে দশমিক সংখ্যা তৈরি করুন।",
    challenge: "বিট ব্যবহার করে দশমিক ৪২ তৈরি করুন।",
    formula: "32b₅ + 16b₄ + 8b₃ + 4b₂ + 2b₁ + b₀",
    insight: "প্রতিটি বিট দুইয়ের একটি নির্দিষ্ট ঘাতের মান বহন করে।",
    target: 42,
    tolerance: 0.001,
    unit: "decimal",
    resultLabel: "দশমিক মান",
    xp: LAB_XP_REWARD,
    controls: [32, 16, 8, 4, 2, 1].map((weight) =>
      control(
        `bit${weight}`,
        `${weight}-এর বিট`,
        0,
        1,
        1,
        "",
        0,
        [
          { value: 0, label: "0 · বন্ধ" },
          { value: 1, label: "1 · চালু" },
        ],
      ),
    ),
  },
  logic: {
    id: "logic",
    title: "লজিক গেট কারখানা",
    family: "ict",
    subject: {
      ssc: "তথ্য ও যোগাযোগ প্রযুক্তি",
      hsc: "তথ্য ও যোগাযোগ প্রযুক্তি",
    },
    chapter: {
      ssc: "Chapter 2: Computer and Computer Security",
      hsc: "Chapter 3: Number Systems and Digital Devices",
    },
    description: "ইনপুট ও গেট বদলে ডিজিটাল আউটপুট পরীক্ষা করুন।",
    challenge: "XOR গেটে A=1 ও B=0 দিয়ে আউটপুট ১ করুন।",
    formula: "Y = A ⊕ B",
    insight: "XOR গেটের ইনপুট দুটি আলাদা হলেই আউটপুট ১ হয়।",
    target: 1,
    tolerance: 0.001,
    unit: "bit",
    resultLabel: "আউটপুট",
    xp: LAB_XP_REWARD,
    controls: [
      control("gate", "গেট", 0, 2, 1, "", 0, [
        { value: 0, label: "AND" },
        { value: 1, label: "OR" },
        { value: 2, label: "XOR" },
      ]),
      control("inputA", "ইনপুট A", 0, 1, 1, "", 1, [
        { value: 0, label: "0" },
        { value: 1, label: "1" },
      ]),
      control("inputB", "ইনপুট B", 0, 1, 1, "", 1, [
        { value: 0, label: "0" },
        { value: 1, label: "1" },
      ]),
    ],
  },
  network: {
    id: "network",
    title: "ডেটা ট্রান্সফার রেস",
    family: "ict",
    subject: {
      ssc: "তথ্য ও যোগাযোগ প্রযুক্তি",
      hsc: "তথ্য ও যোগাযোগ প্রযুক্তি",
    },
    chapter: {
      ssc: "Chapter 3: Internet in My Education",
      hsc: "Chapter 2: Communication Systems and Networking",
    },
    description: "ফাইলের আকার ও ব্যান্ডউইডথ বদলে ডাউনলোড সময় দেখুন।",
    challenge: "ফাইলটি ঠিক ১০ সেকেন্ডে পাঠান।",
    formula: "সময় = (MB × 8) ÷ Mbps",
    insight: "ব্যান্ডউইডথ দ্বিগুণ করলে একই ফাইলের সময় অর্ধেক হয়।",
    target: 10,
    tolerance: 0.001,
    unit: "s",
    resultLabel: "ট্রান্সফার সময়",
    xp: LAB_XP_REWARD,
    controls: [
      control("fileSize", "ফাইলের আকার", 20, 200, 10, "MB", 100),
      control("bandwidth", "ব্যান্ডউইডথ", 10, 100, 10, "Mbps", 40),
    ],
  },
} as const satisfies Record<string, ScienceLabDefinition>;

export type ScienceLabId = keyof typeof SCIENCE_LABS;

export const SCIENCE_LAB_IDS = Object.keys(SCIENCE_LABS) as [
  ScienceLabId,
  ...ScienceLabId[],
];

export function getScienceLabsForLevel(level: SchoolLevel) {
  return SCIENCE_LAB_IDS.map((labId) => {
    const lab = SCIENCE_LABS[labId];
    return {
      ...lab,
      id: labId,
      subject: lab.subject[level],
      chapter: lab.chapter[level],
    };
  });
}

export function getInitialLabValues(labId: ScienceLabId) {
  return Object.fromEntries(
    SCIENCE_LABS[labId].controls.map((item) => [item.key, item.initial]),
  );
}

export function calculateMotionDistance(velocity: number, time: number) {
  return velocity * time;
}

export function calculateCircuitValues(voltage: number, resistance: number) {
  if (resistance <= 0) return { current: 0, power: 0 };
  const current = voltage / resistance;
  return { current, power: voltage * current };
}

export function calculateMolarMass(moles: number, molarMass: number) {
  return moles * molarMass;
}

function number(values: LabInputValues, key: string) {
  return Number(values[key] ?? Number.NaN);
}

export function calculateLabResult(
  labId: ScienceLabId,
  values: LabInputValues,
) {
  switch (labId) {
    case "motion":
      return calculateMotionDistance(number(values, "velocity"), number(values, "time"));
    case "force":
      return number(values, "mass") * number(values, "acceleration");
    case "energy":
      return 0.5 * number(values, "mass") * number(values, "velocity") ** 2;
    case "pressure":
      return number(values, "force") / number(values, "area");
    case "wave":
      return number(values, "frequency") * number(values, "wavelength");
    case "circuit":
      return calculateCircuitValues(
        number(values, "voltage"),
        number(values, "resistance"),
      ).current;
    case "optics": {
      const focalLength = number(values, "focalLength");
      const objectDistance = number(values, "objectDistance");
      return (focalLength * objectDistance) / (objectDistance - focalLength);
    }
    case "atom":
      return number(values, "protons") + number(values, "neutrons");
    case "mole":
      return calculateMolarMass(number(values, "moles"), number(values, "molarMass"));
    case "reaction":
      return (number(values, "temperature") * number(values, "concentration")) / 10;
    case "ph":
      return number(values, "phValue");
    case "solution":
      return number(values, "moles") / number(values, "volume");
    case "vector":
      return Math.hypot(number(values, "x"), number(values, "y"));
    case "trigonometry":
      return number(values, "amplitude") * number(values, "frequency");
    case "probability":
      return (number(values, "favorable") / number(values, "total")) * 100;
    case "binary":
      return [32, 16, 8, 4, 2, 1].reduce(
        (total, weight) => total + number(values, `bit${weight}`) * weight,
        0,
      );
    case "logic": {
      const inputA = number(values, "inputA") === 1;
      const inputB = number(values, "inputB") === 1;
      const gate = number(values, "gate");
      if (gate === 0) return inputA && inputB ? 1 : 0;
      if (gate === 1) return inputA || inputB ? 1 : 0;
      return inputA !== inputB ? 1 : 0;
    }
    case "network":
      return (number(values, "fileSize") * 8) / number(values, "bandwidth");
  }
}

function valuesAreAllowed(labId: ScienceLabId, values: LabInputValues) {
  return SCIENCE_LABS[labId].controls.every((item) => {
    const value = number(values, item.key);
    if (!Number.isFinite(value) || value < item.min || value > item.max) {
      return false;
    }
    if (item.choices) {
      return item.choices.some((choice) => choice.value === value);
    }
    const steps = (value - item.min) / item.step;
    return Math.abs(steps - Math.round(steps)) < 0.000_001;
  });
}

export function validateLabMastery(
  labId: ScienceLabId,
  values: LabInputValues,
) {
  if (!valuesAreAllowed(labId, values)) {
    return { valid: false as const, result: 0 };
  }
  if (
    labId === "probability" &&
    number(values, "favorable") > number(values, "total")
  ) {
    return { valid: false as const, result: 0 };
  }

  const result = calculateLabResult(labId, values);
  const definition = SCIENCE_LABS[labId];
  const targetReached =
    Number.isFinite(result) &&
    Math.abs(result - definition.target) <= definition.tolerance;
  const specialTargetReached =
    labId === "atom"
      ? number(values, "protons") === 8 &&
        number(values, "neutrons") === 8 &&
        number(values, "electrons") === 8
      : labId === "mole"
        ? number(values, "molarMass") === 18
        : labId === "logic"
          ? number(values, "gate") === 2 &&
            number(values, "inputA") === 1 &&
            number(values, "inputB") === 0
          : true;

  return {
    valid: targetReached && specialTargetReached,
    result: Number(result.toFixed(4)),
  };
}
