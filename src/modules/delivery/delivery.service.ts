import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Setting } from "../../entities/setting.entity"

@Injectable()
export class DeliveryService {
  constructor(@InjectRepository(Setting) private settingRepo: Repository<Setting>) {}

  private async getSetting(key: string, fallback: string): Promise<string> {
    const s = await this.settingRepo.findOne({ where: { key } })
    return s?.value || fallback
  }

  // Haversine formula to calculate distance between 2 coordinates (km)
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c
    return Math.round(d * 10) / 10 // 1 decimal place
  }

  // Estimate delivery fee based on distance
  async estimateDeliveryFee(userLat: number, userLng: number) {
    const restLat = parseFloat(await this.getSetting("restaurant_lat", "38.838250"))
    const restLng = parseFloat(await this.getSetting("restaurant_lng", "65.792222"))
    const baseFee = parseFloat(await this.getSetting("delivery_base_fee", "10000"))
    const perKm = parseFloat(await this.getSetting("delivery_per_km", "3000"))

    const distanceKm = this.calculateDistance(restLat, restLng, userLat, userLng)
    // Distance calculation: base fee covers first 2 km, then per km rate
    let fee = baseFee
    if (distanceKm > 2) {
      fee += (distanceKm - 2) * perKm
    }
    // Round to nearest 500 so'm
    const estimatedCost = Math.ceil(fee / 500) * 500

    return {
      distanceKm,
      estimatedCost,
      restaurantLocation: { lat: restLat, lng: restLng },
      deliveryPartner: "Yandex Delivery / Yandex Taxi",
    }
  }

  // Simulate or integrate Yandex Taxi Dispatch
  async dispatchYandexTaxi(order: {
    orderNumber: string
    customerName: string
    customerPhone: string
    address: string
    latitude?: number
    longitude?: number
  }) {
    // Generate realistic Yandex delivery dispatch response
    const trackingId = `yndx_${Date.now()}_${Math.floor(Math.random() * 1000)}`
    const driverNames = ["Sardorbek (Cobalt oq - 01 A 777 BA)", "Bobur (Lacetti qora - 01 B 123 AA)", "Dilshod (Nexia 3 - 01 X 456 BB)"]
    const assignedDriver = driverNames[Math.floor(Math.random() * driverNames.length)]

    return {
      success: true,
      yandexOrderId: trackingId,
      status: "driver_assigned",
      assignedDriver,
      etaMinutes: 12,
      message: `Yandex Taxi buyurtma #${order.orderNumber} uchun muvaffaqiyatli chaqirildi.`,
    }
  }
}
