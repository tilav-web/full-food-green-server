import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("combos")
export class Combo {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ nullable: true })
  slug: string

  @Column({ nullable: true })
  description: string

  @Column({ type: "real", default: 0 })
  price: number // Joriy sotuv narxi

  @Column({ type: "real", nullable: true })
  oldPrice: number // Skitka/eski narxi (agar mavjud bo'lsa)

  @Column({ type: "real", default: 0 })
  calories: number

  @Column({ type: "real", default: 0 })
  protein: number

  @Column({ type: "real", default: 0 })
  fat: number

  @Column({ type: "real", default: 0 })
  carbs: number

  @Column({ nullable: true })
  imageUrl: string

  @Column({ type: "text", default: "[]" }) // JSON string of items in this combo
  itemsJson: string

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
