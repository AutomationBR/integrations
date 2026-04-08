describe('repositoryFactory postgres fallback', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    jest.resetModules();
  });

  test('faz fallback para arquivo quando a inicializacao do pool falha', () => {
    process.env.DATABASE_URL = 'postgres://xml_converter:xml_converter@localhost:5432/xml_converter';
    jest.doMock('../src/db/createPgPool', () => ({
      createPgPool: () => {
        throw new Error('pool init failed');
      }
    }));

    const { createRepositories } = require('../src/repositories/repositoryFactory');
    const repositories = createRepositories();

    expect(repositories.mode).toBe('file');
  });
});
