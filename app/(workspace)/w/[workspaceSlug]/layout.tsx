import OfficeShell from '@/components/office/OfficeShell';

export default function WorkspaceSlugLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <OfficeShell>{children}</OfficeShell>;
}
