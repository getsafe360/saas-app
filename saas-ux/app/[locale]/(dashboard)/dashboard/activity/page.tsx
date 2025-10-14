// app/[locale]/(dashboard)/dashboard/activity/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';
// import { ActivityType } from '@/lib/db/schema'; // removed
import { getActivityLogs } from '@/lib/db/queries';

export const experimental_ppr = true;

// Canonical action values (match what you store in DB)
const ACTIONS = {
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  SIGN_OUT: 'sign_out',
  UPDATE_PASSWORD: 'update_password',
  DELETE_ACCOUNT: 'delete_account',
  UPDATE_ACCOUNT: 'update_account',
  CREATE_TEAM: 'create_team',
  REMOVE_TEAM_MEMBER: 'remove_team_member',
  INVITE_TEAM_MEMBER: 'invite_team_member',
  ACCEPT_INVITATION: 'accept_invitation',
} as const;

type ActivityType = typeof ACTIONS[keyof typeof ACTIONS];

// Minimal shape expected from getActivityLogs()
type ActivityLog = {
  id: string | number;
  action: ActivityType | string;
  ipAddress?: string | null;
  timestamp: string | number | Date;
};

const iconMap: Record<ActivityType, LucideIcon> = {
  [ACTIONS.SIGN_UP]: UserPlus,
  [ACTIONS.SIGN_IN]: UserCog,
  [ACTIONS.SIGN_OUT]: LogOut,
  [ACTIONS.UPDATE_PASSWORD]: Lock,
  [ACTIONS.DELETE_ACCOUNT]: UserMinus,
  [ACTIONS.UPDATE_ACCOUNT]: Settings,
  [ACTIONS.CREATE_TEAM]: UserPlus,
  [ACTIONS.REMOVE_TEAM_MEMBER]: UserMinus,
  [ACTIONS.INVITE_TEAM_MEMBER]: Mail,
  [ACTIONS.ACCEPT_INVITATION]: CheckCircle,
};

function getRelativeTime(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

function formatAction(action: ActivityType): string {
  switch (action) {
    case ACTIONS.SIGN_UP:
      return 'You signed up';
    case ACTIONS.SIGN_IN:
      return 'You signed in';
    case ACTIONS.SIGN_OUT:
      return 'You signed out';
    case ACTIONS.UPDATE_PASSWORD:
      return 'You changed your password';
    case ACTIONS.DELETE_ACCOUNT:
      return 'You deleted your account';
    case ACTIONS.UPDATE_ACCOUNT:
      return 'You updated your account';
    case ACTIONS.CREATE_TEAM:
      return 'You created a new team';
    case ACTIONS.REMOVE_TEAM_MEMBER:
      return 'You removed a team member';
    case ACTIONS.INVITE_TEAM_MEMBER:
      return 'You invited a team member';
    case ACTIONS.ACCEPT_INVITATION:
      return 'You accepted an invitation';
    default:
      return 'Unknown action occurred';
  }
}

export default async function ActivityPage() {
  const logs = (await getActivityLogs()) as ActivityLog[];

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Activity Log
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="space-y-4">
              {logs.map((log) => {
                const action = log.action as ActivityType;
                const Icon = iconMap[action] || Settings;
                const formattedAction = formatAction(action);

                return (
                  <li key={String(log.id)} className="flex items-center space-x-4">
                    <div className="bg-orange-100 rounded-full p-2">
                      <Icon className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {formattedAction}
                        {log.ipAddress ? ` from IP ${log.ipAddress}` : null}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getRelativeTime(new Date(log.timestamp))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No activity yet
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                When you perform actions like signing in or updating your
                account, they'll appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
