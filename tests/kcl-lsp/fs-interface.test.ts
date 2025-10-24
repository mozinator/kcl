/**
 * Filesystem Interface Tests
 */

import { describe, test, expect, beforeEach } from "bun:test"
import { MemoryFileSystem, BunFileSystem } from "../../src/kcl-lsp/fs-interface"

describe("MemoryFileSystem", () => {
  let fs: MemoryFileSystem

  beforeEach(() => {
    fs = new MemoryFileSystem()
  })

  test("writeFile and readFile", async () => {
    await fs.writeFile("/test.kcl", "let x = 10")
    const content = await fs.readFile("/test.kcl")
    expect(content).toBe("let x = 10")
  })

  test("exists returns true for existing files", async () => {
    await fs.writeFile("/test.kcl", "content")
    const exists = await fs.exists("/test.kcl")
    expect(exists).toBe(true)
  })

  test("exists returns false for non-existing files", async () => {
    const exists = await fs.exists("/nonexistent.kcl")
    expect(exists).toBe(false)
  })

  test("stat returns file stats", async () => {
    await fs.writeFile("/test.kcl", "hello")
    const stats = await fs.stat("/test.kcl")

    expect(stats.isFile).toBe(true)
    expect(stats.isDirectory).toBe(false)
    expect(stats.size).toBe(5)
    expect(stats.mtime).toBeGreaterThan(0)
  })

  test("readDirectory lists files", async () => {
    await fs.writeFile("/dir/file1.kcl", "a")
    await fs.writeFile("/dir/file2.kcl", "b")
    await fs.writeFile("/dir/subdir/file3.kcl", "c")

    const files = await fs.readDirectory("/dir")

    expect(files).toContain("/dir/file1.kcl")
    expect(files).toContain("/dir/file2.kcl")
    expect(files).not.toContain("/dir/subdir/file3.kcl") // Not direct child
  })

  test("resolve resolves relative paths", () => {
    const resolved = fs.resolve("/dir/file.kcl", "./other.kcl")
    expect(resolved).toBe("/dir/other.kcl")
  })

  test("resolve resolves parent paths", () => {
    const resolved = fs.resolve("/dir/sub/file.kcl", "../other.kcl")
    expect(resolved).toBe("/dir/other.kcl")
  })

  test("dirname returns directory", () => {
    const dir = fs.dirname("/dir/file.kcl")
    expect(dir).toBe("/dir")
  })

  test("basename returns filename", () => {
    const name = fs.basename("/dir/file.kcl")
    expect(name).toBe("file.kcl")
  })

  test("join combines paths", () => {
    const path = fs.join("/dir", "sub", "file.kcl")
    expect(path).toBe("/dir/sub/file.kcl")
  })

  test("handles file:// URIs", async () => {
    await fs.writeFile("file:///test.kcl", "content")
    const content = await fs.readFile("file:///test.kcl")
    expect(content).toBe("content")
  })

  test("throws error for non-existent file read", async () => {
    expect(async () => {
      await fs.readFile("/nonexistent.kcl")
    }).toThrow()
  })

  test("throws error for stat on non-existent file", async () => {
    expect(async () => {
      await fs.stat("/nonexistent.kcl")
    }).toThrow()
  })
})

describe("BunFileSystem", () => {
  // Note: These tests interact with the real filesystem
  // Use a temp directory to avoid conflicts

  test("can check if Bun is available", () => {
    // Just verify the filesystem can be created
    const fs = new BunFileSystem()
    expect(fs).toBeDefined()
  })

  // More tests would go here but require actual filesystem access
  // For now, we trust Bun's file API works correctly
})
