describe('repositoryFactory', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    jest.resetModules();
  });

  test('usa modo arquivo quando DATABASE_URL nao existe', () => {
    delete process.env.DATABASE_URL;
    jest.resetModules();

    const { createRepositories } = require('../src/repositories/repositoryFactory');
    const repositories = createRepositories();

    expect(repositories.mode).toBe('file');
  });
});
