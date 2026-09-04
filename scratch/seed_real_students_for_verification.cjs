const prisma = require('../backend/src/prismaClient');

async function seedVerificationStudents() {
  const assignmentId = '6a95c2345738c274d9910ab8';

  // 1. Student 1: Already exists (Score Check Student)
  // Let's create Student 2: Rahul Kumar (USN: 1DS23CS001)
  let student2 = await prisma.user.findFirst({ where: { email: 'rahul.kumar@gmail.com' } });
  if (!student2) {
    student2 = await prisma.user.create({
      data: {
        email: 'rahul.kumar@gmail.com',
        name: 'Rahul Kumar',
        usn: '1DS23CS001',
        department: 'CSE',
        password: '$2b$10$e74V2tQZ.w2w6xV4e3x4.e5/Q0q/3V2.w2w6xV4e3x4.e5/Q0q/3V2',
        role: 'USER',
      },
    });
  }

  // Create submission for Student 2 (Score: 65/70 -> Theory 40, Coding 25)
  const existingSub2 = await prisma.assessmentSubmission.findFirst({
    where: { assignmentId, userId: student2.id },
  });
  if (!existingSub2) {
    await prisma.assessmentSubmission.create({
      data: {
        assignmentId,
        userId: student2.id,
        theoryScore: 40,
        codingScore: 25,
        totalScore: 65,
        maxScore: 70,
        percentage: 92.8,
        details: {
          totalQuestions: 2,
          answeredQuestions: 2,
          maxTheoryScore: 40,
          maxCodingScore: 30,
          questions: [
            { type: 'theory', title: 'Data Structures MCQ', status: 'Passed', earnedMarks: 40, marks: 40, selectedOption: 'Option A', correctAnswer: 'Option A' },
            { type: 'coding', title: 'Two Sum Problem', status: 'Passed', earnedMarks: 25, marks: 30, testCasesPassed: 8, totalTestCases: 10, language: 'javascript', submittedCode: 'function twoSum() { return [0, 1]; }' },
          ],
        },
      },
    });
  }

  // Create test attempt for Student 2
  const existingAttempt2 = await prisma.testAttempt.findFirst({
    where: { assignmentId, userId: student2.id },
  });
  if (!existingAttempt2) {
    await prisma.testAttempt.create({
      data: {
        assignmentId,
        userId: student2.id,
        startedAt: new Date(Date.now() - 3600000),
        finishedAt: new Date(),
        status: 'COMPLETED',
        interruptionCount: 0,
        interruptions: [],
      },
    });
  }

  // 2. Student 3: Priya Sharma (USN: 1DS23CS002)
  let student3 = await prisma.user.findFirst({ where: { email: 'priya.sharma@gmail.com' } });
  if (!student3) {
    student3 = await prisma.user.create({
      data: {
        email: 'priya.sharma@gmail.com',
        name: 'Priya Sharma',
        usn: '1DS23CS002',
        department: 'ISE',
        password: '$2b$10$e74V2tQZ.w2w6xV4e3x4.e5/Q0q/3V2.w2w6xV4e3x4.e5/Q0q/3V2',
        role: 'USER',
      },
    });
  }

  // Create submission for Student 3 (Score: 62/70 -> Theory 38, Coding 24)
  const existingSub3 = await prisma.assessmentSubmission.findFirst({
    where: { assignmentId, userId: student3.id },
  });
  if (!existingSub3) {
    await prisma.assessmentSubmission.create({
      data: {
        assignmentId,
        userId: student3.id,
        theoryScore: 38,
        codingScore: 24,
        totalScore: 62,
        maxScore: 70,
        percentage: 88.5,
        details: {
          totalQuestions: 2,
          answeredQuestions: 2,
          maxTheoryScore: 40,
          maxCodingScore: 30,
          questions: [
            { type: 'theory', title: 'Data Structures MCQ', status: 'Passed', earnedMarks: 38, marks: 40, selectedOption: 'Option B', correctAnswer: 'Option B' },
            { type: 'coding', title: 'Two Sum Problem', status: 'Passed', earnedMarks: 24, marks: 30, testCasesPassed: 7, totalTestCases: 10, language: 'python', submittedCode: 'def twoSum(): return [0, 1]' },
          ],
        },
      },
    });
  }

  // Create test attempt for Student 3
  const existingAttempt3 = await prisma.testAttempt.findFirst({
    where: { assignmentId, userId: student3.id },
  });
  if (!existingAttempt3) {
    await prisma.testAttempt.create({
      data: {
        assignmentId,
        userId: student3.id,
        startedAt: new Date(Date.now() - 3600000),
        finishedAt: new Date(),
        status: 'COMPLETED',
        interruptionCount: 1,
        interruptions: [{ eventType: 'TAB_SWITCH', score: 10, timestamp: new Date().toISOString() }],
      },
    });
  }

  console.log('Seeded Student 2 (Rahul Kumar) and Student 3 (Priya Sharma)');
  await prisma.$disconnect();
}

seedVerificationStudents().catch(console.error);
