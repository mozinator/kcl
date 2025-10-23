#!/usr/bin/env bun
/**
 * KCL Format CLI
 *
 * Pretty-prints KCL code with ANSI colors or HTML syntax highlighting.
 * Uses semantic tokens from the LSP for accurate syntax highlighting.
 *
 * Usage:
 *   bun src/kcl/lsp/format-cli.ts <file.kcl>              # ANSI output
 *   bun src/kcl/lsp/format-cli.ts --html <file.kcl>       # HTML output
 *   bun src/kcl/lsp/format-cli.ts -o output.html file.kcl # Save to file
 *   cat file.kcl | bun src/kcl/lsp/format-cli.ts --html
 */

import { lexWithPositions } from "./lexer-with-positions"
import { parseWithPositions } from "./parser-with-positions"
import { formatDocument } from "./features/formatting"
import { formatDocumentWithComments } from "./features/formatting-with-comments"
import { getSemanticTokens, SemanticTokenType } from "./features/semantic-tokens"
import { buildLineOffsets } from "./positions"

// ANSI color codes
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const UNDERLINE = "\x1b[4m"

const COLORS = {
  keyword: "\x1b[35m" + BOLD,      // Magenta bold
  number: "\x1b[36m",              // Cyan
  string: "\x1b[32m",              // Green
  function: "\x1b[33m" + BOLD,     // Yellow bold
  variable: "\x1b[34m",            // Blue (better contrast on light backgrounds)
  operator: "\x1b[90m",            // Bright black (dim)
  comment: "\x1b[90m" + DIM,       // Bright black dim
  constant: "\x1b[36m" + BOLD,     // Cyan bold
  deprecatedKeyword: "\x1b[33m" + BOLD + UNDERLINE, // Yellow bold underlined
}

/**
 * Get ANSI color for a semantic token type
 */
function getColorForTokenType(tokenType: SemanticTokenType, modifiers: number): string {
  // Check for readonly modifier (constants)
  const isReadonly = (modifiers & (1 << 2)) !== 0
  const isDefaultLibrary = (modifiers & (1 << 9)) !== 0

  switch (tokenType) {
    case SemanticTokenType.keyword:
      return COLORS.keyword
    case SemanticTokenType.number:
      return COLORS.number
    case SemanticTokenType.string:
      return COLORS.string
    case SemanticTokenType.function:
    case SemanticTokenType.method:
      return COLORS.function + (isDefaultLibrary ? BOLD : "")
    case SemanticTokenType.variable:
      return isReadonly ? COLORS.constant : COLORS.variable
    case SemanticTokenType.operator:
      return COLORS.operator
    case SemanticTokenType.comment:
      return COLORS.comment + DIM
    default:
      return RESET
  }
}

/**
 * Decode semantic tokens from delta-encoded format
 */
function decodeSemanticTokens(encoded: number[]): Array<{
  line: number
  startChar: number
  length: number
  tokenType: SemanticTokenType
  tokenModifiers: number
}> {
  const tokens = []
  let line = 0
  let char = 0

  for (let i = 0; i < encoded.length; i += 5) {
    const deltaLine = encoded[i]
    const deltaChar = encoded[i + 1]
    const length = encoded[i + 2]
    const tokenType = encoded[i + 3]
    const tokenModifiers = encoded[i + 4]

    line += deltaLine
    char = deltaLine === 0 ? char + deltaChar : deltaChar

    tokens.push({
      line,
      startChar: char,
      length,
      tokenType,
      tokenModifiers,
    })
  }

  return tokens
}

/**
 * Colorize KCL source code using semantic tokens
 */
function colorizeCode(source: string, semanticTokensData: number[]): string {
  const lines = source.split('\n')
  const tokens = decodeSemanticTokens(semanticTokensData)

  // Build a map of positions to colors
  const colorMap: Array<Array<{ start: number; end: number; color: string }>> = []
  for (let i = 0; i < lines.length; i++) {
    colorMap[i] = []
  }

  for (const token of tokens) {
    if (token.line < colorMap.length) {
      let color = getColorForTokenType(token.tokenType, token.tokenModifiers)

      // Check if this is a deprecated 'let' keyword
      const lineText = lines[token.line].substring(token.startChar, token.startChar + token.length)
      if (token.tokenType === SemanticTokenType.keyword && lineText === "let") {
        color = COLORS.deprecatedKeyword
      }

      colorMap[token.line].push({
        start: token.startChar,
        end: token.startChar + token.length,
        color,
      })
    }
  }

  // Colorize each line
  const coloredLines = lines.map((line, lineIdx) => {
    // Check if entire line is a comment
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) {
      return COLORS.comment + line + RESET
    }

    const lineColors = colorMap[lineIdx]
    if (!lineColors || lineColors.length === 0) {
      return line
    }

    // Sort by start position
    lineColors.sort((a, b) => a.start - b.start)

    let result = ""
    let pos = 0

    for (const { start, end, color } of lineColors) {
      // Add uncolored text before this token
      if (pos < start) {
        const beforeText = line.substring(pos, start)
        if (beforeText.trim().startsWith('//')) {
          result += COLORS.comment + line.substring(pos) + RESET
          return result
        }
        result += beforeText
      }

      // Add colored token
      result += color + line.substring(start, end) + RESET
      pos = end
    }

    // Add remaining text (might be a comment)
    if (pos < line.length) {
      const remaining = line.substring(pos)
      const commentStart = remaining.indexOf('//')
      if (commentStart >= 0) {
        result += remaining.substring(0, commentStart)
        result += COLORS.comment + remaining.substring(commentStart) + RESET
      } else {
        result += remaining
      }
    }

    return result
  })

  return coloredLines.join('\n')
}

/**
 * Get CSS class for a semantic token type
 */
function getCSSClassForTokenType(tokenType: SemanticTokenType, modifiers: number): string {
  const isReadonly = (modifiers & (1 << 2)) !== 0
  const isDefaultLibrary = (modifiers & (1 << 9)) !== 0

  switch (tokenType) {
    case SemanticTokenType.keyword:
      return "tok-keyword"
    case SemanticTokenType.number:
      return "tok-number"
    case SemanticTokenType.string:
      return "tok-string"
    case SemanticTokenType.function:
    case SemanticTokenType.method:
      return isDefaultLibrary ? "tok-function tok-stdlib" : "tok-function"
    case SemanticTokenType.variable:
      return isReadonly ? "tok-constant" : "tok-variable"
    case SemanticTokenType.operator:
      return "tok-operator"
    case SemanticTokenType.comment:
      return "tok-comment"
    default:
      return ""
  }
}

/**
 * Render KCL source code as HTML with syntax highlighting
 */
function renderHTML(source: string, semanticTokensData: number[], filename: string = "kcl"): string {
  const lines = source.split('\n')
  const tokens = decodeSemanticTokens(semanticTokensData)

  // Build a map of positions to CSS classes
  const classMap: Array<Array<{ start: number; end: number; className: string }>> = []
  for (let i = 0; i < lines.length; i++) {
    classMap[i] = []
  }

  for (const token of tokens) {
    if (token.line < classMap.length) {
      let className = getCSSClassForTokenType(token.tokenType, token.tokenModifiers)

      // Check if this is a deprecated 'let' keyword
      const lineText = lines[token.line].substring(token.startChar, token.startChar + token.length)
      if (token.tokenType === SemanticTokenType.keyword && lineText === "let") {
        className += " tok-deprecated"
      }

      classMap[token.line].push({
        start: token.startChar,
        end: token.startChar + token.length,
        className,
      })
    }
  }

  // Escape HTML
  const escapeHTML = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // Colorize each line
  const htmlLines = lines.map((line, lineIdx) => {
    // Handle empty lines - add non-breaking space so they render
    if (line.trim() === '') {
      return '&nbsp;'
    }

    // Check if entire line is a comment
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) {
      return `<span class="tok-comment">${escapeHTML(line)}</span>`
    }

    const lineColors = classMap[lineIdx]
    if (!lineColors || lineColors.length === 0) {
      return escapeHTML(line)
    }

    // Sort by start position
    lineColors.sort((a, b) => a.start - b.start)

    let result = ""
    let pos = 0

    for (const { start, end, className } of lineColors) {
      // Add uncolored text before this token
      if (pos < start) {
        const beforeText = line.substring(pos, start)
        // Check if this is the start of a comment
        if (beforeText.trim().startsWith('//')) {
          result += `<span class="tok-comment">${escapeHTML(line.substring(pos))}</span>`
          return result
        }
        result += escapeHTML(beforeText)
      }

      // Add colored token
      result += `<span class="${className}">${escapeHTML(line.substring(start, end))}</span>`
      pos = end
    }

    // Add remaining text (might be a comment)
    if (pos < line.length) {
      const remaining = line.substring(pos)
      const commentStart = remaining.indexOf('//')
      if (commentStart >= 0) {
        result += escapeHTML(remaining.substring(0, commentStart))
        result += `<span class="tok-comment">${escapeHTML(remaining.substring(commentStart))}</span>`
      } else {
        result += escapeHTML(remaining)
      }
    }

    return result
  })

  // Generate complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KCL - ${filename}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.25;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: #1e1e1e;
      border-radius: 8px;
      overflow: hidden;
    }

    .header {
      background: #2d2d30;
      padding: 12px 20px;
      border-bottom: 1px solid #3e3e42;
    }

    .header h1 {
      font-size: 15px;
      font-weight: 500;
      color: #cccccc;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.5px;
    }

    .code-container {
      padding: 20px;
      overflow-x: auto;
    }

    .code {
      font-family: inherit;
      white-space: pre;
    }

    /* Syntax highlighting - Vibrant palette */
    .tok-keyword { color: #ff79c6; font-weight: 600; }  /* Bright pink */
    .tok-function { color: #50fa7b; }                    /* Bright green */
    .tok-stdlib { font-weight: 700; }
    .tok-number { color: #bd93f9; }                      /* Bright purple */
    .tok-string { color: #f1fa8c; }                      /* Bright yellow */
    .tok-variable { color: #8be9fd; }                    /* Bright cyan */
    .tok-constant { color: #ffb86c; font-weight: 700; }  /* Bright orange */
    .tok-operator { color: #f8f8f2; }                    /* Light gray */
    .tok-comment { color: #6272a4; font-style: italic; } /* Blue-gray */

    /* Deprecated keyword warning - visible squiggly line */
    .tok-deprecated {
      position: relative;
      cursor: help;
      background: linear-gradient(to bottom, transparent 85%, #ff9800 85%, #ff9800 87%, transparent 87%);
      background-size: 4px 100%;
      background-repeat: repeat-x;
      background-position: 0 bottom;
    }

    .tok-deprecated::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 3" preserveAspectRatio="none"><path d="M0,3 Q1.5,0 3,1.5 T6,3" stroke="%23ff9800" stroke-width="0.5" fill="none"/></svg>');
      background-repeat: repeat-x;
      background-size: 6px 3px;
      pointer-events: none;
    }

    /* Line numbers */
    .line {
      display: block;
      position: relative;
      padding-left: 60px;
    }

    .line::before {
      content: attr(data-line);
      position: absolute;
      left: 0;
      width: 40px;
      text-align: right;
      color: #858585;
      user-select: none;
    }

    /* Hover effects */
    .tok-function:hover,
    .tok-variable:hover,
    .tok-constant:hover {
      text-decoration: underline;
      cursor: help;
    }

    /* Footer */
    .footer {
      background: #2d2d30;
      padding: 12px 20px;
      border-top: 1px solid #3e3e42;
      text-align: center;
      font-size: 11px;
      color: #858585;
      font-family: 'JetBrains Mono', monospace;
    }

    .legend {
      margin-top: 8px;
      font-size: 11px;
    }

    .legend span {
      margin: 0 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>KCL - ${filename}</h1>
    </div>
    <div class="code-container">
      <div class="code">${htmlLines.map((line, i) => `<div class="line" data-line="${i + 1}">${line}</div>`).join('')}</div>
    </div>
    <div class="footer">
      Generated by <strong>KCL Language Server v0.3.1</strong> • Powered by Bun + TypeScript
      <div class="legend">
        <span class="tok-keyword">keyword</span>
        <span class="tok-keyword tok-deprecated">deprecated</span>
        <span class="tok-function tok-stdlib">function</span>
        <span class="tok-number">number</span>
        <span class="tok-string">string</span>
        <span class="tok-variable">variable</span>
        <span class="tok-constant">CONSTANT</span>
        <span class="tok-operator">operator</span>
      </div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = Bun.argv.slice(2)
  let htmlMode = false
  let outputFile: string | null = null
  let inputFile: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--html" || arg === "-h") {
      htmlMode = true
    } else if (arg === "-o" || arg === "--output") {
      outputFile = args[++i]
    } else if (!arg.startsWith("-")) {
      inputFile = arg
    }
  }

  return { htmlMode, outputFile, inputFile }
}

/**
 * Main CLI function
 */
async function main() {
  const { htmlMode, outputFile, inputFile } = parseArgs()

  let source = ""
  let filename = "stdin"

  // Read from file or stdin
  if (inputFile) {
    const file = Bun.file(inputFile)
    source = await file.text()
    filename = inputFile.split('/').pop() || inputFile
  } else {
    // Read from stdin
    for await (const chunk of Bun.stdin.stream()) {
      source += new TextDecoder().decode(chunk)
    }
  }

  if (!source.trim()) {
    console.error("Usage: bun src/kcl/lsp/format-cli.ts [options] <file.kcl>")
    console.error("")
    console.error("Options:")
    console.error("  --html, -h           Output HTML instead of ANSI")
    console.error("  -o, --output FILE    Write to file instead of stdout")
    console.error("")
    console.error("Examples:")
    console.error("  bun src/kcl/lsp/format-cli.ts file.kcl")
    console.error("  bun src/kcl/lsp/format-cli.ts --html file.kcl")
    console.error("  bun src/kcl/lsp/format-cli.ts -o out.html --html file.kcl")
    console.error("  cat file.kcl | bun src/kcl/lsp/format-cli.ts --html")
    process.exit(1)
  }

  // Parse the code
  const lineOffsets = buildLineOffsets(source)

  try {
    const tokens = lexWithPositions(source)
    const program = parseWithPositions(tokens)

    // Get semantic tokens for the ORIGINAL code (preserves formatting & comments)
    const semanticTokensData = getSemanticTokens({
      success: true,
      tokens,
      program,
      lineOffsets,
    })

    // Render output
    let output: string

    if (htmlMode) {
      // Generate HTML with original formatting preserved
      output = renderHTML(source, semanticTokensData, filename)
    } else {
      // Generate ANSI colored output with original formatting preserved
      const colorized = colorizeCode(source, semanticTokensData)
      output = colorized + "\n\n" + DIM + "─".repeat(60) + RESET + "\n"
      output += DIM + "Legend:" + RESET + "\n"
      output += `  ${COLORS.keyword}keyword${RESET}  ${COLORS.deprecatedKeyword}deprecated${RESET}  ${COLORS.function}function${RESET}  ${COLORS.number}number${RESET}  ${COLORS.string}string${RESET}  ${COLORS.variable}variable${RESET}  ${COLORS.constant}CONSTANT${RESET}  ${COLORS.operator}operator${RESET}\n`
    }

    // Write to file or stdout
    if (outputFile) {
      await Bun.write(outputFile, output)
      console.error(`✅ Written to ${outputFile}`)
    } else {
      console.log(output)
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    if (htmlMode) {
      // HTML error output
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>KCL Parse Error</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    .error { color: #f48771; font-weight: bold; }
    pre { background: #2d2d30; padding: 15px; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1 class="error">Parse Error</h1>
  <p>${errorMsg}</p>
  <h2>Source Code:</h2>
  <pre>${source.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`

      if (outputFile) {
        await Bun.write(outputFile, html)
        console.error(`⚠️  Error written to ${outputFile}`)
      } else {
        console.log(html)
      }
    } else {
      // ANSI error output
      console.error(COLORS.string + "Parse error:" + RESET, errorMsg)
      console.log(DIM + "\nShowing source with syntax highlighting (no formatting):" + RESET)

      // Still try to colorize even if parse failed
      try {
        const tokens = lexWithPositions(source)
        const semanticTokensData = getSemanticTokens({
          success: false,
          error: "Parse error",
          diagnostics: [],
          lineOffsets,
        } as any)

        const colorized = colorizeCode(source, semanticTokensData)
        console.log(colorized)
      } catch {
        console.log(source)
      }
    }

    process.exit(1)
  }
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
