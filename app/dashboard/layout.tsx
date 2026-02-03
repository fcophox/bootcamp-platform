import { SidebarProvider } from '@/components/sidebar-context';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SidebarProvider>{children}</SidebarProvider>;
}
