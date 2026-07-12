export interface PerformanceAlert {
  id: string
  supplierId: string
  supplierName: string
  supplierCountry: string
  metric: "onTimeDelivery" | "qualityScore" | "leadTime"
  previousValue: number
  currentValue: number
  threshold: number
  direction: "below"
  message: string
  createdAt: string
  dismissed: boolean
  dismissedAt?: string
}
