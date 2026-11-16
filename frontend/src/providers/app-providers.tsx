import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AntdProvider } from "@/providers/antd-provider";

type AppProvidersProps = {
    children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <AntdRegistry>
            <AntdProvider>{children}</AntdProvider>
        </AntdRegistry>
    );
}