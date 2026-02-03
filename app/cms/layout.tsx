import { SidebarProvider } from '@/components/sidebar-context';

export default function CmsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <SidebarProvider>{children}</SidebarProvider>;
}
