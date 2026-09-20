/**
 * Full Food POS - ESC/POS Plain Text Receipt Formatter for Xprinter (80mm / 58mm)
 * EXACT 1:1 REPLICA of client/src/lib/thermalPrintService.ts (generateReceiptPlainText)
 */

import { BISTRO_LOGO_80MM, BISTRO_LOGO_58MM } from "./receipt.logo"

function formatDateTime(dateStr?: string | Date) {
  const date = dateStr ? new Date(dateStr) : new Date()
  const d = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent",
  })
  const t = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Tashkent",
  })
  return { date: d, time: t }
}

export function formatReceiptPlainText(order: any, paperWidth: "80mm" | "58mm" = "80mm"): string {
  const { date, time } = formatDateTime(order.createdAt)
  const is80mm = paperWidth === "80mm"
  const width = is80mm ? 40 : 30
  const separator = " " + "-".repeat(width - 2)
  const doubleSep = " " + "=".repeat(width - 2)

  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2))
    return " ".repeat(pad) + text
  }

  const row = (left: string, right: string) => {
    const available = width - 2
    const space = Math.max(1, available - left.length - right.length)
    return " " + left + " ".repeat(space) + right
  }

  let out = ""
  out += is80mm ? BISTRO_LOGO_80MM : BISTRO_LOGO_58MM
  out += center("Tel: +998 33 888 60 60") + "\n"
  out += center("Telegram: @fullfoodbot") + "\n"
  out += doubleSep + "\n"
  out += "\x1bE\x01" + center(`CHEK #${order.orderNumber}`) + "\x1bE\x00\n"
  out += center(`${date}  ${time}`) + "\n"
  out += separator + "\n"
  out += row("Buyurtma turi:", order.type === "DINE_IN" ? (order.tableNumber ? `ZALDA (#${order.tableNumber})` : "ZALDA (POS)") : order.type === "ONLINE_PICKUP" ? "OLIB KETISH" : "YETKAZIB BERISH") + "\n"
  out += row("Kassir:", "Kassir") + "\n"
  if (order.customerName && order.customerName !== "Mijoz" && order.customerName !== "Mijoz (Zal)" && order.customerName !== "Zal Mijoz") {
    out += row("Mijoz:", order.customerName) + "\n"
  }
  if (order.customerPhone && order.customerPhone !== "+998 00 000 00 00" && order.customerPhone !== "+998 71 200 00 00" && order.type !== "DINE_IN") {
    out += row("Telefon:", order.customerPhone) + "\n"
  }
  out += separator + "\n"
  const subtotal = Number(order.subtotal || order.totalAmount)
  const packagingFee = Number(order.packagingFee || 0)
  const deliveryFee = Number(order.deliveryFee || 0)
  out += row("Oraliq jami:", `${subtotal.toLocaleString()} so'm`) + "\n"
  if (packagingFee > 0) {
    out += row("Qadoqlash (Boks):", `${packagingFee.toLocaleString()} so'm`) + "\n"
  }
  if (deliveryFee > 0) {
    out += row("Yetkazib berish:", `${deliveryFee.toLocaleString()} so'm`) + "\n"
  }
  out += separator + "\n"
  if (is80mm) {
    const h_nomi = " Nomi".padEnd(14, " ")
    const h_soni = "Soni".padStart(5, " ")
    const h_narxi = "Narxi".padStart(9, " ")
    const h_summa = "Summa".padStart(9, " ")
    out += `${h_nomi} ${h_soni} ${h_narxi} ${h_summa}\n`
  } else {
    const h_nomi = " Nomi".padEnd(12, " ")
    const h_soni = "Soni".padStart(6, " ")
    const h_summa = "Summa".padStart(10, " ")
    out += `${h_nomi} ${h_soni} ${h_summa}\n`
  }
  out += separator + "\n"

  const items = order.items || []
  items.forEach((item: any, idx: number) => {
    const qty = Number(item.quantity || 1)
    const unitPrice = Number(item.unitPrice || 0)
    const lineTotal = qty * unitPrice
    out += ` ${idx + 1}. ${item.name}\n`
    if (is80mm) {
      const r_empty = " ".repeat(14)
      const s_qty = `${qty} x`.padStart(5, " ")
      const s_pr = unitPrice.toLocaleString().padStart(9, " ")
      const s_tot = lineTotal.toLocaleString().padStart(9, " ")
      out += `${r_empty} ${s_qty} ${s_pr} ${s_tot}\n`
    } else {
      const r_empty = " ".repeat(12)
      const s_qty = `${qty} x`.padStart(6, " ")
      const s_tot = lineTotal.toLocaleString().padStart(10, " ")
      out += `${r_empty} ${s_qty} ${s_tot}\n`
    }
  })

  out += doubleSep + "\n"
  out += "\x1bE\x01\x1d!\x01" + row("JAMI TO'LOV:", `${Number(order.totalAmount || 0).toLocaleString()} SO'M`) + "\x1d!\x00\x1bE\x00\n"
  out += doubleSep + "\n"
  out += row("To'lov usuli:", order.paymentMethod === "CARD_TRANSFER" ? "KARTA" : order.paymentMethod === "CASH" ? "NAQD PUL" : order.paymentMethod === "TERMINAL" ? "TERMINAL" : order.paymentMethod === "BALANCE" ? "MIJOZ BALANSI" : "KARTA") + "\n"
  out += row("To'lov holati:", "[V] TO'LANDI") + "\n"
  out += doubleSep + "\n"
  out += center("*** CHEK OXIRI ***")
  return out
}
