import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { OrderItem } from "./order-item.entity"

export type OrderType = "ONLINE_DELIVERY" | "ONLINE_PICKUP" | "DINE_IN"
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_REVIEW"
  | "PREPARING"
  | "READY_FOR_DELIVERY"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED"

export type PaymentMethod = "CARD_TRANSFER" | "CASH" | "TERMINAL"
export type PaymentStatus = "UNPAID" | "REVIEW" | "PAID" | "REJECTED"

@Entity("orders")
@Index(["status", "createdAt"])
@Index(["type", "createdAt"])
@Index(["userId", "createdAt"])
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Index()
  @Column({ unique: true })
  orderNumber: string // #FF-1001

  @Index()
  @Column({ nullable: true })
  userId: string

  @Column({ default: "Mijoz" })
  customerName: string

  @Index()
  @Column({ nullable: true })
  customerPhone: string

  @Column({ type: "text", default: "ONLINE_DELIVERY" })
  type: OrderType

  @Column({ type: "text", default: "PENDING_PAYMENT" })
  status: OrderStatus

  @Column({ type: "real", default: 0 })
  subtotal: number

  @Column({ type: "real", default: 0 })
  deliveryFee: number

  @Column({ type: "real", default: 0 })
  packagingFee: number // Qadoqlash idishlari to'lovi

  @Column({ type: "real", default: 0 })
  totalAmount: number

  // Delivery & Location
  @Column({ nullable: true })
  address: string

  @Column({ nullable: true })
  extraPhone: string // Qo'shimcha telefon raqami (ixtiyoriy)

  @Column({ nullable: true })
  building: string // Dom / Bino raqami (ixtiyoriy)

  @Column({ nullable: true })
  floor: string // Qavat / Etaj (ixtiyoriy)

  @Column({ nullable: true })
  apartment: string // Xonadon / Xona raqami (ixtiyoriy)

  @Column({ type: "real", nullable: true })
  latitude: number

  @Column({ type: "real", nullable: true })
  longitude: number

  @Column({ type: "real", default: 0 })
  distanceKm: number

  // Payment
  @Column({ type: "text", default: "CARD_TRANSFER" })
  paymentMethod: PaymentMethod

  @Column({ type: "text", default: "UNPAID" })
  paymentStatus: PaymentStatus

  @Column({ nullable: true })
  receiptImageUrl: string // User yuklagan to'lov cheki skrinshoti

  @Column({ nullable: true })
  receiptRejectReason: string

  // Yandex Taxi Dispatch
  @Column({ default: false })
  isYandexTaxiCalled: boolean

  @Column({ nullable: true })
  yandexTaxiOrderId: string

  @Column({ nullable: true })
  yandexTaxiStatus: string // 'requested' | 'driver_assigned' | 'in_transit' | 'delivered'

  @Column({ nullable: true })
  yandexTaxiDriverPhone: string

  @Column({ nullable: true })
  notes: string

  // Custom Container/Lunch Box Packaging Breakdown
  @Column({ type: "text", nullable: true })
  containersJson: string

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
