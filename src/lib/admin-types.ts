export type AdminPrincipal = {
  adminId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissions: string[];
};

export type AdminPage<T = Record<string, unknown>> = {
  page: number;
  size: number;
  total: number;
  items: T[];
};

export type OperationalReadiness = {
  status: string;
  totalCriticalItems: number;
  staleProviderWebhooks: number;
  stuckTransactions: number;
  complianceReviewTransactions: number;
  criticalReconciliationItems: number;
  incompleteCostValuations: number;
  exhaustedProviderOperations: number;
  settlementItemsNeedingReview: number;
  deadBusinessWebhookDeliveries: number;
  exhaustedNotificationDeliveries: number;
};

export type WorkerHeartbeat = {
  status: string;
  environment: string;
  lastSeenAt: string | null;
  ageSeconds: number | null;
};

export type OverviewFeeWindow = {
  from: string;
  to: string;
  valuationStatus: string;
  unvaluedCosts: number;
  transactions: number;
  feeRevenue: number | string;
  providerCosts: number | string;
  realizedProfit: number | string | null;
  estimatedAverageFee: number | string;
  byAsset: Array<{
    asset: string;
    transactions: number;
    feeRevenueNative: number | string;
    providerCostsNative: number | string;
    realizedProfitNative: number | string | null;
    feeRevenueReporting: number | string;
    providerCostsReporting: number | string;
    realizedProfitReporting: number | string | null;
    conversionSource: string;
  }>;
};

export type OverviewMajorRate = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number | string | null;
  source: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  freshness: string;
};

export type OverviewChartDay = {
  day: string;
  buy: number;
  sell: number;
  total: number;
};

export type OverviewRecentTransaction = {
  id: string;
  orderId: string | null;
  provider: string;
  partyId: string;
  providerTransactionId: string | null;
  transactionType: string;
  status: string;
  sourceAsset: string | null;
  sourceAmount: number | string | null;
  destinationAsset: string | null;
  destinationAmount: number | string | null;
  providerFeeAsset: string | null;
  providerFeeAmount: number | string | null;
  platformFeeAsset: string | null;
  platformFeeAmount: number | string | null;
  platformFeeStatus: string | null;
  estimatedEarningsReporting: number | string | null;
  reportingCurrency: string;
  estimateSource: string | null;
  updatedAt: string | null;
};

export type AdminOverview = {
  reportingCurrency: string;
  generatedAt: string;
  feesToday: OverviewFeeWindow;
  feesMonthToDate: OverviewFeeWindow;
  majorRates: OverviewMajorRate[];
  majorRatesStale: boolean;
  transactionChart: OverviewChartDay[];
  recentTransactions: OverviewRecentTransaction[];
  totalTransactions: number;
  readiness: OperationalReadiness;
};

export type TransactionEconomics = {
  transactionId: string;
  valuationStatus: string;
  realizedProfit: number | string | null;
  fee: {
    feeRuleId?: string;
    direction?: string;
    paymentMethod?: string;
    basisAmount?: number | string | null;
    percentageRate?: number | string | null;
    fixedAmount?: number | string | null;
    minimumAmount?: number | string | null;
    feeAsset?: string;
    chargedAmount?: number | string | null;
    status?: string;
  } | null;
  costs: Array<{
    id: string;
    type: string;
    asset: string;
    actualAmount: number | string | null;
    valuationCurrency: string | null;
    valuationAmount: number | string | null;
    status: string;
  }>;
};

export type AdminSessionView = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};
