import {
    apiRequest,
} from "@/lib/api-client";

import {
    getShiftSummary,
} from "./shift.api";

jest.mock(
    "@/lib/api-client",
    () => ({
        apiRequest:
            jest.fn(),
    }),
);

describe("shift API", () => {
    it("requests the authenticated worker shift summary", async () => {
        jest.mocked(
            apiRequest,
        ).mockResolvedValue(
            {} as never,
        );

        await getShiftSummary();

        expect(
            apiRequest,
        ).toHaveBeenCalledWith(
            "/wkms/shift/summary",
        );
    });
});
