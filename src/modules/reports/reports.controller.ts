import { Controller, Get, Query } from "@nestjs/common"
import { ReportsService } from "./reports.service"

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  async getDashboard(
    @Query("period") period?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.reportsService.getDashboardSummary(period || "today", startDate, endDate)
  }
}
