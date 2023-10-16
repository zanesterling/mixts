import { describe, expect, test, beforeAll } from "bun:test";

import { State, Instruction, Word, Index, Byte, Sign, Plus, Minus } from "./mix";

beforeAll(() => {
    // setup tests
});

describe("mix", () => {
    describe("can render instructions to text", () => {
        test("LDA", () => {
            expect(new Instruction(Index.fromNumber(2000),  2, 3,  8).toText()).toBe("LDA  2000,2(0:3)");
            expect(new Instruction(Index.fromNumber(2000),  2, 11, 8).toText()).toBe("LDA  2000,2(1:3)");
            expect(new Instruction(Index.fromNumber(2000),  0, 11, 8).toText()).toBe("LDA  2000(1:3)");
            expect(new Instruction(Index.fromNumber(2000),  0, 5,  8).toText()).toBe("LDA  2000");
            expect(new Instruction(Index.fromNumber(-2000), 4, 5,  8).toText()).toBe("LDA  -2000,4");
        });

        test("NOP", () => {
            expect(new Instruction(new Index(Plus, 0, 0), 0, 0, 0).toText()).toBe("NOP");
        });
    });

    test.todo("can parse instructions");

    describe("behavior", () => {
        describe("LD*", () => {
            const state = new State();
            state.contents[2000] = new Word(Minus, 1, 16, 3, 5, 4);

            const testCases = [
                {
                    assembly: "LDA  2000",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 5, 8),
                    result: new Word(Minus, 1, 16, 3, 5, 4),
                },
                {
                    assembly: "LDA  2000(1:5)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 13, 8),
                    result: new Word(Plus, 1, 16, 3, 5, 4),
                },
                {
                    assembly: "LDA  2000(3:5)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 29, 8),
                    result: new Word(Plus, 0, 0, 3, 5, 4),
                },
                {
                    assembly: "LDA  2000(0:3)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 3, 8),
                    result: new Word(Minus, 0, 0, 1, 16, 3),
                },
                {
                    assembly: "LDA  2000(4:4)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 36, 8),
                    result: new Word(Plus, 0, 0, 0, 0, 5),
                },
                {
                    assembly: "LDA  2000(0:0)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 0, 8),
                    result: new Word(Minus, 0, 0, 0, 0, 0),
                },
                {
                    assembly: "LDA  2000(1:1)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 9, 8),
                    result: new Word(Plus, 0, 0, 0, 0, 1),
                },
            ];
            for (const testCase of testCases) {
                test(testCase.assembly, () => {
                    expect(testCase.instruction.toText()).toBe(testCase.assembly);
                    state.exec(testCase.instruction);
                    expect(state.rA).toStrictEqual(testCase.result);
                });
            }
        });

        test.todo("ST*");
        test.todo("Arithmetic");
        test.todo("Address Transfer");
        test.todo("Comparison");
        test.todo("Jump");
        test.todo("Shift");
        test.todo("Move");
        test.todo("I/O");
        test.todo("CHAR & NUM");
    });
});