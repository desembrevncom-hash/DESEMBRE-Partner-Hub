import { LucideIcon, Search, PhoneCall, UserPlus, ArrowRightLeft, Clock, Activity, Settings2, ShieldAlert } from 'lucide-react';

export type CRMCommandPermission = 'all' | 'manager_only' | 'sale_only';

export interface CRMCommand {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  shortcut?: string[];
  permission: CRMCommandPermission;
  category: 'Actions' | 'Navigation' | 'Recovery';
  path?: string; // If it's a navigation command
  onSelect?: (context?: any) => void;
}

export const crmCommands: CRMCommand[] = [
  // Navigation
  {
    id: 'nav_customers',
    label: 'Sales Workspace',
    description: 'Go to customer execution board',
    icon: Search,
    shortcut: ['G', 'C'],
    permission: 'all',
    category: 'Navigation',
    path: '/customers'
  },
  {
    id: 'nav_ops',
    label: 'Operations Center',
    description: 'Go to CRM Ops oversight',
    icon: Activity,
    shortcut: ['G', 'O'],
    permission: 'manager_only',
    category: 'Navigation',
    path: '/admin/crm-ops'
  },
  {
    id: 'nav_hub',
    label: 'Admin Hub',
    icon: Settings2,
    permission: 'manager_only',
    category: 'Navigation',
    path: '/admin/hub'
  },
  
  // Actions
  {
    id: 'action_quick_log',
    label: 'Quick Log',
    description: 'Log a new interaction quickly',
    icon: PhoneCall,
    shortcut: ['Q'],
    permission: 'all',
    category: 'Actions',
  },
  {
    id: 'action_move_stage',
    label: 'Move Stage',
    description: 'Change customer pipeline stage',
    icon: ArrowRightLeft,
    shortcut: ['⇧', 'M'],
    permission: 'all',
    category: 'Actions',
  },
  {
    id: 'action_assign',
    label: 'Assign Staff',
    description: 'Assign or re-assign customer',
    icon: UserPlus,
    shortcut: ['⇧', 'A'],
    permission: 'manager_only',
    category: 'Actions',
  },
  {
    id: 'action_follow_up',
    label: 'Schedule Follow-up',
    icon: Clock,
    permission: 'all',
    category: 'Actions',
  },

  // Recovery
  {
    id: 'recovery_view',
    label: 'View Exceptions',
    description: 'Open recovery exception queue',
    icon: ShieldAlert,
    permission: 'manager_only',
    category: 'Recovery',
    path: '/admin/crm-ops'
  }
];
