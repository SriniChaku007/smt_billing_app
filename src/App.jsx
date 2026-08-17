import { useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'
import smtLogo from "./assets/smt_logo.png";


const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = getLocalDateString()
const initialItemForm = {
  itemName: '',
  mrp: '',
  quantity: '1',
  discountPercent: '',
  discountAmount: '',
  smtPrice: 0,
}

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0))

const getLineMrp = (item) => Number(item.mrp || 0)
const getLineDiscountAmount = (item) => Number(item.discountAmount || 0)
const getLineSmtPrice = (item) => Number(item.smtPrice || 0)
const getLineAfterDiscount = (item) => Math.max(0, Number(item.mrp || 0) - Number(item.discountAmount || 0))

const normalizeDecimalInput = (value) => {
  const raw = value.replace(/[^0-9.]/g, '')
  const parts = raw.split('.')
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`
  }
  return raw
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const recalculateDraftItem = (draft, changedField) => {
  const mrpValue = Number(draft.mrp || 0)
  const quantityValue = Math.max(1, Number(draft.quantity || 1))
  const percentValue = draft.discountPercent === '' ? null : Number(draft.discountPercent)
  const amountValue = draft.discountAmount === '' ? null : Number(draft.discountAmount)

  const lineMrpValue = mrpValue * quantityValue

  if (changedField === 'quantity') {
    if (draft.discountPercent !== '') {
      const nextPercent = clamp(Number(draft.discountPercent || 0), 0, 99.999)
      const computedAmount = lineMrpValue > 0 ? (lineMrpValue * nextPercent) / 100 : 0
      return {
        ...draft,
        quantity: String(quantityValue),
        discountPercent: String(nextPercent),
        discountAmount: (computedAmount / quantityValue).toFixed(2),
        smtPrice: Math.max(0, lineMrpValue - computedAmount),
      }
    }

    if (draft.discountAmount !== '') {
      const nextAmount = clamp(Number(draft.discountAmount || 0), 0, lineMrpValue)
      const computedPercent = lineMrpValue > 0 ? (nextAmount / lineMrpValue) * 100 : 0
      return {
        ...draft,
        quantity: String(quantityValue),
        discountAmount: nextAmount.toFixed(2),
        discountPercent: computedPercent.toFixed(2),
        smtPrice: Math.max(0, lineMrpValue - nextAmount),
      }
    }

    return {
      ...draft,
      quantity: String(quantityValue),
      smtPrice: Math.max(0, lineMrpValue),
    }
  }

  if (changedField === 'mrp') {
    if (draft.discountPercent !== '') {
      const nextPercent = clamp(Number(draft.discountPercent || 0), 0, 99.999)
      const computedAmount = lineMrpValue > 0 ? (lineMrpValue * nextPercent) / 100 : 0
      return {
        ...draft,
        discountPercent: String(nextPercent),
        discountAmount: (computedAmount / quantityValue).toFixed(2),
        smtPrice: Math.max(0, lineMrpValue - computedAmount),
      }
    }

    if (draft.discountAmount !== '') {
      const nextAmount = clamp(Number(draft.discountAmount || 0), 0, lineMrpValue)
      const computedPercent = lineMrpValue > 0 ? (nextAmount / lineMrpValue) * 100 : 0
      return {
        ...draft,
        discountAmount: nextAmount.toFixed(2),
        discountPercent: computedPercent.toFixed(2),
        smtPrice: Math.max(0, lineMrpValue - nextAmount),
      }
    }

    return {
      ...draft,
      smtPrice: Math.max(0, lineMrpValue),
    }
  }

  if (changedField === 'discountPercent') {
    if (draft.discountPercent === '') {
      return {
        ...draft,
        discountAmount: '',
        smtPrice: Math.max(0, lineMrpValue),
      }
    }

    const nextPercent = clamp(Number(draft.discountPercent || 0), 0, 99.999)
    const computedAmount = lineMrpValue > 0 ? (lineMrpValue * nextPercent) / 100 : 0

    return {
      ...draft,
      discountPercent: String(nextPercent),
      discountAmount: (computedAmount / quantityValue).toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - computedAmount),
    }
  }

  if (changedField === 'discountAmount') {
    if (draft.discountAmount === '') {
      return {
        ...draft,
        discountPercent: '',
        smtPrice: Math.max(0, lineMrpValue),
      }
    }

    const nextAmount = clamp(Number(draft.discountAmount || 0), 0, lineMrpValue)
    const computedPercent = lineMrpValue > 0 ? (nextAmount / lineMrpValue) * 100 : 0

    return {
      ...draft,
      discountAmount: nextAmount.toFixed(2),
      discountPercent: computedPercent.toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - nextAmount),
    }
  }

  if (percentValue !== null && amountValue === null) {
    const nextPercent = clamp(percentValue, 0, 99.999)
    const computedAmount = lineMrpValue > 0 ? (lineMrpValue * nextPercent) / 100 : 0
    return {
      ...draft,
      discountPercent: String(nextPercent),
      discountAmount: (computedAmount / quantityValue).toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - computedAmount),
    }
  }

  if (amountValue !== null && percentValue === null) {
    const nextAmount = clamp(amountValue, 0, lineMrpValue)
    const computedPercent = lineMrpValue > 0 ? (nextAmount / lineMrpValue) * 100 : 0
    return {
      ...draft,
      discountAmount: nextAmount.toFixed(2),
      discountPercent: computedPercent.toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - nextAmount),
    }
  }

  return {
    ...draft,
    quantity: String(quantityValue),
    smtPrice: Math.max(0, lineMrpValue),
  }
}

function App() {
  const [customerName, setCustomerName] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [paymentDate, setPaymentDate] = useState(today)
  const [itemForm, setItemForm] = useState(initialItemForm)
  const [items, setItems] = useState([])
  const [editingItemId, setEditingItemId] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('Paid')
  const [paymentMode, setPaymentMode] = useState('Online')
  const [partialAmount, setPartialAmount] = useState('')
  const [roundOff, setRoundOff] = useState(0)
  const [errors, setErrors] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [pdfBlob, setPdfBlob] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')

  const totalMrp = items.reduce((sum, item) => sum + getLineMrp(item) * Number(item.quantity || 1), 0)
  const totalDiscountedAmount = items.reduce(
    (sum, item) => sum + getLineDiscountAmount(item) * Number(item.quantity || 1),
    0,
  )
  const totalSmtPrice = items.reduce((sum, item) => sum + getLineSmtPrice(item), 0)
  const totalBillAmount = totalMrp - totalDiscountedAmount + Number(roundOff || 0)

  const resetItemForm = () => {
    setItemForm(initialItemForm)
    setFormErrors({})
    setEditingItemId(null)
  }

  const handleDraftFieldChange = (field, value) => {
    setItemForm((current) => recalculateDraftItem({ ...current, [field]: value }, field))
    setFormErrors((current) => ({ ...current, [field]: '' }))
  }

  const validateItemForm = (item) => {
    const nextErrors = {}

    if (!item.itemName.trim()) {
      nextErrors.itemName = 'Item details are required.'
    }

    if (Number(item.quantity) <= 0 || !Number.isInteger(Number(item.quantity))) {
      nextErrors.quantity = 'Quantity must be a positive whole number.'
    }

    if (Number(item.mrp) <= 0) {
      nextErrors.mrp = 'MRP must be greater than 0.'
    }

    if (Number(item.discountPercent) < 0 || Number(item.discountPercent) >= 100) {
      nextErrors.discountPercent = 'Discount % must be between 0 and below 100.'
    }

    const maxDiscountAmount = Number(item.mrp || 0) * Number(item.quantity || 1)
    if (
      Number(item.discountAmount) < 0 ||
      Number(item.discountAmount) > maxDiscountAmount
    ) {
      nextErrors.discountAmount = 'Discount amount must be between 0 and MRP x quantity.'
    }

    if (Number(item.smtPrice) < 0) {
      nextErrors.smtPrice = 'SMT Price cannot be negative.'
    }

    return nextErrors
  }

  const validateCustomerData = () => {
    const nextErrors = {}

    if (!customerName.trim()) {
      nextErrors.customerName = 'Customer name is required.'
    }

    const mobilePattern = /^(?:\+?91|0)?\d{10}$/
    if (!mobileNumber.trim() || !mobilePattern.test(mobileNumber.trim().replace(/\s+/g, ''))) {
      nextErrors.mobileNumber = 'Enter a valid 10-digit mobile number.'
    }

    if (!purchaseDate) {
      nextErrors.purchaseDate = 'Purchase date is required.'
    }

    if (!paymentDate) {
      nextErrors.paymentDate = 'Payment date is required.'
    }

    if (paymentStatus === 'Partially Paid') {
      const partialValue = Number(partialAmount || 0)
      if (partialValue <= 0) {
        nextErrors.partialAmount = 'Enter partial payment amount.'
      } else if (partialValue >= totalBillAmount) {
        nextErrors.partialAmount = 'Partial amount must be below total bill amount.'
      }
    }

    return nextErrors
  }

  const validateBill = () => {
    const nextErrors = {}

    if (items.length === 0) {
      nextErrors.items = 'At least one item is required.'
    }

    items.forEach((item, index) => {
      const itemErrors = validateItemForm(item)
      if (Object.keys(itemErrors).length) {
        nextErrors[`item-${index}`] = itemErrors
      }
    })

    return nextErrors
  }

  const handleAddItem = (event) => {
    event.preventDefault()

    const itemPayload = {
      itemName: itemForm.itemName.trim(),
      mrp: Number(itemForm.mrp || 0),
      quantity: Number(itemForm.quantity || 1),
      discountPercent: Number(itemForm.discountPercent || 0),
      discountAmount: Number(itemForm.discountAmount || 0),
      smtPrice: Number(itemForm.smtPrice || 0),
    }

    const validation = validateItemForm(itemPayload)
    if (Object.keys(validation).length) {
      setFormErrors(validation)
      return
    }

    const itemToSave = {
      id: editingItemId || Date.now(),
      ...itemPayload,
      itemName: itemPayload.itemName,
      quantity: Math.max(1, itemPayload.quantity),
    }

    if (editingItemId) {
      setItems((current) => current.map((item) => (item.id === editingItemId ? itemToSave : item)))
    } else {
      setItems((current) => [...current, itemToSave])
    }

    resetItemForm()
  }

  const handleEditItem = (item) => {
    setEditingItemId(item.id)
    setItemForm({
      itemName: item.itemName,
      mrp: String(item.mrp),
      quantity: String(item.quantity || 1),
      discountPercent: String(item.discountPercent),
      discountAmount: String(item.discountAmount),
      smtPrice: item.smtPrice,
    })
    setFormErrors({})
  }

  const handleDeleteItem = (itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId))
    if (editingItemId === itemId) {
      resetItemForm()
    }
  }

  const downloadPdf = () => {
    if (!pdfBlob) {
      return
    }

    const url = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = 'SMT_Sports_Bill__.pdf'
    downloadLink.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleGeneratePdf = async () => {
    const validationErrors = { ...validateCustomerData(), ...validateBill() }
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setErrors({})

    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 36

    doc.setFillColor(241, 245, 249)
    doc.rect(0, 0, pageWidth, 84, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.setTextColor(15, 23, 42)
    doc.text('SMT Sports', margin, 38)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(55, 65, 81)
    doc.text('No.134/2, Gandhi Road,', pageWidth - 150, 32)
    doc.text('9, Alapakkam,', pageWidth - 150, 46)
    doc.text('Chennai - 600063.', pageWidth - 150, 60)

    if (smtLogo) {
      doc.addImage(smtLogo, 'PNG', pageWidth - margin - 74, 10, 58, 58)
    }

    let currentY = 106
    doc.setDrawColor(203, 213, 225)
    doc.line(margin, currentY, pageWidth - margin, currentY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text('Customer Name:', margin, currentY + 22)
    doc.setFont('helvetica', 'normal')
    doc.text(customerName || '-', margin + 110, currentY + 22)

    doc.setFont('helvetica', 'bold')
    doc.text('Mobile Number:', margin + 260, currentY + 22)
    doc.setFont('helvetica', 'normal')
    doc.text(mobileNumber || '-', margin + 360, currentY + 22)

    doc.setFont('helvetica', 'bold')
    doc.text('Purchase Date:', margin, currentY + 42)
    doc.setFont('helvetica', 'normal')
    doc.text(purchaseDate || '-', margin + 110, currentY + 42)

    doc.setFont('helvetica', 'bold')
    doc.text('Payment Date:', margin + 260, currentY + 42)
    doc.setFont('helvetica', 'normal')
    doc.text(paymentDate || '-', margin + 355, currentY + 42)

    currentY += 70

    autoTable(doc, {
      startY: currentY,
      head: [['Item Details', 'MRP', 'Discount %', 'Discount Amount', 'After Discount', 'Qty', 'SMT Price']],
      body: items.map((item) => [
        item.itemName,
        formatCurrency(getLineMrp(item)),
        `${Number(item.discountPercent || 0).toFixed(2)}%`,
        formatCurrency(getLineDiscountAmount(item)),
        formatCurrency(getLineAfterDiscount(item)),
        String(item.quantity || 1),
        formatCurrency(getLineSmtPrice(item)),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { halign: 'center', cellWidth: 34 },
        2: { halign: 'right', cellWidth: 54 },
        3: { halign: 'right', cellWidth: 52 },
        4: { halign: 'right', cellWidth: 72 },
        5: { halign: 'right', cellWidth: 72 },
        6: { halign: 'right', cellWidth: 72 },
      },
      margin: { left: margin, right: margin },
    })

    const summaryY = doc.lastAutoTable.finalY + 18
    const paymentStartY = summaryY
    const summaryX = pageWidth - margin - 180

    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.text('Payment Status:', margin, paymentStartY)
    doc.setFont('helvetica', 'normal')
    doc.text(paymentStatus, margin + 120, paymentStartY)

    doc.setFont('helvetica', 'bold')
    doc.text('Payment Mode:', margin, paymentStartY + 22)
    doc.setFont('helvetica', 'normal')
    doc.text(paymentMode, margin + 120, paymentStartY + 22)

    if (paymentStatus === 'Partially Paid') {
      doc.setFont('helvetica', 'bold')
      doc.text('Partial Amount:', margin, paymentStartY + 44)
      doc.setFont('helvetica', 'normal')
      doc.text(formatCurrency(partialAmount || 0), margin + 120, paymentStartY + 44)
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Total MRP:', summaryX, summaryY)
    doc.text(formatCurrency(totalMrp), pageWidth - margin, summaryY, { align: 'right' })

    doc.text('Total Discounted Amount:', summaryX, summaryY + 20)
    doc.text(formatCurrency(totalDiscountedAmount), pageWidth - margin, summaryY + 20, {
      align: 'right',
    })

    doc.text('Round Off Amount:', summaryX, summaryY + 40)
    doc.text(formatCurrency(roundOff), pageWidth - margin, summaryY + 40, {
      align: 'right',
    })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(22, 101, 52)
    doc.text('Total Bill Amount:', summaryX, summaryY + 70)
    doc.text(formatCurrency(totalBillAmount), pageWidth - margin, summaryY + 70, {
      align: 'right',
    })

    const footerY = pageHeight - 64
    doc.setDrawColor(203, 213, 225)
    doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Thank you for choosing SMT Sports — Your Ultimate Cricket Destination. We look forward to serving you again!', margin, footerY)

    doc.setFont('helvetica', 'normal')
    doc.text('Phone:', margin, footerY + 20)
    doc.text('97916 30322, 70921 50426', margin + 52, footerY + 20)

    doc.text('Instagram:', margin + 260, footerY + 20)
    doc.text('smt_sports_', margin + 330, footerY + 20)

    const pdfBlobResult = doc.output('blob')
    setPdfBlob(pdfBlobResult)
    setPdfUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
      return URL.createObjectURL(pdfBlobResult)
    })
  }

  const handleShareWhatsapp = async () => {
    if (!pdfBlob) {
      return
    }

    const shareText = [
      'SMT Sports Bill',
      `Customer: ${customerName}`,
      `Mobile: ${mobileNumber}`,
      `Purchase Date: ${purchaseDate}`,
      `Payment Date: ${paymentDate}`,
      `Total Bill Amount: ${formatCurrency(totalBillAmount)}`,
      `Payment Status: ${paymentStatus}`,
      `Partial Amount: ${paymentStatus === 'Partially Paid' ? formatCurrency(partialAmount || 0) : '-'}`,
      `Payment Mode: ${paymentMode}`,
    ].join('\n')

    if (navigator.share && window.isSecureContext) {
      try {
        const file = new File([pdfBlob], 'SMT_Sports_Bill__.pdf', { type: 'application/pdf' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'SMT Sports Bill',
            text: shareText,
            files: [file],
          })
          return
        }
      } catch (error) {
        console.error('Share failed', error)
      }
    }

    downloadPdf()
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  return (
    <div className="billing-app">
      <div className="page-shell">
        <header className="page-header">
          <div>
            <h1>SMT Sports Billing</h1>
          </div>
        </header>

        <main className="billing-layout">
          <section className="card customer-card">
            <div className="section-heading">
              <h2>Customer Details</h2>
            </div>
            <div className="field-grid customer-grid">
              <div className="field-group">
                <label htmlFor="customerName">Customer Name</label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value)
                    setErrors((current) => ({ ...current, customerName: '' }))
                  }}
                  placeholder="Enter customer name"
                  className={errors.customerName ? 'invalid' : ''}
                />
                {errors.customerName && <span className="error-text">{errors.customerName}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="mobileNumber">Mobile Number</label>
                <input
                  id="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  value={mobileNumber}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9+]/g, '')
                    setMobileNumber(value)
                    setErrors((current) => ({ ...current, mobileNumber: '' }))
                  }}
                  placeholder="Enter mobile number"
                  className={errors.mobileNumber ? 'invalid' : ''}
                />
                {errors.mobileNumber && <span className="error-text">{errors.mobileNumber}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="purchaseDate">Purchase Date</label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => {
                    setPurchaseDate(event.target.value)
                    setErrors((current) => ({ ...current, purchaseDate: '' }))
                  }}
                  className={errors.purchaseDate ? 'invalid' : ''}
                />
                {errors.purchaseDate && <span className="error-text">{errors.purchaseDate}</span>}
              </div>

              <div className="field-group">
                <label htmlFor="paymentDate">Payment Date</label>
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => {
                    setPaymentDate(event.target.value)
                    setErrors((current) => ({ ...current, paymentDate: '' }))
                  }}
                  className={errors.paymentDate ? 'invalid' : ''}
                />
                {errors.paymentDate && <span className="error-text">{errors.paymentDate}</span>}
              </div>
            </div>
          </section>

          <section className="card item-card">
            <div className="section-heading">
              <h2>{editingItemId ? 'Edit Bill Item' : 'Add Bill Item'}</h2>
            </div>

            <form onSubmit={handleAddItem} className="item-form">
              <div className="field-grid item-grid">
                <div className="field-group full-width">
                  <label htmlFor="itemName">Item Details</label>
                  <input
                    id="itemName"
                    type="text"
                    value={itemForm.itemName}
                    onChange={(event) => handleDraftFieldChange('itemName', event.target.value)}
                    placeholder="Enter item details"
                    className={formErrors.itemName ? 'invalid' : ''}
                  />
                  {formErrors.itemName && <span className="error-text">{formErrors.itemName}</span>}
                </div>

                <div className="field-group">
                  <label htmlFor="mrp">MRP</label>
                  <input
                    id="mrp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.mrp}
                    onChange={(event) => handleDraftFieldChange('mrp', event.target.value)}
                    placeholder="0.00"
                    className={formErrors.mrp ? 'invalid' : ''}
                  />
                  {formErrors.mrp && <span className="error-text">{formErrors.mrp}</span>}
                </div>

                <div className="field-group">
                  <label htmlFor="discountPercent">Discount %</label>
                  <input
                    id="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={itemForm.discountPercent}
                    onChange={(event) => handleDraftFieldChange('discountPercent', event.target.value)}
                    placeholder="0.00"
                    className={formErrors.discountPercent ? 'invalid' : ''}
                  />
                  {formErrors.discountPercent && (
                    <span className="error-text">{formErrors.discountPercent}</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="discountAmount">Discount Amount</label>
                  <input
                    id="discountAmount"
                    type="text"
                    inputMode="decimal"
                    value={itemForm.discountAmount}
                    onChange={(event) =>
                      handleDraftFieldChange('discountAmount', normalizeDecimalInput(event.target.value))
                    }
                    placeholder="0"
                    className={formErrors.discountAmount ? 'invalid' : ''}
                  />
                  {formErrors.discountAmount && (
                    <span className="error-text">{formErrors.discountAmount}</span>
                  )}
                </div>

                <div className="field-group">
                  <label htmlFor="afterDiscount">After Discount</label>
                  <input
                    id="afterDiscount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={Math.max(0, Number(itemForm.mrp || 0) - Number(itemForm.discountAmount || 0))}
                    readOnly
                    className={formErrors.smtPrice ? 'invalid readonly-input' : 'readonly-input'}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="quantity">Quantity</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={itemForm.quantity}
                    onChange={(event) => handleDraftFieldChange('quantity', event.target.value)}
                    placeholder="1"
                    className={formErrors.quantity ? 'invalid' : ''}
                  />
                  {formErrors.quantity && <span className="error-text">{formErrors.quantity}</span>}
                </div>

                <div className="field-group">
                  <label htmlFor="smtPrice">SMT Price</label>
                  <input
                    id="smtPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={itemForm.smtPrice}
                    readOnly
                    className={formErrors.smtPrice ? 'invalid readonly-input' : 'readonly-input'}
                  />
                  {formErrors.smtPrice && <span className="error-text">{formErrors.smtPrice}</span>}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-btn">
                  {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
                {editingItemId && (
                  <button type="button" className="secondary-btn" onClick={resetItemForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card items-card">
            <div className="section-heading">
              <h2>Bill Items</h2>
            </div>

            {items.length > 0 ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Item Details</th>
                      <th>MRP</th>
                      <th>Discount %</th>
                      <th>Discount Amount</th>
                      <th>After Discount</th>
                      <th>Quantity</th>
                      <th>SMT Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.itemName}</td>
                        <td>{formatCurrency(getLineMrp(item))}</td>
                        <td>{Number(item.discountPercent || 0).toFixed(2)}%</td>
                        <td>{formatCurrency(getLineDiscountAmount(item))}</td>
                        <td>{formatCurrency(getLineAfterDiscount(item))}</td>
                        <td>{item.quantity || 1}</td>
                        <td>{formatCurrency(getLineSmtPrice(item))}</td>
                        <td>
                          <div className="table-actions">
                            <button type="button" className="tiny-btn edit-btn" onClick={() => handleEditItem(item)}>
                              Edit
                            </button>
                            <button type="button" className="tiny-btn delete-btn" onClick={() => handleDeleteItem(item.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No items added yet. Add your first bill item to begin.</div>
            )}
            {errors.items && <span className="error-text inline-error">{errors.items}</span>}
          </section>

          <section className="card payment-card">
            <div className="section-heading">
              <h2>Payment Details</h2>
            </div>

            <div className="choice-grid">
              <div className="choice-block">
                <label>Payment Status</label>
                <div className="toggle-group">
                  {['Paid', 'Partially Paid', 'Pending'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={paymentStatus === status ? 'toggle-option active' : 'toggle-option'}
                      onClick={() => setPaymentStatus(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="choice-block">
                <label>Payment Mode</label>
                <div className="toggle-group">
                  {['Online', 'Cash'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={paymentMode === mode ? 'toggle-option active' : 'toggle-option'}
                      onClick={() => setPaymentMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {paymentStatus === 'Partially Paid' && (
              <div className="partial-amount-block">
                <label htmlFor="partialAmount">Partial Amount</label>
                <input
                  id="partialAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={partialAmount}
                  onChange={(event) => {
                    const value = event.target.value
                    setPartialAmount(value)
                    setErrors((current) => ({ ...current, partialAmount: '' }))
                  }}
                  placeholder="Enter partial amount"
                  className={errors.partialAmount ? 'invalid' : ''}
                />
                {errors.partialAmount && <span className="error-text">{errors.partialAmount}</span>}
              </div>
            )}
          </section>

          <section className="card summary-card">
            <div className="section-heading">
              <h2>Bill Summary</h2>
            </div>

            <div className="summary-list">
              <div className="summary-row">
                <span>Total MRP</span>
                <strong>{formatCurrency(totalMrp)}</strong>
              </div>
              <div className="summary-row">
                <span>Total Discounted Amount</span>
                <strong>{formatCurrency(totalDiscountedAmount)}</strong>
              </div>
              <div className="summary-row round-off-row">
                <label htmlFor="roundOff">Round Off Amount</label>
                <input
                  id="roundOff"
                  type="number"
                  step="0.01"
                  value={roundOff}
                  onChange={(event) => setRoundOff(Number(event.target.value || 0))}
                />
              </div>
              <div className="summary-row total-row">
                <span>Total Bill Amount</span>
                <strong>{formatCurrency(totalBillAmount)}</strong>
              </div>
            </div>
          </section>

          <section className="card preview-card">
            <div className="section-heading preview-heading">
              <h2>Bill Preview</h2>
            </div>

            <div className="preview-invoice" aria-label="Billing preview">
              <div className="invoice-header">
                <div className="shop-info">
                  <h3>SMT Sports</h3>
                  <p>No.134/2, Gandhi Road,</p>
                  <p>9, Alapakkam,</p>
                  <p>Chennai - 600063.</p>
                </div>
                <div className="logo-wrap">
                  <img src={smtLogo} alt="SMT Sports logo" />
                </div>
              </div>

              <div className="invoice-customer">
                <div className="customer-line">
                  <span>Customer Name:</span>
                  <strong>{customerName || '-'}</strong>
                </div>
                <div className="customer-line">
                  <span>Mobile Number:</span>
                  <strong>{mobileNumber || '-'}</strong>
                </div>
                <div className="customer-line">
                  <span>Purchase Date:</span>
                  <strong>{purchaseDate || '-'}</strong>
                </div>
                <div className="customer-line">
                  <span>Payment Date:</span>
                  <strong>{paymentDate || '-'}</strong>
                </div>
              </div>

              <div className="invoice-table-wrapper">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Item Details</th>
                      <th>MRP</th>
                      <th>Discount %</th>
                      <th>Discount Amount</th>
                      <th>After Discount</th>
                      <th>Qty</th>
                      <th>SMT Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length > 0 ? (
                      items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.itemName}</td>
                          <td>{formatCurrency(getLineMrp(item))}</td>
                          <td>{Number(item.discountPercent || 0).toFixed(2)}%</td>
                          <td>{formatCurrency(getLineDiscountAmount(item))}</td>
                          <td>{formatCurrency(getLineAfterDiscount(item))}</td>
                          <td>{item.quantity || 1}</td>
                          <td>{formatCurrency(getLineSmtPrice(item))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="preview-empty">
                          No items added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="invoice-bottom-grid">
                <div className="invoice-payment-info">
                  <div className="payment-line">
                    <span>Payment Status:</span>
                    <strong>{paymentStatus}</strong>
                  </div>
                  {paymentStatus === 'Partially Paid' && (
                    <div className="payment-line">
                      <span>Partial Amount:</span>
                      <strong>{formatCurrency(partialAmount || 0)}</strong>
                    </div>
                  )}
                  <div className="payment-line">
                    <span>Payment Mode:</span>
                    <strong>{paymentMode}</strong>
                  </div>
                </div>

                <div className="invoice-summary">
                  <div className="summary-line">
                    <span>Total MRP:</span>
                    <strong>{formatCurrency(totalMrp)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Total Discounted Amount:</span>
                    <strong>{formatCurrency(totalDiscountedAmount)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Round Off Amount:</span>
                    <strong>{formatCurrency(roundOff)}</strong>
                  </div>
                  <div className="summary-line grand-total">
                    <span>Total Bill Amount:</span>
                    <strong>{formatCurrency(totalBillAmount)}</strong>
                  </div>
                </div>
              </div>

              <div className="invoice-footer">
                <p>Thank you for choosing SMT Sports — Your Ultimate Cricket Destination. <br />We look forward to serving you again!</p>
                <div className="footer-contact">
                  <span>
                    <PhoneIcon />
                    97916 30322, 70921 50426
                  </span>
                  <span>
                    <InstagramIcon />
                    smt_sports_
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="card action-card">
            <div className="action-buttons">
              <button type="button" className="primary-btn" onClick={handleGeneratePdf}>
                Generate PDF
              </button>
              <button type="button" className="secondary-btn" onClick={handleShareWhatsapp} disabled={!pdfBlob}>
                Share via WhatsApp
              </button>
            </div>
            {pdfUrl && (
              <div className="pdf-link-row">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  Open generated PDF
                </a>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 10.8c1.3 2.6 3.5 4.8 6.1 6.1l2-2c.3-.3.8-.4 1.2-.3 1.3.4 2.7.7 4.1.7.7 0 1.3.6 1.3 1.3V20c0 .7-.6 1.3-1.3 1.3C10.8 21.3 2.7 13.2 2.7 4.3c0-.7.6-1.3 1.3-1.3H6c.7 0 1.3.6 1.3 1.3 0 1.4.2 2.8.7 4.1.1.4 0 .9-.3 1.2l-2.1 2.1z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zm5.75-3.75a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25z" />
    </svg>
  )
}

export default App
