import { isCanonicalAcademicAuthorityEnabled } from "@/lib/db/canonical-scope-guard";
import { AcademicSubject } from "@/lib/db/models/AcademicSubject";
import { curriculumNodeAcceptsLegacyAlias, subjectAcceptsLegacyAlias } from "@/lib/academic-alias";
import { AcademicChapter } from "@/lib/db/models/AcademicChapter";

type CanonicalContentScopeDecision =
  | { ok: true; organizationId?: string; subjectId?: string }
  | { ok: false; status: 400 | 404 | 409; message: string };

export async function resolveCanonicalContentScope(
  subjectId: string | undefined,
  legacySubject: string | undefined,
): Promise<CanonicalContentScopeDecision> {
  if (!subjectId) {
    return isCanonicalAcademicAuthorityEnabled()
      ? { ok: false, status: 409, message: "Canonical subjectId is required after academic authority cutover." }
      : { ok: true };
  }

  const subject = await AcademicSubject.findOne({ _id: subjectId, status: "active" })
    .select("organizationId code name nameBn aliases")
    .lean();
  if (!subject) return { ok: false, status: 404, message: "Canonical subject not found." };
  if (!subject.organizationId) {
    return { ok: false, status: 409, message: "Canonical subject is missing organization scope." };
  }
  if (!subjectAcceptsLegacyAlias(subject, legacySubject)) {
    return { ok: false, status: 400, message: "Legacy subject label does not match the canonical subject." };
  }

  return {
    ok: true,
    organizationId: String(subject.organizationId),
    subjectId: String(subject._id),
  };
}

export async function resolveCanonicalQuestionScope(
  subjectId: string | undefined,
  chapterId: string | undefined,
  legacySubject: string | undefined,
  legacyChapter: string | undefined,
) {
  const subjectScope = await resolveCanonicalContentScope(subjectId, legacySubject);
  if (!subjectScope.ok) return subjectScope;
  if (!chapterId) {
    return isCanonicalAcademicAuthorityEnabled()
      ? { ok: false as const, status: 409 as const, message: "Canonical chapterId is required after academic authority cutover." }
      : { ...subjectScope, chapterId: undefined };
  }
  if (!subjectScope.subjectId || !subjectScope.organizationId) {
    return { ok: false as const, status: 409 as const, message: "Canonical subjectId is required with chapterId." };
  }
  const chapter = await AcademicChapter.findOne({
    _id: chapterId,
    subjectId: subjectScope.subjectId,
    organizationId: subjectScope.organizationId,
    status: "active",
  }).select("code name nameBn").lean();
  if (!chapter) return { ok: false as const, status: 404 as const, message: "Canonical chapter not found in the selected subject." };
  if (!curriculumNodeAcceptsLegacyAlias(chapter, legacyChapter)) {
    return { ok: false as const, status: 400 as const, message: "Legacy chapter label does not match the canonical chapter." };
  }
  return { ...subjectScope, chapterId: String(chapter._id) };
}
