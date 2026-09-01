import { Injectable, OnApplicationBootstrap } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import * as bcrypt from "bcryptjs"
import { User } from "../../entities/user.entity"
import { Category } from "../../entities/category.entity"
import { Product } from "../../entities/product.entity"
import { Combo } from "../../entities/combo.entity"
import { Unit } from "../../entities/unit.entity"
import { Setting } from "../../entities/setting.entity"
import { Banner } from "../../entities/banner.entity"

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Combo) private comboRepo: Repository<Combo>,
    @InjectRepository(Unit) private unitRepo: Repository<Unit>,
    @InjectRepository(Setting) private settingRepo: Repository<Setting>,
    @InjectRepository(Banner) private bannerRepo: Repository<Banner>
  ) {}

  async onApplicationBootstrap() {
    await this.seedSettings()
    await this.seedUsers()
    await this.seedUnits()
    await this.seedCategoriesAndProducts()
    await this.seedCombos()
    await this.seedBanners()
  }

  private async seedSettings() {
    const defaultSettings = [
      { key: "card_number", value: "8600 4912 3456 7890" },
      { key: "card_holder", value: "FULL FOOD MCHJ" },
      { key: "card_bank", value: "Kapitalbank" },
      { key: "restaurant_name", value: "Full Food" },
      { key: "restaurant_address", value: "Toshkent sh., Amir Temur shox ko'chasi 45" },
      { key: "restaurant_phone", value: "+998 71 200 00 20" },
      { key: "restaurant_lat", value: "41.311158" },
      { key: "restaurant_lng", value: "69.279737" },
      { key: "delivery_base_fee", value: "10000" },
      { key: "delivery_per_km", value: "3000" },
    ]

    for (const s of defaultSettings) {
      const exists = await this.settingRepo.findOne({ where: { key: s.key } })
      if (!exists) {
        await this.settingRepo.save(s)
      }
    }
  }

  private async seedUsers() {
    const count = await this.userRepo.count()
    if (count === 0) {
      const adminPass = await bcrypt.hash("admin123", 8)
      const cashierPass = await bcrypt.hash("kassir123", 8)

      await this.userRepo.save([
        {
          username: "admin",
          fullName: "Super Admin",
          phone: "+998901234567",
          role: "ADMIN",
          password: adminPass,
        },
        {
          username: "kassir1",
          fullName: "Malika Karimova (1-Kassa)",
          phone: "+998909876543",
          role: "CASHIER",
          password: cashierPass,
        },
        {
          username: "kassir2",
          fullName: "Jasur Rahimov (2-Kassa)",
          phone: "+998905554433",
          role: "CASHIER",
          password: cashierPass,
        },
      ])
      console.log("🌱 Default Admin and Cashier accounts seeded.")
    }
  }

  private async seedUnits() {
    const count = await this.unitRepo.count()
    if (count === 0) {
      await this.unitRepo.save([
        { name: "pors", shortName: "pors" },
        { name: "dona", shortName: "dona" },
        { name: "qoshiq", shortName: "qsh" },
        { name: "kg", shortName: "kg" },
        { name: "gram", shortName: "g" },
        { name: "stakan", shortName: "st" },
        { name: "litr", shortName: "l" },
      ])
      console.log("🌱 Units seeded successfully.")
    }
  }

  private async seedCategoriesAndProducts() {
    const count = await this.categoryRepo.count()
    if (count === 0) {
      // 1. Categories
      const catGarnir = await this.categoryRepo.save({
        name: "Garnirlar",
        slug: "garnirlar",
        icon: "Wheat",
        sortOrder: 1,
      })

      const catMeat = await this.categoryRepo.save({
        name: "Go'shtli Taomlar",
        slug: "gosht",
        icon: "Beef",
        sortOrder: 2,
      })

      const catVeg = await this.categoryRepo.save({
        name: "Sabzavotlar",
        slug: "sabzavotlar",
        icon: "Carrot",
        sortOrder: 3,
      })

      const catFixed = await this.categoryRepo.save({
        name: "Sanoqli Taomlar",
        slug: "sanoqli",
        icon: "Cookie",
        sortOrder: 4,
      })

      const catSalad = await this.categoryRepo.save({
        name: "Salatlar",
        slug: "salatlar",
        icon: "Salad",
        sortOrder: 5,
      })

      const catDrink = await this.categoryRepo.save({
        name: "Ichimliklar",
        slug: "ichimliklar",
        icon: "CupSoda",
        sortOrder: 6,
      })

      // 2. Products
      await this.productRepo.save([
        {
          name: "Dimlangan Guruch (Basmati)",
          description: "Yengil va mayin pishirilgan basmati guruchi",
          categoryId: catGarnir.id,
          type: "PORTION_BASED",
          price: 8000,
          unitName: "1 qoshiq",
          calories: 180,
          protein: 4.2,
          fat: 0.8,
          carbs: 38.5,
          imageUrl: "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Grechka",
          description: "Xushbo'y va yumshoq suvda pishirilgan qora bug'doy",
          categoryId: catGarnir.id,
          type: "PORTION_BASED",
          price: 9000,
          oldPrice: 11000,
          unitName: "1 qoshiq",
          calories: 165,
          protein: 5.8,
          fat: 1.2,
          carbs: 32.0,
          imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Bulgur & Kinoa aralashmasi",
          description: "Foydali donlar va kinoa to'plami",
          categoryId: catGarnir.id,
          type: "PORTION_BASED",
          price: 12000,
          unitName: "1 qoshiq",
          calories: 175,
          protein: 6.0,
          fat: 1.5,
          carbs: 34.0,
          imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Bug'da pishgan Tovuq filesi",
          description: "Yumshoq marinadlangan tovuq ko'kragi",
          categoryId: catMeat.id,
          type: "PORTION_BASED",
          price: 22000,
          oldPrice: 26000,
          unitName: "1 pors",
          calories: 210,
          protein: 31.0,
          fat: 3.2,
          carbs: 0.0,
          imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Kurka go'shtidan kotlet",
          description: "Yumshoq va mayin parhez go'shtli kotlet",
          categoryId: catMeat.id,
          type: "PORTION_BASED",
          price: 24000,
          unitName: "1 dona",
          calories: 195,
          protein: 26.5,
          fat: 4.8,
          carbs: 2.0,
          imageUrl: "https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Qaynatilgan Mol Go'shti (Tillarang)",
          description: "Yog'siz yumshoq pishgan yosh buzoq go'shti",
          categoryId: catMeat.id,
          type: "PORTION_BASED",
          price: 28000,
          unitName: "1 pors",
          calories: 250,
          protein: 34.0,
          fat: 6.5,
          carbs: 0.0,
          imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Bug'da pishgan Brokkoli va Gulkaram",
          description: "Tazik va yangi bug'langan sabzavotlar",
          categoryId: catVeg.id,
          type: "PORTION_BASED",
          price: 12000,
          unitName: "1 qoshiq",
          calories: 55,
          protein: 3.5,
          fat: 0.4,
          carbs: 7.2,
          imageUrl: "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Tandir Somsa (Tovuqli)",
          description: "Yupqa qatlamli, tovuq go'shti va piyozli",
          categoryId: catFixed.id,
          type: "FIXED_COUNT",
          price: 12000,
          oldPrice: 15000,
          stockQuantity: 25,
          unitName: "1 dona",
          calories: 185,
          protein: 12.0,
          fat: 5.5,
          carbs: 22.0,
          imageUrl: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Bug'da pishgan Manti (Qovoqli / Go'shtli)",
          description: "Oshqovoq va mol go'shtidan xushbo'y manti",
          categoryId: catFixed.id,
          type: "FIXED_COUNT",
          price: 7000,
          stockQuantity: 40,
          unitName: "1 dona",
          calories: 95,
          protein: 4.5,
          fat: 2.0,
          carbs: 14.0,
          imageUrl: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Yunoncha Salat",
          description: "Yangi bodring, pomidor, zaytun va pishloq",
          categoryId: catSalad.id,
          type: "PORTION_BASED",
          price: 18000,
          oldPrice: 22000,
          unitName: "1 pors",
          calories: 130,
          protein: 4.0,
          fat: 8.5,
          carbs: 6.0,
          imageUrl: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=60",
        },
        {
          name: "Yashil Detox Smuzi (Kivi + Ismaloq)",
          description: "Organizm uchun foydali tabiiy sharbat",
          categoryId: catDrink.id,
          type: "PORTION_BASED",
          price: 15000,
          unitName: "1 stakan",
          calories: 75,
          protein: 1.8,
          fat: 0.2,
          carbs: 16.5,
          imageUrl: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&auto=format&fit=crop&q=60",
        },
      ])
      console.log("🌱 Categories and Products seeded successfully.")
    }
  }

  private async seedCombos() {
    const count = await this.comboRepo.count()
    if (count === 0) {
      await this.comboRepo.save([
        {
          name: "Fit Protein Kombo",
          description: "Bug'da tovuq filesi + Basmati guruch + Brokkoli + Detox sharbat",
          price: 45000,
          oldPrice: 54000,
          calories: 505,
          protein: 41.5,
          fat: 3.9,
          carbs: 76.2,
          imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60",
          itemsJson: JSON.stringify([
            { name: "Tovuq filesi", count: "1 pors" },
            { name: "Basmati guruch", count: "1 qoshiq" },
            { name: "Brokkoli", count: "1 qoshiq" },
            { name: "Detox ichimlik", count: "1 stakan" },
          ]),
        },
        {
          name: "Super Slim Kombo",
          description: "Grechka + Parhez Kurka kotleti + Yunoncha salat",
          price: 42000,
          oldPrice: 49000,
          calories: 505,
          protein: 37.8,
          fat: 14.7,
          carbs: 41.0,
          imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=60",
          itemsJson: JSON.stringify([
            { name: "Grechka", count: "1 qoshiq" },
            { name: "Kurka kotlet", count: "1 dona" },
            { name: "Yunoncha salat", count: "1 pors" },
          ]),
        },
        {
          name: "Bug'da Pishgan Manti Tushligi",
          description: "Bug'da manti (4 dona) + Maxsus qatiq sousi + Choy",
          price: 32000,
          oldPrice: 38000,
          calories: 420,
          protein: 19.5,
          fat: 9.0,
          carbs: 60.0,
          imageUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop&q=60",
          itemsJson: JSON.stringify([
            { name: "Bug'da manti", count: "4 dona" },
            { name: "Qatiq sousi", count: "1 pors" },
            { name: "Choy", count: "1 choynak" },
          ]),
        },
      ])
      console.log("🌱 Combos seeded successfully.")
    }
  }

  private async seedBanners() {
    const count = await this.bannerRepo.count()
    if (count === 0) {
      await this.bannerRepo.save([
        {
          badge: "Trendda -15%",
          title: "Mazali Tushlik Kombosi",
          description: "Asosiy taom, salat va maxsus sous birgalikda",
          gradient: "from-emerald-700 via-teal-800 to-emerald-950",
          imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=60",
          actionType: "MENU",
          actionTarget: "/menu",
          actionText: "Kombolar",
          sortOrder: 1,
          isActive: true,
        },
        {
          badge: "Maxsus",
          title: "Sog'lom Taomlar To'plami",
          description: "Kunlik ratsion uchun hisoblangan muvozanatli menyu",
          gradient: "from-teal-800 via-emerald-800 to-slate-900",
          imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=60",
          actionType: "MENU",
          actionTarget: "/menu",
          actionText: "Taomlar",
          sortOrder: 2,
          isActive: true,
        },
        {
          badge: "Aksiya",
          title: "Yangi Parhez Taomlar",
          description: "KBDU hisoblangan eng toza taomlar to'plami",
          gradient: "from-emerald-900 via-green-950 to-neutral-950",
          imageUrl: "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&auto=format&fit=crop&q=60",
          actionType: "MENU",
          actionTarget: "/menu",
          actionText: "Barcha taomlar",
          sortOrder: 3,
          isActive: true,
        },
      ])
      console.log("🌱 Promotional Banners seeded successfully.")
    }
  }
}
