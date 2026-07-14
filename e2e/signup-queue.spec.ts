import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

test("signup from slug check, onboard business, then create several queue entries", async ({ page }) => {
  const suffix = Date.now().toString(36)
  const slug = `e2e-${suffix}`
  const phone = `62812345${suffix.replace(/[^0-9]/g, "").padEnd(5, "0").slice(0, 5)}`
  const businessName = `E2E Business ${suffix}`
  const bookingCustomer = `Rina Booking ${suffix}`

  await page.request.post("/api/e2e/cleanup", {
    data: { phone, slug },
  })

  await page.goto("/")
  await page.getByLabel("Buat halaman antrean bisnismu").fill(slug)
  await page.getByRole("button", { name: /Cek URL/i }).click()
  await expect(page.getByText("URL ini tersedia")).toBeVisible()
  await page.getByRole("button", { name: /Klaim dan daftar/i }).click()

  await expect(page.getByRole("heading", { name: /Masuk \/ Daftar/i })).toBeVisible()
  await page.getByLabel("Nomor WhatsApp").fill(phone)
  await page.getByRole("button", { name: /Verifikasi lewat WhatsApp/i }).click()

  await expect(page.getByRole("heading", { name: /Verifikasi WhatsApp/i })).toBeVisible()
  const intent = await waitForWhatsappIntent(page, phone)
  const webhookResponse = await page.request.post("/api/webhooks/whatsapp?secret=e2e-secret", {
    data: { from: phone, message: `LINKJO ${intent.token}` },
  })
  expect(webhookResponse.ok(), await webhookResponse.text()).toBeTruthy()

  await expect(page.getByRole("heading", { name: /Pilih Username/i })).toBeVisible()
  await expect(page.getByLabel("Username bisnis")).toHaveValue(slug)
  await page.getByRole("button", { name: /Lanjut/i }).click()

  await expect(page.getByRole("heading", { name: /Lengkapi Bisnis/i })).toBeVisible()
  await page.getByLabel("Nama Akun").fill("Pemilik E2E")
  await page.getByLabel("Nama Bisnis").fill(businessName)
  await page.getByPlaceholder("Contoh: Barbershop premium di Jakarta Selatan").fill("Bisnis e2e untuk simulasi antrean")
  await page.getByPlaceholder("Contoh: Potong rambut").fill("Layanan utama")
  const timeInputs = page.locator('input[type="time"]')
  for (let index = 0; index < await timeInputs.count(); index += 2) {
    await timeInputs.nth(index).fill("00:00")
    await timeInputs.nth(index + 1).fill("23:59")
  }
  await page.getByRole("button", { name: /Simpan dan Buka Dashboard/i }).click()

  await expect(page).toHaveURL(/\/dashboard$/)

  await page.goto(`/${slug}`)
  await expect(page.locator("main h2", { hasText: businessName })).toBeVisible()

  const queueForm = page.locator("form").first()
  for (const customerName of ["Budi E2E", "Sari E2E", "Andi E2E"]) {
    await queueForm.locator("input").nth(0).fill(customerName)
    await queueForm.locator("input").nth(1).fill(nextCustomerPhone(phone, customerName))
    const queueResponsePromise = page.waitForResponse((response) => (
      response.url().includes(`/api/public/${slug}/queue`) && response.request().method() === "POST"
    ))
    await queueForm.getByRole("button", { name: /Ambil Nomor/i }).click()
    const queueResponse = await queueResponsePromise
    const queueBody = await queueResponse.json()
    expect(queueResponse.ok(), JSON.stringify(queueBody)).toBeTruthy()
    await expect(page.getByText(new RegExp(`Nomor kamu #${queueBody.no}`))).toBeVisible()
  }

  const bookingForm = page.locator("form").nth(1)
  await bookingForm.locator("input").nth(0).fill(bookingCustomer)
  await bookingForm.locator("input").nth(1).fill(nextCustomerPhone(phone, bookingCustomer))
  await bookingForm.locator("select").selectOption({ index: 1 })
  await bookingForm.locator('input[type="datetime-local"]').fill(nextJakartaDateTimeLocal())
  await bookingForm.locator("input").last().fill("Catatan booking e2e")
  const bookingResponsePromise = page.waitForResponse((response) => (
    response.url().includes(`/api/public/${slug}/bookings`) && response.request().method() === "POST"
  ))
  await bookingForm.getByRole("button", { name: /Buat Booking/i }).click()
  const bookingResponse = await bookingResponsePromise
  const bookingBody = await bookingResponse.json()
  expect(bookingResponse.ok(), JSON.stringify(bookingBody)).toBeTruthy()
  await expect(page.getByText(/Token kelola:/i)).toBeVisible()

  await page.goto("/dashboard")
  await expect(page.getByText("Budi E2E")).toBeVisible()
  await expect(page.getByText("Sari E2E")).toBeVisible()
  await expect(page.getByText("Andi E2E")).toBeVisible()
  await expect(page.getByText(bookingCustomer)).toBeVisible()
  await expect(page.getByText("Catatan booking e2e")).toBeVisible()
})

async function waitForWhatsappIntent(page: Page, phone: string): Promise<{ id: string; token: string }> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/e2e/whatsapp-intent?phone=${encodeURIComponent(phone)}`)
    if (res.ok()) {
      const data = await res.json()
      if (data.id && data.token) return { id: data.id, token: data.token }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`WhatsApp intent not found for ${phone}`)
}

function nextCustomerPhone(ownerPhone: string, customerName: string) {
  const offset = customerName.charCodeAt(0) % 10
  return `${ownerPhone.slice(0, -1)}${offset}`
}

function nextJakartaDateTimeLocal() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(tomorrow)
  const value = (type: string) => parts.find((part) => part.type === type)?.value || ""
  return `${value("year")}-${value("month")}-${value("day")}T10:00`
}
