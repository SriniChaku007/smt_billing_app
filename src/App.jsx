import { useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import './App.css'
import smtLogo from "./assets/smt_logo.png";
import upiQr from "./assets/SMT_UPI.jpeg";
import instaQr from "./assets/SMT_INSTA.png";
import mapQr from "./assets/SMT_MAP.png";

const QR_CARDS = [
  {
    id: 'upi',
    image: upiQr,
    alt: 'UPI payment QR code',
    details: [{ label: '', value: 'smtsports1504@oksb' }],
  },
  {
    id: 'instagram',
    image: instaQr,
    alt: 'Instagram QR code',
    details: [{ label: '', value: 'smt_sports' }],
  },
  {
    id: 'location',
    image: mapQr,
    alt: 'Google Maps location QR code',
    details: [{ label: '', value: 'SMT Sports' }],
  },
]

const PRODUCT_CATALOG = [
  {
    name: 'Cricket Bat',
    mrp: 1800,
    discountPercent: 10,
    quantity: 1,
    discountAmount: 180,
    smtPrice: 1620,
  },
  {
    name: 'Cricket Gloves',
    mrp: 1200,
    discountPercent: 8,
    quantity: 1,
    discountAmount: 96,
    smtPrice: 1104,
  },
  {
    name: 'Cricket Helmet',
    mrp: 2500,
    discountPercent: 12,
    quantity: 1,
    discountAmount: 300,
    smtPrice: 2200,
  },
  {
    name: 'Cricket Shoes',
    mrp: 2200,
    discountPercent: 15,
    quantity: 1,
    discountAmount: 330,
    smtPrice: 1870,
  },
  {
    name: 'Practice Ball',
    mrp: 550,
    discountPercent: 5,
    quantity: 1,
    discountAmount: 27.5,
    smtPrice: 522.5,
  },
]

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
  selectedOption: 'other',
  itemName: '',
  mrp: '',
  quantity: '1',
  discountPercent: '',
  discountAmount: '',
  smtPrice: 0,
}

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0))

const html2canvasOptions = {
  scale: 2,
  useCORS: true,
  backgroundColor: '#ffffff',
  logging: false,
}

const getCanvasPdfHeight = (canvas, pdfWidth) => (canvas.height * pdfWidth) / canvas.width

const captureElement = (element) => {
  if (!element) {
    return Promise.resolve(null)
  }

  return html2canvas(element, html2canvasOptions)
}

const addCanvasImage = (doc, canvas, x, y, width, height) => {
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, width, height)
}

const addCanvasSlice = (doc, canvas, x, y, width, height, sourceY, sourceHeight) => {
  const sliceCanvas = document.createElement('canvas')
  const sliceHeight = Math.max(1, Math.ceil(sourceHeight))
  sliceCanvas.width = canvas.width
  sliceCanvas.height = sliceHeight
  const context = sliceCanvas.getContext('2d')
  context.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sliceHeight)
  addCanvasImage(doc, sliceCanvas, x, y, width, height)
}

const buildPaginatedInvoicePdf = async (headerElement, bodyElement, footerElement) => {
  const [headerCanvas, bodyCanvas, footerCanvas] = await Promise.all([
    captureElement(headerElement),
    captureElement(bodyElement),
    captureElement(footerElement),
  ])

  if (!headerCanvas || !bodyCanvas || !footerCanvas) {
    throw new Error('Missing invoice sections for PDF generation.')
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 24
  const sectionGap = 12
  const contentWidth = pageWidth - margin * 2

  const headerHeight = getCanvasPdfHeight(headerCanvas, contentWidth)
  const footerHeight = getCanvasPdfHeight(footerCanvas, contentWidth)
  const bodyFullHeight = getCanvasPdfHeight(bodyCanvas, contentWidth)
  const bodyAreaTop = margin + headerHeight + sectionGap
  const footerTop = pageHeight - margin - footerHeight
  const maxBodyHeightPerPage = Math.max(0, footerTop - sectionGap - bodyAreaTop)

  let bodyOffsetPdf = 0
  let pageIndex = 0

  while (pageIndex === 0 || bodyOffsetPdf < bodyFullHeight - 0.5) {
    if (pageIndex > 0) {
      doc.addPage()
    }

    addCanvasImage(doc, headerCanvas, margin, margin, contentWidth, headerHeight)
    addCanvasImage(doc, footerCanvas, margin, footerTop, contentWidth, footerHeight)

    const remainingBodyHeight = bodyFullHeight - bodyOffsetPdf
    const sliceHeightPdf = Math.min(maxBodyHeightPerPage, remainingBodyHeight)

    if (sliceHeightPdf > 0.5) {
      const sourceYOffset = (bodyOffsetPdf / bodyFullHeight) * bodyCanvas.height
      const sourceSliceHeight = (sliceHeightPdf / bodyFullHeight) * bodyCanvas.height
      addCanvasSlice(
        doc,
        bodyCanvas,
        margin,
        bodyAreaTop,
        contentWidth,
        sliceHeightPdf,
        sourceYOffset,
        sourceSliceHeight,
      )
      bodyOffsetPdf += sliceHeightPdf
    }

    pageIndex += 1
  }

  return doc
}

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

  const applyPerUnitDiscount = (nextDraft, perUnitDiscount, { preserveAmountInput = false } = {}) => {
    const clampedPerUnitDiscount = clamp(perUnitDiscount, 0, mrpValue)
    const totalDiscount = clampedPerUnitDiscount * quantityValue
    const computedPercent = lineMrpValue > 0 ? (totalDiscount / lineMrpValue) * 100 : 0

    return {
      ...nextDraft,
      discountAmount: preserveAmountInput
        ? nextDraft.discountAmount
        : clampedPerUnitDiscount.toFixed(2),
      discountPercent: computedPercent.toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - totalDiscount),
    }
  }

  const applyPercentDiscount = (nextDraft, nextPercent) => {
    const clampedPercent = clamp(nextPercent, 0, 99.999)
    const totalDiscount = lineMrpValue > 0 ? (lineMrpValue * clampedPercent) / 100 : 0

    return {
      ...nextDraft,
      discountPercent: String(clampedPercent),
      discountAmount: (totalDiscount / quantityValue).toFixed(2),
      smtPrice: Math.max(0, lineMrpValue - totalDiscount),
    }
  }

  if (changedField === 'quantity') {
    if (draft.discountPercent !== '') {
      return applyPercentDiscount(
        { ...draft, quantity: String(quantityValue) },
        Number(draft.discountPercent || 0),
      )
    }

    if (draft.discountAmount !== '') {
      return applyPerUnitDiscount(
        { ...draft, quantity: String(quantityValue) },
        Number(draft.discountAmount || 0),
      )
    }

    return {
      ...draft,
      quantity: String(quantityValue),
      smtPrice: Math.max(0, lineMrpValue),
    }
  }

  if (changedField === 'mrp') {
    if (draft.discountPercent !== '') {
      return applyPercentDiscount(draft, Number(draft.discountPercent || 0))
    }

    if (draft.discountAmount !== '') {
      return applyPerUnitDiscount(draft, Number(draft.discountAmount || 0))
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

    return applyPercentDiscount(draft, Number(draft.discountPercent || 0))
  }

  if (changedField === 'discountAmount') {
    if (draft.discountAmount === '') {
      return {
        ...draft,
        discountPercent: '',
        smtPrice: Math.max(0, lineMrpValue),
      }
    }

    return applyPerUnitDiscount(draft, Number(draft.discountAmount || 0), {
      preserveAmountInput: true,
    })
  }

  if (percentValue !== null && amountValue === null) {
    return applyPercentDiscount(draft, percentValue)
  }

  if (amountValue !== null && percentValue === null) {
    return applyPerUnitDiscount(draft, amountValue)
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
  const [paymentStatus, setPaymentStatus] = useState('Pending')
  const [paymentMode, setPaymentMode] = useState('Online')
  const [partialAmount, setPartialAmount] = useState('')
  const [roundOff, setRoundOff] = useState(0)
  const [errors, setErrors] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [pdfBlob, setPdfBlob] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const previewRef = useRef(null)
  const previewHeaderRef = useRef(null)
  const previewBodyRef = useRef(null)
  const previewFooterRef = useRef(null)

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

  const handleItemOptionChange = (selectedValue) => {
    if (!selectedValue || selectedValue === 'other') {
      setItemForm((current) => ({
        ...initialItemForm,
        ...current,
        selectedOption: 'other',
        itemName: '',
      }))
      setFormErrors({})
      return
    }

    const selectedProduct = PRODUCT_CATALOG.find((product) => product.name === selectedValue)
    if (!selectedProduct) {
      return
    }

    const productDefaults = {
      selectedOption: selectedProduct.name,
      itemName: selectedProduct.name,
      mrp: String(selectedProduct.mrp ?? ''),
      quantity: String(selectedProduct.quantity || 1),
      discountPercent: String(selectedProduct.discountPercent ?? 0),
      discountAmount: String(selectedProduct.discountAmount ?? 0),
      smtPrice: Number(selectedProduct.smtPrice ?? 0),
    }

    setItemForm((current) => ({
      ...current,
      ...productDefaults,
    }))
    setFormErrors({})
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

    if (
      Number(item.discountAmount) < 0 ||
      Number(item.discountAmount) > Number(item.mrp || 0)
    ) {
      nextErrors.discountAmount = 'Discount amount must be between 0 and MRP.'
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

    const matchingCatalogItem = PRODUCT_CATALOG.find((product) => product.name === item.itemName)

    setItemForm({
      selectedOption: matchingCatalogItem ? matchingCatalogItem.name : 'other',
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

  const getPdfFileName = () => {
    const safeCustomerName = customerName.trim().replace(/[^\w-]+/g, '_') || 'Customer'
    return `SMT_Sports_Bill_${safeCustomerName}.pdf`
  }

  const getBillShareText = () =>
    [
      'SMT Sports Bill',
      `Customer: ${customerName}`,
      `Mobile: ${mobileNumber}`,
      `Purchase Date: ${purchaseDate}`,
      `Payment Date: ${paymentDate}`,
      `Total Bill Amount: ${formatCurrency(totalBillAmount)}`,
      `Payment Status: ${paymentStatus}`,
      `Paid Amount: ${paymentStatus === 'Partially Paid' ? formatCurrency(partialAmount || 0) : paymentStatus === 'Paid' ? formatCurrency(totalBillAmount) : '-'}`,
      `Payment Mode: ${paymentMode}`,
    ].join('\n')

  const downloadPdf = (blob = pdfBlob) => {
    if (!blob) {
      return
    }

    const url = URL.createObjectURL(blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = url
    downloadLink.download = getPdfFileName()
    downloadLink.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const sharePdfBlob = async (blob) => {
    if (!blob) {
      return false
    }

    const shareText = getBillShareText()
    const file = new File([blob], getPdfFileName(), { type: 'application/pdf' })

    if (navigator.share && window.isSecureContext) {
      try {
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'SMT Sports Bill',
            text: shareText,
            files: [file],
          })
          return true
        }
      } catch (error) {
        if (error?.name === 'AbortError') {
          return true
        }
        console.error('Share failed', error)
      }
    }

    return false
  }

  const handleGeneratePdf = async () => {
    const validationErrors = { ...validateCustomerData(), ...validateBill() }
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    if (!previewHeaderRef.current || !previewBodyRef.current || !previewFooterRef.current) {
      return
    }

    setErrors({})

    const pdfPreviewWindow = window.open('', '_blank')
    if (pdfPreviewWindow) {
      pdfPreviewWindow.document.title = getPdfFileName()
      pdfPreviewWindow.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 24px;">Generating bill PDF...</p>'
    }

    try {
      const doc = await buildPaginatedInvoicePdf(
        previewHeaderRef.current,
        previewBodyRef.current,
        previewFooterRef.current,
      )

      const pdfBlobResult = doc.output('blob')
      const pdfObjectUrl = URL.createObjectURL(pdfBlobResult)

      setPdfBlob(pdfBlobResult)
      setPdfUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }
        return pdfObjectUrl
      })

      if (pdfPreviewWindow) {
        pdfPreviewWindow.location.href = pdfObjectUrl
      } else {
        window.open(pdfObjectUrl, '_blank')
      }

      await sharePdfBlob(pdfBlobResult)
    } catch (error) {
      pdfPreviewWindow?.close()
      console.error('PDF generation failed', error)
      setErrors((current) => ({
        ...current,
        pdf: 'Could not generate the bill PDF. Please try again.',
      }))
    }
  }

  const handleSharePdf = async () => {
    if (!pdfBlob) {
      return
    }

    const shared = await sharePdfBlob(pdfBlob)
    if (!shared) {
      downloadPdf()
      window.open(`https://wa.me/?text=${encodeURIComponent(getBillShareText())}`, '_blank')
    }
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
                  <select
                    id="itemName"
                    value={itemForm.selectedOption}
                    onChange={(event) => handleItemOptionChange(event.target.value)}
                    className={formErrors.itemName ? 'invalid' : ''}
                  >
                    <option value="other">Other</option>
                    {PRODUCT_CATALOG.map((product) => (
                      <option key={product.name} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.itemName && <span className="error-text">{formErrors.itemName}</span>}
                </div>

                {itemForm.selectedOption === 'other' && (
                  <div className="field-group full-width">
                    <label htmlFor="manualItemName">Enter Item Details</label>
                    <input
                      id="manualItemName"
                      type="text"
                      value={itemForm.itemName}
                      onChange={(event) => handleDraftFieldChange('itemName', event.target.value)}
                      placeholder="Enter item details manually"
                      className={formErrors.itemName ? 'invalid' : ''}
                    />
                  </div>
                )}

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
                    type="number"
                    min="0"
                    step="0.01"
                    max={Number(itemForm.mrp || 0) || undefined}
                    value={itemForm.discountAmount}
                    onChange={(event) =>
                      handleDraftFieldChange('discountAmount', normalizeDecimalInput(event.target.value))
                    }
                    placeholder="0.00"
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
                      <th>Dis %</th>
                      <th>Dis Amount</th>
                      <th>After Dis</th>
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
                  {['Pending', 'Partially Paid', 'Paid'].map((status) => (
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
                  {['Online', 'Cash', 'Cash & Online'].map((mode) => (
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
                  // min="0"
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    // Allow "-" for quickly inputting negative and also allow empty string
                    if (rawValue === "" || rawValue === "-") {
                      setRoundOff(rawValue);
                    } else {
                      const num = Number(rawValue);
                      setRoundOff(isNaN(num) ? 0 : num);
                    }

                  }}
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

            <div className="preview-invoice" ref={previewRef} aria-label="Billing preview">
              <div ref={previewHeaderRef} className="invoice-pdf-header">
                <div className="invoice-title" style={{ textAlign: "center", marginBottom: "1em" }}>
                  <h1 style={{ margin: 0, fontSize: "2em" }}>Sales Order</h1>
                </div>

                <div className="invoice-header">
                  <div className="shop-info">
                    <h3>SMT Sports</h3>
                    <p style={{ display: "flex", alignItems: "center", gap: "0.5em", margin: 0 }}>
                      <span role="img" aria-label="Phone" style={{ fontSize: "1.1em" }}>📞</span>
                      <span>97916 30322, 70921 50426</span>
                    </p>
                    <p style={{ margin: 0, fontSize: "0.95em", color: "#555" }}>
                      <strong>MSME No:</strong> UDYAM-TN-34-0114424
                    </p>
                  </div>
                  <div className="logo-wrap" style={{ width: "120px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={smtLogo} alt="SMT Sports logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                </div>
              </div>

              <div ref={previewBodyRef} className="invoice-pdf-body">
              <div className="invoice-customer">
                <div className="customer-line">
                  <span>Customer Name: <strong>{customerName || '-'}</strong></span>
                </div>
                <div className="customer-line">
                  <span>Customer Mobile Number: <strong>{mobileNumber || '-'}</strong></span>
                </div>
                <div className="customer-line">
                  <span>Purchase Date: <strong>{purchaseDate || '-'}</strong></span>
                </div>
                <div className="customer-line">
                  <span>Payment Date: <strong>{paymentDate || '-'}</strong></span>
                </div>
              </div>

              <div className="invoice-table-wrapper">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Item Details</th>
                      <th>MRP</th>
                      <th>Dis %</th>
                      <th>Dis Amount</th>
                      <th>After Dis</th>
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
                    <>
                      <div className="payment-line">
                        <span>Paid Amount:</span>
                        <strong>{formatCurrency(partialAmount || 0)}</strong>
                      </div>
                      <div className="payment-line">
                        <span>Balance Amount:</span>
                        <strong>{formatCurrency(totalBillAmount - (partialAmount || 0))}</strong>
                      </div>
                    </>
                  )}
                  {paymentStatus === 'Paid' && (
                    <div className="payment-line">
                      <span>Paid Amount:</span>
                      <strong>{formatCurrency(totalBillAmount)}</strong>
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

              <div className="invoice-qr-section">
                <div className="qr-card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {/* <img src={smtLogo} alt="" className="qr-card-logo" /> */}
                  <span style={{
                    fontWeight: 700,
                    fontSize: "1.2rem",
                    // color: "rgb(0, 100, 200)", // SMT blue
                    // For logo gradient: also mix with orange (#e64d2e), e.g. using a multi-color effect
                    // Example: use a gradient text if supported, fallback to blue/orange for cross-compatibility
                    // You may toggle between blue and orange (#e64d2e) for brand consistency
                    // WebkitBackgroundClip: "text",
                    // WebkitTextFillColor: "transparent",
                    // backgroundClip: "text",
                    marginTop: 6,
                    letterSpacing: "0.5px",
                    textAlign: "center"
                  }}>
                    Scan To Know More About - SMT Sports
                  </span>

                </div>

                <div className="qr-cards-grid">

                  {QR_CARDS.map((card) => (
                    <div key={card.id} className="qr-card">
                      {/* <div className="qr-card-header">
                        <img src={smtLogo} alt="" className="qr-card-logo" />
                        <span>SMT Sports</span>
                      </div> */}
                      <div className="qr-card-image-wrap">
                        <img src={card.image} alt={card.alt} className="qr-card-image" />
                      </div>
                      {card.details.length > 0 && (
                        <div className="qr-card-details">
                          {card.details.map((detail) => (
                            <p key={detail.label}>
                              {/* <span>{detail.label}:</span> <strong>{detail.value}</strong> */}
                              <strong>{detail.value}</strong>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </div>

              <div ref={previewFooterRef} className="invoice-pdf-footer">
                <div className="invoice-footer">
                  <strong><p style={{ marginBottom: 10 }}>Thank you for choosing SMT Sports — Your Ultimate Cricket Destination. <br />We look forward to serving you again!</p></strong>
                  <div className="footer-contact">
                    <span style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                      Address: No.134/2, Gandhi Road, Srinivasan Nagar Post, 9, Alapakkam, Chennai - 600063.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card action-card">
            <div className="action-buttons">
              <button type="button" className="primary-btn" onClick={handleGeneratePdf}>
                Generate & Open PDF
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleSharePdf}
                disabled={!pdfBlob}
              >
                Share PDF
              </button>
            </div>
            {errors.pdf && <span className="error-text">{errors.pdf}</span>}
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
