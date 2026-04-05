const UNIT_NAME_BY_CODE = {
  '001': 'กระป๋อง',
  '002': 'กระปุก',
  '003': 'กล่อง',
  '004': 'ก้อน',
  '005': 'แกลลอน',
  '006': 'ขวด',
  '007': 'คาทริดจ์',
  '008': 'คู่',
  '009': 'แคปซูล',
  '010': 'ชิ้น',
  '011': 'ชุด',
  '012': 'ชุดทดสอบ',
  '013': 'ซอง',
  '014': 'ด้าม',
  '015': 'ตลับ',
  '016': 'ถัง',
  '017': 'ถุง',
  '018': 'แถบ',
  '019': 'ห่อ',
  '020': 'แท่ง',
  '024': 'แผง',
};

const unitJoin = '';

const unitNameExpr = `
  CASE NULLIF(p.unit, '')
    ${Object.entries(UNIT_NAME_BY_CODE)
      .map(([code, name]) => `WHEN '${code}' THEN '${name}'`)
      .join('\n    ')}
    ELSE NULLIF(p.unit, '')
  END
`;

module.exports = {
  unitJoin,
  unitNameExpr,
};
