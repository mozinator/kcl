#!/usr/bin/env bun
/**
 * KCL Language Server
 *
 * LSP server for KCL using Bun runtime.
 * Usage: bun src/kcl/lsp/server.ts
 */

import { Connection } from "./connection"
import { DocumentManager } from "./document-manager"
import type {
  InitializeParams,
  InitializeResult,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidSaveTextDocumentParams,
  CompletionParams,
  HoverParams,
  DefinitionParams,
  SemanticTokensParams,
  SignatureHelpParams,
  DocumentSymbolParams,
  DocumentFormattingParams,
  RenameParams,
  PrepareRenameParams,
  CodeActionParams,
  FoldingRangeParams,
  ReferenceParams,
  CreateFilesParams,
  RenameFilesParams,
  DeleteFilesParams,
  DidChangeWatchedFilesParams,
} from "./protocol"
import { getDiagnostics } from "./features/diagnostics"
import { getCompletions } from "./features/completion"
import { getHover } from "./features/hover"
import { getDefinition } from "./features/definition"
import { getSemanticTokens, getSemanticTokensLegend } from "./features/semantic-tokens"
import { getSignatureHelp } from "./features/signature-help"
import { getDocumentSymbols } from "./features/symbols"
import { formatDocument } from "./features/formatting"
import { prepareRename, performRename } from "./features/rename"
import { getCodeActions } from "./features/code-actions"
import { getFoldingRanges } from "./features/folding-ranges"
import { getReferences } from "./features/references"

class KclLanguageServer {
  private connection: Connection
  private documents: DocumentManager

  constructor() {
    this.connection = new Connection()
    this.documents = new DocumentManager()
    this.setupHandlers()
  }

  private setupHandlers() {
    // Initialize
    this.connection.onRequest("initialize", (params: InitializeParams) => {
      return this.handleInitialize(params)
    })

    // Initialized notification
    this.connection.onNotification("initialized", () => {
      // Server is ready
    })

    // Document lifecycle
    this.connection.onNotification("textDocument/didOpen", (params: DidOpenTextDocumentParams) => {
      this.handleDidOpen(params)
    })

    this.connection.onNotification("textDocument/didChange", (params: DidChangeTextDocumentParams) => {
      this.handleDidChange(params)
    })

    this.connection.onNotification("textDocument/didClose", (params: DidCloseTextDocumentParams) => {
      this.handleDidClose(params)
    })

    this.connection.onNotification("textDocument/didSave", (params: DidSaveTextDocumentParams) => {
      this.handleDidSave(params)
    })

    // File operations
    this.connection.onNotification("workspace/didCreateFiles", (params: CreateFilesParams) => {
      this.handleDidCreateFiles(params)
    })

    this.connection.onNotification("workspace/didRenameFiles", (params: RenameFilesParams) => {
      this.handleDidRenameFiles(params)
    })

    this.connection.onNotification("workspace/didDeleteFiles", (params: DeleteFilesParams) => {
      this.handleDidDeleteFiles(params)
    })

    this.connection.onNotification("workspace/didChangeWatchedFiles", (params: DidChangeWatchedFilesParams) => {
      this.handleDidChangeWatchedFiles(params)
    })

    // Language features
    this.connection.onRequest("textDocument/completion", (params: CompletionParams) => {
      return this.handleCompletion(params)
    })

    this.connection.onRequest("textDocument/hover", (params: HoverParams) => {
      return this.handleHover(params)
    })

    this.connection.onRequest("textDocument/definition", (params: DefinitionParams) => {
      return this.handleDefinition(params)
    })

    this.connection.onRequest("textDocument/semanticTokens/full", (params: SemanticTokensParams) => {
      return this.handleSemanticTokens(params)
    })

    this.connection.onRequest("textDocument/signatureHelp", (params: SignatureHelpParams) => {
      return this.handleSignatureHelp(params)
    })

    this.connection.onRequest("textDocument/documentSymbol", (params: DocumentSymbolParams) => {
      return this.handleDocumentSymbol(params)
    })

    this.connection.onRequest("textDocument/formatting", (params: DocumentFormattingParams) => {
      return this.handleFormatting(params)
    })

    this.connection.onRequest("textDocument/prepareRename", (params: PrepareRenameParams) => {
      return this.handlePrepareRename(params)
    })

    this.connection.onRequest("textDocument/rename", (params: RenameParams) => {
      return this.handleRename(params)
    })

    this.connection.onRequest("textDocument/codeAction", (params: CodeActionParams) => {
      return this.handleCodeAction(params)
    })

    this.connection.onRequest("textDocument/foldingRange", (params: FoldingRangeParams) => {
      return this.handleFoldingRange(params)
    })

    this.connection.onRequest("textDocument/references", (params: ReferenceParams) => {
      return this.handleReferences(params)
    })

    // Shutdown
    this.connection.onRequest("shutdown", () => {
      return null
    })

    this.connection.onNotification("exit", () => {
      process.exit(0)
    })
  }

  private handleInitialize(params: InitializeParams): InitializeResult {
    return {
      capabilities: {
        textDocumentSync: {
          openClose: true,
          change: 1, // Full sync
          save: true,
        },
        completionProvider: {
          triggerCharacters: [".", "|"],
        },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        documentFormattingProvider: true,
        renameProvider: {
          prepareProvider: true,
        },
        codeActionProvider: {
          codeActionKinds: ["quickfix", "refactor"],
        },
        signatureHelpProvider: {
          triggerCharacters: ["(", ","],
        },
        semanticTokensProvider: {
          legend: getSemanticTokensLegend(),
          full: true,
        },
        foldingRangeProvider: true,
        workspace: {
          fileOperations: {
            didCreate: { filters: [{ pattern: { glob: "**/*.kcl" } }] },
            didRename: { filters: [{ pattern: { glob: "**/*.kcl" } }] },
            didDelete: { filters: [{ pattern: { glob: "**/*.kcl" } }] },
          },
        },
      },
      serverInfo: {
        name: "kcl-language-server",
        version: "0.4.0",
      },
    }
  }

  private handleDidOpen(params: DidOpenTextDocumentParams) {
    const { uri, text, version } = params.textDocument
    const parseResult = this.documents.open(uri, text, version)
    this.publishDiagnostics(uri, parseResult)
  }

  private handleDidChange(params: DidChangeTextDocumentParams) {
    const { uri, version } = params.textDocument
    const text = params.contentChanges[0].text // Full sync
    const parseResult = this.documents.update(uri, text, version)
    this.publishDiagnostics(uri, parseResult)
  }

  private handleDidClose(params: DidCloseTextDocumentParams) {
    const { uri } = params.textDocument
    this.documents.close(uri)
  }

  private handleDidSave(params: DidSaveTextDocumentParams) {
    // Re-validate document on save
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (parseResult) {
      this.publishDiagnostics(params.textDocument.uri, parseResult)
    }
  }

  private handleDidCreateFiles(params: CreateFilesParams) {
    // Files created - could pre-parse them if needed
    // For now, just a placeholder for future functionality
  }

  private handleDidRenameFiles(params: RenameFilesParams) {
    // Handle file renames - update document cache
    for (const file of params.files) {
      const doc = this.documents.get(file.oldUri)
      if (doc) {
        this.documents.close(file.oldUri)
        // Note: The client will send a didOpen for the new URI
      }
    }
  }

  private handleDidDeleteFiles(params: DeleteFilesParams) {
    // Handle file deletions - clean up cache
    for (const file of params.files) {
      this.documents.close(file.uri)
    }
  }

  private handleDidChangeWatchedFiles(params: DidChangeWatchedFilesParams) {
    // Handle external file changes
    for (const change of params.changes) {
      if (change.type === 2) { // Changed
        // Re-parse if we have it open
        const parseResult = this.documents.getParseResult(change.uri)
        if (parseResult) {
          this.publishDiagnostics(change.uri, parseResult)
        }
      } else if (change.type === 3) { // Deleted
        this.documents.close(change.uri)
      }
    }
  }

  private handleCompletion(params: CompletionParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return { isIncomplete: false, items: [] }
    }
    return getCompletions(parseResult, params.position)
  }

  private handleHover(params: HoverParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return getHover(parseResult, params.position)
  }

  private handleDefinition(params: DefinitionParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return getDefinition(parseResult, params.position, params.textDocument.uri)
  }

  private handleSemanticTokens(params: SemanticTokensParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return { data: [] }
    }
    return { data: getSemanticTokens(parseResult) }
  }

  private handleSignatureHelp(params: SignatureHelpParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return getSignatureHelp(parseResult, params.position)
  }

  private handleDocumentSymbol(params: DocumentSymbolParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return []
    }
    return getDocumentSymbols(parseResult)
  }

  private handleFormatting(params: DocumentFormattingParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return []
    }
    const originalSource = this.documents.getText(params.textDocument.uri)

    // Debug: Log if originalSource is missing
    if (!originalSource) {
      console.error(`[KCL LSP] Warning: originalSource is undefined for ${params.textDocument.uri}`)
    }

    return formatDocument(parseResult, originalSource, params.options)
  }

  private handlePrepareRename(params: PrepareRenameParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return prepareRename(parseResult, params.position)
  }

  private handleRename(params: RenameParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return performRename(parseResult, params.position, params.newName, params.textDocument.uri)
  }

  private handleCodeAction(params: CodeActionParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return []
    }
    const diagnostics = getDiagnostics(parseResult)
    return getCodeActions(parseResult, params.range, diagnostics, params.textDocument.uri)
  }

  private handleFoldingRange(params: FoldingRangeParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return []
    }
    return getFoldingRanges(parseResult)
  }

  private handleReferences(params: ReferenceParams) {
    const parseResult = this.documents.getParseResult(params.textDocument.uri)
    if (!parseResult) {
      return null
    }
    return getReferences(
      parseResult,
      params.position,
      params.textDocument.uri,
      params.context.includeDeclaration
    )
  }

  private publishDiagnostics(uri: string, parseResult: any) {
    const diagnostics = getDiagnostics(parseResult)
    this.connection.sendNotification("textDocument/publishDiagnostics", {
      uri,
      diagnostics,
    })
  }

  async start() {
    await this.connection.listen()
  }
}

// Start the server
const server = new KclLanguageServer()
server.start().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
