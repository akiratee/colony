import { NextResponse } from 'next/server';
import { isSupabaseConfigured, isSupabaseConfiguredSync } from '@/lib/supabase';
import { getMetrics, getRawMetrics } from '@/lib/metrics';

// Health check endpoint for load balancers and monitoring
export async function GET() {
  const checks: Record<string, { status: string; latency?: string; error?: string }> = {};
  
  // Check Supabase connectivity (async)
  let supabaseStatus = 'ok';
  let supabaseError: string | undefined;
  try {
    if (!isSupabaseConfiguredSync()) {
      supabaseStatus = 'not_configured';
      supabaseError = 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set';
    } else {
      const connected = await isSupabaseConfigured();
      if (!connected) {
        supabaseStatus = 'error';
        supabaseError = 'Supabase connection failed - invalid credentials or network issue';
      }
    }
  } catch (err: any) {
    supabaseStatus = 'error';
    supabaseError = err.message || 'Unknown error';
  }
  checks.supabase = { 
    status: supabaseStatus, 
    error: supabaseError 
  };
  
  // Check environment
  const envStatus = process.env.NODE_ENV || 'unknown';
  checks.environment = { status: envStatus };
  
  // Check memory usage
  let memoryStatus = 'ok';
  let memoryError: string | undefined;
  try {
    if (process.memoryUsage) {
      const mem = process.memoryUsage();
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const memPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
      if (memPercent > 90) {
        memoryStatus = 'warning';
        memoryError = `Heap usage at ${memPercent}% (${heapUsedMB}MB / ${heapTotalMB}MB)`;
      } else if (memPercent > 80) {
        memoryStatus = 'degraded';
        memoryError = `Heap usage at ${memPercent}% (${heapUsedMB}MB / ${heapTotalMB}MB)`;
      }
    }
  } catch (err: any) {
    memoryStatus = 'unknown';
    memoryError = err.message || 'Could not check memory';
  }
  checks.memory = { 
    status: memoryStatus, 
    error: memoryError 
  };
  
  // Check metrics system
  let metricsStatus = 'ok';
  let metricsError: string | undefined;
  try {
    const metrics = getMetrics();
    if (!metrics) {
      metricsStatus = 'error';
      metricsError = 'Metrics system not initialized';
    }
  } catch (err: any) {
    metricsStatus = 'error';
    metricsError = err.message || 'Metrics check failed';
  }
  checks.metrics = { 
    status: metricsStatus, 
    error: metricsError 
  };
  
  // Check required environment variables
  const requiredEnvVars = ['JWT_SECRET'];
  const missingEnvVars: string[] = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar);
    }
  }
  checks.environmentVars = {
    status: missingEnvVars.length > 0 ? 'warning' : 'ok',
    error: missingEnvVars.length > 0 ? `Missing: ${missingEnvVars.join(', ')}` : undefined
  };
  
  // Overall status - check all critical services
  const criticalChecks = ['supabase', 'metrics'];
  const hasCriticalFailure = criticalChecks.some(check => 
    checks[check]?.status === 'error'
  );
  const hasWarning = Object.values(checks).some(check => 
    check.status === 'warning' || check.status === 'degraded'
  );
  const overall = hasCriticalFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'ok';
  
  // Get basic metrics for health response
  const rawMetrics = getRawMetrics();
  const uptimeMs = rawMetrics?.startTime ? Date.now() - rawMetrics.startTime : 0;
  
  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    service: 'colony-api',
    version: process.env.npm_package_version || '1.0.0',
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      human: `${Math.floor(uptimeMs / 60000)}m ${Math.floor((uptimeMs % 60000) / 1000)}s`,
    },
    checks,
  }, { status: overall === 'ok' || overall === 'degraded' ? 200 : 503 });
}
