import { describe, expect, test, beforeAll } from "bun:test";

import { Instruction, Byte, Sign, Plus, Minus } from "./mix";

beforeAll(() => {
    // setup tests
});

describe("mix", () => {
    describe("can render instructions to text", () => {
        test("lda", () => {
            const a1 = 2000 >> 6;
            const a2 = 2000 % 64;
            expect(new Instruction(Plus,  a1, a2, 2, 3,  8).toText()).toBe("LDA  2000,2(0:3)");
            expect(new Instruction(Plus,  a1, a2, 2, 11, 8).toText()).toBe("LDA  2000,2(1:3)");
            expect(new Instruction(Plus,  a1, a2, 0, 11, 8).toText()).toBe("LDA  2000(1:3)");
            expect(new Instruction(Plus,  a1, a2, 0, 5,  8).toText()).toBe("LDA  2000");
            expect(new Instruction(Minus, a1, a2, 4, 5,  8).toText()).toBe("LDA  -2000,4");
        });
        test("nop", () => {
            expect(new Instruction(Plus, 0, 0, 0, 0, 0).toText()).toBe("NOP");
        });
    });

    test.todo("can parse instructions");
});