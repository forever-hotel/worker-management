"use client";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { staffRequest, sessionResponse } from "@/features/auth/api/auth.api";
import { saveAuthSession } from "@/lib/auth-session";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(values: {
    currentPassword: string;
    newPassword: string;
  }) {
    setBusy(true);
    setError("");
    try {
      const session = await staffRequest("change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      saveAuthSession(sessionResponse(session));
      router.replace("/tasks");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to change password",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-dvh bg-wkms-page flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl bg-white border border-wkms-border p-8">
        <h1 className="text-xl font-semibold text-wkms-navy mb-4">
          Change your initial password
        </h1>
        {error && <Alert type="error" title={error} showIcon />}
        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[{ required: true, min: 12, max: 72 }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirm"
            dependencies={["newPassword"]}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator: (_, value) =>
                  value === getFieldValue("newPassword")
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords must match")),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            Change password
          </Button>
        </Form>
      </section>
    </main>
  );
}
