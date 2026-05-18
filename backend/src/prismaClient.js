const { MongoClient, ObjectId } = require('mongodb');

function normalizeConnectionString(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const hasMatchingDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const hasMatchingSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  return hasMatchingDoubleQuotes || hasMatchingSingleQuotes
    ? trimmed.slice(1, -1)
    : trimmed;
}

function isMongoConnectionString(value) {
  return /^mongodb(\+srv)?:\/\//i.test(String(value || '').trim());
}

function resolveMongoConnectionString() {
  const candidates = [
    normalizeConnectionString(process.env.MONGODB_URI),
    normalizeConnectionString(process.env.MONGO_URL),
    normalizeConnectionString(process.env.DATABASE_URL),
  ];

  return candidates.find(isMongoConnectionString) || 'mongodb://127.0.0.1:27017/hackercit';
}

const DATABASE_URL = resolveMongoConnectionString();
const IS_LOCAL_DATABASE_URL = DATABASE_URL === 'mongodb://127.0.0.1:27017/hackercit';

let clientPromise = null;
let mongoClient = null;
let initializationPromise = null;

function extractDatabaseName(uri) {
  const withoutProtocol = String(uri || '').replace(/^mongodb(\+srv)?:\/\//, '');
  const pathIndex = withoutProtocol.indexOf('/');
  if (pathIndex === -1) return 'hackercit';

  const databaseName = withoutProtocol.slice(pathIndex + 1).split('?')[0].trim();
  return databaseName || 'hackercit';
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeComparable(value) {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.getTime();
  return value;
}

function valuesEqual(left, right) {
  return normalizeComparable(left) === normalizeComparable(right);
}

function compareValues(left, right) {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);

  if (normalizedLeft === normalizedRight) return 0;
  if (normalizedLeft === null || normalizedLeft === undefined) return 1;
  if (normalizedRight === null || normalizedRight === undefined) return -1;
  return normalizedLeft > normalizedRight ? 1 : -1;
}

function sanitizeForStorage(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date || value instanceof ObjectId) return value;
  if (Array.isArray(value)) return value.map((entry) => sanitizeForStorage(entry));
  if (!isPlainObject(value)) return value;

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'id') continue;

    const sanitized = sanitizeForStorage(entry);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function serializeValue(value) {
  if (value instanceof ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map((entry) => serializeValue(entry));
  if (value instanceof Date || value === null || value === undefined) return value;
  if (!isPlainObject(value)) return value;

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '_id') {
      result.id = serializeValue(entry);
      continue;
    }

    result[key] = serializeValue(entry);
  }

  return result;
}

function serializeDocument(document) {
  if (!document) return null;
  return serializeValue(document);
}

function getFieldValue(document, key) {
  if (key === 'id') return document?._id ?? document?.id ?? null;
  return document?.[key];
}

function matchesCondition(value, condition) {
  if (isPlainObject(condition)) {
    if ('in' in condition) {
      return Array.isArray(condition.in) && condition.in.some((entry) => valuesEqual(value, entry));
    }

    if ('not' in condition) {
      return !matchesCondition(value, condition.not);
    }

    if ('lt' in condition) return compareValues(value, condition.lt) < 0;
    if ('lte' in condition) return compareValues(value, condition.lte) <= 0;
    if ('gt' in condition) return compareValues(value, condition.gt) > 0;
    if ('gte' in condition) return compareValues(value, condition.gte) >= 0;
  }

  return valuesEqual(value, condition);
}

function matchesWhere(document, where = {}) {
  return Object.entries(where || {}).every(([key, condition]) => {
    const value = getFieldValue(document, key);
    return matchesCondition(value, condition);
  });
}

function sortDocuments(documents, orderBy) {
  const sorters = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (!sorters.length) return [...documents];

  return [...documents].sort((left, right) => {
    for (const sorter of sorters) {
      const [field, direction] = Object.entries(sorter)[0] || [];
      if (!field) continue;

      const comparison = compareValues(getFieldValue(left, field), getFieldValue(right, field));
      if (comparison !== 0) {
        return direction === 'desc' ? comparison * -1 : comparison;
      }
    }

    return 0;
  });
}

function applySelect(document, select) {
  if (!select) return document;

  const result = {};
  for (const [key, include] of Object.entries(select)) {
    if (include) {
      result[key] = document[key];
    }
  }

  return result;
}

function applyDefaults(modelName, data) {
  const now = new Date();

  const defaults = {
    user: {
      role: 'USER',
      badgeIds: [],
      badgeTier: null,
      solvedProblemCount: 0,
      verified: false,
      loginCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    problem: {
      tags: [],
      constraints: [],
      examples: [],
      starterCode: { javascript: '', python: '', java: '' },
      testCases: [],
      samples: [],
      createdAt: now,
      updatedAt: now,
    },
    submission: {
      createdAt: now,
      results: null,
      timeMs: null,
      memoryKb: null,
    },
    testAssignment: {
      status: 'DRAFT',
      problemIds: [],
      startsAt: null,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    },
    testAttempt: {
      finishedAt: null,
      status: 'IN_PROGRESS',
      finishReason: null,
      interruptionCount: 0,
      interruptions: [],
      createdAt: now,
      updatedAt: now,
    },
    notification: {
      type: 'TEST_ASSIGNED',
      read: false,
      assignmentId: null,
      createdAt: now,
    },
    loginEvent: {
      createdAt: now,
    },
  };

  return {
    ...(defaults[modelName] || {}),
    ...data,
  };
}

function applyUpdate(document, data) {
  const next = {
    ...document,
  };

  for (const [key, value] of Object.entries(data || {})) {
    if (isPlainObject(value) && typeof value.increment === 'number') {
      next[key] = Number(next[key] || 0) + value.increment;
      continue;
    }

    next[key] = value;
  }

  if ('updatedAt' in next) {
    next.updatedAt = new Date();
  }

  return sanitizeForStorage(next);
}

async function getDb() {
  if (!clientPromise) {
    if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && IS_LOCAL_DATABASE_URL) {
      throw new Error('database connection failed: set DATABASE_URL or MONGODB_URI for the deployed backend');
    }

    mongoClient = new MongoClient(DATABASE_URL);
    clientPromise = mongoClient.connect().then(async (client) => {
      const db = client.db(extractDatabaseName(DATABASE_URL));
      if (!initializationPromise) {
        initializationPromise = initializeDatabase(db).catch((error) => {
          initializationPromise = null;
          throw error;
        });
      }

      await initializationPromise;
      return db;
    });
  }

  return clientPromise;
}

async function createIndexSafely(collection, spec, options) {
  try {
    await collection.createIndex(spec, options);
  } catch (error) {
    if (error?.code === 85) {
      return;
    }

    throw error;
  }
}

async function initializeDatabase(db) {
  await Promise.all([
    createIndexSafely(db.collection('User'), { email: 1 }, { unique: true }),
    createIndexSafely(db.collection('User'), { usn: 1 }, { unique: true, sparse: true }),
    createIndexSafely(db.collection('VerificationToken'), { token: 1 }, { unique: true }),
    createIndexSafely(db.collection('ResetToken'), { token: 1 }, { unique: true }),
    createIndexSafely(db.collection('Problem'), { slug: 1 }, { unique: true }),
    createIndexSafely(db.collection('Problem'), { legacyId: 1 }, { unique: true, sparse: true }),
  ]);
}

class MongoModel {
  constructor(modelName, collectionName) {
    this.modelName = modelName;
    this.collectionName = collectionName;
  }

  async collection() {
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  async loadRawDocuments() {
    const collection = await this.collection();
    return collection.find({}).toArray();
  }

  async decorate(document, options = {}) {
    if (!document) return null;

    let result = serializeDocument(document);

    if (options.include) {
      result = await applyInclude(this.modelName, result, options.include);
    }

    if (options.select) {
      result = applySelect(result, options.select);
    }

    return result;
  }

  async findUnique(options = {}) {
    const documents = await this.loadRawDocuments();
    const match = documents.find((document) => matchesWhere(document, options.where));
    return this.decorate(match, options);
  }

  async findFirst(options = {}) {
    const documents = sortDocuments(
      (await this.loadRawDocuments()).filter((document) => matchesWhere(document, options.where)),
      options.orderBy,
    );

    return this.decorate(documents[0], options);
  }

  async findMany(options = {}) {
    let documents = (await this.loadRawDocuments()).filter((document) => matchesWhere(document, options.where));
    documents = sortDocuments(documents, options.orderBy);

    if (typeof options.take === 'number') {
      documents = documents.slice(0, options.take);
    }

    return Promise.all(documents.map((document) => this.decorate(document, options)));
  }

  async create({ data }) {
    const collection = await this.collection();
    const prepared = sanitizeForStorage(applyDefaults(this.modelName, data || {}));
    const document = {
      _id: new ObjectId(),
      ...prepared,
    };

    await collection.insertOne(document);
    return this.decorate(document);
  }

  async update({ where, data }) {
    const collection = await this.collection();
    const documents = await this.loadRawDocuments();
    const existing = documents.find((document) => matchesWhere(document, where));

    if (!existing) {
      return null;
    }

    const updated = {
      _id: existing._id,
      ...applyUpdate(existing, data),
    };

    await collection.replaceOne({ _id: existing._id }, updated);
    return this.decorate(updated);
  }

  async updateMany({ where, data }) {
    const collection = await this.collection();
    const documents = await this.loadRawDocuments();
    const matches = documents.filter((document) => matchesWhere(document, where));

    await Promise.all(
      matches.map(async (document) => {
        const updated = {
          _id: document._id,
          ...applyUpdate(document, data),
        };

        await collection.replaceOne({ _id: document._id }, updated);
      }),
    );

    return { count: matches.length };
  }

  async delete({ where }) {
    const collection = await this.collection();
    const documents = await this.loadRawDocuments();
    const existing = documents.find((document) => matchesWhere(document, where));

    if (!existing) {
      return null;
    }

    await collection.deleteOne({ _id: existing._id });
    return this.decorate(existing);
  }

  async upsert({ where, update, create }) {
    const existing = await this.findUnique({ where });
    if (existing) {
      return this.update({ where, data: update });
    }

    return this.create({ data: create });
  }
}

let prisma = null;

async function applyInclude(modelName, document, include) {
  if (!include || !document) return document;

  if (modelName === 'submission') {
    const result = { ...document };

    if (include.problem) {
      result.problem = await prisma.problem.findUnique({ where: { id: document.problemId } });
    }

    if (include.user) {
      result.user = await prisma.user.findUnique({ where: { id: document.userId } });
    }

    return result;
  }

  return document;
}

prisma = {
  user: new MongoModel('user', 'User'),
  verificationToken: new MongoModel('verificationToken', 'VerificationToken'),
  resetToken: new MongoModel('resetToken', 'ResetToken'),
  problem: new MongoModel('problem', 'Problem'),
  submission: new MongoModel('submission', 'Submission'),
  testAssignment: new MongoModel('testAssignment', 'TestAssignment'),
  testAttempt: new MongoModel('testAttempt', 'TestAttempt'),
  notification: new MongoModel('notification', 'Notification'),
  loginEvent: new MongoModel('loginEvent', 'LoginEvent'),
  async $transaction(operations) {
    return Promise.all(operations);
  },
  async $ping() {
    const db = await getDb();
    return db.command({ ping: 1 });
  },
  async $disconnect() {
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      clientPromise = null;
      initializationPromise = null;
    }
  },
};

module.exports = prisma;
