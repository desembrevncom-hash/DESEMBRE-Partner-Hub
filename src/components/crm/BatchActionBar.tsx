import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BatchAction {
  id: string;
  label: string;
  icon?: any;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  onClick: (selectedIds: string[]) => void;
}

interface BatchActionBarProps {
  selectedIds: string[];
  actions: BatchAction[];
  onClear: () => void;
}

export function BatchActionBar({ selectedIds, actions, onClear }: BatchActionBarProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-200">
      <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[400px]">
        
        <div className="flex items-center gap-2 border-r border-slate-700 pr-4 shrink-0">
          <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
            {selectedIds.length}
          </div>
          <span className="text-sm font-medium text-slate-300">đã chọn</span>
        </div>

        <div className="flex items-center gap-2 flex-1">
          {actions.slice(0, 4).map(action => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant={action.variant || 'secondary'}
                size="sm"
                className={`h-8 text-xs font-bold ${action.variant === 'secondary' ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : ''}`}
                onClick={() => action.onClick(selectedIds)}
              >
                {Icon && <Icon className="w-3.5 h-3.5 mr-1.5" />}
                {action.label}
              </Button>
            );
          })}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 rounded-full"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
