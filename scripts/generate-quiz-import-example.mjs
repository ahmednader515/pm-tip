/**
 * One-off script: regenerate public/quiz-import-example.xlsx
 * Run: node scripts/generate-quiz-import-example.mjs
 */
import * as XLSX from "xlsx";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "quiz-import-example.xlsx");

const headers = [
  "text",
  "textEn",
  "type",
  "points",
  "options",
  "optionsEn",
  "correct",
  "explanation",
  "explanationEn",
];

const rows = [
  {
    text: "ما هي عاصمة مصر؟",
    textEn: "What is the capital of Egypt?",
    type: "MULTIPLE_CHOICE",
    points: 1,
    options: "القاهرة|الإسكندرية|الأقصر|أسوان",
    optionsEn: "Cairo|Alexandria|Luxor|Aswan",
    correct: "1",
    explanation: "القاهرة هي عاصمة جمهورية مصر العربية.",
    explanationEn: "Cairo is the capital of the Arab Republic of Egypt.",
  },
  {
    text: "اختر لغة البرمجة المستخدمة في تطوير الويب الأمامي",
    textEn: "Choose the language commonly used for front-end web development",
    type: "DROPDOWN",
    points: 1,
    options: "جافاسكريبت|بايثون|سي++|جافا",
    optionsEn: "JavaScript|Python|C++|Java",
    correct: "1",
    explanation: "جافاسكريبت هي اللغة الأساسية لواجهات الويب.",
    explanationEn: "JavaScript is the primary language for web front ends.",
  },
  {
    text: "الماء يغلي عند ١٠٠ درجة مئوية عند مستوى سطح البحر.",
    textEn: "Water boils at 100°C at sea level.",
    type: "TRUE_FALSE",
    points: 1,
    options: "",
    optionsEn: "",
    correct: "true",
    explanation: "هذه حقيقة علمية معروفة.",
    explanationEn: "This is a well-known scientific fact.",
  },
  {
    text: "ما هو اختصار إدارة المشاريع؟",
    textEn: "What is a common abbreviation for Project Management?",
    type: "SHORT_ANSWER",
    points: 1,
    options: "",
    optionsEn: "",
    correct: "PM",
    explanation: "PM هو اختصار شائع لـ Project Management.",
    explanationEn: "PM is a common abbreviation for Project Management.",
  },
  {
    text: "صل كل عاصمة بالدولة الصحيحة",
    textEn: "Match each capital to the correct country context",
    type: "MATCHING",
    points: 2,
    options: "prompts: عاصمة مصر|عاصمة فرنسا ;; answers: القاهرة|باريس|لندن",
    optionsEn: "prompts: Capital of Egypt|Capital of France ;; answers: Cairo|Paris|London",
    correct: "عاصمة مصر=القاهرة|عاصمة فرنسا=باريس",
    explanation: "كل عاصمة تُطابق دولتها.",
    explanationEn: "Each capital matches its country.",
  },
];

const sheetData = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

worksheet["!cols"] = headers.map((h) => ({
  wch: Math.max(12, Math.min(48, h.length + 8)),
}));

XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
mkdirSync(dirname(outPath), { recursive: true });
XLSX.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);
