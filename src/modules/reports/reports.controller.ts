import { Controller, Get, Post, Query } from "@nestjs/common"
import { ReportsService } from "./reports.service"
import { DailyReportService } from "./daily-report.service"

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dailyReportService: DailyReportService
  ) {}

  @Get("dashboard")
  async getDashboard(
    @Query("period") period?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.reportsService.getDashboardSummary(period || "today", startDate, endDate)
  }

  @Post("send-daily-report")
  async sendDailyReport() {
    return this.dailyReportService.generateAndSendDailyReport()
  }

  @Get("send-daily-report")
  async triggerDailyReport() {
    return this.dailyReportService.generateAndSendDailyReport()
  }
}
