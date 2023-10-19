import { describe, expect, test, beforeAll } from "bun:test";

import {
    State, Instruction, Word, Index, Byte, Sign, Plus, Minus,
    padLeft, padRight, leftRot, rightRot,
} from "./mix";

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

        describe("ST*", () => {
            const state = new State();
            state.rA = new Word(Plus, 6, 7, 8, 9, 0);

            const testCases = [
                {
                    assembly: "STA  2000",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 5, 24),
                    result: new Word(Plus, 6, 7, 8, 9, 0),
                },
                {
                    assembly: "STA  2000(1:5)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 13, 24),
                    result: new Word(Minus, 6, 7, 8, 9, 0),
                },
                {
                    assembly: "STA  2000(5:5)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 45, 24),
                    result: new Word(Minus, 1, 2, 3, 4, 0),
                },
                {
                    assembly: "STA  2000(2:2)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 18, 24),
                    result: new Word(Minus, 1, 0, 3, 4, 5),
                },
                {
                    assembly: "STA  2000(2:3)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 19, 24),
                    result: new Word(Minus, 1, 9, 0, 4, 5),
                },
                {
                    assembly: "STA  2000(0:1)",
                    instruction: new Instruction(Index.fromNumber(2000), 0, 1, 24),
                    result: new Word(Plus, 0, 2, 3, 4, 5),
                },
            ];
            for (const testCase of testCases) {
                test(testCase.assembly, () => {
                    expect(testCase.instruction.toText()).toBe(testCase.assembly);
                    state.contents[2000] = new Word(Minus, 1, 2, 3, 4, 5);
                    state.exec(testCase.instruction);
                    expect(state.contents[2000]).toStrictEqual(testCase.result);
                })
            }
        });

        describe("Arithmetic", () => {
            test("ADD  1000", () => {
                const state = new State();
                state.rA = new Word(Plus, 19, 18, 1, 2, 22);
                state.setmem(1000, new Word(Plus, 1, 36, 5, 0, 50));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 1);
                expect(instr.toText()).toStrictEqual("ADD  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Plus, 20, 54, 6, 3, 8));
            });

            test("SUB  1000", () => {
                const state = new State();
                state.rA = new Word(Minus, 19, 18, 0, 0, 9);
                state.setmem(1000, new Word(Minus, 31, 16, 2, 22, 0));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 2);
                expect(instr.toText()).toStrictEqual("SUB  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Plus, 11, 62, 2, 21, 55));
            });

            test("MUL  1000", () => {
                const state = new State();
                state.rA = new Word(Plus, 1, 1, 1, 1, 1);
                state.setmem(1000, new Word(Plus, 1, 1, 1, 1, 1));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 3);
                expect(instr.toText()).toStrictEqual("MUL  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Plus, 0, 1, 2, 3, 4));
                expect(state.rX).toStrictEqual(new Word(Plus, 5, 4, 3, 2, 1));
            });

            test("MUL  1000(1:1)", () => {
                const state = new State();
                state.rA = new Word(Minus, 0, 0, 0, 1, 48);
                state.setmem(1000, new Word(Plus, 2, 1, 2, 3, 4));
                const instr = new Instruction(Index.fromNumber(1000), 0, 9, 3);
                expect(instr.toText()).toStrictEqual("MUL  1000(1:1)");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Minus, 0, 0, 0, 0, 0));
                expect(state.rX).toStrictEqual(new Word(Minus, 0, 0, 0, 3, 32));
            });

            test("MUL  1000 (minus)", () => {
                const state = new State();
                state.rA = new Word(Minus, 50, 0, 1, 48, 4);
                state.setmem(1000, new Word(Minus, 2, 0, 0, 0, 0));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 3);
                expect(instr.toText()).toStrictEqual("MUL  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Plus, 1, 36, 0, 3, 32));
                expect(state.rX).toStrictEqual(new Word(Plus, 8, 0, 0, 0, 0));
            });

            test("DIV  1000 (plus)", () => {
                const state = new State();
                state.rA = Word.fromNumber(0);
                state.rX = Word.fromNumber(17);
                state.setmem(1000, Word.fromNumber(3));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 4);
                expect(instr.toText()).toStrictEqual("DIV  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(Word.fromNumber(5));
                expect(state.rX).toStrictEqual(Word.fromNumber(2));
            });

            test("DIV  1000 (minus)", () => {
                const state = new State();
                state.rA = new Word(Minus, 0, 0, 0, 0, 0);
                state.rX = new Word(Plus, 1235 >> 6, 1235 % 64, 0, 3, 1);
                state.setmem(1000, new Word(Minus, 0, 0, 0, 2, 0));
                const instr = new Instruction(Index.fromNumber(1000), 0, 5, 4);
                expect(instr.toText()).toStrictEqual("DIV  1000");

                state.exec(instr);

                expect(state.rA).toStrictEqual(new Word(Plus, 0, 617 >> 6, 617 % 64, 32, 1));
                expect(state.rX).toStrictEqual(new Word(Minus, 0, 0, 0, 1, 1));
            });
        });

        test.todo("Address Transfer");
        test.todo("Comparison");
        test.todo("Jump");

        test("Shift", () => {
            const state = new State();
            state.rA = new Word(Plus, 1, 2, 3, 4, 5);
            state.rX = new Word(Minus, 6, 7, 8, 9, 10);

            state.exec(new Instruction(Index.fromNumber(1), 0, 3, 6));
            expect(state.rA).toStrictEqual(new Word(Plus, 0, 1, 2, 3, 4));
            expect(state.rX).toStrictEqual(new Word(Minus, 5, 6, 7, 8, 9));
            state.exec(new Instruction(Index.fromNumber(2), 0, 0, 6));
            expect(state.rA).toStrictEqual(new Word(Plus, 2, 3, 4, 0, 0));
            expect(state.rX).toStrictEqual(new Word(Minus, 5, 6, 7, 8, 9));
            state.exec(new Instruction(Index.fromNumber(4), 0, 5, 6));
            expect(state.rA).toStrictEqual(new Word(Plus, 6, 7, 8, 9, 2));
            expect(state.rX).toStrictEqual(new Word(Minus, 3, 4, 0, 0, 5));
            state.exec(new Instruction(Index.fromNumber(2), 0, 1, 6));
            expect(state.rA).toStrictEqual(new Word(Plus, 0, 0, 6, 7, 8));
            expect(state.rX).toStrictEqual(new Word(Minus, 3, 4, 0, 0, 5));
            state.exec(new Instruction(Index.fromNumber(501), 0, 4, 6));
            expect(state.rA).toStrictEqual(new Word(Plus, 0, 6, 7, 8, 3));
            expect(state.rX).toStrictEqual(new Word(Minus, 4, 0, 0, 5, 0));
        });

        describe("Move", () => {
            test("nonoverlapping", () => {
                const state = new State();
                for (let i = 0; i < 10; i++) {
                    state.setmem(1000+i, Word.fromNumber(i+1));
                }
                state.rI1 = Index.fromNumber(999);

                state.exec(new Instruction(Index.fromNumber(1000), 0, 5, 7));

                expect(state.contents.slice(999, 1004).map(w => w.toNumber()))
                    .toStrictEqual([1, 2, 3, 4, 5]);
            });

            test("overlapping", () => {
                const state = new State();
                for (let i = 0; i < 10; i++) {
                    state.setmem(1000+i, Word.fromNumber(i+1));
                }
                state.rI1 = Index.fromNumber(1001);

                state.exec(new Instruction(Index.fromNumber(1000), 0, 5, 7));

                expect(state.contents.slice(1001, 1006).map(w => w.toNumber()))
                    .toStrictEqual([1, 1, 1, 1, 1]);
            });
        });

        test.todo("I/O");
        test("NUM & CHAR", () => {
            const state = new State();
            state.rA = new Word(Minus, 0, 0, 31, 32, 39);
            state.rX = new Word(Plus, 37, 57, 47, 30, 30);

            state.exec(new Instruction(Index.fromNumber(0), 0, 0, 5)); // NUM 0
            expect(state.rA).toStrictEqual(Word.fromNumber(-12977700));
            expect(state.rX).toStrictEqual(new Word(Plus, 37, 57, 47, 30, 30));
            state.exec(new Instruction(Index.fromNumber(1), 0, 0, 48)); // INCA 1
            expect(state.rA).toStrictEqual(Word.fromNumber(-12977699));
            expect(state.rX).toStrictEqual(new Word(Plus, 37, 57, 47, 30, 30));
            state.exec(new Instruction(Index.fromNumber(0), 0, 1, 5)); // CHAR 0
            expect(state.rA).toStrictEqual(new Word(Minus, 30, 30, 31, 32, 39));
            expect(state.rX).toStrictEqual(new Word(Plus, 37, 37, 36, 39, 39));
        });
    });
});

describe("utils", () => {
    test("padLeft", () => {
        expect(padLeft([1, 2, 3], 5, 0)).toStrictEqual([0, 0, 1, 2, 3]);
    });
    test("padRight", () => {
        expect(padRight([1, 2, 3], 5, 0)).toStrictEqual([1, 2, 3, 0, 0]);
    });

    test("leftRot", () => {
        expect(leftRot([1,2,3,4,5], 3)).toStrictEqual([4,5,1,2,3]);
    });
    test("rightRot", () => {
        expect(rightRot([1,2,3,4,5], 3)).toStrictEqual([3,4,5,1,2]);
    });
});