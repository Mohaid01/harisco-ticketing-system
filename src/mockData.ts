import type { Ticket } from './types';

export const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'TCK-101',
    title: 'Replacement monitor required for terminal desk',
    description: 'The primary display screen on warehouse terminal #2 has developed a heavy purple vertical line on the left side of the panel, causing scan reading problems.',
    type: 'hardware',
    status: 'awaiting_it_approval',
    justification: 'Critical for the warehouse staff to verify shipments scanning logs. Without a secondary or primary display, sorting times have doubled.',
    createdAt: '2026-06-04T08:30:00Z',
    updatedAt: '2026-06-04T08:30:00Z',
    reporterId: 'usr-5', // John Miller
    reporterName: 'John Miller',
    reporterEmail: 'john.m@harisco.com',
    comments: [],
    activityLogs: [
      {
        id: 'log-1',
        action: 'Ticket raised',
        timestamp: '2026-06-04T08:30:00Z',
        performedByName: 'John Miller',
        performedByRole: 'employee',
      }
    ]
  },
  {
    id: 'TCK-102',
    title: 'Access credentials update for logistics ERP API portal',
    description: 'We need to refresh the client tokens for the incoming logistics API endpoint. The current tokens will expire in 2 days.',
    type: 'software',
    status: 'awaiting_manager_approval',
    justification: 'Prevent API service disruptions with our logistics channels on Friday.',
    createdAt: '2026-06-03T10:15:00Z',
    updatedAt: '2026-06-04T09:00:00Z',
    reporterId: 'usr-6', // Diana Prince
    reporterName: 'Diana Prince',
    reporterEmail: 'diana.p@harisco.com',
    comments: [
      {
        id: 'c-1',
        authorId: 'usr-1',
        authorName: 'Sarah Connor',
        authorRole: 'it',

        content: 'I have verified the security configuration. The settings meet the standard criteria. Escalating to Manager for authorization.',
        createdAt: '2026-06-04T09:00:00Z',
      }
    ],
    activityLogs: [
      {
        id: 'log-2',
        action: 'Ticket raised',
        timestamp: '2026-06-03T10:15:00Z',
        performedByName: 'Diana Prince',
        performedByRole: 'employee',
      },
      {
        id: 'log-3',
        action: 'IT Review Approved & Escalated to Manager',
        timestamp: '2026-06-04T09:00:00Z',
        performedByName: 'Sarah Connor',
        performedByRole: 'it',
      }
    ]
  },
  {
    id: 'TCK-103',
    title: 'Docker Desktop installation on local workstation',
    description: 'Requesting installation of Docker Desktop v4.28 on workstation and administrative approval to run containers.',
    type: 'maintenance',
    status: 'open',
    justification: 'Required to test the local database changes and run integration tests locally before deploying to dev environment.',
    createdAt: '2026-06-02T14:00:00Z',
    updatedAt: '2026-06-03T11:30:00Z',
    reporterId: 'usr-7', // James Harrison
    reporterName: 'James Harrison',
    reporterEmail: 'james.h@harisco.com',
    assigneeId: 'usr-2', // David Kim
    assigneeName: 'David Kim',
    comments: [],
    activityLogs: [
      {
        id: 'log-4',
        action: 'Ticket raised',
        timestamp: '2026-06-02T14:00:00Z',
        performedByName: 'James Harrison',
        performedByRole: 'employee',
      },
      {
        id: 'log-5',
        action: 'IT Review Approved & Escalated to Manager',
        timestamp: '2026-06-02T16:30:00Z',
        performedByName: 'David Kim',
        performedByRole: 'it',
      },
      {
        id: 'log-6',
        action: 'Manager Approved & Opened for Assignment',
        timestamp: '2026-06-03T09:00:00Z',
        performedByName: 'Robert Vance',
        performedByRole: 'manager',
      },
      {
        id: 'log-7',
        action: 'Assigned to David Kim',
        timestamp: '2026-06-03T11:30:00Z',
        performedByName: 'David Kim',
        performedByRole: 'it',
      }
    ]
  },
  {
    id: 'TCK-104',
    title: 'Upgrade RAM on warehouse packaging laptop',
    description: 'The Lenovo ThinkPad in the packaging area is running out of memory (currently 8GB) causing severe lag when opening multiple cargo dispatch tables.',
    type: 'upgrade',
    status: 'awaiting_handover',
    justification: 'Laptop freezes during labeling updates, which delays container dispatch timers.',
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-03T15:00:00Z',
    reporterId: 'usr-5', // John Miller
    reporterName: 'John Miller',
    reporterEmail: 'john.m@harisco.com',
    assigneeId: 'usr-1', // Sarah Connor
    assigneeName: 'Sarah Connor',
    comments: [
      {
        id: 'c-2',
        authorId: 'usr-1',
        authorName: 'Sarah Connor',
        authorRole: 'it',

        content: 'I have installed a new 16GB DDR4 module. System successfully boots and shows 24GB total RAM. Please test the device at the packaging area.',
        createdAt: '2026-06-03T15:00:00Z',
      }
    ],
    activityLogs: [
      {
        id: 'log-8',
        action: 'Ticket raised',
        timestamp: '2026-06-01T09:00:00Z',
        performedByName: 'John Miller',
        performedByRole: 'employee',
      },
      {
        id: 'log-9',
        action: 'IT Review Approved & Escalated to Manager',
        timestamp: '2026-06-01T11:00:00Z',
        performedByName: 'Sarah Connor',
        performedByRole: 'it',
      },
      {
        id: 'log-10',
        action: 'Manager Approved & Opened for Assignment',
        timestamp: '2026-06-02T10:00:00Z',
        performedByName: 'Elena Rostova',
        performedByRole: 'manager',
      },
      {
        id: 'log-11',
        action: 'Assigned to Sarah Connor',
        timestamp: '2026-06-02T10:15:00Z',
        performedByName: 'Sarah Connor',
        performedByRole: 'it',
      },
      {
        id: 'log-12',
        action: 'Marked Ready for Handover',
        timestamp: '2026-06-03T15:00:00Z',
        performedByName: 'Sarah Connor',
        performedByRole: 'it',
      }
    ]
  },
  {
    id: 'TCK-105',
    title: 'VPN connection errors on remote laptop',
    description: 'Keep getting authentication timeout warnings when attempting to connect to VPN from home network.',
    type: 'software',
    status: 'closed',
    justification: 'Remote work requires secure VPN connection.',
    createdAt: '2026-05-30T11:00:00Z',
    updatedAt: '2026-05-31T14:30:00Z',
    reporterId: 'usr-6', // Diana Prince
    reporterName: 'Diana Prince',
    reporterEmail: 'diana.p@harisco.com',
    assigneeId: 'usr-2', // David Kim
    assigneeName: 'David Kim',
    comments: [
      {
        id: 'c-3',
        authorId: 'usr-2',
        authorName: 'David Kim',
        authorRole: 'it',

        content: 'Your account was locked out in Active Directory due to repeated incorrect password attempts. I have unlocked your account and triggered an AD syncer. Please try again.',
        createdAt: '2026-05-31T13:45:00Z',
      },
      {
        id: 'c-4',
        authorId: 'usr-6',
        authorName: 'Diana Prince',
        authorRole: 'employee',

        content: 'Works perfectly now! Thanks for the quick support.',
        createdAt: '2026-05-31T14:25:00Z',
      }
    ],
    activityLogs: [
      {
        id: 'log-13',
        action: 'Ticket raised',
        timestamp: '2026-05-30T11:00:00Z',
        performedByName: 'Diana Prince',
        performedByRole: 'employee',
      },
      {
        id: 'log-14',
        action: 'IT Review Approved & Escalated to Manager',
        timestamp: '2026-05-30T14:00:00Z',
        performedByName: 'David Kim',
        performedByRole: 'it',
      },
      {
        id: 'log-15',
        action: 'Manager Approved & Opened for Assignment',
        timestamp: '2026-05-31T09:30:00Z',
        performedByName: 'Robert Vance',
        performedByRole: 'manager',
      },
      {
        id: 'log-16',
        action: 'Assigned to David Kim',
        timestamp: '2026-05-31T10:00:00Z',
        performedByName: 'David Kim',
        performedByRole: 'it',
      },
      {
        id: 'log-17',
        action: 'Marked Ready for Handover',
        timestamp: '2026-05-31T13:45:00Z',
        performedByName: 'David Kim',
        performedByRole: 'it',
      },
      {
        id: 'log-18',
        action: 'Handover Accepted & Closed',
        timestamp: '2026-05-31T14:30:00Z',
        performedByName: 'Diana Prince',
        performedByRole: 'employee',
      }
    ]
  }
];
