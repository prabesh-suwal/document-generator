import { ParsedTemplate, RenderedDocument, RenderRequest } from '../types/core'

export interface CacheConfig {
  enabled: boolean
  provider: 'memory' | 'redis' | 'file'
  ttlMs: number
  maxSize: number
  compression?: boolean
  keyPrefix?: string
}

export interface CacheStats {
  hitCount: number
  missCount: number
  hitRatio: number
  size: number
  maxSize: number
  memoryUsage?: number
}

export abstract class CacheProvider {
  protected config: CacheConfig
  protected stats: CacheStats

  constructor(config: CacheConfig) {
    this.config = config
    this.stats = {
      hitCount: 0,
      missCount: 0,
      hitRatio: 0,
      size: 0,
      maxSize: config.maxSize
    }
  }

  abstract get(key: string): Promise<any>
  abstract set(key: string, value: any, ttl?: number): Promise<void>
  abstract delete(key: string): Promise<boolean>
  abstract clear(): Promise<void>
  abstract exists(key: string): Promise<boolean>
  abstract getSize(): Promise<number>

  public getStats(): CacheStats {
    this.stats.hitRatio = this.stats.hitCount / (this.stats.hitCount + this.stats.missCount) || 0
    return { ...this.stats }
  }

  protected createKey(key: string): string {
    return `${this.config.keyPrefix || 'te'}:${key}`
  }

  protected recordHit(): void {
    this.stats.hitCount++
  }

  protected recordMiss(): void {
    this.stats.missCount++
  }
}

export class CacheManager {
  private templateCache?: CacheProvider
  private renderCache?: CacheProvider
  private conversionCache?: CacheProvider

  constructor(
    templateCacheConfig?: CacheConfig,
    renderCacheConfig?: CacheConfig,
    conversionCacheConfig?: CacheConfig
  ) {
    if (templateCacheConfig?.enabled) {
      this.templateCache = this.createProvider(templateCacheConfig)
    }
    if (renderCacheConfig?.enabled) {
      this.renderCache = this.createProvider(renderCacheConfig)
    }
    if (conversionCacheConfig?.enabled) {
      this.conversionCache = this.createProvider(conversionCacheConfig)
    }
  }

  // Template caching
  public async getTemplate(key: string): Promise<ParsedTemplate | null> {
    if (!this.templateCache) return null
    return await this.templateCache.get(key)
  }

  public async setTemplate(key: string, template: ParsedTemplate, ttl?: number): Promise<void> {
    if (!this.templateCache) return
    await this.templateCache.set(key, template, ttl)
  }

  // Render result caching
  public async getRenderResult(key: string): Promise<RenderedDocument | null> {
    if (!this.renderCache) return null
    return await this.renderCache.get(key)
  }

  public async setRenderResult(key: string, result: RenderedDocument, ttl?: number): Promise<void> {
    if (!this.renderCache) return
    await this.renderCache.set(key, result, ttl)
  }

  // Conversion result caching
  public async getConversionResult(key: string): Promise<Buffer | null> {
    if (!this.conversionCache) return null
    return await this.conversionCache.get(key)
  }

  public async setConversionResult(key: string, result: Buffer, ttl?: number): Promise<void> {
    if (!this.conversionCache) return
    await this.conversionCache.set(key, result, ttl)
  }

  // Cache key generation
  public createTemplateKey(content: string): string {
    return this.hashContent(content)
  }

  public createRenderKey(request: RenderRequest): string {
    const key = JSON.stringify({
      template: typeof request.template.content === 'string' 
        ? this.hashContent(request.template.content) 
        : 'buffer-content',
      data: request.data,
      options: request.options
    })
    return this.hashContent(key)
  }

  public createConversionKey(content: Buffer, from: string, to: string, options?: any): string {
    const key = `${this.hashContent(content.toString())}:${from}:${to}:${JSON.stringify(options || {})}`
    return this.hashContent(key)
  }

  // Statistics
  public getStats() {
    return {
      template: this.templateCache?.getStats(),
      render: this.renderCache?.getStats(),
      conversion: this.conversionCache?.getStats()
    }
  }

  // Cleanup
  public async clearAll(): Promise<void> {
    await Promise.all([
      this.templateCache?.clear(),
      this.renderCache?.clear(),
      this.conversionCache?.clear()
    ].filter(Boolean))
  }

  private createProvider(config: CacheConfig): CacheProvider {
    switch (config.provider) {
      case 'memory':
        return new MemoryCacheProvider(config)
      case 'file':
        return new FileCacheProvider(config)
      case 'redis':
        return new RedisCacheProvider(config)
      default:
        throw new Error(`Unknown cache provider: ${config.provider}`)
    }
  }

  private hashContent(content: string): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(content).digest('hex')
  }
}

// ============================================================================
// MEMORY CACHE PROVIDER
// ============================================================================

export class MemoryCacheProvider extends CacheProvider {
  private cache: Map<string, { value: any; expiry: number }>
  private memoryUsage: number = 0

  constructor(config: CacheConfig) {
    super(config)
    this.cache = new Map()
    
    // Setup cleanup interval
    setInterval(() => this.cleanup(), 60000) // Every minute
  }

  async get(key: string): Promise<any> {
    const fullKey = this.createKey(key)
    const item = this.cache.get(fullKey)
    
    if (!item) {
      this.recordMiss()
      return null
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(fullKey)
      this.recordMiss()
      return null
    }
    
    this.recordHit()
    return item.value
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const fullKey = this.createKey(key)
    const expiry = Date.now() + (ttl || this.config.ttlMs)
    
    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest()
    }
    
    const serialized = JSON.stringify(value)
    this.cache.set(fullKey, { value, expiry })
    this.memoryUsage += serialized.length
    this.stats.size = this.cache.size
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.createKey(key)
    const deleted = this.cache.delete(fullKey)
    if (deleted) {
      this.stats.size = this.cache.size
    }
    return deleted
  }

  async clear(): Promise<void> {
    this.cache.clear()
    this.memoryUsage = 0
    this.stats.size = 0
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.createKey(key)
    return this.cache.has(fullKey)
  }

  async getSize(): Promise<number> {
    return this.cache.size
  }

  public getStats(): CacheStats {
    const baseStats = super.getStats()
    return {
      ...baseStats,
      memoryUsage: this.memoryUsage
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
    this.stats.size = this.cache.size
  }

  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.cache.delete(firstKey)
    }
  }
}

// ============================================================================
// FILE CACHE PROVIDER
// ============================================================================

import { promises as fs } from 'fs'
import path from 'path'

export class FileCacheProvider extends CacheProvider {
  private cacheDir: string

  constructor(config: CacheConfig) {
    super(config)
    this.cacheDir = path.join(process.cwd(), 'cache')
    this.ensureCacheDir()
  }

  async get(key: string): Promise<any> {
    try {
      const filePath = this.getFilePath(key)
      const content = await fs.readFile(filePath, 'utf8')
      const item = JSON.parse(content)
      
      if (Date.now() > item.expiry) {
        await fs.unlink(filePath)
        this.recordMiss()
        return null
      }
      
      this.recordHit()
      return item.value
    } catch (error) {
      this.recordMiss()
      return null
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key)
    const expiry = Date.now() + (ttl || this.config.ttlMs)
    const item = { value, expiry }
    
    await fs.writeFile(filePath, JSON.stringify(item))
    this.stats.size = await this.getSize()
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key)
      await fs.unlink(filePath)
      this.stats.size = await this.getSize()
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir)
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      )
      this.stats.size = 0
    } catch (error) {
      // Directory might not exist
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  async getSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir)
      return files.length
    } catch {
      return 0
    }
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_')
    return path.join(this.cacheDir, `${safeKey}.cache`)
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
    } catch (error) {
      console.warn('Failed to create cache directory:', error)
    }
  }
}

// ============================================================================
// REDIS CACHE PROVIDER (Optional)
// ============================================================================

export class RedisCacheProvider extends CacheProvider {
  private client: any = null

  constructor(config: CacheConfig) {
    super(config)
    
    try {
      const redis = require('redis')
      this.client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      })
      
      this.client.on('error', (err: any) => {
        console.warn('Redis cache error:', err)
      })
    } catch (error) {
      console.warn('Redis not available, falling back to memory cache')
      throw new Error('Redis not available')
    }
  }

  async get(key: string): Promise<any> {
    if (!this.client) {
      this.recordMiss()
      return null
    }

    try {
      const fullKey = this.createKey(key)
      const result = await this.client.get(fullKey)
      
      if (!result) {
        this.recordMiss()
        return null
      }
      
      this.recordHit()
      return JSON.parse(result)
    } catch (error) {
      this.recordMiss()
      return null
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client) return

    try {
      const fullKey = this.createKey(key)
      const serialized = JSON.stringify(value)
      const expiry = Math.floor((ttl || this.config.ttlMs) / 1000)
      
      await this.client.setex(fullKey, expiry, serialized)
      this.stats.size = await this.getSize()
    } catch (error) {
      console.warn('Redis set error:', error)
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false

    try {
      const fullKey = this.createKey(key)
      const result = await this.client.del(fullKey)
      this.stats.size = await this.getSize()
      return result > 0
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return

    try {
      const pattern = this.createKey('*')
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
      this.stats.size = 0
    } catch (error) {
      console.warn('Redis clear error:', error)
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false

    try {
      const fullKey = this.createKey(key)
      const result = await this.client.exists(fullKey)
      return result > 0
    } catch {
      return false
    }
  }

  async getSize(): Promise<number> {
    if (!this.client) return 0

    try {
      const pattern = this.createKey('*')
      const keys = await this.client.keys(pattern)
      return keys.length
    } catch {
      return 0
    }
  }
}