// Database Configuration for Different Environments
// This helps prevent production issues by validating configurations

export interface DatabaseConfig {
  environment: 'development' | 'staging' | 'production';
  allowFunctionReplacement: boolean;
  requireMigrations: boolean;
  validateFunctionSignatures: boolean;
  maxQueryTime: number;
  enableDebugLogging: boolean;
}

export const databaseConfigs: Record<string, DatabaseConfig> = {
  development: {
    environment: 'development',
    allowFunctionReplacement: true, // Allow CREATE OR REPLACE
    requireMigrations: false,
    validateFunctionSignatures: false,
    maxQueryTime: 30000,
    enableDebugLogging: true
  },
  staging: {
    environment: 'staging',
    allowFunctionReplacement: false,
    requireMigrations: true,
    validateFunctionSignatures: true,
    maxQueryTime: 15000,
    enableDebugLogging: true
  },
  production: {
    environment: 'production',
    allowFunctionReplacement: false,
    requireMigrations: true,
    validateFunctionSignatures: true,
    maxQueryTime: 8000,
    enableDebugLogging: false
  }
};

// Get current environment config
export function getDatabaseConfig(): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  return databaseConfigs[env] || databaseConfigs.development;
}

// Function validation helper
export function validateFunctionCall(
  functionName: string, 
  params: Record<string, any>
): { valid: boolean; errors: string[] } {
  const config = getDatabaseConfig();
  const errors: string[] = [];

  if (config.validateFunctionSignatures) {
    // Add validation logic here
    if (!functionName) {
      errors.push('Function name is required');
    }
    
    if (!params || typeof params !== 'object') {
      errors.push('Function parameters must be an object');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Safe function execution wrapper
export async function safeFunctionCall<T>(
  supabase: any,
  functionName: string,
  params: Record<string, any>
): Promise<{ data: T | null; error: any }> {
  const config = getDatabaseConfig();
  
  // Validate function call
  const validation = validateFunctionCall(functionName, params);
  if (!validation.valid) {
    return {
      data: null,
      error: { message: 'Function validation failed', details: validation.errors }
    };
  }

  // Log in development
  if (config.enableDebugLogging) {
    console.log(`[DB] Calling function: ${functionName}`, params);
  }

  try {
    const result = await supabase.rpc(functionName, params);
    
    if (config.enableDebugLogging) {
      console.log(`[DB] Function ${functionName} result:`, result);
    }
    
    return result;
  } catch (error) {
    if (config.enableDebugLogging) {
      console.error(`[DB] Function ${functionName} error:`, error);
    }
    return { data: null, error };
  }
}

// Migration helper
export function requireMigration(operation: string): void {
  const config = getDatabaseConfig();
  
  if (config.requireMigrations && config.environment === 'production') {
    throw new Error(
      `Direct database operation "${operation}" not allowed in production. ` +
      'Use proper migrations instead.'
    );
  }
}

// Environment-specific logging
export function logDatabaseOperation(operation: string, details?: any): void {
  const config = getDatabaseConfig();
  
  if (config.enableDebugLogging) {
    console.log(`[DB ${config.environment.toUpperCase()}] ${operation}`, details);
  }
} 