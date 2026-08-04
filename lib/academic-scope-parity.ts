import type { StudentClass } from "@/types";

type LegacyTeacherScope = {
  isAll?: boolean;
  classes?: StudentClass[];
  subjects?: string[];
  students?: string[];
};

type CanonicalSubjectScope = {
  key: string;
  aliases: string[];
};

type CanonicalTeacherScope = {
  classes: StudentClass[];
  subjects: CanonicalSubjectScope[];
  students: string[];
};

function normalized(value: unknown) {
  return String(value).trim().toLocaleLowerCase("en-US");
}

function unique(values: string[]) {
  return [...new Set(values.map(normalized).filter(Boolean))].sort();
}

function difference(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

export function compareTeacherScopeParity(
  legacy: LegacyTeacherScope | null | undefined,
  canonical: CanonicalTeacherScope,
) {
  const canonicalClasses = unique(canonical.classes);
  const legacyClasses = unique(legacy?.classes ?? []);
  const canonicalStudents = unique(canonical.students);
  const legacyStudents = unique(legacy?.students ?? []);
  const legacySubjects = unique(legacy?.subjects ?? []);
  const canonicalSubjects = canonical.subjects.map((subject) => ({
    key: normalized(subject.key),
    aliases: unique([subject.key, ...subject.aliases]),
  }));

  const canonicalSubjectKeysMissingFromLegacy = canonicalSubjects
    .filter((subject) => !subject.aliases.some((alias) => legacySubjects.includes(alias)))
    .map((subject) => subject.key);
  const legacySubjectsMissingFromCanonical = legacySubjects.filter(
    (legacySubject) =>
      !canonicalSubjects.some((subject) => subject.aliases.includes(legacySubject)),
  );

  const differences = {
    canonicalOnlyClasses: difference(canonicalClasses, legacyClasses),
    legacyOnlyClasses: difference(legacyClasses, canonicalClasses),
    canonicalOnlySubjects: canonicalSubjectKeysMissingFromLegacy,
    legacyOnlySubjects: legacySubjectsMissingFromCanonical,
    canonicalOnlyStudents: difference(canonicalStudents, legacyStudents),
    legacyOnlyStudents: difference(legacyStudents, canonicalStudents),
  };
  const hasDifferences = Object.values(differences).some((values) => values.length > 0);

  return {
    status: legacy?.isAll ? "legacy_all_requires_review" : hasDifferences ? "mismatch" : "match",
    differences,
  } as const;
}
