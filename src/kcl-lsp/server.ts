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
        },
        completionProvider: {
          triggerCharacters: [".", "|"],
        },
        hoverProvider: true,
        definitionProvider: true,
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
      },
      serverInfo: {
        name: "kcl-language-server",
        version: "0.3.3",
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

    return formatDocument(parseResult, originalSource)
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
