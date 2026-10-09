import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { getMyTasks, getTaskQueue } from "@/features/tasks/api/tasks.api";

import type { TaskApiRecord } from "@/features/tasks/types/task-api";

import { ApiError } from "@/lib/api-client";

import { TaskDataProvider, useTaskData } from "./task-data-provider";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock("@/features/tasks/api/tasks.api", () => ({
  getTaskQueue: jest.fn(),

  getMyTasks: jest.fn(),
}));

const mockedGetTaskQueue = jest.mocked(getTaskQueue);

const mockedGetMyTasks = jest.mocked(getMyTasks);

const queueTasks: TaskApiRecord[] = [
  {
    task_id: "queue-1",
    room_number: "101",
    category: "ROOM_CLEANING",
    description: "Clean room",
    priority: "NORMAL",
    status: "UNASSIGNED",
    assigned_worker_id: null,
    booking_id: "booking-1",
    service_request_id: null,
    food_order_id: null,
    submitted_at: "2026-10-04T08:00:00.000Z",
    completed_at: null,
    source: "CHECKOUT_TRIGGER",
    created_at: "2026-10-04T08:00:00.000Z",
    updated_at: "2026-10-04T08:00:00.000Z",
  },
];

const myTasks: TaskApiRecord[] = [
  {
    ...queueTasks[0],
    task_id: "mine-1",
    status: "ASSIGNED",
    assigned_worker_id: "worker-1",
  },
];

function Probe() {
  const {
    queueCount,
    myTasksCount,
    loading,
    error,
    refreshAll,
    refreshQueue,
    refreshMyTasks,
  } = useTaskData();

  const [page, setPage] = useState("queue");

  return (
    <div>
      <span data-testid="queue-count">{queueCount}</span>

      <span data-testid="my-count">{myTasksCount}</span>

      <span data-testid="loading">{loading ? "loading" : "ready"}</span>

      <span data-testid="error">{error ?? "none"}</span>

      <span data-testid="page">{page}</span>

      <button
        type="button"
        onClick={() => {
          void refreshAll();
        }}
      >
        Refresh all
      </button>

      <button
        type="button"
        onClick={() => {
          void refreshQueue();
        }}
      >
        Refresh queue
      </button>

      <button
        type="button"
        onClick={() => {
          void refreshMyTasks();
        }}
      >
        Refresh mine
      </button>

      <button
        type="button"
        onClick={() => {
          setPage((current) => (current === "queue" ? "my-tasks" : "queue"));
        }}
      >
        Switch page
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <TaskDataProvider>
      <Probe />
    </TaskDataProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });

  return {
    promise,
    resolve,
  };
}

describe("TaskDataProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedGetTaskQueue.mockResolvedValue(queueTasks);

    mockedGetMyTasks.mockResolvedValue(myTasks);
  });

  it("loads queue and My Tasks once on initial protected entry", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    expect(screen.getByTestId("queue-count")).toHaveTextContent("1");

    expect(screen.getByTestId("my-count")).toHaveTextContent("1");

    expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

    expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
  });

  it("does not reload task APIs when child screen changes", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Switch page",
      }),
    );

    expect(screen.getByTestId("page")).toHaveTextContent("my-tasks");

    expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

    expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
  });

  it("refreshes both collections through refreshAll", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();

    mockedGetMyTasks.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh all",
      }),
    );

    await waitFor(() => {
      expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

      expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
    });
  });

  it("refreshes queue and My Tasks independently", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();

    mockedGetMyTasks.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh queue",
      }),
    );

    await waitFor(() => {
      expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);
    });

    expect(mockedGetMyTasks).not.toHaveBeenCalled();

    mockedGetTaskQueue.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh mine",
      }),
    );

    await waitFor(() => {
      expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
    });

    expect(mockedGetTaskQueue).not.toHaveBeenCalled();
  });

  it("redirects to login when initial task loading returns 401", async () => {
    mockedGetTaskQueue.mockRejectedValueOnce(
      new ApiError(
        401,
        {
          message: "Unauthorized",
        },
        "Unauthorized",
      ),
    );

    renderProvider();

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("stores a shared error when task loading fails", async () => {
    mockedGetTaskQueue.mockRejectedValueOnce(new Error("network"));

    renderProvider();

    expect(
      await screen.findByText("Unable to refresh task data."),
    ).toBeInTheDocument();
  });

  it("refreshes shared data when the browser tab becomes visible", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();

    mockedGetMyTasks.mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

      expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
    });
  });

  it("deduplicates concurrent refreshAll requests", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();

    mockedGetMyTasks.mockClear();

    const queueDeferred = deferred<TaskApiRecord[]>();

    const myTasksDeferred = deferred<TaskApiRecord[]>();

    mockedGetTaskQueue.mockReturnValue(queueDeferred.promise);

    mockedGetMyTasks.mockReturnValue(myTasksDeferred.promise);

    const button = screen.getByRole("button", {
      name: "Refresh all",
    });

    fireEvent.click(button);

    fireEvent.click(button);

    expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

    expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);

    await act(async () => {
      queueDeferred.resolve(queueTasks);

      myTasksDeferred.resolve(myTasks);

      await Promise.all([queueDeferred.promise, myTasksDeferred.promise]);
    });
  });

  it("clears a shared error after a successful targeted refresh", async () => {
    mockedGetTaskQueue.mockRejectedValueOnce(new Error("network"));

    renderProvider();

    expect(
      await screen.findByText("Unable to refresh task data."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh mine",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });
  });

  it("does not refresh when the browser tab becomes hidden", async () => {
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();
    mockedGetMyTasks.mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(mockedGetTaskQueue).not.toHaveBeenCalled();

    expect(mockedGetMyTasks).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("ignores a successful refresh that finishes after unmount", async () => {
    const rendered = renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();
    mockedGetMyTasks.mockClear();

    const queueDeferred = deferred<TaskApiRecord[]>();

    const myTasksDeferred = deferred<TaskApiRecord[]>();

    mockedGetTaskQueue.mockReturnValue(queueDeferred.promise);

    mockedGetMyTasks.mockReturnValue(myTasksDeferred.promise);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh all",
      }),
    );

    rendered.unmount();

    await act(async () => {
      queueDeferred.resolve(queueTasks);
      myTasksDeferred.resolve(myTasks);

      await Promise.all([queueDeferred.promise, myTasksDeferred.promise]);
    });

    expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);

    expect(mockedGetMyTasks).toHaveBeenCalledTimes(1);
  });

  it("ignores a failed refresh that finishes after unmount", async () => {
    const rendered = renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    mockedGetTaskQueue.mockClear();
    mockedGetMyTasks.mockClear();

    let rejectQueue: ((reason?: unknown) => void) | undefined;

    const lateFailure = new Promise<TaskApiRecord[]>((_resolve, reject) => {
      rejectQueue = reject;
    });

    mockedGetTaskQueue.mockReturnValue(lateFailure);

    mockedGetMyTasks.mockResolvedValue(myTasks);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh all",
      }),
    );

    rendered.unmount();

    await act(async () => {
      rejectQueue?.(new Error("late network failure"));

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedGetTaskQueue).toHaveBeenCalledTimes(1);
  });

  it("rejects useTaskData outside TaskDataProvider", () => {
    function InvalidConsumer() {
      useTaskData();

      return null;
    }

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      expect(() => {
        render(<InvalidConsumer />);
      }).toThrow("useTaskData must be used inside TaskDataProvider");
    } finally {
      consoleError.mockRestore();
    }
  });
});
