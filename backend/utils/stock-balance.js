const lotBalanceJoin = `
  LEFT JOIN (
    SELECT product_code, COALESCE(SUM(quantity), 0) AS quantity
    FROM invp_stock_lots
    GROUP BY product_code
  ) lb ON lb.product_code = p.product_code
`;

const currentStockExpr = 'COALESCE(lb.quantity, 0)';

module.exports = {
  lotBalanceJoin,
  currentStockExpr,
};
