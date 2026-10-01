import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

class MockMessageChannel {
    port1 = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        close: jest.fn(),
        start: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    };

    port2 = {
        postMessage: (data: unknown) => {
            queueMicrotask(() => {
                this.port1.onmessage?.({ data } as MessageEvent);
            });
        },
        close: jest.fn(),
        start: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    };
}

Object.defineProperty(globalThis, "MessageChannel", {
    writable: true,
    value: MockMessageChannel,
});

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});