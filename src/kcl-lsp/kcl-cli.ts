#!/usr/bin/env bun
/**
 * KCL Unified CLI
 *
 * A unified command-line interface for KCL development tasks.
 * Inspired by cargo (Rust) and go toolchain patterns.
 *
 * Usage:
 *   kcl fmt <file.kcl>              # Format code
 *   kcl check <file.kcl>            # Type check code
 *   kcl check --format <file.kcl>   # Format and check
 *   kcl fmt --check <file.kcl>      # Verify formatting (CI)
 *   kcl check "src/*.kcl"           # Check multiple files
 *   kcl check --json file.kcl       # Machine-readable output
 */

import { DocumentManager } from "./document-manager"
import { formatDocument } from "./features/formatting"
import { getDiagnostics } from "./features/diagnostics"
import type { Diagnostic } from "./protocol"

/**
 * Simple glob expansion using Bun's Glob API
 */
async function expandGlob(pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern)
  const matches: string[] = []
  for await (const file of glob.scan({ cwd: ".", onlyFiles: true })) {
    matches.push(file)
  }
  return matches
}

// ANSI color codes
const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"

const COLORS = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
}

type Command = "fmt" | "check" | "help"

type Options = {
  command: Command
  files: string[]
  format: boolean  // For check --format
  check: boolean   // For fmt --check
  json: boolean
  write: boolean   // For fmt (write to file)
}

/**
 * Parse command-line arguments
 */
function parseArgs(): Options {
  const args = Bun.argv.slice(2)

  if (args.length === 0) {
    return { command: "help", files: [], format: false, check: false, json: false, write: false }
  }

  const command = args[0] as Command
  const files: string[] = []
  let format = false
  let check = false
  let json = false
  let write = true // fmt writes by default

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]

    if (arg === "--format" || arg === "-f") {
      format = true
    } else if (arg === "--check" || arg === "-c") {
      check = true
      write = false // Don't write in check mode
    } else if (arg === "--json") {
      json = true
    } else if (arg === "--no-write") {
      write = false
    } else if (!arg.startsWith("-")) {
      files.push(arg)
    }
  }

  return { command, files, format, check, json, write }
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`${BOLD}KCL${RESET} - KittyCAD Language Toolchain

${BOLD}USAGE:${RESET}
  kcl <COMMAND> [OPTIONS] [FILES...]

${BOLD}COMMANDS:${RESET}
  ${COLORS.cyan}fmt${RESET}        Format KCL source files
  ${COLORS.cyan}check${RESET}      Type check KCL source files
  ${COLORS.cyan}help${RESET}       Print this help message

${BOLD}FMT OPTIONS:${RESET}
  ${COLORS.green}--check, -c${RESET}     Check if files are formatted (don't write)
  ${COLORS.green}--no-write${RESET}      Don't write changes, just show diff

${BOLD}CHECK OPTIONS:${RESET}
  ${COLORS.green}--format, -f${RESET}    Format files before checking
  ${COLORS.green}--json${RESET}          Output errors in JSON format

${BOLD}EXAMPLES:${RESET}
  ${DIM}# Format a single file${RESET}
  kcl fmt examples/box.kcl

  ${DIM}# Check for type errors${RESET}
  kcl check examples/box.kcl

  ${DIM}# Format and check${RESET}
  kcl check --format examples/box.kcl

  ${DIM}# Check multiple files with glob${RESET}
  kcl check "src/**/*.kcl"

  ${DIM}# Verify formatting in CI${RESET}
  kcl fmt --check "src/**/*.kcl"

  ${DIM}# JSON output for tooling${RESET}
  kcl check --json examples/box.kcl
`)
}

/**
 * Format severity as colored label
 */
function formatSeverity(severity: number): string {
  if (severity === 1) {
    return `${COLORS.red}${BOLD}error${RESET}`
  } else if (severity === 2) {
    return `${COLORS.yellow}${BOLD}warning${RESET}`
  } else {
    return `${COLORS.blue}${BOLD}info${RESET}`
  }
}

/**
 * Format diagnostic for pretty output
 */
function formatDiagnostic(diagnostic: Diagnostic, filename: string, lines: string[]): string {
  const { range, severity, message, source } = diagnostic
  const line = range.start.line
  const col = range.start.character

  const severityLabel = formatSeverity(severity)
  const sourceLabel = source ? `${DIM}[${source}]${RESET}` : ""

  // File location
  const location = `${COLORS.cyan}${filename}${RESET}:${COLORS.yellow}${line + 1}${RESET}:${COLORS.yellow}${col + 1}${RESET}`

  // Code snippet
  let snippet = ""
  if (line < lines.length) {
    const codeLine = lines[line]
    const lineNum = String(line + 1).padStart(4, " ")
    snippet = `\n${DIM}${lineNum} |${RESET} ${codeLine}`

    // Add caret pointing to error location
    const spaces = " ".repeat(col)
    const carets = "^".repeat(Math.max(1, range.end.character - range.start.character))
    snippet += `\n${DIM}     |${RESET} ${spaces}${COLORS.red}${carets}${RESET}`
  }

  return `${severityLabel}: ${message} ${sourceLabel}\n  ${DIM}-->${RESET} ${location}${snippet}\n`
}

/**
 * Run fmt command
 */
async function runFmt(options: Options): Promise<number> {
  const { files, check, write } = options

  if (files.length === 0) {
    console.error(`${COLORS.red}error:${RESET} no files specified`)
    return 1
  }

  // Expand globs
  const allFiles: string[] = []
  for (const pattern of files) {
    // Check if it's a glob pattern or a direct file
    if (pattern.includes('*') || pattern.includes('?')) {
      const matches = await expandGlob(pattern)
      allFiles.push(...matches)
    } else {
      allFiles.push(pattern)
    }
  }

  if (allFiles.length === 0) {
    console.error(`${COLORS.red}error:${RESET} no files found matching patterns`)
    return 1
  }

  const manager = new DocumentManager()
  let hasChanges = false
  let errorCount = 0

  for (const file of allFiles) {
    try {
      const source = await Bun.file(file).text()
      const result = manager.open(`file:///${file}`, source, 1)

      if (!result.success) {
        console.error(`${COLORS.red}error:${RESET} failed to parse ${COLORS.cyan}${file}${RESET}`)
        errorCount++
        continue
      }

      const formatted = formatDocument(result, source)

      if (formatted.length === 0) {
        continue
      }

      const newText = formatted[0].newText

      if (check) {
        // Check mode: verify if formatted
        if (source !== newText) {
          console.log(`${COLORS.yellow}${file}${RESET} needs formatting`)
          hasChanges = true
        }
      } else if (write) {
        // Write mode: format files
        if (source !== newText) {
          await Bun.write(file, newText)
          console.log(`${COLORS.green}formatted${RESET} ${COLORS.cyan}${file}${RESET}`)
          hasChanges = true
        }
      } else {
        // Show diff mode
        if (source !== newText) {
          console.log(`${COLORS.cyan}${file}${RESET}:`)
          console.log(newText)
          hasChanges = true
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`${COLORS.red}error:${RESET} ${file}: ${msg}`)
      errorCount++
    }
  }

  if (errorCount > 0) {
    return 1
  }

  if (check && hasChanges) {
    console.error(`\n${COLORS.red}error:${RESET} some files need formatting`)
    console.error(`${DIM}hint:${RESET} run ${COLORS.cyan}kcl fmt${RESET} to fix`)
    return 1
  }

  if (!hasChanges && allFiles.length > 0) {
    console.log(`${COLORS.green}✓${RESET} all files formatted`)
  }

  return 0
}

/**
 * Run check command
 */
async function runCheck(options: Options): Promise<number> {
  const { files, format, json } = options

  if (files.length === 0) {
    console.error(`${COLORS.red}error:${RESET} no files specified`)
    return 1
  }

  // Expand globs
  const allFiles: string[] = []
  for (const pattern of files) {
    // Check if it's a glob pattern or a direct file
    if (pattern.includes('*') || pattern.includes('?')) {
      const matches = await expandGlob(pattern)
      allFiles.push(...matches)
    } else {
      allFiles.push(pattern)
    }
  }

  if (allFiles.length === 0) {
    console.error(`${COLORS.red}error:${RESET} no files found matching patterns`)
    return 1
  }

  const manager = new DocumentManager()
  const allDiagnostics: Array<{ file: string; diagnostics: Diagnostic[]; lines: string[] }> = []
  let errorCount = 0
  let warningCount = 0

  for (const file of allFiles) {
    try {
      let source = await Bun.file(file).text()

      // Format first if requested
      if (format) {
        const result = manager.open(`file:///${file}`, source, 1)
        if (result.success) {
          const formatted = formatDocument(result, source)
          if (formatted.length > 0 && formatted[0].newText !== source) {
            source = formatted[0].newText
            await Bun.write(file, source)
            console.log(`${COLORS.green}formatted${RESET} ${COLORS.cyan}${file}${RESET}`)
          }
        }
      }

      const result = manager.open(`file:///${file}`, source, 1)

      if (!result.success) {
        console.error(`${COLORS.red}error:${RESET} failed to parse ${COLORS.cyan}${file}${RESET}`)
        errorCount++
        continue
      }

      const diagnostics = getDiagnostics(result)

      if (diagnostics.length > 0) {
        allDiagnostics.push({
          file,
          diagnostics,
          lines: source.split('\n'),
        })

        for (const diag of diagnostics) {
          if (diag.severity === 1) errorCount++
          else if (diag.severity === 2) warningCount++
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`${COLORS.red}error:${RESET} ${file}: ${msg}`)
      errorCount++
    }
  }

  // Output diagnostics
  if (json) {
    // JSON mode
    const jsonOutput = allDiagnostics.map(({ file, diagnostics }) => ({
      file,
      diagnostics: diagnostics.map(d => ({
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
        message: d.message,
        source: d.source,
        code: d.code,
      })),
    }))
    console.log(JSON.stringify(jsonOutput, null, 2))
  } else {
    // Pretty mode
    for (const { file, diagnostics, lines } of allDiagnostics) {
      for (const diagnostic of diagnostics) {
        console.log(formatDiagnostic(diagnostic, file, lines))
      }
    }

    // Summary
    if (errorCount > 0 || warningCount > 0) {
      const parts: string[] = []
      if (errorCount > 0) {
        parts.push(`${COLORS.red}${errorCount} error${errorCount !== 1 ? 's' : ''}${RESET}`)
      }
      if (warningCount > 0) {
        parts.push(`${COLORS.yellow}${warningCount} warning${warningCount !== 1 ? 's' : ''}${RESET}`)
      }
      console.log(`\n${parts.join(', ')}`)
    }
  }

  if (errorCount === 0 && warningCount === 0 && allFiles.length > 0) {
    console.log(`${COLORS.green}✓${RESET} no errors found`)
  }

  return errorCount > 0 ? 1 : 0
}

/**
 * Main CLI entry point
 */
async function main() {
  const options = parseArgs()

  switch (options.command) {
    case "help":
      printHelp()
      return 0

    case "fmt":
      return await runFmt(options)

    case "check":
      return await runCheck(options)

    default:
      console.error(`${COLORS.red}error:${RESET} unknown command '${options.command}'`)
      console.error(`${DIM}hint:${RESET} run ${COLORS.cyan}kcl help${RESET} for usage`)
      return 1
  }
}

main().then(code => process.exit(code)).catch(error => {
  console.error(`${COLORS.red}fatal error:${RESET}`, error)
  process.exit(1)
})
