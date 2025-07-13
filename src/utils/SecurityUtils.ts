export class SecurityUtils {
  private static readonly DANGEROUS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /eval\s*\(/gi,
    /document\.write/gi,
    /window\.location/gi
  ]

  /**
   * Sanitize template content
   */
  public static sanitizeTemplate(content: string): string {
    let sanitized = content

    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '')
    }

    return sanitized
  }

  /**
   * Validate template security
   */
  public static validateTemplateSecurity(content: string): SecurityValidationResult {
    const issues: SecurityIssue[] = []
    
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      const matches = content.match(pattern)
      if (matches) {
        issues.push({
          type: 'dangerous_pattern',
          severity: 'high',
          description: `Potentially dangerous pattern found: ${matches[0]}`,
          recommendation: 'Remove or sanitize the dangerous content'
        })
      }
    }
    
    // Check for path traversal attempts
    if (content.includes('../') || content.includes('..\\')) {
      issues.push({
        type: 'path_traversal',
        severity: 'medium',
        description: 'Path traversal pattern detected',
        recommendation: 'Ensure user input is properly validated'
      })
    }
    
    return {
      secure: issues.length === 0,
      issues,
      riskLevel: this.calculateRiskLevel(issues)
    }
  }

  private static calculateRiskLevel(issues: SecurityIssue[]): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.severity === 'high')) {
      return 'high'
    }
    if (issues.some(issue => issue.severity === 'medium')) {
      return 'medium'
    }
    return 'low'
  }
}

interface SecurityValidationResult {
  secure: boolean
  issues: SecurityIssue[]
  riskLevel: 'low' | 'medium' | 'high'
}

interface SecurityIssue {
  type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  recommendation: string
}