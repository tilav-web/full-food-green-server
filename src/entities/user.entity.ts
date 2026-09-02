import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

export type UserRole = "USER" | "CASHIER" | "ADMIN"

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ nullable: true, unique: true })
  telegramId: string

  @Column({ nullable: true })
  username: string

  @Column({ nullable: true })
  fullName: string

  @Column({ nullable: true })
  phone: string

  @Column({ type: "text", default: "USER" })
  role: UserRole

  @Column({ nullable: true, select: false })
  password?: string

  @Column({ type: "real", default: 0 })
  balance: number

  @Column({ type: "boolean", default: true })
  isBotActive: boolean

  @Column({ type: "datetime", nullable: true })
  botBlockedAt?: Date

  @Column({ type: "datetime", nullable: true })
  lastBotActivityAt?: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
