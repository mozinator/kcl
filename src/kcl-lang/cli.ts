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

async function main() {
  const args = Bun.argv.slice(2)
  let outputFile: string | null = null
  let inputFile: string | null = null

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-o" || arg === "--output") {
      outputFile = args[++i]
    } else if (!arg.startsWith("-")) {
      inputFile = arg
    }
  }

  let source = ""

  // Read from file or stdin
  if (inputFile) {
    const file = Bun.file(inputFile)
    source = await file.text()
  } else {
    // Read from stdin
    for await (const chunk of Bun.stdin.stream()) {
      source += new TextDecoder().decode(chunk)
    }
  }

  if (!source.trim()) {
    console.error("Usage: bun src/kcl-lang/cli.ts [options] <file.kcl>")
    console.error("")
    console.error("Options:")
    console.error("  -o, --output FILE    Write to file instead of stdout")
    console.error("")
    console.error("Examples:")
    console.error("  bun src/kcl-lang/cli.ts file.kcl")
    console.error("  bun src/kcl-lang/cli.ts -o ast.json file.kcl")
    console.error("  cat file.kcl | bun src/kcl-lang/cli.ts")
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
