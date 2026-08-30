export function normalizeAcademicAlias(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function subjectAcceptsLegacyAlias(
  subject: { code: string; name: string; nameBn: string; aliases?: string[] },
  legacySubject: string | undefined,
) {
  if (!legacySubject) return true;
  const accepted = [subject.code, subject.name, subject.nameBn, ...(subject.aliases ?? [])]
    .map(normalizeAcademicAlias);
  return accepted.includes(normalizeAcademicAlias(legacySubject));
}

export function curriculumNodeAcceptsLegacyAlias(
  node: { code: string; name: string; nameBn: string },
  legacyValue: string | undefined,
) {
  if (!legacyValue) return true;
  return [node.code, node.name, node.nameBn]
    .map(normalizeAcademicAlias)
    .includes(normalizeAcademicAlias(legacyValue));
}
