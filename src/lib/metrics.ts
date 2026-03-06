// Comprehensive in-memory metrics for API monitoring
// Resets on server restart (intentional for simplicity)

interface MetricsData {
  // Basic counts
  requests: number;
  messagesCreated: number;
  channelsCreated: number;
  usersRegistered: number;
  
  // Error tracking
  errors: number;
  authFailures: number;
  validationFailures: number;
  
  // Performance tracking
  totalResponseTime: number;
  slowestResponseTime: number;
  fastestResponseTime: number;
  
  // WebSocket metrics
  socketConnections: number;
  socketMessages: number;
  
  // WhatsApp metrics
  whatsappMessagesReceived: number;
  whatsappMessagesSent: number;
  
  // Timing
  startTime: number;
}

const metrics: MetricsData = {
  requests: 0,
  messagesCreated: 0,
  channelsCreated: 0,
  usersRegistered: 0,
  errors: 0,
  authFailures: 0,
  validationFailures: 0,
  totalResponseTime: 0,
  slowestResponseTime: 0,
  fastestResponseTime: Infinity,
  socketConnections: 0,
  socketMessages: 0,
  whatsappMessagesReceived: 0,
  whatsappMessagesSent: 0,
  startTime: Date.now(),
};

export interface Metrics {
  requests: number;
  messagesCreated: number;
  channelsCreated: number;
  usersRegistered: number;
  errors: number;
  authFailures: number;
  validationFailures: number;
  avgResponseTime: number;
  slowestResponseTime: number;
  fastestResponseTime: number;
  socketConnections: number;
  socketMessages: number;
  whatsappMessagesReceived: number;
  whatsappMessagesSent: number;
  uptime: number;
}

export function incrementMetric(key: keyof MetricsData) {
  if (key in metrics) {
    metrics[key]++;
  }
}

export function incrementResponseTime(responseTime: number) {
  metrics.requests++;
  metrics.totalResponseTime += responseTime;
  if (responseTime > metrics.slowestResponseTime) {
    metrics.slowestResponseTime = responseTime;
  }
  if (responseTime < metrics.fastestResponseTime) {
    metrics.fastestResponseTime = responseTime;
  }
}

export function incrementSocketConnections(delta: number) {
  metrics.socketConnections += delta;
}

export function incrementSocketMessages() {
  metrics.socketMessages++;
}

export function incrementWhatsAppReceived() {
  metrics.whatsappMessagesReceived++;
}

export function incrementWhatsAppSent() {
  metrics.whatsappMessagesSent++;
}

export function getMetrics(): Metrics | null {
  const uptime = Date.now() - metrics.startTime;
  const avgResponseTime = metrics.requests > 0 
    ? Math.round(metrics.totalResponseTime / metrics.requests) 
    : 0;
  
  return {
    requests: metrics.requests,
    messagesCreated: metrics.messagesCreated,
    channelsCreated: metrics.channelsCreated,
    usersRegistered: metrics.usersRegistered,
    errors: metrics.errors,
    authFailures: metrics.authFailures,
    validationFailures: metrics.validationFailures,
    avgResponseTime,
    slowestResponseTime: metrics.slowestResponseTime === 0 ? 0 : metrics.slowestResponseTime,
    fastestResponseTime: metrics.fastestResponseTime === Infinity ? 0 : metrics.fastestResponseTime,
    socketConnections: metrics.socketConnections,
    socketMessages: metrics.socketMessages,
    whatsappMessagesReceived: metrics.whatsappMessagesReceived,
    whatsappMessagesSent: metrics.whatsappMessagesSent,
    uptime,
  };
}

export function getRawMetrics(): MetricsData {
  return { ...metrics };
}

export function resetMetrics(): void {
  metrics.requests = 0;
  metrics.messagesCreated = 0;
  metrics.channelsCreated = 0;
  metrics.usersRegistered = 0;
  metrics.errors = 0;
  metrics.authFailures = 0;
  metrics.validationFailures = 0;
  metrics.totalResponseTime = 0;
  metrics.slowestResponseTime = 0;
  metrics.fastestResponseTime = Infinity;
  metrics.socketConnections = 0;
  metrics.socketMessages = 0;
  metrics.whatsappMessagesReceived = 0;
  metrics.whatsappMessagesSent = 0;
  metrics.startTime = Date.now();
}
