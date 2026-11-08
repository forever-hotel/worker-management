"use client";

import { Alert, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRef, useState } from "react";

export function PasswordReset() {
  const [email, setEmail] = useState("");
  const [form] = Form.useForm();
  const [stage, setStage] = useState<"email" | "code" | "done">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  async function submit(values: {
    email: string;
    code?: string;
    password?: string;
    confirmation?: string;
  }) {
    if (lock.current) return;
    setError("");
    setMessage("");
    if (
      stage === "code" &&
      (!/^[0-9]{6}$/.test(values.code ?? "") ||
        (values.password ?? "").length < 12 ||
        new TextEncoder().encode(values.password ?? "").length > 72 ||
        !/\S/.test(values.password ?? "") ||
        values.password !== values.confirmation)
    ) {
      setError(
        "Enter the six-digit code and matching new passwords (at least 12 characters, up to 72 UTF-8 bytes).",
      );
      return;
    }
    lock.current = true;
    setPending(true);
    try {
      const response = await fetch(
        "/api/auth/" +
          (stage === "email" ? "request-password-reset" : "reset-password"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify(
            stage === "email"
              ? { email: values.email.trim() }
              : {
                  email: email.trim(),
                  code: values.code,
                  newPassword: values.password,
                },
          ),
        },
      );
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== "object" ||
        !("message" in body) ||
        typeof body.message !== "string"
      )
        throw new Error("Password recovery is unavailable. Please retry.");
      if (!response.ok) throw new Error(body.message);
      setMessage(body.message);
      if (stage === "email") setEmail(values.email.trim());
      setStage(stage === "email" ? "code" : "done");
      form.resetFields(["code", "password", "confirmation"]);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name !== "TypeError"
          ? cause.message
          : "Password recovery is unavailable. Please retry.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-wkms-page p-6">
      <section
        aria-labelledby="reset-title"
        className="w-full max-w-[420px] rounded-xl border border-wkms-border bg-wkms-white p-6 sm:p-8"
      >
        <p className="text-xs font-medium tracking-[0.16em] text-wkms-gold">
          FOREVER CITY HOTEL
        </p>
        <h1
          id="reset-title"
          className="my-4 text-2xl font-medium text-wkms-navy"
        >
          Reset password
        </h1>
        <p className="mb-5 text-sm text-wkms-navy/75">
          Enter the email for your Worker or ROOT account. We will send a
          verification code. Your new password must differ from your current
          password.
        </p>
        {error && (
          <Alert type="error" showIcon title={error} className="mb-4" />
        )}
        {message && (
          <Alert type="success" showIcon title={message} className="mb-4" />
        )}
        {stage !== "done" && (
          <Form
            form={form}
            layout="vertical"
            onFinish={submit}
            requiredMark={false}
            initialValues={{ email }}
          >
            <Form.Item
              name="email"
              label="Account email"
              rules={[{ required: true }, { type: "email" }, { max: 320 }]}
            >
              <Input
                type="email"
                autoComplete="email"
                readOnly={stage === "code"}
              />
            </Form.Item>
            {stage === "code" && (
              <>
                <Form.Item
                  name="code"
                  label="Email verification code"
                  rules={[{ required: true }, { pattern: /^[0-9]{6}$/ }]}
                >
                  <Input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </Form.Item>
                <Form.Item
                  name="password"
                  label="New password"
                  rules={[{ required: true }, { min: 12 }, { max: 72 }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  name="confirmation"
                  label="Confirm new password"
                  dependencies={["password"]}
                  rules={[
                    { required: true },
                    ({ getFieldValue }) => ({
                      validator: (_, value) =>
                        value === getFieldValue("password")
                          ? Promise.resolve()
                          : Promise.reject(new Error("Passwords must match.")),
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </>
            )}
            <Button type="primary" htmlType="submit" block loading={pending}>
              {stage === "email" ? "Send verification code" : "Change password"}
            </Button>
            {stage === "code" && (
              <Button
                className="mt-3"
                block
                disabled={pending}
                onClick={() => {
                  setStage("email");
                  form.resetFields();

                  setMessage("");
                  setError("");
                }}
              >
                Use another email
              </Button>
            )}
          </Form>
        )}
        <Link
          className="mt-4 block text-center text-sm text-wkms-navy underline"
          href="/login"
        >
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
