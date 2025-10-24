/**
 * Workspace Symbols Feature
 *
 * Find symbols across all files in the workspace.
 * Useful for quick navigation to any function/variable by name.
 */

import type { ParseResult } from "../document-manager"
import type { DocumentSymbol, SymbolKind } from "./symbols"
import { getDocumentSymbols } from "./symbols"

export type WorkspaceSymbol = {
  name: string
  kind: SymbolKind
  location: {
    uri: string
    range: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
  containerName?: string
}

/**
 * Search for symbols across workspace documents
 */
export function findWorkspaceSymbols(
  query: string,
  documents: Map<string, ParseResult>,
  maxResults: number = 100
): WorkspaceSymbol[] {
  const results: WorkspaceSymbol[] = []
  const queryLower = query.toLowerCase()

  // Search through all open documents
  for (const [uri, parseResult] of documents) {
    if (!parseResult.success) continue

    const documentSymbols = getDocumentSymbols(parseResult)

    for (const symbol of documentSymbols) {
      // Check if symbol name matches query (case-insensitive fuzzy match)
      if (matchesQuery(symbol.name, queryLower)) {
        results.push({
          name: symbol.name,
          kind: symbol.kind,
          location: {
            uri,
            range: symbol.range,
          },
        })

        if (results.length >= maxResults) {
          return results
        }
      }

      // Check children symbols
      if (symbol.children) {
        for (const child of symbol.children) {
          if (matchesQuery(child.name, queryLower)) {
            results.push({
              name: child.name,
              kind: child.kind,
              location: {
                uri,
                range: child.range,
              },
              containerName: symbol.name,
            })

            if (results.length >= maxResults) {
              return results
            }
          }
        }
      }
    }
  }

  // Sort by relevance (exact matches first, then prefix matches, then contains)
  return results.sort((a, b) => {
    const aScore = getRelevanceScore(a.name, query)
    const bScore = getRelevanceScore(b.name, query)
    return bScore - aScore
  })
}

/**
 * Check if a symbol name matches the query
 * Supports fuzzy matching (e.g., "mkbx" matches "makeBox")
 */
function matchesQuery(name: string, queryLower: string): boolean {
  if (queryLower === "") return true

  const nameLower = name.toLowerCase()

  // Exact match
  if (nameLower === queryLower) return true

  // Prefix match
  if (nameLower.startsWith(queryLower)) return true

  // Contains match
  if (nameLower.includes(queryLower)) return true

  // Fuzzy match (e.g., "mkbx" matches "makeBox")
  return fuzzyMatch(nameLower, queryLower)
}

/**
 * Fuzzy matching - check if query characters appear in order in the name
 */
function fuzzyMatch(name: string, query: string): boolean {
  let nameIndex = 0
  let queryIndex = 0

  while (nameIndex < name.length && queryIndex < query.length) {
    if (name[nameIndex] === query[queryIndex]) {
      queryIndex++
    }
    nameIndex++
  }

  return queryIndex === query.length
}

/**
 * Calculate relevance score for sorting
 * Higher score = more relevant
 */
function getRelevanceScore(name: string, query: string): number {
  const nameLower = name.toLowerCase()
  const queryLower = query.toLowerCase()

  // Exact match (highest score)
  if (nameLower === queryLower) return 1000

  // Starts with query (high score)
  if (nameLower.startsWith(queryLower)) return 500

  // Contains query (medium score)
  if (nameLower.includes(queryLower)) return 100

  // Fuzzy match (lower score, penalize by distance)
  const fuzzyScore = calculateFuzzyScore(nameLower, queryLower)
  return fuzzyScore
}

/**
 * Calculate fuzzy match score based on how close together the matched characters are
 */
function calculateFuzzyScore(name: string, query: string): number {
  let nameIndex = 0
  let queryIndex = 0
  let score = 50 // Base fuzzy score
  let lastMatchIndex = -1

  while (nameIndex < name.length && queryIndex < query.length) {
    if (name[nameIndex] === query[queryIndex]) {
      // Bonus for consecutive matches
      if (lastMatchIndex === nameIndex - 1) {
        score += 10
      }
      lastMatchIndex = nameIndex
      queryIndex++
    }
    nameIndex++
  }

  // Penalty for gaps between matches
  score -= (nameIndex - query.length) * 2

  return Math.max(0, score)
}
