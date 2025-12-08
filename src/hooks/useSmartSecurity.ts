import { useState, useEffect, useCallback, useRef } from "react";

// Interfaces para el sistema de seguridad inteligente y detección de anomalías
export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
  timestamp: Date;
  source: ThreatSource;
  target: ThreatTarget;
  indicators: ThreatIndicator[];
  context: SecurityContext;
  mitigation_actions: MitigationAction[];
  status:
    | "detected"
    | "investigating"
    | "mitigated"
    | "resolved"
    | "false_positive";
  analyst_notes?: string;
  resolution_time?: number; // minutes
  business_impact: BusinessImpact;
}

export interface ThreatType {
  category:
    | "malware"
    | "phishing"
    | "ddos"
    | "data_breach"
    | "insider_threat"
    | "fraud"
    | "account_takeover"
    | "injection"
    | "privilege_escalation"
    | "anomalous_behavior";
  subcategory: string;
  attack_vector: string;
  kill_chain_phase:
    | "reconnaissance"
    | "initial_access"
    | "execution"
    | "persistence"
    | "privilege_escalation"
    | "defense_evasion"
    | "credential_access"
    | "discovery"
    | "lateral_movement"
    | "collection"
    | "exfiltration"
    | "impact";
  mitre_technique?: string; // MITRE ATT&CK technique ID
}

export interface ThreatSource {
  ip_addresses: string[];
  user_agents: string[];
  geographic_location?: {
    country: string;
    region: string;
    city: string;
    coordinates: { lat: number; lng: number };
  };
  device_fingerprint?: string;
  reputation_score: number; // 0-1 (0 = malicious, 1 = trusted)
  threat_intelligence: {
    known_malicious: boolean;
    ioc_matches: string[]; // Indicators of Compromise
    threat_actor?: string;
    campaign?: string;
  };
}

export interface ThreatTarget {
  user_id?: string;
  asset_id?: string;
  resource_type:
    | "user_account"
    | "application"
    | "database"
    | "api_endpoint"
    | "file_system"
    | "network"
    | "infrastructure";
  criticality: "low" | "medium" | "high" | "critical";
  data_classification: "public" | "internal" | "confidential" | "restricted";
  affected_systems: string[];
}

export interface ThreatIndicator {
  type:
    | "behavioral"
    | "network"
    | "host"
    | "application"
    | "user"
    | "file"
    | "registry"
    | "process";
  indicator: string;
  value: any;
  confidence: number;
  severity: number;
  description: string;
  first_seen: Date;
  last_seen: Date;
  frequency: number;
}

export interface SecurityContext {
  session_id?: string;
  request_metadata: {
    headers: Record<string, string>;
    parameters: Record<string, any>;
    body_size?: number;
    method: string;
    endpoint: string;
  };
  user_context: {
    authentication_method?: string;
    role: string;
    permissions: string[];
    last_login: Date;
    login_history: LoginEvent[];
  };
  environment: {
    timestamp: Date;
    server_info: string;
    network_segment: string;
    security_controls: string[];
  };
  related_events: RelatedSecurityEvent[];
}

export interface LoginEvent {
  timestamp: Date;
  ip_address: string;
  user_agent: string;
  success: boolean;
  failure_reason?: string;
  geographic_location?: any;
}

export interface RelatedSecurityEvent {
  event_id: string;
  event_type: string;
  timestamp: Date;
  correlation_score: number;
  description: string;
}

export interface MitigationAction {
  id: string;
  type:
    | "block_ip"
    | "quarantine_user"
    | "revoke_session"
    | "enable_mfa"
    | "escalate_alert"
    | "create_ticket"
    | "run_script"
    | "isolate_system"
    | "backup_data"
    | "notify_user";
  description: string;
  automated: boolean;
  executed: boolean;
  execution_time?: Date;
  effectiveness: number; // 0-1
  side_effects: string[];
  rollback_possible: boolean;
  parameters: Record<string, any>;
}

export interface BusinessImpact {
  severity: "negligible" | "minor" | "moderate" | "major" | "catastrophic";
  affected_users: number;
  revenue_impact: number;
  compliance_impact: string[];
  reputation_risk: "low" | "medium" | "high";
  operational_impact: string;
  recovery_time_estimate: number; // hours
}

export interface AnomalyDetection {
  id: string;
  algorithm:
    | "isolation_forest"
    | "one_class_svm"
    | "local_outlier_factor"
    | "dbscan"
    | "statistical"
    | "lstm_autoencoder"
    | "ensemble";
  model_version: string;
  training_data: {
    start_date: Date;
    end_date: Date;
    sample_count: number;
    features: string[];
  };
  anomaly_score: number; // 0-1
  threshold: number;
  confidence: number;
  feature_contributions: Array<{
    feature: string;
    contribution: number;
    normal_range: [number, number];
    observed_value: number;
  }>;
  temporal_context: {
    time_of_day_factor: number;
    day_of_week_factor: number;
    seasonal_factor: number;
    trend_factor: number;
  };
  similar_anomalies: string[];
  explanation: string;
}

export interface UserBehaviorProfile {
  user_id: string;
  profile_created: Date;
  last_updated: Date;
  behavioral_patterns: BehavioralPattern[];
  risk_score: number; // 0-1
  baseline_metrics: BaselineMetrics;
  anomaly_history: AnomalyEvent[];
  trust_level: "untrusted" | "low" | "medium" | "high" | "verified";
  adaptive_thresholds: Record<string, AdaptiveThreshold>;
}

export interface BehavioralPattern {
  pattern_type:
    | "login_times"
    | "access_patterns"
    | "navigation_behavior"
    | "data_access"
    | "transaction_patterns"
    | "device_usage"
    | "location_patterns";
  pattern_data: Record<string, any>;
  confidence: number;
  last_observed: Date;
  frequency: number;
  seasonal_variation: boolean;
  anomaly_indicators: string[];
}

export interface BaselineMetrics {
  average_session_duration: number;
  typical_login_times: Array<{ hour: number; frequency: number }>;
  common_ip_addresses: Array<{
    ip: string;
    frequency: number;
    last_seen: Date;
  }>;
  usual_devices: Array<{
    fingerprint: string;
    frequency: number;
    last_seen: Date;
  }>;
  access_patterns: Array<{
    resource: string;
    frequency: number;
    typical_times: number[];
  }>;
  transaction_volumes: {
    daily_average: number;
    weekly_pattern: number[];
    monthly_trend: number;
  };
  geographic_locations: Array<{
    location: string;
    frequency: number;
    radius: number;
  }>;
}

export interface AnomalyEvent {
  id: string;
  timestamp: Date;
  anomaly_type: string;
  severity: number;
  description: string;
  resolved: boolean;
  resolution_method?: string;
  false_positive: boolean;
  feedback_provided: boolean;
}

export interface AdaptiveThreshold {
  metric: string;
  current_threshold: number;
  adjustment_factor: number;
  last_adjustment: Date;
  performance_metrics: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
}

export interface FraudDetectionModel {
  id: string;
  name: string;
  type:
    | "rule_based"
    | "machine_learning"
    | "deep_learning"
    | "ensemble"
    | "graph_neural_network";
  algorithm: string;
  version: string;
  accuracy_metrics: {
    precision: number;
    recall: number;
    f1_score: number;
    auc_roc: number;
    false_positive_rate: number;
    false_negative_rate: number;
  };
  training_data: {
    legitimate_transactions: number;
    fraudulent_transactions: number;
    features_used: string[];
    training_period: { start: Date; end: Date };
    last_retrained: Date;
  };
  deployment_info: {
    environment: "staging" | "production";
    deployment_date: Date;
    performance_monitoring: boolean;
    auto_retraining: boolean;
  };
  interpretability: {
    feature_importance: Array<{ feature: string; importance: number }>;
    decision_boundaries: Record<string, any>;
    explanation_available: boolean;
  };
}

export interface FraudTransaction {
  id: string;
  user_id: string;
  timestamp: Date;
  amount: number;
  currency: string;
  transaction_type: string;
  merchant?: string;
  location?: {
    country: string;
    city: string;
    coordinates: { lat: number; lng: number };
  };
  device_info: {
    fingerprint: string;
    type: string;
    os: string;
    browser: string;
  };
  risk_factors: RiskFactor[];
  fraud_score: number; // 0-1
  model_predictions: Array<{
    model_id: string;
    score: number;
    confidence: number;
    reasoning: string[];
  }>;
  decision: "approve" | "decline" | "review" | "challenge";
  actual_outcome?: "legitimate" | "fraudulent";
  investigation_notes?: string;
  interacted?: boolean;
}

export interface RiskFactor {
  factor_type:
    | "velocity"
    | "location"
    | "device"
    | "behavior"
    | "network"
    | "temporal"
    | "amount"
    | "merchant";
  factor_name: string;
  risk_level: number; // 0-1
  description: string;
  evidence: any;
  weight: number;
}

export interface SecurityAnalytics {
  threat_statistics: {
    total_threats_detected: number;
    threats_by_severity: Record<string, number>;
    threats_by_type: Record<string, number>;
    resolution_times: {
      average: number;
      median: number;
      percentile_95: number;
    };
    false_positive_rate: number;
    threat_trends: Array<{
      date: Date;
      count: number;
      severity_distribution: Record<string, number>;
    }>;
  };
  anomaly_statistics: {
    total_anomalies: number;
    anomalies_by_type: Record<string, number>;
    model_performance: Array<{
      model_id: string;
      accuracy: number;
      precision: number;
      recall: number;
      last_evaluation: Date;
    }>;
    threshold_adjustments: number;
    user_feedback_accuracy: number;
  };
  fraud_statistics: {
    total_transactions_analyzed: number;
    fraud_detected: number;
    fraud_prevented_value: number;
    false_positive_impact: number;
    model_accuracy: number;
    avg_detection_time: number;
    fraud_trends: Array<{
      date: Date;
      legitimate: number;
      fraudulent: number;
      prevented_loss: number;
    }>;
  };
  security_posture: {
    overall_risk_score: number;
    threat_exposure: number;
    control_effectiveness: number;
    compliance_score: number;
    improvement_recommendations: string[];
  };
}

export interface SecurityConfig {
  threat_detection: {
    enabled: boolean;
    real_time_analysis: boolean;
    threat_intelligence_feeds: string[];
    automated_response: boolean;
    escalation_thresholds: Record<string, number>;
    ml_models_enabled: string[];
  };
  anomaly_detection: {
    enabled: boolean;
    algorithms: string[];
    sensitivity_level: "low" | "medium" | "high";
    adaptive_thresholds: boolean;
    user_behavior_profiling: boolean;
    temporal_analysis: boolean;
    feature_engineering: boolean;
  };
  fraud_prevention: {
    enabled: boolean;
    real_time_scoring: boolean;
    transaction_monitoring: boolean;
    velocity_checks: boolean;
    geolocation_analysis: boolean;
    device_fingerprinting: boolean;
    ensemble_models: boolean;
  };
  incident_response: {
    automated_containment: boolean;
    notification_channels: string[];
    escalation_matrix: Record<string, string[]>;
    forensic_logging: boolean;
    backup_triggers: boolean;
  };
  privacy_compliance: {
    data_anonymization: boolean;
    retention_policies: Record<string, number>;
    consent_management: boolean;
    audit_logging: boolean;
    data_sovereignty: boolean;
  };
  integration: {
    siem_enabled: boolean;
    soar_enabled: boolean;
    threat_intel_platforms: string[];
    external_apis: string[];
    webhook_notifications: boolean;
  };
}

// Clase principal del sistema de seguridad inteligente
class SmartSecurityAnomalySystem {
  private threats: Map<string, SecurityThreat>;
  private anomalies: Map<string, AnomalyDetection>;
  private userProfiles: Map<string, UserBehaviorProfile>;
  private fraudModels: Map<string, FraudDetectionModel>;
  private fraudTransactions: Map<string, FraudTransaction>;
  private config: SecurityConfig;
  private subscribers: Map<string, (data: any) => void>;
  private isRunning: boolean;
  private analysisInterval: NodeJS.Timeout | null;
  private threatDetector: ThreatDetector;
  private anomalyDetector: AnomalyDetector;
  private fraudDetector: FraudDetector;
  private responseOrchestrator: ResponseOrchestrator;
  private behaviorAnalyzer: BehaviorAnalyzer;

  constructor(config?: Partial<SecurityConfig>) {
    this.threats = new Map();
    this.anomalies = new Map();
    this.userProfiles = new Map();
    this.fraudModels = new Map();
    this.fraudTransactions = new Map();
    this.config = this.getDefaultConfig(config);
    this.subscribers = new Map();
    this.isRunning = false;
    this.analysisInterval = null;
    this.threatDetector = new ThreatDetector(this);
    this.anomalyDetector = new AnomalyDetector(this);
    this.fraudDetector = new FraudDetector(this);
    this.responseOrchestrator = new ResponseOrchestrator(this);
    this.behaviorAnalyzer = new BehaviorAnalyzer(this);

    this.initializeDefaultModels();
    this.initializeUserProfiles();
    this.startSecurityEngine();
  }

  private getDefaultConfig(
    userConfig?: Partial<SecurityConfig>
  ): SecurityConfig {
    return {
      threat_detection: {
        enabled: true,
        real_time_analysis: true,
        threat_intelligence_feeds: ["misp", "otx", "virustotal"],
        automated_response: true,
        escalation_thresholds: {
          low: 0.3,
          medium: 0.6,
          high: 0.8,
          critical: 0.95,
        },
        ml_models_enabled: ["isolation_forest", "neural_network", "ensemble"],
      },
      anomaly_detection: {
        enabled: true,
        algorithms: ["isolation_forest", "one_class_svm", "lstm_autoencoder"],
        sensitivity_level: "medium",
        adaptive_thresholds: true,
        user_behavior_profiling: true,
        temporal_analysis: true,
        feature_engineering: true,
      },
      fraud_prevention: {
        enabled: true,
        real_time_scoring: true,
        transaction_monitoring: true,
        velocity_checks: true,
        geolocation_analysis: true,
        device_fingerprinting: true,
        ensemble_models: true,
      },
      incident_response: {
        automated_containment: true,
        notification_channels: ["email", "slack", "sms"],
        escalation_matrix: {
          low: ["security_analyst"],
          medium: ["security_analyst", "team_lead"],
          high: ["security_analyst", "team_lead", "security_manager"],
          critical: [
            "security_analyst",
            "team_lead",
            "security_manager",
            "ciso",
          ],
        },
        forensic_logging: true,
        backup_triggers: true,
      },
      privacy_compliance: {
        data_anonymization: true,
        retention_policies: {
          security_logs: 2555, // 7 years in days
          user_behavior: 365, // 1 year
          fraud_data: 2555, // 7 years
          threat_data: 1095, // 3 years
        },
        consent_management: true,
        audit_logging: true,
        data_sovereignty: true,
      },
      integration: {
        siem_enabled: true,
        soar_enabled: true,
        threat_intel_platforms: ["misp", "taxii"],
        external_apis: ["virustotal", "shodan", "abuse_ipdb"],
        webhook_notifications: true,
      },
      ...userConfig,
    };
  }

  private initializeDefaultModels(): void {
    const defaultFraudModels: FraudDetectionModel[] = [
      {
        id: "gradient_boosting_v3",
        name: "Gradient Boosting Fraud Detector v3",
        type: "machine_learning",
        algorithm: "xgboost",
        version: "3.1.0",
        accuracy_metrics: {
          precision: 0.89,
          recall: 0.85,
          f1_score: 0.87,
          auc_roc: 0.93,
          false_positive_rate: 0.02,
          false_negative_rate: 0.15,
        },
        training_data: {
          legitimate_transactions: 2500000,
          fraudulent_transactions: 15000,
          features_used: [
            "transaction_amount",
            "merchant_category",
            "time_since_last_transaction",
            "velocity_1h",
            "velocity_24h",
            "location_risk",
            "device_reputation",
            "user_age",
            "account_balance",
            "transaction_frequency",
          ],
          training_period: {
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          last_retrained: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        deployment_info: {
          environment: "production",
          deployment_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          performance_monitoring: true,
          auto_retraining: true,
        },
        interpretability: {
          feature_importance: [
            { feature: "transaction_amount", importance: 0.25 },
            { feature: "velocity_24h", importance: 0.18 },
            { feature: "location_risk", importance: 0.15 },
            { feature: "device_reputation", importance: 0.12 },
            { feature: "time_since_last_transaction", importance: 0.1 },
          ],
          decision_boundaries: {},
          explanation_available: true,
        },
      },
      {
        id: "neural_network_v2",
        name: "Deep Neural Network Fraud Detector v2",
        type: "deep_learning",
        algorithm: "feedforward_neural_network",
        version: "2.3.1",
        accuracy_metrics: {
          precision: 0.92,
          recall: 0.81,
          f1_score: 0.86,
          auc_roc: 0.94,
          false_positive_rate: 0.015,
          false_negative_rate: 0.19,
        },
        training_data: {
          legitimate_transactions: 3000000,
          fraudulent_transactions: 18000,
          features_used: [
            "amount_zscore",
            "merchant_risk_score",
            "temporal_features",
            "user_behavior_embedding",
            "network_features",
            "sequence_features",
          ],
          training_period: {
            start: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          last_retrained: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        deployment_info: {
          environment: "production",
          deployment_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          performance_monitoring: true,
          auto_retraining: true,
        },
        interpretability: {
          feature_importance: [
            { feature: "amount_zscore", importance: 0.22 },
            { feature: "user_behavior_embedding", importance: 0.2 },
            { feature: "merchant_risk_score", importance: 0.18 },
            { feature: "temporal_features", importance: 0.16 },
            { feature: "network_features", importance: 0.14 },
          ],
          decision_boundaries: {},
          explanation_available: false,
        },
      },
    ];

    defaultFraudModels.forEach((model) => {
      this.fraudModels.set(model.id, model);
    });
  }

  private initializeUserProfiles(): void {
    // Create sample user behavior profiles
    const sampleProfiles = this.generateSampleUserProfiles(100);
    sampleProfiles.forEach((profile) => {
      this.userProfiles.set(profile.user_id, profile);
    });
  }

  private generateSampleUserProfiles(count: number): UserBehaviorProfile[] {
    const profiles: UserBehaviorProfile[] = [];

    for (let i = 0; i < count; i++) {
      const userId = `user_${i + 2000}`;
      const profile: UserBehaviorProfile = {
        user_id: userId,
        profile_created: new Date(
          Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000
        ),
        last_updated: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ),
        behavioral_patterns: [
          {
            pattern_type: "login_times",
            pattern_data: {
              preferred_hours: [9, 10, 11, 14, 15, 16],
              weekend_activity: Math.random() > 0.7,
              timezone_consistency: Math.random() > 0.1,
            },
            confidence: 0.8 + Math.random() * 0.2,
            last_observed: new Date(
              Date.now() - Math.random() * 24 * 60 * 60 * 1000
            ),
            frequency: Math.random(),
            seasonal_variation: Math.random() > 0.6,
            anomaly_indicators: [],
          },
          {
            pattern_type: "transaction_patterns",
            pattern_data: {
              avg_amount: 50 + Math.random() * 500,
              frequency_per_week: 2 + Math.random() * 10,
              preferred_merchants: ["grocery", "gas", "restaurant"],
              spending_categories: ["essentials", "entertainment"],
            },
            confidence: 0.7 + Math.random() * 0.3,
            last_observed: new Date(
              Date.now() - Math.random() * 48 * 60 * 60 * 1000
            ),
            frequency: Math.random(),
            seasonal_variation: Math.random() > 0.5,
            anomaly_indicators: [],
          },
        ],
        risk_score: Math.random() * 0.3, // Most users are low risk
        baseline_metrics: {
          average_session_duration: 15 + Math.random() * 45, // 15-60 minutes
          typical_login_times: [
            { hour: 9, frequency: 0.3 },
            { hour: 14, frequency: 0.4 },
            { hour: 19, frequency: 0.3 },
          ],
          common_ip_addresses: [
            {
              ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
              frequency: 0.8,
              last_seen: new Date(
                Date.now() - Math.random() * 24 * 60 * 60 * 1000
              ),
            },
          ],
          usual_devices: [
            {
              fingerprint: `device_${Math.random().toString(36).substr(2, 9)}`,
              frequency: 0.9,
              last_seen: new Date(
                Date.now() - Math.random() * 24 * 60 * 60 * 1000
              ),
            },
          ],
          access_patterns: [
            {
              resource: "/dashboard",
              frequency: 0.8,
              typical_times: [9, 14, 19],
            },
            { resource: "/profile", frequency: 0.3, typical_times: [10, 15] },
          ],
          transaction_volumes: {
            daily_average: 2 + Math.random() * 8,
            weekly_pattern: [0.8, 1.0, 1.1, 1.2, 1.3, 0.9, 0.7],
            monthly_trend: 1.0 + (Math.random() - 0.5) * 0.2,
          },
          geographic_locations: [
            {
              location: "Home City",
              frequency: 0.85,
              radius: 10, // km
            },
          ],
        },
        anomaly_history: [],
        trust_level: ["low", "medium", "high"][
          Math.floor(Math.random() * 3)
        ] as any,
        adaptive_thresholds: {
          login_velocity: {
            metric: "logins_per_hour",
            current_threshold: 5,
            adjustment_factor: 1.0,
            last_adjustment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            performance_metrics: {
              true_positives: 8,
              false_positives: 2,
              true_negatives: 150,
              false_negatives: 1,
            },
          },
        },
      };

      profiles.push(profile);
    }

    return profiles;
  }

  private startSecurityEngine(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.analysisInterval = setInterval(() => {
      this.performSecurityAnalysis();
    }, 60000); // Analyze every minute

    console.log("🛡️ Smart Security & Anomaly Detection Engine started");
  }

  private stopSecurityEngine(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isRunning = false;
    console.log("⏹️ Smart Security Engine stopped");
  }

  private async performSecurityAnalysis(): Promise<void> {
    try {
      // Threat detection
      if (this.config.threat_detection.enabled) {
        await this.threatDetector.detectThreats();
      }

      // Anomaly detection
      if (this.config.anomaly_detection.enabled) {
        await this.anomalyDetector.detectAnomalies();
      }

      // Fraud detection
      if (this.config.fraud_prevention.enabled) {
        await this.fraudDetector.analyzeFraud();
      }

      // Update user behavior profiles
      await this.behaviorAnalyzer.updateProfiles();

      // Process automated responses
      await this.responseOrchestrator.processResponses();
    } catch (error) {
      console.error("Error in security analysis:", error);
    }
  }

  // Métodos públicos
  public async analyzeSecurityEvent(event: {
    type: string;
    source: any;
    target: any;
    context: any;
    timestamp?: Date;
  }): Promise<SecurityThreat | null> {
    const timestamp = event.timestamp || new Date();

    // Detect threats in the event
    const threat = await this.threatDetector.analyzeEvent(event);

    if (threat) {
      this.threats.set(threat.id, threat);

      // Trigger automated response if configured
      if (this.config.incident_response.automated_containment) {
        await this.responseOrchestrator.respondToThreat(threat);
      }

      this.notifySubscribers("threat_detected", threat);
      return threat;
    }

    return null;
  }

  public async analyzeTransaction(transaction: {
    user_id: string;
    amount: number;
    merchant?: string;
    location?: any;
    device_info: any;
    timestamp?: Date;
  }): Promise<FraudTransaction> {
    const fraudTransaction = await this.fraudDetector.analyzeTransaction(
      transaction
    );
    this.fraudTransactions.set(fraudTransaction.id, fraudTransaction);

    if (fraudTransaction.fraud_score > 0.7) {
      this.notifySubscribers("fraud_detected", fraudTransaction);
    }

    return fraudTransaction;
  }

  public async detectUserBehaviorAnomaly(
    userId: string,
    activity: {
      type: string;
      data: any;
      timestamp?: Date;
    }
  ): Promise<AnomalyDetection | null> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      // Create new profile for new user
      await this.behaviorAnalyzer.createUserProfile(userId, activity);
      return null;
    }

    const anomaly = await this.anomalyDetector.detectUserAnomaly(
      userId,
      activity
    );

    if (anomaly) {
      this.anomalies.set(anomaly.id, anomaly);

      // Update user profile with anomaly
      profile.anomaly_history.push({
        id: anomaly.id,
        timestamp: activity.timestamp || new Date(),
        anomaly_type: activity.type,
        severity: anomaly.anomaly_score,
        description: anomaly.explanation,
        resolved: false,
        false_positive: false,
        feedback_provided: false,
      });

      this.notifySubscribers("anomaly_detected", { userId, anomaly });
      return anomaly;
    }

    return null;
  }

  public async updateThreatStatus(
    threatId: string,
    status: SecurityThreat["status"],
    notes?: string
  ): Promise<boolean> {
    const threat = this.threats.get(threatId);
    if (!threat) return false;

    threat.status = status;
    if (notes) {
      threat.analyst_notes = notes;
    }

    if (status === "resolved" || status === "mitigated") {
      threat.resolution_time =
        (Date.now() - threat.timestamp.getTime()) / (1000 * 60); // minutes
    }

    this.notifySubscribers("threat_updated", threat);
    return true;
  }

  public async provideFeedback(
    type: "threat" | "anomaly" | "fraud",
    id: string,
    feedback: {
      accurate: boolean;
      severity_correct: boolean;
      comments?: string;
    }
  ): Promise<void> {
    switch (type) {
      case "threat":
        const threat = this.threats.get(id);
        if (threat && !feedback.accurate) {
          threat.status = "false_positive";
        }
        break;

      case "anomaly":
        const anomaly = this.anomalies.get(id);
        if (anomaly) {
          // Update model based on feedback
          await this.anomalyDetector.updateModel(id, feedback);
        }
        break;

      case "fraud":
        const fraudTx = this.fraudTransactions.get(id);
        if (fraudTx) {
          fraudTx.actual_outcome = feedback.accurate
            ? "fraudulent"
            : "legitimate";
          // Retrain models with this feedback
          await this.fraudDetector.updateModel(id, feedback);
        }
        break;
    }

    this.notifySubscribers("feedback_provided", { type, id, feedback });
  }

  public getActiveThreats(): SecurityThreat[] {
    return Array.from(this.threats.values())
      .filter(
        (threat) =>
          threat.status === "detected" || threat.status === "investigating"
      )
      .sort((a, b) => {
        // Sort by severity first, then by timestamp
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff =
          severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  public getRecentAnomalies(hours = 24): AnomalyDetection[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.anomalies.values())
      .filter((anomaly) => new Date() >= cutoff)
      .sort((a, b) => b.anomaly_score - a.anomaly_score);
  }

  public getHighRiskTransactions(): FraudTransaction[] {
    return Array.from(this.fraudTransactions.values())
      .filter((tx) => tx.fraud_score > 0.5)
      .sort((a, b) => b.fraud_score - a.fraud_score);
  }

  public getUserRiskProfile(userId: string): UserBehaviorProfile | undefined {
    return this.userProfiles.get(userId);
  }

  public getSecurityAnalytics(): SecurityAnalytics {
    const threats = Array.from(this.threats.values());
    const anomalies = Array.from(this.anomalies.values());
    const fraudTransactions = Array.from(this.fraudTransactions.values());

    // Threat statistics
    const threatsBySeverity: Record<string, number> = {};
    const threatsByType: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedThreats = 0;

    threats.forEach((threat) => {
      threatsBySeverity[threat.severity] =
        (threatsBySeverity[threat.severity] || 0) + 1;
      threatsByType[threat.type.category] =
        (threatsByType[threat.type.category] || 0) + 1;

      if (threat.resolution_time) {
        totalResolutionTime += threat.resolution_time;
        resolvedThreats++;
      }
    });

    const avgResolutionTime =
      resolvedThreats > 0 ? totalResolutionTime / resolvedThreats : 0;

    // Anomaly statistics
    const anomaliesByType: Record<string, number> = {};
    anomalies.forEach((anomaly) => {
      anomaliesByType[anomaly.algorithm] =
        (anomaliesByType[anomaly.algorithm] || 0) + 1;
    });

    // Fraud statistics
    const fraudulent = fraudTransactions.filter(
      (tx) => tx.fraud_score > 0.5
    ).length;
    const fraudPreventedValue = fraudTransactions
      .filter((tx) => tx.fraud_score > 0.5 && tx.decision === "decline")
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      threat_statistics: {
        total_threats_detected: threats.length,
        threats_by_severity: threatsBySeverity,
        threats_by_type: threatsByType,
        resolution_times: {
          average: avgResolutionTime,
          median: avgResolutionTime, // Simplified
          percentile_95: avgResolutionTime * 1.5, // Simplified
        },
        false_positive_rate:
          threats.filter((t) => t.status === "false_positive").length /
          Math.max(threats.length, 1),
        threat_trends: this.calculateThreatTrends(),
      },
      anomaly_statistics: {
        total_anomalies: anomalies.length,
        anomalies_by_type: anomaliesByType,
        model_performance: Array.from(this.fraudModels.values()).map(
          (model) => ({
            model_id: model.id,
            accuracy: model.accuracy_metrics.precision,
            precision: model.accuracy_metrics.precision,
            recall: model.accuracy_metrics.recall,
            last_evaluation: model.training_data.last_retrained,
          })
        ),
        threshold_adjustments: 15, // Simplified
        user_feedback_accuracy: 0.87, // Simplified
      },
      fraud_statistics: {
        total_transactions_analyzed: fraudTransactions.length,
        fraud_detected: fraudulent,
        fraud_prevented_value: fraudPreventedValue,
        false_positive_impact:
          fraudTransactions.filter(
            (tx) => tx.actual_outcome === "legitimate" && tx.fraud_score > 0.5
          ).length * 100, // Simplified
        model_accuracy: 0.89, // Average from models
        avg_detection_time: 150, // ms, simplified
        fraud_trends: this.calculateFraudTrends(),
      },
      security_posture: {
        overall_risk_score: this.calculateOverallRiskScore(),
        threat_exposure: this.calculateThreatExposure(),
        control_effectiveness: this.calculateControlEffectiveness(),
        compliance_score: 0.92, // Simplified
        improvement_recommendations: [
          "Increase threat intelligence feed coverage",
          "Implement additional behavioral analytics",
          "Enhance automated response capabilities",
          "Improve user training on security awareness",
        ],
      },
    };
  }

  private calculateThreatTrends(): Array<{
    date: Date;
    count: number;
    severity_distribution: Record<string, number>;
  }> {
    const trends = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      // Last 7 days
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayThreats = Array.from(this.threats.values()).filter(
        (threat) => threat.timestamp >= dayStart && threat.timestamp < dayEnd
      );

      const severityDist: Record<string, number> = {};
      dayThreats.forEach((threat) => {
        severityDist[threat.severity] =
          (severityDist[threat.severity] || 0) + 1;
      });

      trends.push({
        date: dayStart,
        count: dayThreats.length,
        severity_distribution: severityDist,
      });
    }

    return trends;
  }

  private calculateFraudTrends(): Array<{
    date: Date;
    legitimate: number;
    fraudulent: number;
    prevented_loss: number;
  }> {
    const trends = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      // Last 7 days
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayTransactions = Array.from(
        this.fraudTransactions.values()
      ).filter((tx) => tx.timestamp >= dayStart && tx.timestamp < dayEnd);

      const legitimate = dayTransactions.filter(
        (tx) => tx.fraud_score <= 0.5
      ).length;
      const fraudulent = dayTransactions.filter(
        (tx) => tx.fraud_score > 0.5
      ).length;
      const preventedLoss = dayTransactions
        .filter((tx) => tx.fraud_score > 0.5 && tx.decision === "decline")
        .reduce((sum, tx) => sum + tx.amount, 0);

      trends.push({
        date: dayStart,
        legitimate,
        fraudulent,
        prevented_loss: preventedLoss,
      });
    }

    return trends;
  }

  private calculateOverallRiskScore(): number {
    const activeThreats = this.getActiveThreats();
    const highRiskUsers = Array.from(this.userProfiles.values()).filter(
      (p) => p.risk_score > 0.7
    ).length;
    const totalUsers = this.userProfiles.size;

    const threatScore = Math.min(activeThreats.length / 10, 1); // Normalize to 0-1
    const userRiskScore = totalUsers > 0 ? highRiskUsers / totalUsers : 0;

    return threatScore * 0.6 + userRiskScore * 0.4; // Weighted average
  }

  private calculateThreatExposure(): number {
    const criticalThreats = Array.from(this.threats.values()).filter(
      (t) => t.severity === "critical"
    ).length;
    const highThreats = Array.from(this.threats.values()).filter(
      (t) => t.severity === "high"
    ).length;

    return Math.min((criticalThreats * 0.8 + highThreats * 0.4) / 10, 1);
  }

  private calculateControlEffectiveness(): number {
    const totalThreats = this.threats.size;
    const mitigatedThreats = Array.from(this.threats.values()).filter(
      (t) => t.status === "mitigated" || t.status === "resolved"
    ).length;

    return totalThreats > 0 ? mitigatedThreats / totalThreats : 1;
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

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.stopSecurityEngine();
    this.threats.clear();
    this.anomalies.clear();
    this.userProfiles.clear();
    this.fraudModels.clear();
    this.fraudTransactions.clear();
    this.subscribers.clear();
  }
}

// Clases auxiliares
class ThreatDetector {
  private securitySystem: SmartSecurityAnomalySystem;

  constructor(system: SmartSecurityAnomalySystem) {
    this.securitySystem = system;
  }

  async detectThreats(): Promise<void> {
    console.log("🔍 Scanning for security threats...");
    // Real threat detection logic would go here
  }

  async analyzeEvent(event: any): Promise<SecurityThreat | null> {
    // Simulate threat analysis
    const riskScore = Math.random();

    if (riskScore > 0.7) {
      // High risk event
      return {
        id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: {
          category: "anomalous_behavior",
          subcategory: "suspicious_login",
          attack_vector: "credential_stuffing",
          kill_chain_phase: "initial_access",
        },
        severity:
          riskScore > 0.95 ? "critical" : riskScore > 0.85 ? "high" : "medium",
        confidence: riskScore,
        timestamp: new Date(),
        source: {
          ip_addresses: [`192.168.1.${Math.floor(Math.random() * 255)}`],
          user_agents: [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          ],
          reputation_score: 1 - riskScore,
          threat_intelligence: {
            known_malicious: riskScore > 0.9,
            ioc_matches: [],
            threat_actor: riskScore > 0.95 ? "APT29" : undefined,
          },
        },
        target: {
          resource_type: "user_account",
          criticality: "medium",
          data_classification: "internal",
          affected_systems: ["web_application"],
        },
        indicators: [
          {
            type: "behavioral",
            indicator: "unusual_login_time",
            value: event.timestamp,
            confidence: riskScore,
            severity: riskScore,
            description: "Login attempt outside normal hours",
            first_seen: new Date(),
            last_seen: new Date(),
            frequency: 1,
          },
        ],
        context: {
          request_metadata: {
            headers: event.context?.headers || {},
            parameters: event.context?.parameters || {},
            method: "POST",
            endpoint: "/login",
          },
          user_context: {
            role: "user",
            permissions: ["read"],
            last_login: new Date(Date.now() - 24 * 60 * 60 * 1000),
            login_history: [],
          },
          environment: {
            timestamp: new Date(),
            server_info: "web-server-01",
            network_segment: "dmz",
            security_controls: ["firewall", "ids"],
          },
          related_events: [],
        },
        mitigation_actions: [
          {
            id: "action_1",
            type: "revoke_session",
            description: "Revoke user session",
            automated: true,
            executed: false,
            effectiveness: 0.8,
            side_effects: ["user_inconvenience"],
            rollback_possible: true,
            parameters: { user_id: event.source?.user_id },
          },
        ],
        status: "detected",
        business_impact: {
          severity: "minor",
          affected_users: 1,
          revenue_impact: 0,
          compliance_impact: [],
          reputation_risk: "low",
          operational_impact: "minimal",
          recovery_time_estimate: 0.5,
        },
      };
    }

    return null;
  }
}

class AnomalyDetector {
  private securitySystem: SmartSecurityAnomalySystem;

  constructor(system: SmartSecurityAnomalySystem) {
    this.securitySystem = system;
  }

  async detectAnomalies(): Promise<void> {
    console.log("📊 Analyzing behavioral anomalies...");
    // Anomaly detection logic
  }

  async detectUserAnomaly(
    userId: string,
    activity: any
  ): Promise<AnomalyDetection | null> {
    // Simulate anomaly detection
    const anomalyScore = Math.random();

    if (anomalyScore > 0.6) {
      // Anomaly detected
      return {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        algorithm: "isolation_forest",
        model_version: "2.1.0",
        training_data: {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          sample_count: 10000,
          features: [
            "login_time",
            "session_duration",
            "pages_visited",
            "transaction_amount",
          ],
        },
        anomaly_score: anomalyScore,
        threshold: 0.6,
        confidence: anomalyScore,
        feature_contributions: [
          {
            feature: "login_time",
            contribution: 0.4,
            normal_range: [9, 17],
            observed_value: 23,
          },
          {
            feature: "session_duration",
            contribution: 0.3,
            normal_range: [10, 60],
            observed_value: 180,
          },
        ],
        temporal_context: {
          time_of_day_factor: 0.8,
          day_of_week_factor: 1.0,
          seasonal_factor: 1.0,
          trend_factor: 1.1,
        },
        similar_anomalies: [],
        explanation: `User ${userId} showed unusual ${
          activity.type
        } behavior with anomaly score ${anomalyScore.toFixed(2)}`,
      };
    }

    return null;
  }

  async updateModel(anomalyId: string, feedback: any): Promise<void> {
    console.log(
      `📈 Updating anomaly detection model based on feedback for ${anomalyId}`
    );
    // Model update logic based on feedback
  }
}

class FraudDetector {
  private securitySystem: SmartSecurityAnomalySystem;

  constructor(system: SmartSecurityAnomalySystem) {
    this.securitySystem = system;
  }

  async analyzeFraud(): Promise<void> {
    console.log("💳 Analyzing fraud patterns...");
    // Fraud analysis logic
  }

  async analyzeTransaction(transaction: any): Promise<FraudTransaction> {
    // Simulate fraud scoring
    const fraudScore = Math.random();

    const riskFactors: RiskFactor[] = [
      {
        factor_type: "velocity",
        factor_name: "transaction_velocity",
        risk_level: Math.random(),
        description: "Multiple transactions in short time",
        evidence: { count: 5, timeframe: "1hour" },
        weight: 0.3,
      },
      {
        factor_type: "location",
        factor_name: "geographic_risk",
        risk_level: Math.random(),
        description: "Transaction from high-risk location",
        evidence: { country: "Unknown", risk_score: 0.7 },
        weight: 0.2,
      },
    ];

    return {
      id: `fraud_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: transaction.user_id,
      timestamp: transaction.timestamp || new Date(),
      amount: transaction.amount,
      currency: "USD",
      transaction_type: "purchase",
      merchant: transaction.merchant,
      location: transaction.location,
      device_info: transaction.device_info,
      risk_factors: riskFactors,
      fraud_score: fraudScore,
      model_predictions: [
        {
          model_id: "gradient_boosting_v3",
          score: fraudScore,
          confidence: 0.85,
          reasoning: ["High transaction velocity", "Unusual merchant category"],
        },
      ],
      decision:
        fraudScore > 0.8 ? "decline" : fraudScore > 0.5 ? "review" : "approve",
      interacted: false,
    };
  }

  async updateModel(transactionId: string, feedback: any): Promise<void> {
    console.log(
      `📊 Updating fraud detection model based on feedback for ${transactionId}`
    );
    // Model retraining logic
  }
}

class ResponseOrchestrator {
  private securitySystem: SmartSecurityAnomalySystem;

  constructor(system: SmartSecurityAnomalySystem) {
    this.securitySystem = system;
  }

  async processResponses(): Promise<void> {
    console.log("⚡ Processing automated security responses...");
    // Automated response processing
  }

  async respondToThreat(threat: SecurityThreat): Promise<void> {
    console.log(`🚨 Executing automated response to threat ${threat.id}`);

    // Execute mitigation actions
    for (const action of threat.mitigation_actions) {
      if (action.automated && !action.executed) {
        await this.executeMitigationAction(action);
        action.executed = true;
        action.execution_time = new Date();
      }
    }
  }

  private async executeMitigationAction(
    action: MitigationAction
  ): Promise<void> {
    console.log(`🔧 Executing mitigation action: ${action.type}`);

    switch (action.type) {
      case "block_ip":
        console.log(
          `🚫 Blocking IP addresses: ${action.parameters.ip_addresses}`
        );
        break;
      case "revoke_session":
        console.log(
          `🔐 Revoking session for user: ${action.parameters.user_id}`
        );
        break;
      case "quarantine_user":
        console.log(`⛔ Quarantining user: ${action.parameters.user_id}`);
        break;
      default:
        console.log(`❓ Unknown action type: ${action.type}`);
    }

    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

class BehaviorAnalyzer {
  private securitySystem: SmartSecurityAnomalySystem;

  constructor(system: SmartSecurityAnomalySystem) {
    this.securitySystem = system;
  }

  async updateProfiles(): Promise<void> {
    console.log("👤 Updating user behavior profiles...");
    // Profile update logic
  }

  async createUserProfile(
    userId: string,
    initialActivity: any
  ): Promise<UserBehaviorProfile> {
    const profile: UserBehaviorProfile = {
      user_id: userId,
      profile_created: new Date(),
      last_updated: new Date(),
      behavioral_patterns: [],
      risk_score: 0.1, // New users start with low risk
      baseline_metrics: {
        average_session_duration: 0,
        typical_login_times: [],
        common_ip_addresses: [],
        usual_devices: [],
        access_patterns: [],
        transaction_volumes: {
          daily_average: 0,
          weekly_pattern: [0, 0, 0, 0, 0, 0, 0],
          monthly_trend: 1.0,
        },
        geographic_locations: [],
      },
      anomaly_history: [],
      trust_level: "untrusted",
      adaptive_thresholds: {},
    };

    return profile;
  }
}

// Hook personalizado para usar el sistema de seguridad inteligente
export const useSmartSecurity = (config?: Partial<SecurityConfig>) => {
  const [securitySystem] = useState(
    () => new SmartSecurityAnomalySystem(config)
  );
  const [activeThreats, setActiveThreats] = useState<SecurityThreat[]>(
    securitySystem.getActiveThreats()
  );
  const [recentAnomalies, setRecentAnomalies] = useState<AnomalyDetection[]>(
    securitySystem.getRecentAnomalies()
  );
  const [highRiskTransactions, setHighRiskTransactions] = useState<
    FraudTransaction[]
  >(securitySystem.getHighRiskTransactions());
  const [analytics, setAnalytics] = useState<SecurityAnalytics>(
    securitySystem.getSecurityAnalytics()
  );

  useEffect(() => {
    const id = `security_system_${Date.now()}`;

    securitySystem.subscribe(id, (update) => {
      switch (update.event) {
        case "threat_detected":
        case "threat_updated":
          setActiveThreats(securitySystem.getActiveThreats());
          setAnalytics(securitySystem.getSecurityAnalytics());
          break;
        case "anomaly_detected":
          setRecentAnomalies(securitySystem.getRecentAnomalies());
          setAnalytics(securitySystem.getSecurityAnalytics());
          break;
        case "fraud_detected":
          setHighRiskTransactions(securitySystem.getHighRiskTransactions());
          setAnalytics(securitySystem.getSecurityAnalytics());
          break;
        case "feedback_provided":
          setAnalytics(securitySystem.getSecurityAnalytics());
          break;
      }
    });

    // Actualizar datos periódicamente
    const interval = setInterval(() => {
      setActiveThreats(securitySystem.getActiveThreats());
      setRecentAnomalies(securitySystem.getRecentAnomalies());
      setHighRiskTransactions(securitySystem.getHighRiskTransactions());
      setAnalytics(securitySystem.getSecurityAnalytics());
    }, 30000); // Every 30 seconds

    return () => {
      securitySystem.unsubscribe(id);
      clearInterval(interval);
    };
  }, [securitySystem]);

  const analyzeSecurityEvent = useCallback(
    async (event: any) => {
      return await securitySystem.analyzeSecurityEvent(event);
    },
    [securitySystem]
  );

  const analyzeTransaction = useCallback(
    async (transaction: any) => {
      return await securitySystem.analyzeTransaction(transaction);
    },
    [securitySystem]
  );

  const detectUserBehaviorAnomaly = useCallback(
    async (userId: string, activity: any) => {
      return await securitySystem.detectUserBehaviorAnomaly(userId, activity);
    },
    [securitySystem]
  );

  const updateThreatStatus = useCallback(
    async (
      threatId: string,
      status: SecurityThreat["status"],
      notes?: string
    ) => {
      return await securitySystem.updateThreatStatus(threatId, status, notes);
    },
    [securitySystem]
  );

  const provideFeedback = useCallback(
    async (type: "threat" | "anomaly" | "fraud", id: string, feedback: any) => {
      return await securitySystem.provideFeedback(type, id, feedback);
    },
    [securitySystem]
  );

  return {
    activeThreats,
    recentAnomalies,
    highRiskTransactions,
    analytics,
    analyzeSecurityEvent,
    analyzeTransaction,
    detectUserBehaviorAnomaly,
    updateThreatStatus,
    provideFeedback,
    getUserRiskProfile: (userId: string) =>
      securitySystem.getUserRiskProfile(userId),
    updateConfig: (config: Partial<SecurityConfig>) =>
      securitySystem.updateConfig(config),
    getConfig: () => securitySystem.getConfig(),
  };
};
