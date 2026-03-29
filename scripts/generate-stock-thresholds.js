const { query, pool } = require('../backend/db/pool');
const { ensureAppSchema } = require('../backend/db/app');

const BASELINE_BY_CATEGORY_CODE = {
  '01': { min: 100, reorder: 150, max: 300 },
  '02': { min: 100, reorder: 150, max: 300 },
  '03': { min: 12, reorder: 18, max: 36 },
  '04': { min: 25, reorder: 40, max: 80 },
  '05': { min: 12, reorder: 18, max: 36 },
  '06': { min: 6, reorder: 10, max: 20 },
  '07': { min: 20, reorder: 30, max: 60 },
  '10': { min: 20, reorder: 30, max: 60 },
  '11': { min: 10, reorder: 15, max: 30 },
};

const UNIT_MULTIPLIER_BY_CODE = {
  '003': 2,
  '006': 1.5,
  '009': 1,
  '013': 1,
  '017': 1.5,
  '018': 1.5,
  '024': 1.5,
};

function getCategoryCode(row) {
  const drugtype = String(row.drugtype || '').trim();
  if (/^\d{2}$/.test(drugtype)) {
    return drugtype;
  }

  const categoryCode = String(row.category_code || '').trim();
  if (/^\d{2}$/.test(categoryCode)) {
    return categoryCode;
  }

  return '11';
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getUnitMultiplier(row) {
  const code = String(row.unit_sell || '').trim();
  return UNIT_MULTIPLIER_BY_CODE[code] || 1;
}

function computeThresholds(row) {
  const categoryCode = getCategoryCode(row);
  const baseline = BASELINE_BY_CATEGORY_CODE[categoryCode] || BASELINE_BY_CATEGORY_CODE['11'];
  const quantity = Number(row.current_qty || 0);
  const unitMultiplier = getUnitMultiplier(row);

  const adjustedMin = Math.max(1, Math.round(baseline.min * unitMultiplier));
  const adjustedReorder = Math.max(adjustedMin + 1, Math.round(baseline.reorder * unitMultiplier));
  const adjustedMax = Math.max(adjustedReorder + 1, Math.round(baseline.max * unitMultiplier));

  let minLevel = adjustedMin;
  if (quantity > 0) {
    const scaledMin = Math.round(Math.sqrt(quantity) * unitMultiplier);
    minLevel = clamp(scaledMin, adjustedMin, adjustedMax);
  }

  const reorderPoint = Math.max(adjustedReorder, minLevel + Math.ceil(minLevel * 0.3));
  const maxLevel = Math.max(adjustedMax, reorderPoint + Math.ceil(reorderPoint * 0.5));

  return {
    minLevel,
    reorderPoint,
    maxLevel,
    categoryCode,
    unitMultiplier,
  };
}

async function main() {
  await ensureAppSchema();
  const force = process.argv.includes('--force');

  const rows = await query(`
    SELECT
      p.id,
      p.product_code,
      p.drugtype,
      c.category_code,
      p.min_stock_level,
      p.max_stock_level,
      p.reorder_point,
      COALESCE(p.unit_sell, '') AS unit_sell,
      COALESCE(lb.qty, 0) AS current_qty
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN (
      SELECT product_code, COALESCE(SUM(quantity), 0) AS qty
      FROM invp_stock_lots
      GROUP BY product_code
    ) lb ON lb.product_code = p.product_code
    WHERE p.is_active = 1
    ORDER BY p.id ASC
  `);

  let updatedProducts = 0;
  let updatedLevels = 0;
  let insertedLevels = 0;

  const existingLevels = await query('SELECT product_id, quantity, min_level, max_level, reorder_point FROM stock_levels');
  const levelByProductId = new Map(existingLevels.map((row) => [Number(row.product_id), row]));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const row of rows) {
      const thresholds = computeThresholds(row);
      const shouldUpdateProduct =
        force ||
        Number(row.min_stock_level || 0) === 0 ||
        Number(row.max_stock_level || 0) === 0 ||
        Number(row.reorder_point || 0) === 0;

      if (shouldUpdateProduct) {
        await connection.execute(
          `
            UPDATE products
            SET min_stock_level = ?, max_stock_level = ?, reorder_point = ?
            WHERE id = ?
          `,
          [thresholds.minLevel, thresholds.maxLevel, thresholds.reorderPoint, row.id]
        );
        updatedProducts += 1;
      }

      const existingLevel = levelByProductId.get(Number(row.id));
      if (!existingLevel) {
        await connection.execute(
          `
            INSERT INTO stock_levels (
              product_id, quantity, min_level, max_level, reorder_point, last_counted_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
          `,
          [
            row.id,
            Number(row.current_qty || 0),
            thresholds.minLevel,
            thresholds.maxLevel,
            thresholds.reorderPoint,
          ]
        );
        insertedLevels += 1;
        continue;
      }

      const shouldUpdateLevel =
        force ||
        Number(existingLevel.min_level || 0) === 0 ||
        Number(existingLevel.max_level || 0) === 0 ||
        Number(existingLevel.reorder_point || 0) === 0;

      if (shouldUpdateLevel) {
        await connection.execute(
          `
            UPDATE stock_levels
            SET
              quantity = ?,
              min_level = ?,
              max_level = ?,
              reorder_point = ?,
              last_counted_at = NOW(),
              updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?
          `,
          [
            Number(row.current_qty || 0),
            thresholds.minLevel,
            thresholds.maxLevel,
            thresholds.reorderPoint,
            row.id,
          ]
        );
        updatedLevels += 1;
      }
    }

    await connection.commit();
  } finally {
    connection.release();
  }

  const [summary] = await query(`
    SELECT
      COUNT(*) AS products,
      SUM(CASE WHEN min_stock_level > 0 THEN 1 ELSE 0 END) AS products_with_min,
      SUM(CASE WHEN max_stock_level > 0 THEN 1 ELSE 0 END) AS products_with_max,
      SUM(CASE WHEN reorder_point > 0 THEN 1 ELSE 0 END) AS products_with_reorder
    FROM products
    WHERE is_active = 1
  `);

  console.log(
    JSON.stringify(
      {
        updatedProducts,
        insertedLevels,
        updatedLevels,
        summary,
        heuristic: {
          basis: 'dosage-form baseline + package multiplier + sqrt(stock) scaling',
          '01-02': 'oral solids 100/150/300',
          '03': 'liquids 12/18/36',
          '04': 'injectables 25/40/80',
          '05': 'topicals 12/18/36',
          '06': 'special prep 6/10/20',
          '07-10': 'medical supplies 20/30/60',
          '11': 'other 10/15/30',
          formula: 'min = clamp(sqrt(qty) x unitFactor, baselineMin, baselineMax); reorder >= min + 30%; max >= reorder + 50%',
          mode: force ? 'force-recompute-all' : 'fill-zero-only',
        },
      },
      null,
      2
    )
  );
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    pool.end().finally(() => process.exit(1));
  });
