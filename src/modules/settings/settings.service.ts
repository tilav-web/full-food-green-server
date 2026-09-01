import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Setting } from "../../entities/setting.entity"

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private settingRepo: Repository<Setting>) {}

  async getAll() {
    const settings = await this.settingRepo.find()
    const map: Record<string, string> = {}
    settings.forEach((s) => (map[s.key] = s.value))
    return map
  }

  async update(key: string, value: string) {
    let setting = await this.settingRepo.findOne({ where: { key } })
    if (!setting) {
      setting = this.settingRepo.create({ key, value })
    } else {
      setting.value = value
    }
    return this.settingRepo.save(setting)
  }

  async updateMultiple(data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      await this.update(key, value)
    }
    return this.getAll()
  }
}
