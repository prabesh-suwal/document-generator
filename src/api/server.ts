import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer as createHttpServer } from 'http'
import { config } from '../config/app'
import { setupMiddleware } from './middleware'
import { setupRoutes } from './routes'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

export class TemplateApiServer {
  private app: Express
  private server: any

  constructor() {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: false, // Allow file uploads
      crossOriginEmbedderPolicy: false
    }))
    
    // CORS
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
      optionsSuccessStatus: 200
    }))

    // Compression
    this.app.use(compression())

    // Body parsing
    this.app.use(express.json({ limit: config.upload.maxBodySize }))
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: config.upload.maxBodySize 
    }))

    // Custom middleware
    setupMiddleware(this.app)
  }

  private setupRoutes(): void {
    setupRoutes(this.app)
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler)
  }

  public start(port?: number): Promise<void> {
    const serverPort = port || config.server.port
    
    return new Promise((resolve, reject) => {
      this.server = createHttpServer(this.app)
      
      this.server.listen(serverPort, () => {
        logger.info(`🚀 Template Engine API Server started`)
        logger.info(`📡 Server running on port ${serverPort}`)
        logger.info(`🌍 Environment: ${config.env}`)
        logger.info(`📋 Health check: http://localhost:${serverPort}/health`)
        logger.info(`📄 API docs: http://localhost:${serverPort}/api/docs`)
        resolve()
      })

      this.server.on('error', (error: Error) => {
        logger.error('Server startup error:', error)
        reject(error)
      })
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🛑 Server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  public getApp(): Express {
    return this.app
  }
}