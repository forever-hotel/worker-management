import { render } from "@testing-library/react";
import { ServiceWorkerRegistration } from "./service-worker-registration";

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  window.navigator,
  "serviceWorker",
);

function setServiceWorker(value?: { register: jest.Mock }) {
  if (!value) {
    Reflect.deleteProperty(window.navigator, "serviceWorker");
    return;
  }

  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalServiceWorker) {
    Object.defineProperty(window.navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(window.navigator, "serviceWorker");
  }
});

describe("DDP-199 service-worker registration development safeguards", () => {
  // next/jest compiles components for NODE_ENV=test. It may replace
  // process.env.NODE_ENV at transform time, so changing the value during
  // a test does not simulate a production build. Production registration
  // and error handling must be verified in a real production browser run.
  it("does not register from the Jest development/test build", () => {
    const register = jest.fn().mockResolvedValue(undefined);
    setServiceWorker({ register });
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container).toBeEmptyDOMElement();
    expect(register).not.toHaveBeenCalled();
  });

  it("renders safely when the browser does not support service workers", () => {
    setServiceWorker();
    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});
