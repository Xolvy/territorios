import { useState, useEffect, useCallback, useRef } from "react";

// Interfaces para el sistema de alertas y notificaciones
export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  type:
    | "threshold"
    | "anomaly"
    | "error_rate"
    | "performance"
    | "business"
    | "security"
    | "custom";
  condition: AlertCondition;
  actions: AlertAction[];
  schedule: AlertSchedule;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface AlertCondition {
  metric: string;
  operator:
    | "gt"
    | "lt"
    | "eq"
    | "ne"
    | "gte"
    | "lte"
    | "contains"
    | "not_contains"
    | "in"
    | "not_in";
  threshold: number | string | string[];
  timeWindow: number; // minutos
  evaluationInterval: number; // minutos
  aggregation?: "avg" | "sum" | "count" | "min" | "max" | "p95" | "p99";
  groupBy?: string[];
  filters?: AlertFilter[];
  suppressionRules?: SuppressionRule[];
}

export interface AlertFilter {
  field: string;
  operator: "eq" | "ne" | "contains" | "not_contains" | "in" | "not_in";
  value: string | string[];
}

export interface SuppressionRule {
  type: "time_based" | "condition_based" | "dependency_based";
  duration?: number; // minutos
  condition?: string;
  dependencies?: string[]; // IDs de otras alertas
}

export interface AlertAction {
  id: string;
  type:
    | "email"
    | "slack"
    | "webhook"
    | "sms"
    | "push"
    | "ticket"
    | "escalation"
    | "auto_remediation";
  config: ActionConfig;
  delay?: number; // minutos antes de ejecutar
  retryPolicy?: RetryPolicy;
  conditions?: ActionCondition[];
}

export interface ActionConfig {
  // Email
  recipients?: string[];
  subject?: string;
  template?: string;

  // Slack
  channel?: string;
  webhook_url?: string;
  mention_users?: string[];
  mention_channel?: boolean;

  // Webhook
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  payload?: Record<string, any>;

  // SMS
  phone_numbers?: string[];
  message?: string;

  // Push
  app_id?: string;
  user_ids?: string[];
  title?: string;
  body?: string;

  // Ticket
  system?: "jira" | "servicenow" | "zendesk" | "custom";
  project?: string;
  assignee?: string;
  priority?: string;

  // Escalation
  escalation_chain?: EscalationLevel[];

  // Auto Remediation
  script?: string;
  parameters?: Record<string, any>;
}

export interface EscalationLevel {
  level: number;
  delay: number; // minutos
  actions: AlertAction[];
  conditions?: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: "fixed" | "exponential" | "linear";
  initialDelay: number; // segundos
  maxDelay: number; // segundos
  retryConditions?: string[];
}

export interface ActionCondition {
  field: string;
  operator: string;
  value: any;
}

export interface AlertSchedule {
  timezone: string;
  maintenanceWindows: MaintenanceWindow[];
  activeHours?: {
    days: string[]; // ['monday', 'tuesday', ...]
    startTime: string; // '09:00'
    endTime: string; // '17:00'
  };
  snoozeUntil?: Date;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  recurring?: {
    type: "daily" | "weekly" | "monthly";
    interval: number;
  };
  alertsToSuppress: string[]; // Alert IDs o 'all'
}

export interface AlertInstance {
  id: string;
  alertId: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status:
    | "triggered"
    | "acknowledged"
    | "resolved"
    | "suppressed"
    | "escalated";
  severity: AlertDefinition["severity"];
  message: string;
  context: AlertContext;
  actions: ActionExecution[];
  acknowledgments: Acknowledgment[];
  escalations: EscalationExecution[];
  metrics: AlertMetrics;
  annotations?: Record<string, string>;
}

export interface AlertContext {
  triggerValue: number | string;
  threshold: number | string;
  metric: string;
  timeWindow: number;
  affectedResources: string[];
  relatedAlerts: string[];
  environmentContext: {
    environment: string;
    region?: string;
    service?: string;
    version?: string;
  };
  userContext?: {
    affectedUsers: number;
    impactLevel: "low" | "medium" | "high" | "critical";
  };
  businessContext?: {
    businessImpact: string;
    revenue_impact?: number;
    sla_breach?: boolean;
  };
}

export interface ActionExecution {
  id: string;
  actionId: string;
  executedAt: Date;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  attempts: number;
  lastError?: string;
  response?: any;
  duration?: number;
}

export interface Acknowledgment {
  id: string;
  acknowledgedBy: string;
  acknowledgedAt: Date;
  comment?: string;
  duration?: number; // minutos de snooze
}

export interface EscalationExecution {
  id: string;
  level: number;
  triggeredAt: Date;
  completedAt?: Date;
  status: "pending" | "running" | "completed" | "failed";
  actions: ActionExecution[];
}

export interface AlertMetrics {
  timeToAcknowledge?: number; // minutos
  timeToResolve?: number; // minutos
  escalationLevel: number;
  actionSuccess: number;
  actionFailures: number;
  falsePositive?: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: AlertAction["type"];
  config: ActionConfig;
  enabled: boolean;
  rateLimits: RateLimit[];
  filters: ChannelFilter[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimit {
  type: "per_minute" | "per_hour" | "per_day";
  limit: number;
  severity?: AlertDefinition["severity"];
}

export interface ChannelFilter {
  severity: AlertDefinition["severity"][];
  alertTypes: AlertDefinition["type"][];
  tags: string[];
  excludeTags: string[];
}

export interface AlertingSystemConfig {
  defaultSeverity: AlertDefinition["severity"];
  defaultActions: AlertAction[];
  globalSuppressionRules: SuppressionRule[];
  escalationEnabled: boolean;
  autoResolutionEnabled: boolean;
  autoResolutionTimeout: number; // minutos
  batchingEnabled: boolean;
  batchingConfig: {
    maxBatchSize: number;
    maxWaitTime: number; // segundos
    groupBy: string[];
  };
  rateLimiting: {
    enabled: boolean;
    globalLimits: RateLimit[];
  };
  integrations: {
    prometheus: boolean;
    grafana: boolean;
    datadog: boolean;
    newrelic: boolean;
    pagerduty: boolean;
    slack: boolean;
    email: boolean;
    webhook: boolean;
  };
}

export interface AlertingAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  alertsByStatus: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  alertsByType: Record<string, number>;
  averageTimeToAcknowledge: number;
  averageTimeToResolve: number;
  falsePositiveRate: number;
  topAlerts: Array<{
    alertId: string;
    name: string;
    count: number;
    lastTriggered: Date;
  }>;
  channelPerformance: Array<{
    channelId: string;
    name: string;
    successRate: number;
    avgResponseTime: number;
    errorCount: number;
  }>;
  escalationMetrics: {
    totalEscalations: number;
    escalationsByLevel: Record<number, number>;
    avgEscalationTime: number;
  };
}

// Clase principal del sistema de alertas
class AlertingNotificationSystem {
  private alerts: Map<string, AlertDefinition>;
  private activeInstances: Map<string, AlertInstance>;
  private channels: Map<string, NotificationChannel>;
  private config: AlertingSystemConfig;
  private subscribers: Map<string, (data: any) => void>;
  private evaluationEngine: AlertEvaluationEngine;
  private actionExecutor: ActionExecutor;
  private escalationManager: EscalationManager;
  private isRunning: boolean;
  private evaluationInterval: NodeJS.Timeout | null;

  constructor(config?: Partial<AlertingSystemConfig>) {
    this.alerts = new Map();
    this.activeInstances = new Map();
    this.channels = new Map();
    this.config = this.getDefaultConfig(config);
    this.subscribers = new Map();
    this.evaluationEngine = new AlertEvaluationEngine(this);
    this.actionExecutor = new ActionExecutor(this);
    this.escalationManager = new EscalationManager(this);
    this.isRunning = false;
    this.evaluationInterval = null;

    this.initializeDefaultChannels();
    this.initializeDefaultAlerts();
    this.startEvaluationEngine();
  }

  private getDefaultConfig(
    userConfig?: Partial<AlertingSystemConfig>
  ): AlertingSystemConfig {
    return {
      defaultSeverity: "medium",
      defaultActions: [
        {
          id: "default_email",
          type: "email",
          config: {
            recipients: ["admin@company.com"],
            subject: "Alert: {{alert.name}}",
            template: "default",
          },
        },
      ],
      globalSuppressionRules: [],
      escalationEnabled: true,
      autoResolutionEnabled: true,
      autoResolutionTimeout: 60,
      batchingEnabled: true,
      batchingConfig: {
        maxBatchSize: 10,
        maxWaitTime: 300,
        groupBy: ["severity", "alertId"],
      },
      rateLimiting: {
        enabled: true,
        globalLimits: [
          { type: "per_minute", limit: 100 },
          { type: "per_hour", limit: 1000 },
        ],
      },
      integrations: {
        prometheus: false,
        grafana: false,
        datadog: false,
        newrelic: false,
        pagerduty: false,
        slack: true,
        email: true,
        webhook: true,
      },
      ...userConfig,
    };
  }

  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: "email_default",
        name: "Default Email",
        type: "email",
        config: {
          recipients: ["admin@company.com"],
          subject: "Alert: {{alert.name}}",
          template: "default",
        },
        enabled: true,
        rateLimits: [
          { type: "per_minute", limit: 10 },
          { type: "per_hour", limit: 100 },
        ],
        filters: [
          {
            severity: ["medium", "high", "critical"],
            alertTypes: ["error_rate", "performance", "business"],
            tags: [],
            excludeTags: ["test"],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "slack_critical",
        name: "Critical Slack Channel",
        type: "slack",
        config: {
          channel: "#critical-alerts",
          webhook_url: "https://hooks.slack.com/services/...",
          mention_channel: true,
        },
        enabled: true,
        rateLimits: [{ type: "per_minute", limit: 5, severity: "critical" }],
        filters: [
          {
            severity: ["critical"],
            alertTypes: ["error_rate", "performance", "security", "business"],
            tags: [],
            excludeTags: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "webhook_monitoring",
        name: "Monitoring Webhook",
        type: "webhook",
        config: {
          url: "https://api.monitoring.company.com/alerts",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer {{token}}",
          },
        },
        enabled: true,
        rateLimits: [],
        filters: [
          {
            severity: ["low", "medium", "high", "critical"],
            alertTypes: ["threshold", "anomaly", "error_rate", "performance"],
            tags: [],
            excludeTags: [],
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultChannels.forEach((channel) => {
      this.channels.set(channel.id, channel);
    });
  }

  private initializeDefaultAlerts(): void {
    const defaultAlerts: AlertDefinition[] = [
      {
        id: "high_error_rate",
        name: "High Error Rate",
        description: "Error rate exceeds 5% in the last 5 minutes",
        severity: "high",
        type: "error_rate",
        condition: {
          metric: "error_rate",
          operator: "gt",
          threshold: 5,
          timeWindow: 5,
          evaluationInterval: 1,
          aggregation: "avg",
        },
        actions: [
          {
            id: "email_dev_team",
            type: "email",
            config: {
              recipients: ["dev-team@company.com"],
              subject: "🚨 High Error Rate Alert",
              template: "error_rate_alert",
            },
          },
          {
            id: "slack_dev_channel",
            type: "slack",
            config: {
              channel: "#dev-alerts",
              mention_users: ["@oncall-engineer"],
            },
          },
        ],
        schedule: {
          timezone: "UTC",
          maintenanceWindows: [],
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
        tags: ["error", "production", "critical-path"],
      },
      {
        id: "slow_response_time",
        name: "Slow Response Time",
        description: "Average response time exceeds 2 seconds",
        severity: "medium",
        type: "performance",
        condition: {
          metric: "avg_response_time",
          operator: "gt",
          threshold: 2000,
          timeWindow: 10,
          evaluationInterval: 2,
          aggregation: "avg",
        },
        actions: [
          {
            id: "slack_performance",
            type: "slack",
            config: {
              channel: "#performance-alerts",
            },
          },
          {
            id: "escalation_chain",
            type: "escalation",
            config: {
              escalation_chain: [
                {
                  level: 1,
                  delay: 15,
                  actions: [
                    {
                      id: "email_team_lead",
                      type: "email",
                      config: {
                        recipients: ["team-lead@company.com"],
                      },
                    },
                  ],
                },
                {
                  level: 2,
                  delay: 30,
                  actions: [
                    {
                      id: "sms_manager",
                      type: "sms",
                      config: {
                        phone_numbers: ["+1234567890"],
                        message: "URGENT: Performance issue requires attention",
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
        schedule: {
          timezone: "UTC",
          maintenanceWindows: [],
          activeHours: {
            days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            startTime: "09:00",
            endTime: "17:00",
          },
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
        tags: ["performance", "user-experience"],
      },
      {
        id: "disk_space_critical",
        name: "Critical Disk Space",
        description: "Disk usage exceeds 90%",
        severity: "critical",
        type: "threshold",
        condition: {
          metric: "disk_usage_percent",
          operator: "gt",
          threshold: 90,
          timeWindow: 1,
          evaluationInterval: 1,
          groupBy: ["host", "mount_point"],
        },
        actions: [
          {
            id: "immediate_escalation",
            type: "escalation",
            config: {
              escalation_chain: [
                {
                  level: 1,
                  delay: 0,
                  actions: [
                    {
                      id: "slack_critical",
                      type: "slack",
                      config: {
                        channel: "#critical-alerts",
                        mention_channel: true,
                      },
                    },
                    {
                      id: "sms_oncall",
                      type: "sms",
                      config: {
                        phone_numbers: ["+1234567890"],
                        message:
                          "CRITICAL: Disk space {{context.triggerValue}}% on {{context.affectedResources}}",
                      },
                    },
                  ],
                },
              ],
            },
          },
          {
            id: "auto_cleanup",
            type: "auto_remediation",
            config: {
              script: "cleanup_disk_space.sh",
              parameters: {
                threshold: 85,
                cleanup_logs: true,
                cleanup_temp: true,
              },
            },
            delay: 5,
          },
        ],
        schedule: {
          timezone: "UTC",
          maintenanceWindows: [],
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system",
        tags: ["infrastructure", "critical", "auto-remediation"],
      },
    ];

    defaultAlerts.forEach((alert) => {
      this.alerts.set(alert.id, alert);
    });
  }

  private startEvaluationEngine(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts();
    }, 60000); // Evaluar cada minuto

    console.log("🔍 Alert evaluation engine started");
  }

  private stopEvaluationEngine(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
    this.isRunning = false;
    console.log("⏹️ Alert evaluation engine stopped");
  }

  private async evaluateAlerts(): Promise<void> {
    const enabledAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.enabled
    );

    for (const alert of enabledAlerts) {
      try {
        await this.evaluationEngine.evaluateAlert(alert);
      } catch (error) {
        console.error(`Error evaluating alert ${alert.id}:`, error);
      }
    }
  }

  // Métodos públicos para gestión de alertas
  public createAlert(
    alert: Omit<AlertDefinition, "id" | "createdAt" | "updatedAt">
  ): string {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAlert: AlertDefinition = {
      ...alert,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.alerts.set(id, newAlert);
    this.notifySubscribers("alert_created", newAlert);

    return id;
  }

  public updateAlert(id: string, updates: Partial<AlertDefinition>): boolean {
    const alert = this.alerts.get(id);
    if (!alert) return false;

    const updatedAlert = {
      ...alert,
      ...updates,
      updatedAt: new Date(),
    };

    this.alerts.set(id, updatedAlert);
    this.notifySubscribers("alert_updated", updatedAlert);

    return true;
  }

  public deleteAlert(id: string): boolean {
    const alert = this.alerts.get(id);
    if (!alert) return false;

    // Resolver todas las instancias activas
    const activeInstances = Array.from(this.activeInstances.values()).filter(
      (instance) => instance.alertId === id
    );

    activeInstances.forEach((instance) => {
      this.resolveAlert(instance.id, "Alert definition deleted");
    });

    this.alerts.delete(id);
    this.notifySubscribers("alert_deleted", { id, alert });

    return true;
  }

  public getAlert(id: string): AlertDefinition | undefined {
    return this.alerts.get(id);
  }

  public getAllAlerts(): AlertDefinition[] {
    return Array.from(this.alerts.values());
  }

  public getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeInstances.values())
      .filter((instance) => instance.status === "triggered")
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  public acknowledgeAlert(
    instanceId: string,
    acknowledgedBy: string,
    comment?: string,
    duration?: number
  ): boolean {
    const instance = this.activeInstances.get(instanceId);
    if (!instance || instance.status !== "triggered") return false;

    const acknowledgment: Acknowledgment = {
      id: `ack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      acknowledgedBy,
      acknowledgedAt: new Date(),
      comment,
      duration,
    };

    instance.acknowledgments.push(acknowledgment);
    instance.status = "acknowledged";

    // Si hay duración, programar reactivación
    if (duration) {
      setTimeout(() => {
        if (instance.status === "acknowledged") {
          instance.status = "triggered";
          this.notifySubscribers("alert_reactivated", instance);
        }
      }, duration * 60 * 1000);
    }

    this.notifySubscribers("alert_acknowledged", { instance, acknowledgment });
    return true;
  }

  public resolveAlert(instanceId: string, comment?: string): boolean {
    const instance = this.activeInstances.get(instanceId);
    if (!instance) return false;

    instance.status = "resolved";
    instance.resolvedAt = new Date();

    if (instance.metrics) {
      instance.metrics.timeToResolve =
        (instance.resolvedAt.getTime() - instance.triggeredAt.getTime()) /
        (1000 * 60);
    }

    this.notifySubscribers("alert_resolved", { instance, comment });
    return true;
  }

  public createChannel(
    channel: Omit<NotificationChannel, "id" | "createdAt" | "updatedAt">
  ): string {
    const id = `channel_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const newChannel: NotificationChannel = {
      ...channel,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.channels.set(id, newChannel);
    this.notifySubscribers("channel_created", newChannel);

    return id;
  }

  public updateChannel(
    id: string,
    updates: Partial<NotificationChannel>
  ): boolean {
    const channel = this.channels.get(id);
    if (!channel) return false;

    const updatedChannel = {
      ...channel,
      ...updates,
      updatedAt: new Date(),
    };

    this.channels.set(id, updatedChannel);
    this.notifySubscribers("channel_updated", updatedChannel);

    return true;
  }

  public deleteChannel(id: string): boolean {
    const deleted = this.channels.delete(id);
    if (deleted) {
      this.notifySubscribers("channel_deleted", { id });
    }
    return deleted;
  }

  public getAllChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  public triggerAlert(
    alertId: string,
    context: Partial<AlertContext>,
    message?: string
  ): string | null {
    const alert = this.alerts.get(alertId);
    if (!alert || !alert.enabled) return null;

    const instanceId = `instance_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const instance: AlertInstance = {
      id: instanceId,
      alertId,
      triggeredAt: new Date(),
      status: "triggered",
      severity: alert.severity,
      message: message || `Alert ${alert.name} has been triggered`,
      context: {
        triggerValue: context.triggerValue || 0,
        threshold: context.threshold || 0,
        metric: context.metric || alert.condition.metric,
        timeWindow: context.timeWindow || alert.condition.timeWindow,
        affectedResources: context.affectedResources || [],
        relatedAlerts: context.relatedAlerts || [],
        environmentContext: context.environmentContext || {
          environment: "production",
        },
        ...context,
      },
      actions: [],
      acknowledgments: [],
      escalations: [],
      metrics: {
        escalationLevel: 0,
        actionSuccess: 0,
        actionFailures: 0,
      },
    };

    this.activeInstances.set(instanceId, instance);

    // Ejecutar acciones
    this.actionExecutor.executeActions(instance, alert.actions);

    // Programar escalación si está habilitada
    if (this.config.escalationEnabled) {
      this.escalationManager.scheduleEscalation(instance, alert);
    }

    // Programar auto-resolución si está habilitada
    if (this.config.autoResolutionEnabled) {
      setTimeout(() => {
        if (instance.status === "triggered") {
          this.resolveAlert(instanceId, "Auto-resolved due to timeout");
        }
      }, this.config.autoResolutionTimeout * 60 * 1000);
    }

    this.notifySubscribers("alert_triggered", instance);
    return instanceId;
  }

  public getAnalytics(): AlertingAnalytics {
    const allInstances = Array.from(this.activeInstances.values());
    const activeInstances = allInstances.filter(
      (i) => i.status === "triggered"
    );

    const alertsByStatus: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};

    allInstances.forEach((instance) => {
      alertsByStatus[instance.status] =
        (alertsByStatus[instance.status] || 0) + 1;
      alertsBySeverity[instance.severity] =
        (alertsBySeverity[instance.severity] || 0) + 1;

      const alert = this.alerts.get(instance.alertId);
      if (alert) {
        alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      }
    });

    const avgTimeToAcknowledge =
      this.calculateAverageTimeToAcknowledge(allInstances);
    const avgTimeToResolve = this.calculateAverageTimeToResolve(allInstances);
    const falsePositiveRate = this.calculateFalsePositiveRate(allInstances);

    return {
      totalAlerts: allInstances.length,
      activeAlerts: activeInstances.length,
      alertsByStatus,
      alertsBySeverity,
      alertsByType,
      averageTimeToAcknowledge: avgTimeToAcknowledge,
      averageTimeToResolve: avgTimeToResolve,
      falsePositiveRate,
      topAlerts: this.getTopAlerts(),
      channelPerformance: this.getChannelPerformance(),
      escalationMetrics: this.getEscalationMetrics(),
    };
  }

  private calculateAverageTimeToAcknowledge(
    instances: AlertInstance[]
  ): number {
    const acknowledgedInstances = instances.filter(
      (i) => i.acknowledgments.length > 0
    );
    if (acknowledgedInstances.length === 0) return 0;

    const totalTime = acknowledgedInstances.reduce((sum, instance) => {
      const firstAck = instance.acknowledgments[0];
      return (
        sum +
        (firstAck.acknowledgedAt.getTime() - instance.triggeredAt.getTime())
      );
    }, 0);

    return totalTime / acknowledgedInstances.length / (1000 * 60); // minutos
  }

  private calculateAverageTimeToResolve(instances: AlertInstance[]): number {
    const resolvedInstances = instances.filter(
      (i) => i.status === "resolved" && i.resolvedAt
    );
    if (resolvedInstances.length === 0) return 0;

    const totalTime = resolvedInstances.reduce((sum, instance) => {
      return (
        sum + (instance.resolvedAt!.getTime() - instance.triggeredAt.getTime())
      );
    }, 0);

    return totalTime / resolvedInstances.length / (1000 * 60); // minutos
  }

  private calculateFalsePositiveRate(instances: AlertInstance[]): number {
    const totalInstances = instances.length;
    if (totalInstances === 0) return 0;

    const falsePositives = instances.filter(
      (i) => i.metrics?.falsePositive
    ).length;
    return (falsePositives / totalInstances) * 100;
  }

  private getTopAlerts(): Array<{
    alertId: string;
    name: string;
    count: number;
    lastTriggered: Date;
  }> {
    const alertCounts = new Map<
      string,
      { count: number; lastTriggered: Date }
    >();

    Array.from(this.activeInstances.values()).forEach((instance) => {
      const current = alertCounts.get(instance.alertId) || {
        count: 0,
        lastTriggered: new Date(0),
      };
      current.count++;
      if (instance.triggeredAt > current.lastTriggered) {
        current.lastTriggered = instance.triggeredAt;
      }
      alertCounts.set(instance.alertId, current);
    });

    return Array.from(alertCounts.entries())
      .map(([alertId, data]) => {
        const alert = this.alerts.get(alertId);
        return {
          alertId,
          name: alert?.name || "Unknown",
          count: data.count,
          lastTriggered: data.lastTriggered,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getChannelPerformance(): Array<{
    channelId: string;
    name: string;
    successRate: number;
    avgResponseTime: number;
    errorCount: number;
  }> {
    // Implementación simplificada
    return Array.from(this.channels.values()).map((channel) => ({
      channelId: channel.id,
      name: channel.name,
      successRate: Math.random() * 100, // Simulado
      avgResponseTime: Math.random() * 1000, // Simulado
      errorCount: Math.floor(Math.random() * 10), // Simulado
    }));
  }

  private getEscalationMetrics() {
    const allEscalations = Array.from(this.activeInstances.values()).flatMap(
      (i) => i.escalations
    );

    const escalationsByLevel: Record<number, number> = {};
    allEscalations.forEach((esc) => {
      escalationsByLevel[esc.level] = (escalationsByLevel[esc.level] || 0) + 1;
    });

    const avgEscalationTime =
      allEscalations.length > 0
        ? allEscalations.reduce((sum, esc) => {
            if (esc.completedAt) {
              return (
                sum + (esc.completedAt.getTime() - esc.triggeredAt.getTime())
              );
            }
            return sum;
          }, 0) /
          allEscalations.length /
          (1000 * 60)
        : 0;

    return {
      totalEscalations: allEscalations.length,
      escalationsByLevel,
      avgEscalationTime,
    };
  }

  // Sistema de suscripciones
  private notifySubscribers(event: string, data: any): void {
    this.subscribers.forEach((callback, id) => {
      try {
        callback({ event, data, timestamp: new Date() });
      } catch (error) {
        console.error(`Error notifying subscriber ${id}:`, error);
      }
    });
  }

  public subscribe(id: string, callback: (data: any) => void): void {
    this.subscribers.set(id, callback);
  }

  public unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  public updateConfig(newConfig: Partial<AlertingSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): AlertingSystemConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.stopEvaluationEngine();
    this.alerts.clear();
    this.activeInstances.clear();
    this.channels.clear();
    this.subscribers.clear();
  }
}

// Clases auxiliares
class AlertEvaluationEngine {
  private alertingSystem: AlertingNotificationSystem;

  constructor(alertingSystem: AlertingNotificationSystem) {
    this.alertingSystem = alertingSystem;
  }

  async evaluateAlert(alert: AlertDefinition): Promise<void> {
    // Simular evaluación de métricas
    const metricValue = await this.getMetricValue(alert.condition.metric);
    const shouldTrigger = this.evaluateCondition(alert.condition, metricValue);

    if (shouldTrigger) {
      // Verificar si ya existe una instancia activa
      const existingInstance = Array.from(
        this.alertingSystem["activeInstances"].values()
      ).find((i) => i.alertId === alert.id && i.status === "triggered");

      if (!existingInstance) {
        this.alertingSystem.triggerAlert(alert.id, {
          triggerValue: metricValue,
          threshold: Array.isArray(alert.condition.threshold)
            ? alert.condition.threshold[0]
            : alert.condition.threshold,
          metric: alert.condition.metric,
          timeWindow: alert.condition.timeWindow,
        });
      }
    }
  }

  private async getMetricValue(metric: string): Promise<number> {
    // Simular obtención de métricas desde diferentes fuentes
    const mockMetrics: Record<string, () => number> = {
      error_rate: () => Math.random() * 10, // 0-10%
      avg_response_time: () => 500 + Math.random() * 2000, // 500-2500ms
      disk_usage_percent: () => 70 + Math.random() * 25, // 70-95%
      cpu_usage_percent: () => 30 + Math.random() * 50, // 30-80%
      memory_usage_percent: () => 40 + Math.random() * 40, // 40-80%
      active_users: () => Math.floor(Math.random() * 1000), // 0-1000
      request_count: () => Math.floor(Math.random() * 10000), // 0-10000
    };

    const generator = mockMetrics[metric];
    return generator ? generator() : Math.random() * 100;
  }

  private evaluateCondition(
    condition: AlertCondition,
    value: number | string
  ): boolean {
    const threshold = condition.threshold;

    switch (condition.operator) {
      case "gt":
        return Number(value) > Number(threshold);
      case "lt":
        return Number(value) < Number(threshold);
      case "gte":
        return Number(value) >= Number(threshold);
      case "lte":
        return Number(value) <= Number(threshold);
      case "eq":
        return value === threshold;
      case "ne":
        return value !== threshold;
      case "contains":
        return String(value).includes(String(threshold));
      case "not_contains":
        return !String(value).includes(String(threshold));
      case "in":
        return Array.isArray(threshold) && threshold.includes(String(value));
      case "not_in":
        return Array.isArray(threshold) && !threshold.includes(String(value));
      default:
        return false;
    }
  }
}

class ActionExecutor {
  private alertingSystem: AlertingNotificationSystem;

  constructor(alertingSystem: AlertingNotificationSystem) {
    this.alertingSystem = alertingSystem;
  }

  async executeActions(
    instance: AlertInstance,
    actions: AlertAction[]
  ): Promise<void> {
    for (const action of actions) {
      try {
        const execution = await this.executeAction(instance, action);
        instance.actions.push(execution);

        if (execution.status === "success") {
          instance.metrics.actionSuccess++;
        } else {
          instance.metrics.actionFailures++;
        }
      } catch (error) {
        console.error(`Error executing action ${action.id}:`, error);
        instance.metrics.actionFailures++;
      }
    }
  }

  private async executeAction(
    instance: AlertInstance,
    action: AlertAction
  ): Promise<ActionExecution> {
    const execution: ActionExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionId: action.id,
      executedAt: new Date(),
      status: "pending",
      attempts: 0,
    };

    const startTime = Date.now();

    try {
      execution.status = "running";
      execution.attempts = 1;

      switch (action.type) {
        case "email":
          await this.sendEmail(instance, action.config);
          break;
        case "slack":
          await this.sendSlack(instance, action.config);
          break;
        case "webhook":
          await this.sendWebhook(instance, action.config);
          break;
        case "sms":
          await this.sendSMS(instance, action.config);
          break;
        case "push":
          await this.sendPush(instance, action.config);
          break;
        case "ticket":
          await this.createTicket(instance, action.config);
          break;
        case "auto_remediation":
          await this.executeRemediation(instance, action.config);
          break;
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      execution.status = "success";
      execution.duration = Date.now() - startTime;
    } catch (error) {
      execution.status = "failed";
      execution.lastError =
        error instanceof Error ? error.message : String(error);
      execution.duration = Date.now() - startTime;
    }

    return execution;
  }

  private async sendEmail(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    console.log("📧 Sending email alert:", {
      recipients: config.recipients,
      subject: this.interpolateTemplate(config.subject || "Alert", instance),
      body: this.interpolateTemplate(`Alert: ${instance.message}`, instance),
    });

    // Simular delay de envío
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async sendSlack(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    const message = this.formatSlackMessage(instance, config);
    console.log("💬 Sending Slack alert:", {
      channel: config.channel,
      message,
      mentions: config.mention_users,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async sendWebhook(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    const payload = {
      alert: {
        id: instance.id,
        alertId: instance.alertId,
        severity: instance.severity,
        message: instance.message,
        triggeredAt: instance.triggeredAt,
        context: instance.context,
      },
      ...config.payload,
    };

    console.log("🔗 Sending webhook:", {
      url: config.url,
      method: config.method || "POST",
      payload,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  private async sendSMS(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    const message = this.interpolateTemplate(
      config.message || instance.message,
      instance
    );
    console.log("📱 Sending SMS:", {
      phones: config.phone_numbers,
      message: message.slice(0, 160), // SMS length limit
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async sendPush(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    console.log("🔔 Sending push notification:", {
      appId: config.app_id,
      users: config.user_ids,
      title: config.title || "Alert",
      body: config.body || instance.message,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  private async createTicket(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    console.log("🎫 Creating ticket:", {
      system: config.system,
      project: config.project,
      title: `Alert: ${instance.message}`,
      assignee: config.assignee,
      priority: config.priority || instance.severity,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private async executeRemediation(
    instance: AlertInstance,
    config: ActionConfig
  ): Promise<void> {
    console.log("🔧 Executing auto-remediation:", {
      script: config.script,
      parameters: config.parameters,
      context: instance.context,
    });

    // Simular ejecución de script
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  private interpolateTemplate(
    template: string,
    instance: AlertInstance
  ): string {
    return template
      .replace(/\{\{alert\.name\}\}/g, instance.message)
      .replace(/\{\{alert\.severity\}\}/g, instance.severity)
      .replace(
        /\{\{context\.triggerValue\}\}/g,
        String(instance.context.triggerValue)
      )
      .replace(
        /\{\{context\.threshold\}\}/g,
        String(instance.context.threshold)
      )
      .replace(
        /\{\{context\.affectedResources\}\}/g,
        instance.context.affectedResources.join(", ")
      );
  }

  private formatSlackMessage(
    instance: AlertInstance,
    config: ActionConfig
  ): string {
    const severityEmoji = {
      low: "🟡",
      medium: "🟠",
      high: "🔴",
      critical: "🚨",
    };

    let message = `${
      severityEmoji[instance.severity]
    } *${instance.severity.toUpperCase()} ALERT*\n`;
    message += `*Message:* ${instance.message}\n`;
    message += `*Triggered:* ${instance.triggeredAt.toISOString()}\n`;
    message += `*Metric:* ${instance.context.metric} = ${instance.context.triggerValue}\n`;
    message += `*Threshold:* ${instance.context.threshold}\n`;

    if (instance.context.affectedResources.length > 0) {
      message += `*Affected Resources:* ${instance.context.affectedResources.join(
        ", "
      )}\n`;
    }

    if (config.mention_users && config.mention_users.length > 0) {
      message += `\n${config.mention_users.join(" ")}`;
    }

    if (config.mention_channel) {
      message += "\n<!channel>";
    }

    return message;
  }
}

class EscalationManager {
  private alertingSystem: AlertingNotificationSystem;

  constructor(alertingSystem: AlertingNotificationSystem) {
    this.alertingSystem = alertingSystem;
  }

  scheduleEscalation(instance: AlertInstance, alert: AlertDefinition): void {
    const escalationActions = alert.actions.filter(
      (a) => a.type === "escalation"
    );

    escalationActions.forEach((action) => {
      if (action.config.escalation_chain) {
        this.processEscalationChain(instance, action.config.escalation_chain);
      }
    });
  }

  private processEscalationChain(
    instance: AlertInstance,
    chain: EscalationLevel[]
  ): void {
    chain.forEach((level) => {
      setTimeout(() => {
        // Verificar si la alerta aún está activa
        if (instance.status === "triggered") {
          this.executeEscalationLevel(instance, level);
        }
      }, level.delay * 60 * 1000);
    });
  }

  private async executeEscalationLevel(
    instance: AlertInstance,
    level: EscalationLevel
  ): Promise<void> {
    const escalation: EscalationExecution = {
      id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: level.level,
      triggeredAt: new Date(),
      status: "running",
      actions: [],
    };

    instance.escalations.push(escalation);
    instance.metrics.escalationLevel = Math.max(
      instance.metrics.escalationLevel,
      level.level
    );

    try {
      // Ejecutar acciones de escalación
      const actionExecutor = new ActionExecutor(this.alertingSystem);
      await actionExecutor.executeActions(instance, level.actions);

      escalation.status = "completed";
      escalation.completedAt = new Date();
    } catch (error) {
      escalation.status = "failed";
      console.error(`Escalation level ${level.level} failed:`, error);
    }
  }
}

// Hook personalizado para usar el sistema de alertas
export const useAlertingSystem = (config?: Partial<AlertingSystemConfig>) => {
  const [alertingSystem] = useState(
    () => new AlertingNotificationSystem(config)
  );
  const [alerts, setAlerts] = useState<AlertDefinition[]>(
    alertingSystem.getAllAlerts()
  );
  const [activeAlerts, setActiveAlerts] = useState<AlertInstance[]>(
    alertingSystem.getActiveAlerts()
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    alertingSystem.getAllChannels()
  );
  const [analytics, setAnalytics] = useState<AlertingAnalytics>(
    alertingSystem.getAnalytics()
  );

  useEffect(() => {
    const id = `alerting_system_${Date.now()}`;

    alertingSystem.subscribe(id, (update) => {
      switch (update.event) {
        case "alert_created":
        case "alert_updated":
        case "alert_deleted":
          setAlerts(alertingSystem.getAllAlerts());
          break;
        case "alert_triggered":
        case "alert_acknowledged":
        case "alert_resolved":
          setActiveAlerts(alertingSystem.getActiveAlerts());
          setAnalytics(alertingSystem.getAnalytics());
          break;
        case "channel_created":
        case "channel_updated":
        case "channel_deleted":
          setChannels(alertingSystem.getAllChannels());
          break;
      }
    });

    // Actualizar analytics periódicamente
    const interval = setInterval(() => {
      setAnalytics(alertingSystem.getAnalytics());
      setActiveAlerts(alertingSystem.getActiveAlerts());
    }, 30000);

    return () => {
      alertingSystem.unsubscribe(id);
      clearInterval(interval);
    };
  }, [alertingSystem]);

  const createAlert = useCallback(
    (alert: Omit<AlertDefinition, "id" | "createdAt" | "updatedAt">) => {
      return alertingSystem.createAlert(alert);
    },
    [alertingSystem]
  );

  const updateAlert = useCallback(
    (id: string, updates: Partial<AlertDefinition>) => {
      return alertingSystem.updateAlert(id, updates);
    },
    [alertingSystem]
  );

  const deleteAlert = useCallback(
    (id: string) => {
      return alertingSystem.deleteAlert(id);
    },
    [alertingSystem]
  );

  const triggerAlert = useCallback(
    (alertId: string, context: Partial<AlertContext>, message?: string) => {
      return alertingSystem.triggerAlert(alertId, context, message);
    },
    [alertingSystem]
  );

  const acknowledgeAlert = useCallback(
    (
      instanceId: string,
      acknowledgedBy: string,
      comment?: string,
      duration?: number
    ) => {
      return alertingSystem.acknowledgeAlert(
        instanceId,
        acknowledgedBy,
        comment,
        duration
      );
    },
    [alertingSystem]
  );

  const resolveAlert = useCallback(
    (instanceId: string, comment?: string) => {
      return alertingSystem.resolveAlert(instanceId, comment);
    },
    [alertingSystem]
  );

  const createChannel = useCallback(
    (channel: Omit<NotificationChannel, "id" | "createdAt" | "updatedAt">) => {
      return alertingSystem.createChannel(channel);
    },
    [alertingSystem]
  );

  const updateChannel = useCallback(
    (id: string, updates: Partial<NotificationChannel>) => {
      return alertingSystem.updateChannel(id, updates);
    },
    [alertingSystem]
  );

  const deleteChannel = useCallback(
    (id: string) => {
      return alertingSystem.deleteChannel(id);
    },
    [alertingSystem]
  );

  return {
    alerts,
    activeAlerts,
    channels,
    analytics,
    createAlert,
    updateAlert,
    deleteAlert,
    triggerAlert,
    acknowledgeAlert,
    resolveAlert,
    createChannel,
    updateChannel,
    deleteChannel,
    getAlert: (id: string) => alertingSystem.getAlert(id),
    updateConfig: (config: Partial<AlertingSystemConfig>) =>
      alertingSystem.updateConfig(config),
    getConfig: () => alertingSystem.getConfig(),
  };
};
