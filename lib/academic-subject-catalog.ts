export type CatalogSubject = { code: string; name: string; nameBn: string };

export const ACADEMIC_SUBJECT_CATALOG: readonly CatalogSubject[] = [
  { code: "PHY", name: "Physics", nameBn: "পদার্থবিজ্ঞান" },
  { code: "CHEM", name: "Chemistry", nameBn: "রসায়ন" },
  { code: "MATH", name: "Math", nameBn: "সাধারণ গণিত" },
  { code: "HMATH", name: "Higher Math", nameBn: "উচ্চতর গণিত" },
  { code: "BIO", name: "Biology", nameBn: "জীববিজ্ঞান" },
  { code: "ICT", name: "ICT", nameBn: "তথ্য ও যোগাযোগ প্রযুক্তি" },
  { code: "PHY-1", name: "Physics 1st Paper", nameBn: "পদার্থবিজ্ঞান ১ম পত্র" },
  { code: "PHY-2", name: "Physics 2nd Paper", nameBn: "পদার্থবিজ্ঞান ২য় পত্র" },
  { code: "CHEM-1", name: "Chemistry 1st Paper", nameBn: "রসায়ন ১ম পত্র" },
  { code: "CHEM-2", name: "Chemistry 2nd Paper", nameBn: "রসায়ন ২য় পত্র" },
  { code: "HMATH-1", name: "Higher Math 1st Paper", nameBn: "উচ্চতর গণিত ১ম পত্র" },
  { code: "HMATH-2", name: "Higher Math 2nd Paper", nameBn: "উচ্চতর গণিত ২য় পত্র" },
  { code: "BIO-1", name: "Biology 1st Paper", nameBn: "জীববিজ্ঞান ১ম পত্র" },
  { code: "BIO-2", name: "Biology 2nd Paper", nameBn: "জীববিজ্ঞান ২য় পত্র" },
  { code: "BAN-1", name: "Bangla 1st Paper", nameBn: "বাংলা ১ম পত্র" },
  { code: "BAN-2", name: "Bangla 2nd Paper", nameBn: "বাংলা ২য় পত্র" },
  { code: "ENG-1", name: "English 1st Paper", nameBn: "ইংরেজি ১ম পত্র" },
  { code: "ENG-2", name: "English 2nd Paper", nameBn: "ইংরেজি ২য় পত্র" },
];

export function findCatalogSubject(name: string) {
  const normalized = name.trim().toLocaleLowerCase("en-US");
  return ACADEMIC_SUBJECT_CATALOG.find((subject) =>
    subject.name.toLocaleLowerCase("en-US") === normalized ||
    subject.nameBn.toLocaleLowerCase("bn-BD") === normalized,
  );
}
