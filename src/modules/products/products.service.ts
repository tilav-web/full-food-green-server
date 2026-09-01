import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository, Like } from "typeorm"
import { Product, ProductType } from "../../entities/product.entity"
import { Category } from "../../entities/category.entity"
import { Combo } from "../../entities/combo.entity"
import { generateSlug } from "../../utils/slugify"

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(Combo) private comboRepo: Repository<Combo>
  ) {}

  async getAllCategories() {
    return this.categoryRepo.find({
      order: { sortOrder: "ASC" },
      relations: ["products"],
    })
  }

  async reorderCategories(items: { id: string; sortOrder: number }[]) {
    for (const item of items) {
      await this.categoryRepo.update(item.id, { sortOrder: item.sortOrder })
    }
    return this.getAllCategories()
  }

  async getCategoryById(id: string) {
    const cat = await this.categoryRepo.findOne({ where: { id } })
    if (!cat) throw new NotFoundException("Kategoriya topilmadi")
    return cat
  }

  async getAllProducts(query?: { categoryId?: string; search?: string; type?: ProductType }) {
    const qb = this.productRepo
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.category", "category")
      .leftJoinAndSelect("product.unit", "unit")
      .where("product.isActive = :isActive", { isActive: true })

    if (query?.categoryId) {
      qb.andWhere("product.categoryId = :categoryId", { categoryId: query.categoryId })
    }
    if (query?.type) {
      qb.andWhere("product.type = :type", { type: query.type })
    }
    if (query?.search) {
      qb.andWhere("(LOWER(product.name) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search))", {
        search: `%${query.search}%`,
      })
    }

    qb.orderBy("category.sortOrder", "ASC")
      .addOrderBy("product.createdAt", "DESC")

    const products = await qb.getMany()

    // Ensure all products have slugs
    for (const p of products) {
      if (!p.slug && p.name) {
        p.slug = generateSlug(p.name)
        await this.productRepo.update(p.id, { slug: p.slug })
      }
    }

    return products
  }

  async getProductById(id: string) {
    const product = await this.productRepo.findOne({ where: { id }, relations: ["category", "unit"] })
    if (!product) throw new NotFoundException("Mahsulot topilmadi")
    if (!product.slug && product.name) {
      product.slug = generateSlug(product.name)
      await this.productRepo.update(product.id, { slug: product.slug })
    }
    return product
  }

  async getProductBySlug(slug: string) {
    let product = await this.productRepo.findOne({
      where: [{ slug, isActive: true }, { id: slug, isActive: true }],
      relations: ["category", "unit"],
    })

    if (!product) {
      // Fallback search by transliteration
      const all = await this.productRepo.find({ relations: ["category", "unit"] })
      product = all.find((p) => generateSlug(p.name) === slug) || null
    }

    if (!product) {
      throw new NotFoundException(`"${slug}" nomli taom topilmadi`)
    }

    return product
  }

  async getAllCombos() {
    const combos = await this.comboRepo.find({
      where: { isActive: true },
      order: { createdAt: "DESC" },
    })

    for (const c of combos) {
      if (!c.slug && c.name) {
        c.slug = generateSlug(c.name)
        await this.comboRepo.update(c.id, { slug: c.slug })
      }
    }

    return combos
  }

  async getComboBySlug(slug: string) {
    let combo = await this.comboRepo.findOne({
      where: [{ slug, isActive: true }, { id: slug, isActive: true }],
    })

    if (!combo) {
      const all = await this.comboRepo.find()
      combo = all.find((c) => generateSlug(c.name) === slug) || null
    }

    if (!combo) {
      throw new NotFoundException(`"${slug}" nomli kombo topilmadi`)
    }

    return combo
  }

  // Admin Product CRUD
  async createProduct(data: Partial<Product>) {
    if (data.name) {
      data.slug = data.slug || generateSlug(data.name)
    }
    const p = this.productRepo.create(data)
    return this.productRepo.save(p)
  }

  async updateProduct(id: string, data: Partial<Product>) {
    await this.getProductById(id)
    if (data.name && !data.slug) {
      data.slug = generateSlug(data.name)
    }
    await this.productRepo.update(id, data)
    return this.getProductById(id)
  }

  async deleteProduct(id: string) {
    const p = await this.getProductById(id)
    p.isActive = false
    return this.productRepo.save(p)
  }

  // Admin Category CRUD
  async createCategory(data: Partial<Category>) {
    if (!data.slug && data.name) {
      data.slug = generateSlug(data.name)
    }
    const c = this.categoryRepo.create(data)
    return this.categoryRepo.save(c)
  }

  async updateCategory(id: string, data: Partial<Category>) {
    const cat = await this.getCategoryById(id)
    if (data.name && !data.slug) {
      data.slug = generateSlug(data.name)
    }
    Object.assign(cat, data)
    return this.categoryRepo.save(cat)
  }

  async deleteCategory(id: string) {
    const cat = await this.getCategoryById(id)
    await this.categoryRepo.remove(cat)
    return true
  }

  // Admin Combo CRUD
  async createCombo(data: Partial<Combo>) {
    if (data.name) {
      data.slug = data.slug || generateSlug(data.name)
    }
    const c = this.comboRepo.create(data)
    return this.comboRepo.save(c)
  }

  async updateCombo(id: string, data: Partial<Combo>) {
    if (data.name && !data.slug) {
      data.slug = generateSlug(data.name)
    }
    await this.comboRepo.update(id, data)
    return this.comboRepo.findOne({ where: { id } })
  }

  async deleteCombo(id: string) {
    await this.comboRepo.update(id, { isActive: false })
    return true
  }
}
