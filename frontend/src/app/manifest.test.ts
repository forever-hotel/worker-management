
import manifest from "./manifest";

describe("WKMS PWA manifest", () => {
    const config = manifest();

    it("identifies WKMS and uses standalone mode", () => {
        expect(config.name).toBe(
            "Forever City Hotel | Worker Management",
        );
        expect(config.short_name).toBe("WKMS");
        expect(config.start_url).toBe("/");
        expect(config.scope).toBe("/");
        expect(config.display).toBe("standalone");
    });

    it("preserves the approved hotel palette", () => {
        expect(config.theme_color).toBe("#1a3c5e");
        expect(config.background_color).toBe("#f5f3ef");
    });

    it("declares both required PNG icon sizes", () => {
        expect(config.icons).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    src: "/icons/wkms-192.png",
                    sizes: "192x192",
                    type: "image/png",
                }),
                expect.objectContaining({
                    src: "/icons/wkms-512.png",
                    sizes: "512x512",
                    type: "image/png",
                }),
            ]),
        );
    });

    it("does not enable offline task synchronization", () => {
        expect(config.start_url).toBe("/");
        expect(config.display).toBe("standalone");
    });
});
