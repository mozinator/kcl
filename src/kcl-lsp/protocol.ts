/**
 * LSP Protocol Types
 *
 * Minimal LSP protocol definitions - only what we need.
 * Based on LSP spec 3.17
 */

// ===== JSON-RPC 2.0 =====

export type RequestMessage = {
  jsonrpc: "2.0"
  id: number | string
  method: string
  params?: any
}

export type ResponseMessage = {
  jsonrpc: "2.0"
  id: number | string | null
  result?: any
  error?: ResponseError
}

export type ResponseError = {
  code: number
  message: string
  data?: any
}

export type NotificationMessage = {
  jsonrpc: "2.0"
  method: string
  params?: any
}

export type Message = RequestMessage | ResponseMessage | NotificationMessage

// ===== LSP Base Types =====

export type Position = {
  line: number      // 0-based
  character: number // 0-based (UTF-16 code units)
}

export type Range = {
  start: Position
  end: Position
}

export type Location = {
  uri: string
  range: Range
}

export type TextEdit = {
  range: Range
  newText: string
}

export type DocumentUri = string

// ===== Diagnostic =====

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export type Diagnostic = {
  range: Range
  severity?: DiagnosticSeverity
  code?: number | string
  source?: string
  message: string
}

// ===== Completion =====

export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export type CompletionItem = {
  label: string
  kind?: CompletionItemKind
  detail?: string
  documentation?: string
  sortText?: string
  filterText?: string
  insertText?: string
}

export type CompletionList = {
  isIncomplete: boolean
  items: CompletionItem[]
}

// ===== Hover =====

export type MarkupContent = {
  kind: "plaintext" | "markdown"
  value: string
}

export type Hover = {
  contents: MarkupContent | string
  range?: Range
}

// ===== Initialize =====

export type InitializeParams = {
  processId: number | null
  rootUri: DocumentUri | null
  capabilities: any
  workspaceFolders?: any[]
}

export type ServerCapabilities = {
  textDocumentSync?: {
    openClose?: boolean
    change?: 1 | 2 // 1 = Full, 2 = Incremental
  }
  completionProvider?: {
    triggerCharacters?: string[]
  }
  hoverProvider?: boolean
  definitionProvider?: boolean
  documentSymbolProvider?: boolean
  documentFormattingProvider?: boolean
  renameProvider?: boolean | {
    prepareProvider?: boolean
  }
  codeActionProvider?: boolean | {
    codeActionKinds?: string[]
  }
  signatureHelpProvider?: {
    triggerCharacters?: string[]
  }
  semanticTokensProvider?: {
    legend: SemanticTokensLegend
    full?: boolean
  }
}

export type InitializeResult = {
  capabilities: ServerCapabilities
  serverInfo?: {
    name: string
    version?: string
  }
}

// ===== Text Document =====

export type TextDocumentIdentifier = {
  uri: DocumentUri
}

export type VersionedTextDocumentIdentifier = TextDocumentIdentifier & {
  version: number
}

export type TextDocumentItem = {
  uri: DocumentUri
  languageId: string
  version: number
  text: string
}

export type TextDocumentContentChangeEvent = {
  text: string
}

// ===== Request/Notification Params =====

export type DidOpenTextDocumentParams = {
  textDocument: TextDocumentItem
}

export type DidChangeTextDocumentParams = {
  textDocument: VersionedTextDocumentIdentifier
  contentChanges: TextDocumentContentChangeEvent[]
}

export type DidCloseTextDocumentParams = {
  textDocument: TextDocumentIdentifier
}

export type PublishDiagnosticsParams = {
  uri: DocumentUri
  diagnostics: Diagnostic[]
}

export type CompletionParams = {
  textDocument: TextDocumentIdentifier
  position: Position
}

export type HoverParams = {
  textDocument: TextDocumentIdentifier
  position: Position
}

export type DefinitionParams = {
  textDocument: TextDocumentIdentifier
  position: Position
}

// ===== Semantic Tokens =====

export type SemanticTokensParams = {
  textDocument: TextDocumentIdentifier
}

export type SemanticTokens = {
  data: number[]
}

export type SemanticTokensLegend = {
  tokenTypes: string[]
  tokenModifiers: string[]
}

// ===== Signature Help =====

export type SignatureHelpParams = {
  textDocument: TextDocumentIdentifier
  position: Position
}

export type SignatureHelp = {
  signatures: SignatureInformation[]
  activeSignature?: number
  activeParameter?: number
}

export type SignatureInformation = {
  label: string
  documentation?: string
  parameters?: ParameterInformation[]
}

export type ParameterInformation = {
  label: string | [number, number]
  documentation?: string
}

// ===== Document Symbols =====

export type DocumentSymbolParams = {
  textDocument: TextDocumentIdentifier
}

export type DocumentSymbol = {
  name: string
  detail?: string
  kind: number
  range: Range
  selectionRange: Range
  children?: DocumentSymbol[]
}

// ===== Formatting =====

export type DocumentFormattingParams = {
  textDocument: TextDocumentIdentifier
  options: FormattingOptions
}

export type FormattingOptions = {
  tabSize: number
  insertSpaces: boolean
}

// ===== Rename =====

export type RenameParams = {
  textDocument: TextDocumentIdentifier
  position: Position
  newName: string
}

export type PrepareRenameParams = {
  textDocument: TextDocumentIdentifier
  position: Position
}

export type WorkspaceEdit = {
  changes?: Record<string, TextEdit[]>
}

// ===== Code Actions =====

export type CodeActionParams = {
  textDocument: TextDocumentIdentifier
  range: Range
  context: CodeActionContext
}

export type CodeActionContext = {
  diagnostics: Diagnostic[]
}

export type CodeAction = {
  title: string
  kind?: string
  diagnostics?: Diagnostic[]
  edit?: WorkspaceEdit
  command?: Command
}

export type Command = {
  title: string
  command: string
  arguments?: any[]
}
