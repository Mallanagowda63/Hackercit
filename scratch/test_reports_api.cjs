const prisma = require('../backend/src/prismaClient');
const reportsController = require('../backend/src/controllers/reportsController');

async function testSpecificReport() {
  const reqTest = { params: { testId: '6a95c2345738c274d9910ab8' } };
  const resTest = {
    json: (data) => console.log(`TEST REPORT:\n`, JSON.stringify(data, null, 2)),
    status: (code) => ({ json: (err) => console.error('TEST REPORT ERROR:', code, err) }),
  };
  await reportsController.getTestReport(reqTest, resTest);

  await prisma.$disconnect();
}

testSpecificReport().catch(console.error);
