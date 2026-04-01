import Layout from "@/components/layout";

interface MainLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <Layout>
      {children}
    </Layout>
  );
}
