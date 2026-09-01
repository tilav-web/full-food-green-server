import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Banner } from "../../entities/banner.entity"
import { generateSlug } from "../../utils/slugify"

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(Banner) private bannerRepo: Repository<Banner>
  ) {}

  async findAll(onlyActive = false): Promise<any[]> {
    const qb = this.bannerRepo.createQueryBuilder("banner").orderBy("banner.sortOrder", "ASC")
    if (onlyActive) {
      qb.where("banner.isActive = :active", { active: true })
    }
    const banners = await qb.getMany()
    return banners.map((b) => ({
      ...b,
      slug: b.slug || generateSlug(b.title),
      items: b.itemsJson ? JSON.parse(b.itemsJson) : [],
    }))
  }

  async findOne(idOrSlug: string): Promise<any> {
    const banner = await this.bannerRepo.findOne({
      where: [{ id: idOrSlug }, { slug: idOrSlug }],
    })
    if (!banner) throw new NotFoundException("Banner topilmadi")
    return {
      ...banner,
      slug: banner.slug || generateSlug(banner.title),
      items: banner.itemsJson ? JSON.parse(banner.itemsJson) : [],
    }
  }

  async create(data: any): Promise<Banner> {
    if (!data.slug && data.title) {
      data.slug = generateSlug(data.title)
    }
    if (data.items && Array.isArray(data.items)) {
      data.itemsJson = JSON.stringify(data.items)
      delete data.items
    }
    const banner = this.bannerRepo.create(data as Partial<Banner>) as Banner
    return this.bannerRepo.save(banner)
  }

  async update(id: string, data: any): Promise<Banner> {
    const banner = await this.bannerRepo.findOne({ where: { id } })
    if (!banner) throw new NotFoundException("Banner topilmadi")
    if (!data.slug && data.title) {
      data.slug = generateSlug(data.title)
    }
    if (data.items && Array.isArray(data.items)) {
      data.itemsJson = JSON.stringify(data.items)
      delete data.items
    }
    Object.assign(banner, data)
    return this.bannerRepo.save(banner)
  }

  async toggleActive(id: string): Promise<Banner> {
    const banner = await this.findOne(id)
    banner.isActive = !banner.isActive
    return this.bannerRepo.save(banner)
  }

  async delete(id: string): Promise<void> {
    const banner = await this.findOne(id)
    await this.bannerRepo.remove(banner)
  }
}
