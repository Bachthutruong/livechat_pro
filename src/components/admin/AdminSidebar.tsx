'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutDashboard, Users, Settings, MessageSquareText, CalendarCog, ShieldAlert } from 'lucide-react'; // Added ShieldAlert for Q&A/Keywords
import { Logo } from '@/components/icons/Logo';

const adminNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/qna', label: 'Q&A / Keywords', icon: MessageSquareText },
  { href: '/admin/appointments', label: 'Appointment Rules', icon: CalendarCog },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-16 left-0 z-30 w-64 h-[calc(100vh-4rem)] transition-transform -translate-x-full bg-card border-r sm:translate-x-0"> {/* Adjust top and height */}
      <ScrollArea className="h-full py-4 px-3 overflow-y-auto">
        <div className="flex items-center mb-6 px-2 mt-2"> {/* Optional: Add some margin top if needed */}
          <Logo />
          <h2 className="ml-2 text-xl font-semibold text-primary">Admin Panel</h2>
        </div>
        <ul className="space-y-2 font-medium">
          {adminNavItems.map((item) => (
            <li key={item.href}>
              <Button
                asChild
                variant={pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/admin/dashboard') ? 'secondary' : 'ghost'}
                className="w-full justify-start"
              >
                <Link href={item.href}>
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}
