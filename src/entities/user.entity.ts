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

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
