import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("banners")
export class Banner {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ default: "Aksiya" })
  badge: string // e.g. "Trendda -15%", "Konstruktor", "Chegirma"

  @Column()
  title: string // e.g. "Mazali Tushlik Kombosi"

  @Column({ nullable: true })
  slug: string

  @Column({ nullable: true })
  description: string // e.g. "Asosiy taom, salat va maxsus sous birgalikda"

  @Column({ default: "from-emerald-700 via-teal-800 to-emerald-950" })
  gradient: string

  @Column({ nullable: true })
  imageUrl: string

  @Column({ default: "PROMO_PAGE" })
  actionType: "MENU" | "CONSTRUCTOR" | "CATEGORY" | "DISH" | "LINK" | "PROMO_PAGE"

  @Column({ nullable: true })
  actionTarget: string // e.g. "/constructor", "garnirlar", or dish slug

  @Column({ type: "text", default: "[]" })
  itemsJson: string

  @Column({ default: "Batafsil" })
  actionText: string

  @Column({ default: 0 })
  sortOrder: number

  @Column({ default: true })
  isActive: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
