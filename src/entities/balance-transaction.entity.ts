import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

export type BalanceTransactionType =
  | "DEPOSIT"
  | "ORDER_PAYMENT"
  | "MANUAL_ADJUSTMENT"
  | "ORDER_REFUND"

@Entity("balance_transactions")
@Index(["userId", "createdAt"])
export class BalanceTransaction {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Index()
  @Column()
  userId: string

  @Column({ type: "real" })
  amount: number

  @Column({ type: "real" })
  balanceBefore: number

  @Column({ type: "real" })
  balanceAfter: number

  @Column({ type: "text" })
  type: BalanceTransactionType

  @Column({ nullable: true })
  orderId?: string

  @Column({ nullable: true })
  note?: string

  @Column({ nullable: true })
  performedBy?: string

  @CreateDateColumn()
  createdAt: Date
}
