"use client";

import type { ReactNode } from "react";
import { ConfigProvider } from "antd";
import { wkmsTheme } from "@/config/theme";

type AntdProviderProps = {
    children: ReactNode;
};

export function AntdProvider({ children }: AntdProviderProps) {
    return <ConfigProvider theme={wkmsTheme}>{children}</ConfigProvider>;
}
