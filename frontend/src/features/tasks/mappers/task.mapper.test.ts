import {
    calculateElapsedMinutes,
    mapTaskApiRecord,
} from "./task.mapper";

describe("task mapper", () => {
    it("calculates elapsed minutes", () => {
        expect(
            calculateElapsedMinutes(
                "2026-10-03T10:00:00.000Z",
                new Date(
                    "2026-10-03T10:15:30.000Z",
                ).getTime(),
            ),
        ).toBe(15);
    });

    it("never returns negative elapsed time", () => {
        expect(
            calculateElapsedMinutes(
                "2026-10-03T11:00:00.000Z",
                new Date(
                    "2026-10-03T10:00:00.000Z",
                ).getTime(),
            ),
        ).toBe(0);
    });

    it("returns zero for an invalid submitted timestamp", () => {
        expect(
            calculateElapsedMinutes(
                "invalid-date",
            ),
        ).toBe(0);
    });

    it("maps the backend task shape to the frontend task shape", () => {
        const submittedAt =
            "2026-10-03T10:00:00.000Z";

        jest.spyOn(
            Date,
            "now",
        ).mockReturnValue(
            new Date(
                "2026-10-03T10:10:00.000Z",
            ).getTime(),
        );

        const result =
            mapTaskApiRecord({
                task_id:
                    "task-1",
                room_number:
                    "205",
                category:
                    "ROOM_CLEANING",
                description:
                    "Clean room",
                priority:
                    "HIGH",
                status:
                    "UNASSIGNED",
                assigned_worker_id:
                    null,
                booking_id:
                    "booking-1",
                service_request_id:
                    null,
                food_order_id:
                    null,
                submitted_at:
                    submittedAt,
                completed_at:
                    null,
                source:
                    "CHECKOUT_TRIGGER",
                created_at:
                    submittedAt,
                updated_at:
                    submittedAt,
            });

        expect(
            result,
        ).toEqual({
            id:
                "task-1",
            roomNumber:
                "205",
            category:
                "ROOM_CLEANING",
            description:
                "Clean room",
            priority:
                "HIGH",
            status:
                "UNASSIGNED",
            source:
                "CHECKOUT_TRIGGER",
            submittedAt,
            elapsedMinutes:
                10,
        });

        jest.restoreAllMocks();
    });
});
