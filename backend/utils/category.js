function getCategoryExpression(alias = 'd') {
  return `
    CASE
      WHEN NULLIF(TRIM(${alias}.drugcategory), '') IS NOT NULL THEN TRIM(${alias}.drugcategory)
      WHEN NULLIF(TRIM(${alias}.drugtype), '') IS NOT NULL AND NULLIF(TRIM(${alias}.drugtypesub), '') IS NOT NULL
        THEN CONCAT('หมวด ', TRIM(${alias}.drugtype), '.', TRIM(${alias}.drugtypesub))
      WHEN NULLIF(TRIM(${alias}.drugtype), '') IS NOT NULL
        THEN CONCAT('หมวด ', TRIM(${alias}.drugtype))
      ELSE 'ไม่ระบุหมวด'
    END
  `;
}

module.exports = {
  getCategoryExpression,
};
