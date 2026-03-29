const crypto = require('crypto');
const path = require('path');
const { pool } = require('../db/pool');
const { ensureAppSchema } = require('../db/app');

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

function normalizeLotNo(rawLotNo, receiveNo) {
  const lotNo = String(rawLotNo || '').trim();
  const normalizedReceiveNo = String(receiveNo || '').trim();

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

function normalizeExpiryDate(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value || value === '0') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

function normalizeNumber(rawValue) {
  const value = Number(String(rawValue || '').replace(/,/g, '').trim());
  return Number.isFinite(value) ? value : 0;
}

function loadAndAggregateContent(content) {
  const normalizedContent = String(content || '').replace(/^\uFEFF/, '').trim();
  if (!normalizedContent) {
    throw new Error('CSV content is empty');
  }

  const lines = normalizedContent.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const expected = ['pcucode', 'receiveno', 'drugcode', 'amount', 'cost', 'expiredate', 'lotno', 'remark'];

  if (JSON.stringify(header) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected CSV header: ${header.join(', ')}`);
  }

  const aggregated = new Map();
  let rawRows = 0;

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    rawRows += 1;

    const [pcucode, receiveno, drugcode, amount, cost, expiredate, lotno, remark] = parseCsvLine(line);
    const productCode = String(drugcode || '').trim();
    const quantity = normalizeNumber(amount);
    const totalCost = normalizeNumber(cost);

    if (!productCode || quantity <= 0) {
      continue;
    }

    const lotNumber = normalizeLotNo(lotno, receiveno);
    const importLotNumber = buildImportLotNo(lotNumber);
    const expiryDate = normalizeExpiryDate(expiredate);
    const unitCost = quantity > 0 ? totalCost / quantity : 0;
    const aggregateKey = [productCode, importLotNumber, expiryDate || 'NULL'].join('|');

    const current = aggregated.get(aggregateKey) || {
      pcucode: String(pcucode || '').trim(),
      receiveno: String(receiveno || '').trim(),
      productCode,
      quantity: 0,
      totalCost: 0,
      expiryDate,
      lotNumber,
      importLotNumber,
      remark: String(remark || '').trim(),
    };

    current.quantity += quantity;
    current.totalCost += totalCost;
    current.unitCost = current.quantity > 0 ? current.totalCost / current.quantity : unitCost;
    aggregated.set(aggregateKey, current);
  }

  return {
    rawRows,
    records: [...aggregated.values()],
  };
}

async function importDrugstoreReceiveDetailCsv({ content, sourceRef }) {
  const resolvedSourceRef = path.basename(String(sourceRef || 'drugstorereceivedetail.csv'));
  await ensureAppSchema();

  const { rawRows, records } = loadAndAggregateContent(content);
  const productCodes = [...new Set(records.map((record) => record.productCode))];

  let existingProductSet = new Set();
  if (productCodes.length > 0) {
    const placeholders = productCodes.map(() => '?').join(',');
    const [existingProducts] = await pool.query(
      `SELECT product_code FROM products WHERE product_code IN (${placeholders})`,
      productCodes
    );
    existingProductSet = new Set(existingProducts.map((row) => String(row.product_code)));
  }

  const validRecords = records.filter((record) => existingProductSet.has(record.productCode));
  const skippedRecords = records.filter((record) => !existingProductSet.has(record.productCode));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      'DELETE FROM invp_stock_movements WHERE reference = ? AND movement_type = "receipt"',
      [resolvedSourceRef]
    );
    await connection.execute(
      'DELETE FROM invp_stock_lots WHERE source_type = "legacy_csv" AND source_ref = ?',
      [resolvedSourceRef]
    );

    for (const record of validRecords) {
      await connection.execute(
        `
          INSERT INTO invp_stock_lots (
            product_code, lot_number, expiry_date, quantity, unit_cost, location,
            source_type, source_ref, supplier_id, supplier_name, received_date
          ) VALUES (?, ?, ?, ?, ?, 'MAIN', 'legacy_csv', ?, NULL, 'CSV Import', NOW())
        `,
        [
          record.productCode,
          record.importLotNumber,
          record.expiryDate,
          record.quantity,
          record.unitCost || 0,
          resolvedSourceRef,
        ]
      );

      await connection.execute(
        `
          INSERT INTO invp_stock_movements (
            movement_type, product_code, lot_number, quantity, reference, performed_by, notes
          ) VALUES ('receipt', ?, ?, ?, ?, 'csv-import', ?)
        `,
        [
          record.productCode,
          record.importLotNumber,
          record.quantity,
          resolvedSourceRef,
          `Imported from ${resolvedSourceRef}`,
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

  const [summaryRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS total_lots,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COALESCE(SUM(quantity * unit_cost), 0) AS total_value
      FROM invp_stock_lots
      WHERE source_type = 'legacy_csv' AND source_ref = ?
    `,
    [resolvedSourceRef]
  );

  return {
    sourceRef: resolvedSourceRef,
    rawRows,
    aggregatedRows: records.length,
    importedRows: validRecords.length,
    skippedRows: skippedRecords.length,
    importedLots: Number(summaryRows[0]?.total_lots || 0),
    importedQuantity: Number(summaryRows[0]?.total_quantity || 0),
    importedValue: Number(summaryRows[0]?.total_value || 0),
    skippedSample: skippedRecords.slice(0, 10).map((record) => record.productCode),
  };
}

module.exports = {
  importDrugstoreReceiveDetailCsv,
  loadAndAggregateContent,
};
