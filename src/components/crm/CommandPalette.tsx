import React, { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
  CommandShortcut
} from '@/components/ui/command';
import { crmCommands } from '@/lib/crmCommands';
import { supabase } from '@/integrations/supabase/client';
import { CustomerMiniPeek } from './CustomerMiniPeek';
import { useAuth } from '@/hooks/useAuth';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const navigate = useNavigate();
  const { isManager } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Simple local search effect for customers
  useEffect(() => {
    if (search.length > 1 && open) {
      const fetchCustomers = async () => {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
          .limit(5);
        if (data) setCustomers(data);
      };
      fetchCustomers();
    } else {
      setCustomers([]);
    }
  }, [search, open]);

  const handleCommand = (cmd: any) => {
    setOpen(false);
    if (cmd.path) {
      navigate({ to: cmd.path });
    } else if (cmd.onSelect) {
      cmd.onSelect();
    } else {
      console.log(`Command triggered: ${cmd.id}`);
    }
  };

  const handleCustomerSelect = (customer: any) => {
    setOpen(false);
    // Tạm thời điều hướng về trang customers với search state nếu có thể, hoặc dùng state management để mở drawer
    navigate({ to: '/customers', search: { q: customer.name } as any });
  };

  const allowedCommands = crmCommands.filter(c => 
    c.permission === 'all' || 
    (c.permission === 'manager_only' && isManager) || 
    (c.permission === 'sale_only' && !isManager)
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a command or search customers..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results found.</CommandEmpty>
        
        {customers.length > 0 && (
          <CommandGroup heading="Customers">
            {customers.map((c) => (
              <CommandItem 
                key={c.id} 
                onSelect={() => handleCustomerSelect(c)}
                className="flex justify-between items-center py-2 relative group"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-500">{c.phone || c.email}</span>
                </div>
                
                {/* Mini Peek Hover Card */}
                <div className="absolute right-full mr-2 top-0 hidden group-hover:block z-50">
                  <CustomerMiniPeek customer={c} />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {['Navigation', 'Actions', 'Recovery'].map(category => {
          const cmds = allowedCommands.filter(c => c.category === category);
          if (cmds.length === 0) return null;
          
          return (
            <CommandGroup key={category} heading={category}>
              {cmds.map(cmd => {
                const Icon = cmd.icon;
                return (
                  <CommandItem key={cmd.id} onSelect={() => handleCommand(cmd)}>
                    <Icon className="mr-2 h-4 w-4 text-slate-500" />
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut>
                        {cmd.shortcut.join(' ')}
                      </CommandShortcut>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
