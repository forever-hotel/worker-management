"use client";

import { Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import Image from "next/image";

type SignInFormValues = {
    username: string;
    password: string;
};

export default function SignInPage() {
    const router = useRouter();

    const handleSubmit = () => {
        // Temporary frontend-only navigation.
        // Real authentication will be connected through the shared API Gateway later.
        router.push("/queue");
    };

    return (
        <main className="min-h-dvh bg-wkms-page">
            <section className="mx-auto grid min-h-dvh w-full grid-cols-1 md:grid-cols-2">
                {/* Hero / hotel branding */}
                <div className="relative min-h-64 overflow-hidden sm:min-h-72 md:min-h-dvh">
                    <Image
                        src="/images/hotel-sign-in.png"
                        alt="Forever City Hotel"
                        fill
                        priority
                        className="object-cover"
                    />

                    <div className="absolute inset-0 bg-black/35" />

                    <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6 md:p-8 lg:p-12">
                        <p className="text-sm font-medium tracking-[0.18em] text-white/70">
                            FOREVER CITY HOTEL
                        </p>

                        <h1 className="mt-2 text-3xl font-medium leading-tight tracking-wider sm:text-4xl lg:text-5xl">
                            Worker
                            <br />
                            <span className="text-wkms-gold">Management</span>
                        </h1>
                    </div>
                </div>

                {/* Sign-in content */}
                <div className="relative flex min-h-full flex-col px-5 py-8 sm:px-8 md:px-10 lg:px-16 xl:px-24">
                    <div className="flex flex-1 items-start sm:items-center">
                        <div className="mx-auto w-full max-w-md">
                            <Form<SignInFormValues>
                                layout="vertical"
                                onFinish={handleSubmit}
                                requiredMark={false}
                            >
                                <Form.Item
                                    name="username"
                                    label={
                                        <span className="text-xs font-semibold tracking-[0.12em] text-slate-600">
                                          USERNAME
                                        </span>
                                    }
                                    rules={[
                                        {
                                            required: true,
                                            whitespace: true,
                                            message: "Username is required.",
                                        },
                                    ]}
                                >
                                    <Input
                                        size="middle"
                                        autoComplete="username"
                                        placeholder="worker_001"
                                    />
                                </Form.Item>

                                <Form.Item
                                    name="password"
                                    label={
                                        <span className="text-xs font-semibold tracking-[0.12em] text-slate-600">
                                          PASSWORD
                                        </span>
                                    }
                                    rules={[
                                        {
                                            required: true,
                                            whitespace: true,
                                            message: "Password is required.",
                                        },
                                    ]}
                                >
                                    <Input.Password
                                        size="middle"
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                    />
                                </Form.Item>

                                <Form.Item className="mb-3">
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        size="middle"
                                        block
                                        className="font-semibold"
                                    >
                                        Sign In
                                    </Button>
                                </Form.Item>

                                <p className="text-center text-xs text-slate-500">
                                    Credentials provided by hotel manager
                                </p>
                            </Form>
                        </div>
                    </div>

                    <div className="pt-8 text-center text-xs text-slate-400">
                        WKMS v1.0 · Forever City Hotel
                    </div>
                </div>
            </section>
        </main>
    );
}