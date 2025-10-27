#!/usr/bin/env bun
/**
 * KCL AST CLI
 *
 * Parses KCL code and outputs the serialized AST as JSON (includes CST trivia).
 *
 * Usage:
 *   bun src/kcl-lang/cli.ts <file.kcl>
 *   cat file.kcl | bun src/kcl-lang/cli.ts
 *   bun src/kcl-lang/cli.ts -o ast.json file.kcl
 */

import { parse } from "./parser"

function showHelp() {
  console.log("KCL AST Parser - Parse KCL code and output the serialized AST as JSON")
  console.log("")
  console.log("Usage: kcl [options] <file.kcl>")
  console.log("       cat file.kcl | kcl [options]")
  console.log("")
  console.log("Options:")
  console.log("  -o, --output FILE    Write output to file instead of stdout")
  console.log("  -h, --help          Show this help message")
  console.log("")
  console.log("Examples:")
  console.log("  kcl file.kcl                    # Parse file and output AST to stdout")
  console.log("  kcl -o ast.json file.kcl        # Parse file and save AST to ast.json")
  console.log("  cat file.kcl | kcl              # Parse from stdin")
  console.log("  cat file.kcl | kcl -o ast.json  # Parse from stdin and save to file")
  console.log("")
}

async function main() {
  const args = Bun.argv.slice(2)
  let outputFile: string | null = null
  let inputFile: string | null = null
  let unknownArgs: string[] = []

  // Show help if no arguments
  if (args.length === 0) {
    showHelp()
    process.exit(0)
  }

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-h" || arg === "--help") {
      showHelp()
      process.exit(0)
    } else if (arg === "-o" || arg === "--output") {
      if (i + 1 >= args.length) {
        console.error("❌ Error: -o/--output requires a file path")
        console.error("")
        showHelp()
        process.exit(1)
      }
      outputFile = args[++i]
    } else if (arg.startsWith("-")) {
      unknownArgs.push(arg)
    } else {
      inputFile = arg
    }
  }

  // Check for unknown arguments
  if (unknownArgs.length > 0) {
    console.error(`❌ Error: Unknown option(s): ${unknownArgs.join(", ")}`)
    console.error("")
    showHelp()
    process.exit(1)
  }

  let source = ""

  // Read from file or stdin
  if (inputFile) {
    const file = Bun.file(inputFile)
    if (!(await file.exists())) {
      console.error(`❌ Error: File not found: ${inputFile}`)
      process.exit(1)
    }
    source = await file.text()
  } else {
    // Check if stdin has data
    const isStdinTTY = Bun.stdin.isTTY
    if (isStdinTTY) {
      console.error("❌ Error: No input file provided and no data from stdin")
      console.error("")
      showHelp()
      process.exit(1)
    }

    // Read from stdin
    for await (const chunk of Bun.stdin.stream()) {
      source += new TextDecoder().decode(chunk)
    }
  }

  if (!source.trim()) {
    console.error("❌ Error: Input source is empty")
    process.exit(1)
  }

  try {
    // Parse with CST (includes trivia)
    const ast = parse(source)

    // Serialize AST as JSON (includes trivia)
    const json = JSON.stringify(ast, null, 2)

    // Write to file or stdout
    if (outputFile) {
      await Bun.write(outputFile, json)
      console.error(`✅ AST written to ${outputFile}`)
    } else {
      console.log(json)
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("❌ Parse error:", errorMsg)
    process.exit(1)
  }
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
