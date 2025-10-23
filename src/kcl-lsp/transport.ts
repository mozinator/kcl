/**
 * LSP Transport Layer
 *
 * Implements Content-Length header protocol over stdio using Bun built-ins.
 * LSP uses HTTP-style headers: Content-Length: N\r\n\r\n{json}
 */

import type { Message } from "./protocol"

export class StdioTransport {
  private buffer: string = ""
  private contentLength: number | null = null

  constructor(
    private onMessage: (message: Message) => void,
    private onError: (error: Error) => void
  ) {}

  /**
   * Start reading from stdin
   */
  async start() {
    const decoder = new TextDecoder()

    for await (const chunk of Bun.stdin.stream()) {
      const text = decoder.decode(chunk, { stream: true })
      this.buffer += text
      this.processBuffer()
    }
  }

  /**
   * Process the buffer to extract complete messages
   */
  private processBuffer() {
    while (true) {
      // If we don't have content length yet, try to parse headers
      if (this.contentLength === null) {
        const headerMatch = this.buffer.match(/^Content-Length: (\d+)\r\n\r\n/)
        if (!headerMatch) {
          // Not enough data yet
          break
        }

        this.contentLength = parseInt(headerMatch[1], 10)
        this.buffer = this.buffer.slice(headerMatch[0].length)
      }

      // Check if we have enough data for the message
      if (this.buffer.length < this.contentLength) {
        // Not enough data yet
        break
      }

      // Extract the message
      const messageText = this.buffer.slice(0, this.contentLength)
      this.buffer = this.buffer.slice(this.contentLength)
      this.contentLength = null

      // Parse and deliver the message
      try {
        const message = JSON.parse(messageText) as Message
        this.onMessage(message)
      } catch (error) {
        this.onError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Send a message to stdout
   */
  send(message: Message) {
    const content = JSON.stringify(message)
    const header = `Content-Length: ${content.length}\r\n\r\n`
    const output = header + content

    // Use Bun.write for stdout
    Bun.write(Bun.stdout, output)
  }
}
