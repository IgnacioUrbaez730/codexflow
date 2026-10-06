import { render, screen } from '@testing-library/react';
import SuperadminLayout from '../layout';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createServerComponentClient: jest.fn(),
}));

describe('SuperadminLayout', () => {
  it('redirects to / if user is not superadmin', async () => {
    const { createServerComponentClient } = require('@supabase/auth-helpers-nextjs');
    createServerComponentClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'admin' },
            }),
          }),
        }),
      }),
    });

    const Layout = await SuperadminLayout({ children: <div>Child</div> });
    render(Layout);

    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('renders children if user is superadmin', async () => {
    const { createServerComponentClient } = require('@supabase/auth-helpers-nextjs');
    createServerComponentClient.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'superadmin' },
            }),
          }),
        }),
      }),
    });

    const Layout = await SuperadminLayout({ children: <div>Child</div> });
    render(Layout);

    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});
