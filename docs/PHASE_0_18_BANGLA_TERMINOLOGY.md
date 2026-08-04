# 18 — Bangla Terminology Guide

Tone: clear, respectful, concise. Student copy may be friendly but should use neutral respectful imperatives; staff/admin copy should use formal `করুন`. Avoid runtime English alternatives.

| Concept | Preferred UI term | Avoid | Navigation/button example |
|---|---|---|---|
| Home | হোম | শিক্ষার্থী হোম, Dashboard mixed randomly | `হোম` |
| Dashboard | Dashboard only for staff context; otherwise হোম/Overview | ড্যাশবোর্ড everywhere | `Admin Dashboard` may be `Admin Overview` |
| Student | শিক্ষার্থী | স্টুডেন্ট in formal records | `শিক্ষার্থী যোগ করুন` |
| Teacher | শিক্ষক | টিচার in Bangla sentences | `শিক্ষক নির্ধারণ করুন` |
| Guardian | অভিভাবক | Parent/Guardian mixed | `অভিভাবক যুক্ত করুন` |
| Batch | Batch | ব্যাচ/Batch alternating | `Batch তৈরি করুন` |
| Course | Course or কোর্স, choose by surface; preferred কোর্স | course/কোর্স mixed in same module | `কোর্স দেখুন` |
| Class session | ক্লাস | সেশন when it means lesson | `আজকের ক্লাস` |
| Academic session | শিক্ষাবর্ষ | Session alone | `শিক্ষাবর্ষ নির্বাচন করুন` |
| Subject | বিষয় | Subject in staff labels unless needed | `বিষয় নির্বাচন করুন` |
| Chapter | অধ্যায় | চ্যাপ্টার in formal navigation | `অধ্যায় নির্বাচন করুন` |
| Topic | Topic (when curriculum term is familiar) | টপিক/বিষয়বস্তু switching | `দুর্বল Topic` |
| Practice | Practice | প্র্যাকটিস/অনুশীলন alternating | `MCQ Practice শুরু করুন` |
| Formal exam | পরীক্ষা | টেস্ট/Exam mixed | `পরীক্ষা প্রকাশ করুন` |
| Assignment | Assignment | কাজ when it hides the academic type | `Assignment জমা দিন` |
| Attendance | Attendance | হাজিরা/উপস্থিতি mixed | `Attendance নিন` |
| Result | ফলাফল | রেজাল্ট in formal UI | `ফলাফল দেখুন` |
| Marks | নম্বর | মার্ক/Marks mixed | `মোট নম্বর` |
| Score | স্কোর (practice only) | ফলাফল when only score | `স্কোর: ৮/১০` |
| Accuracy | সঠিক উত্তরের হার | Accuracy without explanation | `সঠিক উত্তরের হার` |
| Fee | ফি | Payment when referring to obligation | `ফি-এর অবস্থা` |
| Payment | পেমেন্ট/পরিশোধ; preferred action `ফি পরিশোধ করুন` | জমা ambiguous | `পেমেন্ট রেকর্ড করুন` |
| Due | বকেয়া | Due | `বকেয়া ফি` |
| Receipt | রসিদ | Receipt mixed | `রসিদ ডাউনলোড করুন` |
| Report | রিপোর্ট | প্রতিবেদন if unfamiliar in workflow | `Attendance রিপোর্ট` |
| Analytics | Analytics for staff; অগ্রগতি for students | student analytics jargon | `Batch Analytics` |
| Question bank | Question Bank | প্রশ্ন ভান্ডার/ব্যাংক alternating | `Question Bank খুলুন` |
| Publish | প্রকাশ করুন | Live করুন | `পরীক্ষা প্রকাশ করুন` |
| Draft | খসড়া | Draft mixed in status | `খসড়া সংরক্ষণ করুন` |
| Archive | আর্কাইভ করুন | Delete when records must remain | `আর্কাইভ করুন` |
| Void result | ফলাফল বাতিল করুন | ফলাফল মুছুন | Explain that history remains |
| Login | Login | লগইন/Login alternating | `Login করুন` |
| Logout | Logout | সাইন আউট mixed | `Logout করুন` |
| Register | অ্যাকাউন্ট তৈরি করুন / ভর্তি আবেদন | Register when outcome differs | Student: `অ্যাকাউন্ট তৈরি করুন`; teacher: `আবেদন পাঠান` |

## Standard states

- Empty: `এখনও কোনো পরীক্ষা প্রকাশ করা হয়নি।`
- Loading: `পরীক্ষার তালিকা লোড হচ্ছে…`
- Recoverable error: `তালিকাটি লোড করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।`
- Permission denial: `এই তথ্য দেখার অনুমতি আপনার নেই। প্রয়োজন হলে Admin-এর সঙ্গে যোগাযোগ করুন।`
- Destructive confirmation: state exact scope and recovery: `এই ফলাফলটি বাতিল হবে, তবে Audit history-তে থাকবে।`
- Validation: field-specific, e.g. `পাস নম্বর মোট নম্বরের বেশি হতে পারবে না।`

## Capitalization and plural

English acronyms remain uppercase: MCQ, CQ, PDF, ID, QR, SMS, API, AI. English product terms use title case only in navigation/headings. Bangla nouns do not take English plural `s`; use context or `গুলো/সমূহ` sparingly.
