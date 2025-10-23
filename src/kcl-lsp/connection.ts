/**
 * JSON-RPC Connection Handler
 *
 * Manages request/response correlation and method routing.
 */

import type {
  Message,
  RequestMessage,
  ResponseMessage,
  NotificationMessage,
  ResponseError,
} from "./protocol"
import { StdioTransport } from "./transport"

type RequestHandler = (params: any) => Promise<any> | any
type NotificationHandler = (params: any) => void

export class Connection {
  private transport: StdioTransport
  private requestHandlers = new Map<string, RequestHandler>()
  private notificationHandlers = new Map<string, NotificationHandler>()
  private nextId = 1

  constructor() {
    this.transport = new StdioTransport(
      (message) => this.handleMessage(message),
      (error) => this.handleError(error)
    )
  }

  /**
   * Start listening for messages
   */
  async listen() {
    await this.transport.start()
  }

  /**
   * Register a request handler
   */
  onRequest(method: string, handler: RequestHandler) {
    this.requestHandlers.set(method, handler)
  }

  /**
   * Register a notification handler
   */
  onNotification(method: string, handler: NotificationHandler) {
    this.notificationHandlers.set(method, handler)
  }

  /**
   * Send a notification to the client
   */
  sendNotification(method: string, params?: any) {
    const message: NotificationMessage = {
      jsonrpc: "2.0",
      method,
      params,
    }
    this.transport.send(message)
  }

  /**
   * Send a request to the client
   */
  sendRequest(method: string, params?: any): Promise<any> {
    const id = this.nextId++
    const message: RequestMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    }

    this.transport.send(message)

    // Note: We don't implement client->server requests yet,
    // so this just sends and doesn't wait for response
    return Promise.resolve(null)
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message) {
    // Check if it's a request
    if ("method" in message && "id" in message) {
      await this.handleRequest(message as RequestMessage)
      return
    }

    // Check if it's a notification
    if ("method" in message && !("id" in message)) {
      this.handleNotificationMessage(message as NotificationMessage)
      return
    }

    // It's a response (client responding to our request)
    // We don't handle these yet
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(request: RequestMessage) {
    const handler = this.requestHandlers.get(request.method)

    if (!handler) {
      this.sendErrorResponse(request.id, -32601, `Method not found: ${request.method}`)
      return
    }

    try {
      const result = await handler(request.params)
      this.sendResponse(request.id, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.sendErrorResponse(request.id, -32603, message)
    }
  }

  /**
   * Handle incoming notification
   */
  private handleNotificationMessage(notification: NotificationMessage) {
    const handler = this.notificationHandlers.get(notification.method)
    if (handler) {
      try {
        handler(notification.params)
      } catch (error) {
        // Log but don't send error (notifications don't expect responses)
        console.error(`Error handling notification ${notification.method}:`, error)
      }
    }
  }

  /**
   * Send a successful response
   */
  private sendResponse(id: number | string, result: any) {
    const message: ResponseMessage = {
      jsonrpc: "2.0",
      id,
      result,
    }
    this.transport.send(message)
  }

  /**
   * Send an error response
   */
  private sendErrorResponse(id: number | string, code: number, message: string, data?: any) {
    const response: ResponseMessage = {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data,
      },
    }
    this.transport.send(response)
  }

  /**
   * Handle transport errors
   */
  private handleError(error: Error) {
    console.error("Transport error:", error)
  }
}
