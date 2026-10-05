export const mockOrganizations: Record<string, { timezone: string }> = {
  'org-1': { timezone: 'America/Caracas' },
  'org-2': { timezone: 'Europe/Madrid' }
};

export const mockUsageLogs: { orgId: string; timestamp: Date }[] = [];

export function injectMockLogs(logs: { orgId: string; timestamp: Date }[]) {
  mockUsageLogs.length = 0; // clear
  mockUsageLogs.push(...logs);
}

export async function checkQuotaLimit(organization_id: string, currentDate: Date = new Date()): Promise<{ bloqueado: boolean; reason?: string }> {
  const org = mockOrganizations[organization_id];
  if (!org) {
    throw new Error("Organization not found");
  }

  const tz = org.timezone;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const formattedNow = formatter.format(currentDate);

  let consumedToday = 0;
  let consumedThisWeek = 0;

  for (const log of mockUsageLogs) {
    if (log.orgId !== organization_id) continue;

    const logDateStr = formatter.format(log.timestamp);
    
    if (logDateStr === formattedNow) {
      consumedToday++;
    }

    // Aproximación estricta para la semana (últimos 7 días)
    const timeDiff = currentDate.getTime() - log.timestamp.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);
    if (daysDiff >= 0 && daysDiff <= 7) {
      consumedThisWeek++;
    }
  }

  if (consumedToday >= 5) {
    return { bloqueado: true, reason: "Límite diario alcanzado" };
  }

  if (consumedThisWeek >= 25) {
    return { bloqueado: true, reason: "Límite semanal alcanzado" };
  }

  return { bloqueado: false };
}
