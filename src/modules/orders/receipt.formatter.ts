/**
 * Full Food POS - ESC/POS Plain Text Receipt Formatter for Xprinter (80mm / 58mm)
 * EXACT 1:1 REPLICA of client/src/lib/thermalPrintService.ts (generateReceiptPlainText)
 */

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
  if (is80mm) {
    out += center("+----------------------------------+") + "\n"
    out += center("|          * FULL FOOD *           |") + "\n"
    out += center("|    SOG'LOM VA PARHEZ TAOMLAR     |") + "\n"
    out += center("+----------------------------------+") + "\n"
    out += center("Tel: +998 71 200 00 20") + "\n"
    out += center("+998 33 888 60 60") + "\n"
    out += center("Telegram: @fullfoodbot") + "\n"
  } else {
    out += center("+--------------------------+") + "\n"
    out += center("|      * FULL FOOD *       |") + "\n"
    out += center("|    SOG'LOM VA PARHEZ     |") + "\n"
    out += center("+--------------------------+") + "\n"
    out += center("Tel: +998 71 200 00 20") + "\n"
    out += center("Telegram: @fullfoodbot") + "\n"
  }
  out += doubleSep + "\n"
  out += center(`CHEK #${order.orderNumber}`) + "\n"
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
  out += is80mm ? row(" Nomi", "Soni   Narxi   Summa") + "\n" : row(" Nomi", "Soni   Summa") + "\n"
  out += separator + "\n"

  const items = order.items || []
  items.forEach((item: any, idx: number) => {
    const qty = Number(item.quantity || 1)
    const unitPrice = Number(item.unitPrice || 0)
    const lineTotal = qty * unitPrice
    out += `  ${idx + 1}. ${item.name}\n`
    out += row(`  ${qty} x ${unitPrice.toLocaleString()}`, `${lineTotal.toLocaleString()} so'm`) + "\n"
  })

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
  out += row("JAMI TO'LOV:", `${Number(order.totalAmount || 0).toLocaleString()} SO'M`) + "\n"
  out += row("To'lov usuli:", order.paymentMethod === "CARD_TRANSFER" ? "KARTA" : order.paymentMethod === "CASH" ? "NAQD PUL" : order.paymentMethod === "TERMINAL" ? "TERMINAL" : order.paymentMethod === "BALANCE" ? "MIJOZ BALANSI" : "KARTA") + "\n"
  out += row("To'lov holati:", "[V] TO'LANDI") + "\n"
  out += doubleSep + "\n"
  out += center("Salomatligingiz - boyligimiz!") + "\n"
  out += center("Xaridingiz uchun rahmat!") + "\n"
  out += center("www.fullfood.uz") + "\n"
  out += doubleSep + "\n"
  out += center("*** CHEK OXIRI ***")
  return out
}
