import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const filesToProcess = [
  // Components
  "components/admin/AdminCoursesPanel.tsx",
  "components/admin/AdminOverview.tsx",
  "components/admin/AdminPracticeManager.tsx",
  "components/admin/AdminTeacherMcqReview.tsx",
  "components/admin/AdminUsersPanel.tsx",
  "components/auth/AuthGateLink.tsx",
  "components/auth/LoginForm.tsx",
  "components/auth/RegisterForm.tsx",
  "components/batches/BatchesList.tsx",
  "components/brand/Logo.tsx",
  "components/contact/ContactSection.tsx",
  "components/content/StudentClassAssignments.tsx",
  "components/content/StudentClassCourses.tsx",
  "components/content/TargetClassPicker.tsx",
  "components/content/TeacherClassUploadPanel.tsx",
  "components/courses/CoursesCatalog.tsx",
  "components/exam/McqExamRunner.tsx",
  "components/exam/McqPracticeRunner.tsx",
  "components/exam/ResultHistory.tsx",
  "components/exam/StudentExamsPanel.tsx",
  "components/exam/TeacherMcqResults.tsx",
  "components/home/HomeSection.tsx",
  "components/layout/AuthShell.tsx",
  "components/layout/DashboardMobileNav.tsx",
  "components/layout/Footer.tsx",
  "components/layout/MobileNav.tsx",
  "components/layout/Navbar.tsx",
  "components/layout/UserMenu.tsx",
  "components/profile/ProfilePanel.tsx",
  "components/shared/PwaInstallPrompt.tsx",
  "components/shared/UploadingIndicator.tsx",
  "components/teacher/TeacherExamDetailPanel.tsx",
  "components/teacher/TeacherExamsPanel.tsx",
  "components/teacher/TeacherMcqReview.tsx",
  "components/teacher/TeacherResultsDashboard.tsx",

  // Libs
  "lib/content/classes.ts",
  "lib/content/syllabus.ts",

  // Pages
  "app/(dashboard)/student/practice/page.tsx"
];

function processFile(filePath) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, "utf8");
  const original = content;

  // 1. Safe simple string ternaries (locale === "bn" ? "A" : "B") -> "A"
  // Excludes any template literals or placeholders to prevent syntax bugs
  content = content.replace(/locale\s*===\s*['"]bn['"]\s*\?\s*("([^"\\$]*)"|'([^'\\$]*)')\s*:\s*("([^"\\$]*)"|'([^'\\$]*)')/g, (match, p1) => {
    return p1;
  });

  // 1b. Safe simple string ternaries (locale !== "bn" ? "A" : "B") -> "B"
  content = content.replace(/locale\s*!==\s*['"]bn['"]\s*\?\s*("([^"\\$]*)"|'([^'\\$]*)')\s*:\s*("([^"\\$]*)"|'([^'\\$]*)')/g, (match, p1, p2, p3, p4) => {
    return p4;
  });

  // 1c. Simple boolean checks on one line (locale === "bn" && "A") -> "A"
  content = content.replace(/locale\s*===\s*['"]bn['"]\s*&&\s*([^\r\n;,\)\}}]+)/g, (match, p1) => {
    return p1.trim();
  });

  // 2. Remove locale from type/interface definitions
  content = content.replace(/\b(locale\??\s*:\s*(?:Locale|string|any)\s*;?,?\r?\n)/g, "");

  // 2b. Remove existing local declarations of locale (e.g. const locale = useParams() etc.)
  content = content.replace(/\b(?:const|let|var)\s+locale\s*=\s*[^\r\n]+;?\r?\n/g, "");

  // 3. Remove locale from destructuring (safely)
  content = content.replace(/{\s*locale\s*,\s*/g, "{ ");
  content = content.replace(/,\s*locale\s*,\s*/g, ", ");
  content = content.replace(/,\s*locale\s*}/g, " }");
  content = content.replace(/{\s*locale\s*}/g, "{}");
  content = content.replace(/\(\{\s*locale\s*\}\)/g, "()");

  // 4. Remove locale={...} from JSX props
  content = content.replace(/\s+locale={[A-Za-z0-9\?_\.\(\)]+}/g, "");
  content = content.replace(/\s+locale="[A-Za-z0-9_]+"/g, "");

  // 5. Simplify route calls:
  // getLocalizedPath(path, locale) -> getLocalizedPath(path)
  content = content.replace(/\bgetLocalizedPath\(([^,\r\n]+),\s*([^\)\r\n]+)\)/g, "getLocalizedPath($1)");
  // dashboardPath(role, locale) -> dashboardPath(role)
  content = content.replace(/\bdashboardPath\(([^,\r\n]+),\s*([^\)\r\n]+)\)/g, "dashboardPath($1)");
  // buildLoginUrl(locale, returnUrl, reason) -> buildLoginUrl(returnUrl, reason)
  content = content.replace(/\bbuildLoginUrl\((?:locale|defaultLocale|resolvedLocale|'bn'|"bn"),?\s*/g, "buildLoginUrl(");
  // buildRegisterUrl(locale, returnUrl) -> buildRegisterUrl(returnUrl)
  content = content.replace(/\bbuildRegisterUrl\((?:locale|defaultLocale|resolvedLocale|'bn'|"bn"),?\s*/g, "buildRegisterUrl(");

  // 6. remove const path = createLocalizedPath(locale)
  content = content.replace(/\bconst\s+path\s*=\s*createLocalizedPath\([^)\r\n]*\);?\r?\n?/g, "");
  // Replace path("/about") with "/about"
  content = content.replace(/\bpath\((['"][^'"\r\n]+['"])\)/g, "$1");

  // 7. Remove type Locale imports
  content = content.replace(/,\s*type\s+Locale\b/g, "");
  content = content.replace(/\btype\s+Locale\s*,/g, "");
  content = content.replace(/import\s+{[^}\r\n]*Locale[^}\r\n]*}\s*from\s*['"]@\/lib\/i18n['"];?\r?\n/g, "");

  // 8. If the component function body still references "locale", we inject "const locale = 'bn';"
  // to maintain backward compatibility with any remaining complex conditionals.
  const hasRemainingLocale = /\blocale\b/.test(content);
  if (hasRemainingLocale) {
    // Inject at the start of component function bodies
    content = content.replace(/(export\s+(?:async\s+)?function\s+[A-Z][A-Za-z0-9_]*\s*\([^)]*\)\s*{)/g, "$1\n  const locale = \"bn\";");
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`Processed: ${filePath}`);
  }
}

console.log("Starting removal of locale...");
filesToProcess.forEach(processFile);
console.log("Finished!");
