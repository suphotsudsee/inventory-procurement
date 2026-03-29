const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../backend/db/pool');
const { ensureAppSchema } = require('../backend/db/app');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function readCsv(filePath, expectedHeader) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
    throw new Error(`Unexpected CSV header in ${filePath}: ${header.join(', ')}`);
  }
  return lines.slice(1).filter(Boolean).map(parseCsvLine);
}

function normalizeText(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'null') {
    return '';
  }
  return text;
}

function normalizeNumber(value) {
  const number = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text || text === '0/0/0') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

function normalizeLotNo(rawLotNo, receiveNo) {
  const lotNo = normalizeText(rawLotNo);
  const normalizedReceiveNo = normalizeText(receiveNo);

  if (lotNo && lotNo !== '0') {
    const asciiLot = lotNo.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (asciiLot) {
      return asciiLot.slice(0, 100);
    }

    const hash = crypto.createHash('md5').update(lotNo).digest('hex').slice(0, 12).toUpperCase();
    return `LOT-${hash}`;
  }

  if (normalizedReceiveNo && normalizedReceiveNo !== '0') {
    return `RCV-${normalizedReceiveNo}`;
  }

  return 'NOLOT';
}

function buildImportLotNo(lotNo) {
  const base = String(lotNo || 'NOLOT').trim() || 'NOLOT';
  const suffix = '-CSV';
  if (base.endsWith(suffix)) {
    return base.slice(0, 100);
  }
  return `${base.slice(0, Math.max(1, 100 - suffix.length))}${suffix}`;
}

function buildReceiptNumber(receiveNo) {
  return `LEGACY-CSV-${String(receiveNo).trim() || '0'}`;
}

async function main() {
  const receivePath = process.argv[2] || 'C:/Users/user/Desktop/drugstorereceive.csv';
  const detailPath = process.argv[3] || 'C:/Users/user/Desktop/drugstorereceivedetail.csv';
  const receiveSourceRef = path.basename(receivePath);
  const detailSourceRef = path.basename(detailPath);

  await ensureAppSchema();

  const receiveRows = readCsv(receivePath, [
    'pcucode',
    'receiveno',
    'receivedate',
    'receitype',
    'recievenoreal',
    'companyname',
    'remark',
  ]);
  const detailRows = readCsv(detailPath, [
    'pcucode',
    'receiveno',
    'drugcode',
    'amount',
    'cost',
    'expiredate',
    'lotno',
    'remark',
  ]);

  const receipts = new Map();
  for (const row of receiveRows) {
    const [, receiveno, receivedate, receitype, recievenoreal, companyname, remark] = row;
    const receiveNo = normalizeText(receiveno) || '0';
    receipts.set(receiveNo, {
      receiveNo,
      receiptNumber: buildReceiptNumber(receiveNo),
      receivedDate: normalizeDate(receivedate),
      receiptType: normalizeText(receitype),
      invoiceNumber: normalizeText(recievenoreal),
      supplierName: normalizeText(companyname) || 'CSV Import',
      notes: normalizeText(remark),
    });
  }

  const aggregateMap = new Map();
  let rawDetailCount = 0;
  for (const row of detailRows) {
    rawDetailCount += 1;
    const [, receiveno, drugcode, amount, cost, expiredate, lotno, remark] = row;
    const receiveNo = normalizeText(receiveno) || '0';
    const productCode = normalizeText(drugcode);
    const quantity = normalizeNumber(amount);
    const totalCost = normalizeNumber(cost);

    if (!productCode || quantity <= 0) {
      continue;
    }

    const lotNumber = normalizeLotNo(lotno, receiveNo);
    const importLotNumber = buildImportLotNo(lotNumber);
    const expiryDate = normalizeDate(expiredate);
    const aggregateKey = [receiveNo, productCode, importLotNumber, expiryDate || 'NULL'].join('|');
    const current = aggregateMap.get(aggregateKey) || {
      receiveNo,
      productCode,
      lotNumber: importLotNumber,
      expiryDate,
      quantity: 0,
      totalCost: 0,
      notes: normalizeText(remark),
    };

    current.quantity += quantity;
    current.totalCost += totalCost;
    aggregateMap.set(aggregateKey, current);
  }

  const aggregatedItems = [...aggregateMap.values()];
  const productCodes = [...new Set(aggregatedItems.map((item) => item.productCode))];
  let existingProductSet = new Set();
  if (productCodes.length > 0) {
    const placeholders = productCodes.map(() => '?').join(',');
    const [existingProducts] = await pool.query(
      `SELECT product_code FROM products WHERE product_code IN (${placeholders})`,
      productCodes
    );
    existingProductSet = new Set(existingProducts.map((row) => String(row.product_code)));
  }

  const validItems = aggregatedItems.filter((item) => existingProductSet.has(item.productCode));
  const skippedItems = aggregatedItems.filter((item) => !existingProductSet.has(item.productCode));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      "DELETE FROM invp_stock_movements WHERE reference LIKE 'LEGACY-CSV-%' AND performed_by = 'csv-import'"
    );
    await connection.execute(
      "DELETE FROM invp_stock_lots WHERE source_type = 'legacy_csv' AND source_ref IN (?, ?)",
      [receiveSourceRef, detailSourceRef]
    );
    await connection.execute(
      "DELETE FROM invp_goods_receipts WHERE receipt_number LIKE 'LEGACY-CSV-%'"
    );

    const receiptIdByReceiveNo = new Map();
    for (const receipt of receipts.values()) {
      const [result] = await connection.execute(
        `
          INSERT INTO invp_goods_receipts (
            receipt_number, supplier_id, supplier_name, invoice_number, notes, received_by, received_date
          ) VALUES (?, NULL, ?, ?, ?, 'csv-import', ?)
        `,
        [
          receipt.receiptNumber,
          receipt.supplierName,
          receipt.invoiceNumber,
          [receipt.notes, receipt.receiptType ? `receitype=${receipt.receiptType}` : ''].filter(Boolean).join(' | '),
          receipt.receivedDate ? `${receipt.receivedDate} 00:00:00` : '2000-01-01 00:00:00',
        ]
      );
      receiptIdByReceiveNo.set(receipt.receiveNo, result.insertId);
    }

    for (const item of validItems) {
      const receipt = receipts.get(item.receiveNo) || {
        receiveNo: item.receiveNo,
        receiptNumber: buildReceiptNumber(item.receiveNo),
        receivedDate: null,
        invoiceNumber: '',
        supplierName: 'CSV Import',
        notes: '',
      };

      let goodsReceiptId = receiptIdByReceiveNo.get(item.receiveNo);
      if (!goodsReceiptId) {
        const [result] = await connection.execute(
          `
            INSERT INTO invp_goods_receipts (
              receipt_number, supplier_id, supplier_name, invoice_number, notes, received_by, received_date
            ) VALUES (?, NULL, ?, ?, ?, 'csv-import', ?)
          `,
          [
            receipt.receiptNumber,
            receipt.supplierName,
            receipt.invoiceNumber,
            receipt.notes,
            receipt.receivedDate ? `${receipt.receivedDate} 00:00:00` : '2000-01-01 00:00:00',
          ]
        );
        goodsReceiptId = result.insertId;
        receiptIdByReceiveNo.set(item.receiveNo, goodsReceiptId);
      }

      const unitCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;

      await connection.execute(
        `
          INSERT INTO invp_goods_receipt_items (
            goods_receipt_id, product_code, lot_number, expiry_date, quantity, unit_cost, location
          ) VALUES (?, ?, ?, ?, ?, ?, 'MAIN')
        `,
        [goodsReceiptId, item.productCode, item.lotNumber, item.expiryDate, item.quantity, unitCost]
      );

      await connection.execute(
        `
          INSERT INTO invp_stock_lots (
            product_code, lot_number, expiry_date, quantity, unit_cost, location,
            source_type, source_ref, supplier_id, supplier_name, received_date
          ) VALUES (?, ?, ?, ?, ?, 'MAIN', 'legacy_csv', ?, NULL, ?, ?)
          ON DUPLICATE KEY UPDATE
            quantity = quantity + VALUES(quantity),
            unit_cost = VALUES(unit_cost),
            supplier_name = VALUES(supplier_name),
            received_date = LEAST(COALESCE(received_date, VALUES(received_date)), VALUES(received_date)),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          item.productCode,
          item.lotNumber,
          item.expiryDate,
          item.quantity,
          unitCost,
          detailSourceRef,
          receipt.supplierName,
          receipt.receivedDate ? `${receipt.receivedDate} 00:00:00` : '2000-01-01 00:00:00',
        ]
      );

      await connection.execute(
        `
          INSERT INTO invp_stock_movements (
            movement_type, product_code, lot_number, quantity, reference, performed_by, notes
          ) VALUES ('receipt', ?, ?, ?, ?, 'csv-import', ?)
        `,
        [
          item.productCode,
          item.lotNumber,
          item.quantity,
          receipt.receiptNumber,
          item.notes || `Imported from ${detailSourceRef}`,
        ]
      );
    }

    await connection.execute(`
      INSERT INTO stock_levels (product_id, quantity, min_level, max_level, reorder_point, last_counted_at)
      SELECT
        p.id,
        0,
        COALESCE(p.min_stock_level, 0),
        COALESCE(p.max_stock_level, 0),
        COALESCE(p.reorder_point, 0),
        NOW()
      FROM products p
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      WHERE sl.product_id IS NULL
    `);

    await connection.execute(`
      UPDATE stock_levels sl
      JOIN products p ON p.id = sl.product_id
      LEFT JOIN (
        SELECT product_code, COALESCE(SUM(quantity), 0) AS quantity
        FROM invp_stock_lots
        GROUP BY product_code
      ) lb ON lb.product_code = p.product_code
      SET
        sl.quantity = COALESCE(lb.quantity, 0),
        sl.last_counted_at = NOW(),
        sl.updated_at = CURRENT_TIMESTAMP
    `);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [summaryRows] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM invp_goods_receipts WHERE receipt_number LIKE 'LEGACY-CSV-%') AS receipts,
      (SELECT COUNT(*) FROM invp_goods_receipt_items gri
        JOIN invp_goods_receipts gr ON gr.id = gri.goods_receipt_id
        WHERE gr.receipt_number LIKE 'LEGACY-CSV-%') AS receipt_items,
      (SELECT COUNT(*) FROM invp_stock_lots WHERE source_type = 'legacy_csv' AND source_ref = ?) AS lots,
      (SELECT COALESCE(SUM(quantity), 0) FROM invp_stock_lots WHERE source_type = 'legacy_csv' AND source_ref = ?) AS quantity,
      (SELECT COALESCE(SUM(quantity * unit_cost), 0) FROM invp_stock_lots WHERE source_type = 'legacy_csv' AND source_ref = ?) AS value
  `, [detailSourceRef, detailSourceRef, detailSourceRef]);

  console.log(JSON.stringify({
    database: 'inventory_db',
    receiveFile: receiveSourceRef,
    detailFile: detailSourceRef,
    rawReceiveRows: receiveRows.length,
    rawDetailRows: rawDetailCount,
    aggregatedDetailRows: aggregatedItems.length,
    importedReceipts: Number(summaryRows[0].receipts || 0),
    importedReceiptItems: Number(summaryRows[0].receipt_items || 0),
    importedLots: Number(summaryRows[0].lots || 0),
    importedQuantity: Number(summaryRows[0].quantity || 0),
    importedValue: Number(summaryRows[0].value || 0),
    skippedRows: skippedItems.length,
    skippedSample: skippedItems.slice(0, 10).map((item) => item.productCode),
  }, null, 2));
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    pool.end().finally(() => process.exit(1));
  });
