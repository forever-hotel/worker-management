import {
    apiRequest,
} from "@/lib/api-client";

import type {
    ShiftSummary,
} from "../types/shift-summary";

export function getShiftSummary():
    Promise<ShiftSummary> {
    return apiRequest<ShiftSummary>(
        "/wkms/shift/summary",
    );
}
