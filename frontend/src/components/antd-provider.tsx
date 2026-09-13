"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";

type AntdProviderProps = {
    children: ReactNode;
};

export function AntdProvider({ children }: AntdProviderProps) {
    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: "#1a3c5e",
                    colorSuccess: "#1a6b3c",
                    colorWarning: "#c9920d",
                    colorText: "#12263a",
                    borderRadius: 12,
                    controlHeight: 48,
                },
            }}
        >
            {children}
        </ConfigProvider>
    );
}