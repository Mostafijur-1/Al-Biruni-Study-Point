export function isAssessmentKernelWriteEnabled(env?: { ASSESSMENT_KERNEL_WRITES?: string }) {
  return (env ?? process.env).ASSESSMENT_KERNEL_WRITES?.trim().toLowerCase() !== "false";
}
