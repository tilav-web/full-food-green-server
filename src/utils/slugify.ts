export function generateSlug(name: string): string {
  let text = (name || "").toLowerCase().trim()

  const charMap: Record<string, string> = {
    "oʻ": "o",
    "o'": "o",
    "o`": "o",
    "o’": "o",
    "gʻ": "g",
    "g'": "g",
    "g`": "g",
    "g’": "g",
    "sh": "sh",
    "ch": "ch",
    "yo": "yo",
    "yu": "yu",
    "ya": "ya",
    "ў": "o",
    "ғ": "g",
    "ш": "sh",
    "ч": "ch",
    "ё": "yo",
    "ю": "yu",
    "я": "ya",
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "x",
    "ҳ": "h",
    "ц": "ts",
    "ъ": "",
    "ь": "",
    "э": "e",
    "қ": "q",
  }

  for (const [key, val] of Object.entries(charMap)) {
    text = text.split(key).join(val)
  }

  let slug = text
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (!slug) {
    slug = `dish-${Date.now().toString(36)}`
  }

  return slug
}
