/**
 * Filesystem Abstraction Interface
 *
 * Provides a platform-agnostic filesystem interface that works in:
 * - Bun/Node.js (actual filesystem)
 * - Browser (virtual filesystem, IndexedDB, or memory)
 *
 * This allows the LSP to work in both server and browser environments.
 */

export type FileUri = string

export interface FileSystemStats {
  isFile: boolean
  isDirectory: boolean
  size: number
  mtime: number
}

/**
 * Abstract filesystem interface
 */
export interface FileSystem {
  /**
   * Read a file's contents
   */
  readFile(uri: FileUri): Promise<string>

  /**
   * Write a file's contents
   */
  writeFile(uri: FileUri, content: string): Promise<void>

  /**
   * Check if a file exists
   */
  exists(uri: FileUri): Promise<boolean>

  /**
   * Get file stats
   */
  stat(uri: FileUri): Promise<FileSystemStats>

  /**
   * List files in a directory
   */
  readDirectory(uri: FileUri): Promise<FileUri[]>

  /**
   * Resolve a relative path to an absolute URI
   */
  resolve(base: FileUri, relative: string): FileUri

  /**
   * Get the directory containing this file
   */
  dirname(uri: FileUri): FileUri

  /**
   * Get the basename of a file
   */
  basename(uri: FileUri): string

  /**
   * Join path segments
   */
  join(...segments: string[]): FileUri

  /**
   * Watch a file or directory for changes (optional)
   */
  watch?(uri: FileUri, callback: (event: FileChangeEvent) => void): FileWatcher
}

export interface FileWatcher {
  close(): void
}

export type FileChangeEvent = {
  type: "created" | "changed" | "deleted"
  uri: FileUri
}

/**
 * Bun/Node.js filesystem implementation
 */
export class BunFileSystem implements FileSystem {
  async readFile(uri: FileUri): Promise<string> {
    const path = this.uriToPath(uri)
    const file = Bun.file(path)
    return await file.text()
  }

  async writeFile(uri: FileUri, content: string): Promise<void> {
    const path = this.uriToPath(uri)
    await Bun.write(path, content)
  }

  async exists(uri: FileUri): Promise<boolean> {
    const path = this.uriToPath(uri)
    const file = Bun.file(path)
    return await file.exists()
  }

  async stat(uri: FileUri): Promise<FileSystemStats> {
    const path = this.uriToPath(uri)
    const file = Bun.file(path)
    const exists = await file.exists()

    if (!exists) {
      throw new Error(`File not found: ${uri}`)
    }

    const size = file.size
    const lastModified = file.lastModified

    // Check if it's a directory
    try {
      const stat = await Bun.file(path).stat()
      const isDirectory = stat.isDirectory()

      return {
        isFile: !isDirectory,
        isDirectory,
        size,
        mtime: lastModified,
      }
    } catch {
      // If stat fails, assume it's a file
      return {
        isFile: true,
        isDirectory: false,
        size,
        mtime: lastModified,
      }
    }
  }

  async readDirectory(uri: FileUri): Promise<FileUri[]> {
    const path = this.uriToPath(uri)
    const entries = await Array.fromAsync(
      new Bun.Glob("*").scan({ cwd: path, absolute: false })
    )
    return entries.map(entry => this.pathToUri(this.join(path, entry)))
  }

  resolve(base: FileUri, relative: string): FileUri {
    const basePath = this.uriToPath(base)
    const baseDir = this.dirname(basePath)
    const resolved = this.join(baseDir, relative)
    return this.pathToUri(resolved)
  }

  dirname(uri: FileUri): FileUri {
    const path = this.uriToPath(uri)
    const parts = path.split("/")
    parts.pop()
    return this.pathToUri(parts.join("/") || "/")
  }

  basename(uri: FileUri): string {
    const path = this.uriToPath(uri)
    const parts = path.split("/")
    return parts[parts.length - 1] || ""
  }

  join(...segments: string[]): FileUri {
    return segments.join("/").replace(/\/+/g, "/")
  }

  watch(uri: FileUri, callback: (event: FileChangeEvent) => void): FileWatcher {
    const path = this.uriToPath(uri)

    // Use Bun's file watcher (if available)
    // Note: This is a simplified implementation
    const watcher = {
      close() {
        // Cleanup watcher
      }
    }

    return watcher
  }

  private uriToPath(uri: FileUri): string {
    if (uri.startsWith("file://")) {
      return decodeURIComponent(uri.substring(7))
    }
    return uri
  }

  private pathToUri(path: string): FileUri {
    return `file://${encodeURIComponent(path)}`
  }
}

/**
 * In-memory filesystem implementation (for testing and browser)
 */
export class MemoryFileSystem implements FileSystem {
  private files = new Map<string, { content: string; mtime: number }>()
  private directories = new Set<string>()

  async readFile(uri: FileUri): Promise<string> {
    const normalized = this.normalizePath(uri)
    const file = this.files.get(normalized)
    if (!file) {
      throw new Error(`File not found: ${uri}`)
    }
    return file.content
  }

  async writeFile(uri: FileUri, content: string): Promise<void> {
    const normalized = this.normalizePath(uri)
    this.files.set(normalized, { content, mtime: Date.now() })

    // Ensure parent directories exist
    const dir = this.dirname(normalized)
    this.ensureDirectory(dir)
  }

  async exists(uri: FileUri): Promise<boolean> {
    const normalized = this.normalizePath(uri)
    return this.files.has(normalized) || this.directories.has(normalized)
  }

  async stat(uri: FileUri): Promise<FileSystemStats> {
    const normalized = this.normalizePath(uri)
    const file = this.files.get(normalized)

    if (file) {
      return {
        isFile: true,
        isDirectory: false,
        size: file.content.length,
        mtime: file.mtime,
      }
    }

    if (this.directories.has(normalized)) {
      return {
        isFile: false,
        isDirectory: true,
        size: 0,
        mtime: Date.now(),
      }
    }

    throw new Error(`File not found: ${uri}`)
  }

  async readDirectory(uri: FileUri): Promise<FileUri[]> {
    const normalized = this.normalizePath(uri)
    const results: FileUri[] = []

    // Find all files and directories that are direct children
    const prefix = normalized.endsWith("/") ? normalized : normalized + "/"

    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        const relative = path.substring(prefix.length)
        if (!relative.includes("/")) {
          results.push(path)
        }
      }
    }

    for (const path of this.directories) {
      if (path.startsWith(prefix)) {
        const relative = path.substring(prefix.length)
        if (!relative.includes("/")) {
          results.push(path)
        }
      }
    }

    return results
  }

  resolve(base: FileUri, relative: string): FileUri {
    const baseDir = this.dirname(base)
    const joined = this.join(baseDir, relative)
    return this.normalizePath(joined)
  }

  dirname(uri: FileUri): FileUri {
    const normalized = this.normalizePath(uri)
    const parts = normalized.split("/").filter(Boolean)
    parts.pop()
    return "/" + parts.join("/")
  }

  basename(uri: FileUri): string {
    const normalized = this.normalizePath(uri)
    const parts = normalized.split("/").filter(Boolean)
    return parts[parts.length - 1] || ""
  }

  join(...segments: string[]): FileUri {
    return this.normalizePath(segments.join("/"))
  }

  private normalizePath(path: string): string {
    // Remove file:// prefix if present
    if (path.startsWith("file://")) {
      path = path.substring(7)
    }

    // Normalize slashes
    path = path.replace(/\/+/g, "/")

    // Ensure starts with /
    if (!path.startsWith("/")) {
      path = "/" + path
    }

    // Resolve . and .. segments
    const parts = path.split("/").filter(Boolean)
    const resolved: string[] = []

    for (const part of parts) {
      if (part === "..") {
        resolved.pop()
      } else if (part !== ".") {
        resolved.push(part)
      }
    }

    return "/" + resolved.join("/")
  }

  private ensureDirectory(path: string) {
    const normalized = this.normalizePath(path)
    const parts = normalized.split("/").filter(Boolean)

    let current = ""
    for (const part of parts) {
      current += "/" + part
      this.directories.add(current)
    }
  }

  // Testing helpers
  clear() {
    this.files.clear()
    this.directories.clear()
  }

  setFile(uri: FileUri, content: string) {
    const normalized = this.normalizePath(uri)
    this.files.set(normalized, { content, mtime: Date.now() })
    this.ensureDirectory(this.dirname(normalized))
  }
}

/**
 * Factory function to create appropriate filesystem based on environment
 */
export function createFileSystem(): FileSystem {
  // Check if we're in a browser environment
  if (typeof window !== "undefined" && typeof Bun === "undefined") {
    return new MemoryFileSystem()
  }

  // Use Bun filesystem
  return new BunFileSystem()
}
