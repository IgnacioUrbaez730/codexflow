import { createTemplate, getTemplates } from '../src/actions/templateActions';

// Mock Supabase client
jest.mock('../src/lib/supabase', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: '1', name: 'Bautismo' }, error: null }),
  })),
}));

describe('Template Management', () => {
  it('should create a template successfully', async () => {
    const fakeToken = 'valid_token';
    const fakeTenantId = 'tenant_1';
    const templateData = {
      name: 'Bautismo',
      schema: { fields: [] },
    };

    const result = await createTemplate(templateData, fakeTenantId, fakeToken);
    expect(result.data).toHaveProperty('id');
  });

  it('should list templates successfully', async () => {
    const fakeToken = 'valid_token';
    const fakeTenantId = 'tenant_1';
    
    const result = await getTemplates(fakeTenantId, fakeToken);
    expect(result.data).toBeDefined();
  });
});
