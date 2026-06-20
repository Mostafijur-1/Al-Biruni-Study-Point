# Project-Scoped Rules

## MCQ Mathematical Expressions Formatting
When parsing, translating, formatting, or creating MCQs, do not use raw LaTeX/markup characters like `$`, `^`, `\times`, or `\cdot`. Instead:
1. **Math Delimiters**: Never use `$` as math delimiters; instead, write clean, plain text.
2. **Exponents/Powers**: Use actual Unicode superscript characters (e.g., `²`, `³`, `⁴`, `ⁿ`, `ˣ`, `ʸ`) instead of `^` or `^{...}`.
3. **Multiplication**: Use the standard multiplication symbol `×` instead of `\times`, `*`, or `times`.
4. **Permutations/Combinations**: Use Unicode superscripts and subscripts (e.g., `⁴P₄`, `⁴C₄`) or standard plain text.
5. **Image/OCR & Text Correction**: Ensure any raw text parsed from images or text files is converted into clean Unicode/plain-text Bengali strings using this formatting before inserting into the database.
