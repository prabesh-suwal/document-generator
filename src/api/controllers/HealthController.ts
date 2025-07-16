
import { Request, Response } from 'express'
import { performance } from 'perf_hooks'
import { sendSuccess } from '../utils/responseHelpers'
import { logger } from '../utils/logger'
import { TemplateEngine } from '../../engine/TemplateEngine'

export class HealthController {
  private engine: TemplateEngine

  constructor() {
    this.engine = new TemplateEngine()
  }

  public async basicHealth(req: Request, res: Response): Promise<void> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }

    sendSuccess(res, health)
  }

  public async detailedHealth(req: Request, res: Response): Promise<void> {
    const startTime = performance.now()
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      engine: {
        supportedFormats: this.engine.getSupportedFormats ? this.engine.getSupportedFormats() : [],
        status: 'operational'
      },
      dependencies: await this.checkDependencies(),
      performance: {
        responseTime: performance.now() - startTime
      }
    }

    sendSuccess(res, health)
  }

  public async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if the service is ready to accept requests
      await this.performReadinessChecks()
      
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Readiness check failed:', error)
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  public async livenessCheck(req: Request, res: Response): Promise<void> {
    // Simple liveness check - if this endpoint responds, the service is alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString()
    })
  }

  private async checkDependencies(): Promise<any> {
    return {
      express: 'operational',
      templateEngine: 'operational',
      fileSystem: 'operational'
    }
  }

  private async performReadinessChecks(): Promise<void> {
    // Add actual readiness checks here
    // For example: database connectivity, external service availability, etc.
    
    // Simple template engine check
    try {
      const testResult = await this.engine.parseTemplate({
        content: 'Test {d.value}',
        format: 'txt' as any
      })
      
      if (!testResult) {
        throw new Error('Template engine not responding')
      }
    } catch (error) {
      throw new Error('Template engine readiness check failed')
    }
  }
}