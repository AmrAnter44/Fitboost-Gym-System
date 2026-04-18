// Test script to check receipt filtering
const receipts = [
  { createdAt: "2024-02-15T10:00:00.000Z", type: "pt_new", amount: 1000 },
  { createdAt: "2024-03-05T10:00:00.000Z", type: "pt_new", amount: 1500 },
  { createdAt: "2024-03-15T10:00:00.000Z", type: "pt_renew", amount: 2000 },
  { createdAt: "2024-04-01T10:00:00.000Z", type: "pt_new", amount: 1200 },
]

const dateFrom = "2024-03-01"
const dateTo = "2024-03-31"

const start = new Date(dateFrom)
const end = new Date(dateTo)
end.setHours(23, 59, 59, 999)


const filtered = receipts.filter((receipt) => {
  const receiptDate = new Date(receipt.createdAt)
  const isInRange = !(receiptDate < start || receiptDate > end)
  return isInRange
})

