import { checkQuotaLimit, injectMockLogs } from './quotas.actions';

describe('Quotas and Limits', () => {
  it('should allow if under limits', async () => {
    injectMockLogs([]);
    const result = await checkQuotaLimit('org-1');
    expect(result.bloqueado).toBe(false);
  });

  it('should block if daily limit is reached', async () => {
    const now = new Date();
    injectMockLogs([
      { orgId: 'org-1', timestamp: now },
      { orgId: 'org-1', timestamp: now },
      { orgId: 'org-1', timestamp: now },
      { orgId: 'org-1', timestamp: now },
      { orgId: 'org-1', timestamp: now }
    ]);
    const result = await checkQuotaLimit('org-1', now);
    expect(result.bloqueado).toBe(true);
    expect(result.reason).toBe('Límite diario alcanzado');
  });

  it('should block if weekly limit is reached', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const logs = Array(25).fill({ orgId: 'org-1', timestamp: twoDaysAgo });
    injectMockLogs(logs);
    
    const result = await checkQuotaLimit('org-1', now);
    expect(result.bloqueado).toBe(true);
    expect(result.reason).toBe('Límite semanal alcanzado');
  });
});
