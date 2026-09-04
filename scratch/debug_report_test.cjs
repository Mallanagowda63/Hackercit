const prisma = require('../backend/src/prismaClient');
const reportsController = require('../backend/src/controllers/reportsController');

async function debugReportTest() {
  const assignments = await prisma.testAssignment.findMany();
  console.log('Assignments in DB:', assignments.map(a => ({ id: a.id, title: a.title })));

  for (const assignment of assignments) {
    let reportData = null;
    const req = { params: { testId: assignment.id } };
    const res = {
      json: (data) => { reportData = data; },
      status: () => res,
    };
    await reportsController.getTestReport(req, res);
    console.log(`Report for "${assignment.title}" (${assignment.id}):`, {
      totalStudents: reportData?.stats?.totalStudents,
      studentsCount: reportData?.students?.length,
      topStudent: reportData?.students?.[0]
    });
  }

  await prisma.$disconnect();
}

debugReportTest().catch(console.error);
