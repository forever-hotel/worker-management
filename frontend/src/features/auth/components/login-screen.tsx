"use client";

import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { loginWorker } from "../api/auth.api";
import type { LoginRequest } from "../types/auth";
import { ApiError } from "@/lib/api-client";
import { saveAuthSession } from "@/lib/auth-session";

export function LoginScreen() {
  const router = useRouter();

  const [authenticationError, setAuthenticationError] = useState<string | null>(
    null,
  );

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: LoginRequest) => {
    setAuthenticationError(null);
    setSubmitting(true);

    try {
      const response = await loginWorker(values);

      saveAuthSession(response);

      router.replace(
        response.passwordChangeRequired ? "/change-password" : "/tasks",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAuthenticationError("Invalid username or password.");
      } else {
        setAuthenticationError("Unable to sign in. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-wkms-page p-6">
      <section
        aria-labelledby="worker-sign-in-title"
        className="w-full max-w-[420px] rounded-xl border border-wkms-border bg-wkms-white p-6 sm:p-8"
      >
        <p className="text-xs font-medium tracking-[0.16em] text-wkms-gold">
          FOREVER CITY HOTEL
        </p>
        <h1
          id="worker-sign-in-title"
          className="my-4 text-2xl font-medium text-wkms-navy"
        >
          Worker sign in
        </h1>
        <Form<LoginRequest>
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          {authenticationError && (
            <Alert
              type="error"
              showIcon
              title={authenticationError}
              className="mb-4"
            />
          )}

          <Form.Item
            name="username"
            label={
              <span className="text-xs font-medium tracking-[0.08em] text-wkms-navy">
                USERNAME OR EMAIL
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
              <span className="text-xs font-medium tracking-[0.08em] text-wkms-navy">
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
              loading={submitting}
              className="font-semibold"
            >
              Sign In
            </Button>
          </Form.Item>

          <p className="text-center text-xs text-wkms-navy/70">
            Credentials provided by hotel manager
          </p>
          <Link
            href="/reset-password"
            className="mt-4 block text-center text-sm text-wkms-navy underline"
          >
            Forgot password?
          </Link>
        </Form>
      </section>
    </main>
  );
}
