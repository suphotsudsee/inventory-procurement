const fs = require('fs');
const { pool } = require('../backend/db/pool');
const { importDrugstoreReceiveDetailCsv } = require('../backend/services/drugstorereceivedetail-import');

async function main() {
  const filePath = process.argv[2] || 'C:/Users/user/Desktop/drugstorereceivedetail.csv';

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const summary = await importDrugstoreReceiveDetailCsv({
    content,
    sourceRef: filePath,
  });

  console.log(
    JSON.stringify(
      {
        file: filePath,
        ...summary,
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
