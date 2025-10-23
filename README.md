# KCL

TypeScript implementation of the [KittyCAD modeling language](https://kittycad.io). Built with Bun, zero dependencies.

## Components

- **Parser** - Lexer, parser, type checker (`src/kcl-lang/`)
- **LSP** - Language server with autocomplete, diagnostics, hover, formatting (`src/kcl-lsp/`)
- **CLI Tools**:
  - Format to HTML with syntax highlighting
  - Output serialized AST as JSON

## LSP Setup

**VSCode** - Add to `.vscode/settings.json`:
```json
{
  "kcl.server": {
    "command": "bun",
    "args": ["path/to/src/kcl-lsp/server.ts"]
  }
}
```

**Neovim (LazyVim)** - Add to config:
```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "kcl",
  callback = function()
    vim.lsp.start({
      name = "kcl-lsp",
      cmd = { "bun", "path/to/src/kcl-lsp/server.ts" },
      root_dir = vim.fn.getcwd(),
    })
  end,
})
```

## CLI Tools

**Format to HTML** (preserves comments and formatting):
```bash
bun src/kcl-lsp/format-cli.ts --html examples/formatting-showcase.kcl > examples/formatting-showcase.html
```

**Output AST as JSON**:
```bash
bun src/kcl-lang/cli.ts examples/formatting-showcase.kcl > examples/formatting-showcase-ast.json
```
