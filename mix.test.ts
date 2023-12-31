import { describe, expect, test, beforeAll, beforeEach } from "bun:test";

import {
    State, Instruction, Word, Index, Byte, Sign, Plus, Minus, Comparison,
    padLeft, padRight, leftRot, rightRot, programToRawCards, loadingProgram, CardReader,
} from "./mix";

beforeAll(() => {
    // setup tests
});

describe("mix", () => {
    describe("can render instructions to text", () => {
        test("LDA", () => {
            expect(new Instruction(Index.fromNumber(2000),  2, 3,  8).toText())
                .toBe("LDA  2000,2(0:3)");
            expect(new Instruction(Index.fromNumber(2000),  2, 11, 8).toText())
                .toBe("LDA  2000,2(1:3)");
            expect(new Instruction(Index.fromNumber(2000),  0, 11, 8).toText())
                .toBe("LDA  2000(1:3)");
            expect(new Instruction(Index.fromNumber(2000),  0, 5,  8).toText())
                .toBe("LDA  2000");
            expect(new Instruction(Index.fromNumber(-2000), 4, 5,  8).toText())
                .toBe("LDA  -2000,4");
        });

        test("NOP", () => {
            expect(new Instruction(new Index(Plus, 0, 0), 0, 0, 0).toText())
                .toBe("NOP");
        });
    });

    describe("instruction parsing", () => {
        describe("circular parsing", () => {
            for (const [symbName, opCode] of Instruction.opCodesByName()) {
                if (symbName === "NOP") continue;
                test(symbName, () => {
                    const s = `${symbName}  1000`;
                    expect(Instruction.fromText(`${symbName} 1000`).toText())
                        .toStrictEqual(s);
                });
            }
        });
    });

    describe("behavior", () => {
        describe("LD*", () => {
            const state = new State();
            state.contents[2000] = new Word(Minus, 1, 16, 3, 5, 4);

            const ldTest = (
                reg: ((s: State) => any),
                instr: string,
                out: any) => {
                test(instr, () => {
                    state.exec(Instruction.fromText(instr));
                    expect(reg(state)).toStrictEqual(out);
                });
            };

            const regs = [
                { op: "LDA", reg: (state: State) => state.rA },
                { op: "LDX", reg: (state: State) => state.rX },
            ];
            for (const {op, reg} of regs) {
                let testCases = [
                    { instr: `${op}  2000`, out: new Word(Minus, 1, 16, 3, 5, 4) },
                    { instr: `${op}  2000(4:4)`, out: new Word(Plus, 0, 0, 0, 0, 5) },
                    { instr: `${op}  2000(0:0)`, out: new Word(Minus, 0, 0, 0, 0, 0) },
                    { instr: `${op}  2000(1:1)`, out: new Word(Plus, 0, 0, 0, 0, 1) },
                    { instr: `${op}  2000(1:5)`, out: new Word(Plus, 1, 16, 3, 5, 4) },
                    { instr: `${op}  2000(3:5)`, out: new Word(Plus, 0, 0, 3, 5, 4) },
                    { instr: `${op}  2000(0:3)`, out: new Word(Minus, 0, 0, 1, 16, 3) },
                ];
                for (const {instr, out} of testCases) {
                    ldTest(reg, instr, out);
                }
            }

            for (const {op, reg} of [
                { op: "LD1", reg: (state: State) => state.rI1 },
                { op: "LD2", reg: (state: State) => state.rI2 },
                { op: "LD3", reg: (state: State) => state.rI3 },
                { op: "LD4", reg: (state: State) => state.rI4 },
                { op: "LD5", reg: (state: State) => state.rI5 },
                { op: "LD6", reg: (state: State) => state.rI6 },
            ]) {
                for (const {instr, out} of [
                    { instr: `${op}  2000(4:4)`, out: new Index(Plus, 0, 5) },
                    { instr: `${op}  2000(0:0)`, out: new Index(Minus, 0, 0) },
                    { instr: `${op}  2000(1:1)`, out: new Index(Plus, 0, 1) },
                ]) {
                    ldTest(reg, instr, out);
                }
            }
        });

        describe("LD*N", () => {
            const state = new State();
            state.contents[2000] = new Word(Minus, 1, 16, 3, 5, 4);

            const ldTest = (
                reg: ((s: State) => any),
                instr: string,
                out: any) => {
                test(instr, () => {
                    state.exec(Instruction.fromText(instr));
                    expect(reg(state)).toStrictEqual(out);
                });
            };

            const regs = [
                { op: "LDAN", reg: (state: State) => state.rA },
                { op: "LDXN", reg: (state: State) => state.rX },
            ];
            for (const {op, reg} of regs) {
                let testCases = [
                    { instr: `${op}  2000`,      out: new Word(Plus, 1, 16, 3, 5, 4) },
                    { instr: `${op}  2000(4:4)`, out: new Word(Minus, 0, 0, 0, 0, 5) },
                    { instr: `${op}  2000(0:0)`, out: new Word(Plus, 0, 0, 0, 0, 0) },
                    { instr: `${op}  2000(1:1)`, out: new Word(Minus, 0, 0, 0, 0, 1) },
                    { instr: `${op}  2000(1:5)`, out: new Word(Minus, 1, 16, 3, 5, 4) },
                    { instr: `${op}  2000(3:5)`, out: new Word(Minus, 0, 0, 3, 5, 4) },
                    { instr: `${op}  2000(0:3)`, out: new Word(Plus, 0, 0, 1, 16, 3) },
                ];
                for (const {instr, out} of testCases) {
                    ldTest(reg, instr, out);
                }
            }

            for (const {op, reg} of [
                { op: "LD1N", reg: (state: State) => state.rI1 },
                { op: "LD2N", reg: (state: State) => state.rI2 },
                { op: "LD3N", reg: (state: State) => state.rI3 },
                { op: "LD4N", reg: (state: State) => state.rI4 },
                { op: "LD5N", reg: (state: State) => state.rI5 },
                { op: "LD6N", reg: (state: State) => state.rI6 },
            ]) {
                for (const {instr, out} of [
                    { instr: `${op}  2000(4:4)`, out: new Index(Minus, 0, 5) },
                    { instr: `${op}  2000(0:0)`, out: new Index(Plus, 0, 0) },
                    { instr: `${op}  2000(1:1)`, out: new Index(Minus, 0, 1) },
                ]) {
                    ldTest(reg, instr, out);
                }
            }
        });

        describe("ST*", () => {
            const state = new State();
            state.rA = new Word(Plus, 6, 7, 8, 9, 0);
            state.rX = new Word(Plus, 6, 7, 8, 9, 0);
            state.rI1 = new Index(Plus, 6, 7);
            state.rI2 = new Index(Plus, 6, 7);
            state.rI3 = new Index(Plus, 6, 7);
            state.rI4 = new Index(Plus, 6, 7);
            state.rI5 = new Index(Plus, 6, 7);
            state.rI6 = new Index(Plus, 6, 7);

            const stTest = (instr: string, out: Word) => {
                test(instr, () => {
                    state.contents[2000] = new Word(Minus, 1, 2, 3, 4, 5);
                    state.exec(Instruction.fromText(instr));
                    expect(state.contents[2000]).toStrictEqual(out);
                });
            };

            for (const op of ["STA", "STX"]) {
                for (const {instr, out} of [
                    { instr: `${op}  2000`,      out: new Word(Plus, 6, 7, 8, 9, 0) },
                    { instr: `${op}  2000(1:5)`, out: new Word(Minus, 6, 7, 8, 9, 0) },
                    { instr: `${op}  2000(5:5)`, out: new Word(Minus, 1, 2, 3, 4, 0) },
                    { instr: `${op}  2000(2:2)`, out: new Word(Minus, 1, 0, 3, 4, 5) },
                    { instr: `${op}  2000(2:3)`, out: new Word(Minus, 1, 9, 0, 4, 5) },
                    { instr: `${op}  2000(0:1)`, out: new Word(Plus, 0, 2, 3, 4, 5) },
                ]) {
                    stTest(instr, out);
                }
            }

            for (const op of ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"]) {
                for (const {instr, out} of [
                    { instr: `${op}  2000`,      out: new Word(Plus, 0, 0, 0, 6, 7) },
                    { instr: `${op}  2000(1:5)`, out: new Word(Minus, 0, 0, 0, 6, 7) },
                    { instr: `${op}  2000(5:5)`, out: new Word(Minus, 1, 2, 3, 4, 7) },
                    { instr: `${op}  2000(2:2)`, out: new Word(Minus, 1, 7, 3, 4, 5) },
                    { instr: `${op}  2000(2:3)`, out: new Word(Minus, 1, 6, 7, 4, 5) },
                    { instr: `${op}  2000(0:1)`, out: new Word(Plus, 7, 2, 3, 4, 5) },
                ]) {
                    stTest(instr, out);
                }
            }
            for (const {instr, out} of [
                { instr: `STZ  2000`,      out: new Word(Plus, 0, 0, 0, 0, 0) },
                { instr: `STZ  2000(1:5)`, out: new Word(Minus, 0, 0, 0, 0, 0) },
                { instr: `STZ  2000(5:5)`, out: new Word(Minus, 1, 2, 3, 4, 0) },
                { instr: `STZ  2000(2:2)`, out: new Word(Minus, 1, 0, 3, 4, 5) },
                { instr: `STZ  2000(2:3)`, out: new Word(Minus, 1, 0, 0, 4, 5) },
                { instr: `STZ  2000(0:1)`, out: new Word(Plus, 0, 2, 3, 4, 5) },
            ]) {
                stTest(instr, out);
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

        describe("ENT*, ENN*, INC*, DEC*", () => {
            const state = new State();
            const testWord = new Word(Minus, 1, 2, 3, 4, 5);
            // ENT*, ENN*, INC*, DEC*
            for (const {testName, name, reg} of [
                { testName: "A",  name: "A", reg: (state: State) => state.rA},
                { testName: "X",  name: "X", reg: (state: State) => state.rX},
                { testName: "I1", name: "1", reg: (state: State) => state.rI1},
                { testName: "I2", name: "2", reg: (state: State) => state.rI2},
                { testName: "I3", name: "3", reg: (state: State) => state.rI3},
                { testName: "I4", name: "4", reg: (state: State) => state.rI4},
                { testName: "I5", name: "5", reg: (state: State) => state.rI5},
                { testName: "I6", name: "6", reg: (state: State) => state.rI6},
            ]) {
                test(testName, () => {
                    state.exec(Instruction.fromText(`ENT${name} 3000`));
                    expect(reg(state).toNumber()).toStrictEqual(3000);
                    state.exec(Instruction.fromText(`INC${name} 5`));
                    expect(reg(state).toNumber()).toStrictEqual(3005);
                    state.exec(Instruction.fromText(`DEC${name} 5`));
                    expect(reg(state).toNumber()).toStrictEqual(3000);
                    state.exec(Instruction.fromText(`ENN${name} 3000`));
                    expect(reg(state).toNumber()).toStrictEqual(-3000);
                });
            }
        });

        describe("CMP*", () => {
            const state = new State();
            state.contents[2000] = Word.fromNumber(-1);
            state.contents[2001] = Word.fromNumber(0);
            state.contents[2002] = Word.fromNumber(1);
            state.rA = new Word(Plus, 0, 0, 0, 2, 0);
            state.rX = new Word(Plus, 0, 0, 0, 2, 0);
            state.rI1 = new Index(Plus, 2, 0);
            state.rI2 = new Index(Plus, 2, 0);
            state.rI3 = new Index(Plus, 2, 0);
            state.rI4 = new Index(Plus, 2, 0);
            state.rI5 = new Index(Plus, 2, 0);
            state.rI6 = new Index(Plus, 2, 0);

            for (const reg of ["A", "X", "1", "2", "3", "4", "5", "6"]) {
                for (const {instr, out} of [
                    { instr: `CMP${reg} 2002`,      out: "GREATER" as Comparison },
                    { instr: `CMP${reg} 2000(5:5)`, out: "LESS"    as Comparison },
                    { instr: `CMP${reg} 2001(5:5)`, out: "EQUAL"   as Comparison },
                    { instr: `CMP${reg} 2002(5:5)`, out: "LESS"    as Comparison },
                ]) {
                    test(instr, () => {
                        state.exec(Instruction.fromText(instr));
                        expect(state.comparison).toStrictEqual(out);
                    });
                }
            }
        });

        describe("Jump", () => {
            let state: State;
            beforeEach(() => {
                state = new State();
                state.IP = 2000;
            });

            test("JMP", () => {
                state.exec(Instruction.fromText("JMP 3000"));
                expect(state.IP).toStrictEqual(3000);
                expect(state.rJ.toNumber()).toStrictEqual(2001);
            });

            test("JSJ", () => {
                state.exec(Instruction.fromText("JSJ 3000"));
                expect(state.IP).toStrictEqual(3000);
                expect(state.rJ.toNumber()).toStrictEqual(0);
            });

            test("JOV", () => {
                state.overflow = false;
                state.exec(Instruction.fromText("JOV 3000"));
                expect(state.IP).toStrictEqual(2001);
                expect(state.rJ.toNumber()).toStrictEqual(0);
                expect(state.overflow).toStrictEqual(false);

                state.overflow = true;
                state.exec(Instruction.fromText("JOV 3000"));
                expect(state.IP).toStrictEqual(3000);
                expect(state.rJ.toNumber()).toStrictEqual(2002);
                expect(state.overflow).toStrictEqual(false);
            });

            test("JNOV", () => {
                state.overflow = true;
                state.exec(Instruction.fromText("JNOV 3000"));
                expect(state.IP).toStrictEqual(2001);
                expect(state.rJ.toNumber()).toStrictEqual(0);
                expect(state.overflow).toStrictEqual(false);

                state.overflow = false;
                state.exec(Instruction.fromText("JNOV 3000"));
                expect(state.IP).toStrictEqual(3000);
                expect(state.rJ.toNumber()).toStrictEqual(2002);
                expect(state.overflow).toStrictEqual(false);
            });
        
            const comps: Comparison[] = ["LESS", "EQUAL", "GREATER"];
            for (const {op, oks} of [
                {op: "JL", oks: ["LESS"]},
                {op: "JE", oks: ["EQUAL"]},
                {op: "JG", oks: ["GREATER"]},
                {op: "JGE", oks: ["GREATER", "EQUAL"]},
                {op: "JNE", oks: ["LESS", "GREATER"]},
                {op: "JLE", oks: ["LESS", "EQUAL"]},
            ]) {
                test(op, () => {
                    for (const cmp of comps) {
                        state.comparison = cmp;
                        state.exec(Instruction.fromText(`${op} 2000`));
                        if (oks.includes(cmp)) expect(state.IP).toStrictEqual(2000);
                        else expect(state.IP).not.toStrictEqual(2000);
                    }
                });
            }

            const testVals = [-1, 0, 1];
            for (const {reg, setReg} of [
                {reg: "A", setReg: (x: number) => state.rA = Word.fromNumber(x) },
                {reg: "X", setReg: (x: number) => state.rX = Word.fromNumber(x) },
                {reg: "1", setReg: (x: number) => state.rI1 = Index.fromNumber(x) },
                {reg: "2", setReg: (x: number) => state.rI2 = Index.fromNumber(x) },
                {reg: "3", setReg: (x: number) => state.rI3 = Index.fromNumber(x) },
                {reg: "4", setReg: (x: number) => state.rI4 = Index.fromNumber(x) },
                {reg: "5", setReg: (x: number) => state.rI5 = Index.fromNumber(x) },
                {reg: "6", setReg: (x: number) => state.rI6 = Index.fromNumber(x) },
            ]) {
                for (const {instr, oks} of [
                    {instr: `J${reg}N 2000`, oks: [-1]},
                    {instr: `J${reg}Z 2000`, oks: [0]},
                    {instr: `J${reg}P 2000`, oks: [1]},
                    {instr: `J${reg}NN 2000`, oks: [0, 1]},
                    {instr: `J${reg}NZ 2000`, oks: [-1, 1]},
                    {instr: `J${reg}NP 2000`, oks: [-1, 0]},
                ]) {
                    for (const val of testVals) {
                        test(`${instr} [${reg}=${val}]`, () => {
                            state.IP = 0;
                            setReg(val);
                            state.exec(Instruction.fromText(instr));
                            if (oks.includes(val)) expect(state.IP).toStrictEqual(2000);
                            else expect(state.IP).not.toStrictEqual(2000);
                        });
                    }
                }
            }
        });

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

describe("1.3.1", () => {
    test("Problem 16", () => {
        // (a) Shortest possible.
        let state = new State();
        for (let i = 0; i < 101; i++) state.setmem(i, Word.fromNumber(1));
        state.exec(Instruction.fromText("STZ 0000"));
        state.exec(Instruction.fromText("ENT1 0001"));
        state.exec(Instruction.fromText("MOVE 0000(7:7)"));
        state.exec(Instruction.fromText("MOVE 0063(4:4)"));
        expect(state.contents.slice(0, 100).every(w => w.toNumber() === 0))
            .toBeTrue();
        expect(state.getmem(100)).toStrictEqual(Word.fromNumber(1));
        expect(state.clock).toStrictEqual(204n);

        // (b) Fastest possible.
        state = new State();
        for (let i = 0; i < 101; i++) state.setmem(i, Word.fromNumber(1));
        for (let i = 0; i < 100; i++) {
            state.exec(Instruction.fromText(`STZ ${i}`));
        }
        expect(state.contents.slice(0, 100).every(w => w.toNumber() === 0))
            .toBeTrue();
        expect(state.getmem(100)).toStrictEqual(Word.fromNumber(1));
        expect(state.clock).toStrictEqual(200n);
    });
});

describe("loading test", () => {
    test("loading routine fits on two cards", () => {
        const cards = programToRawCards(loadingProgram.split('\n'));
        expect(cards.length).toBeLessThanOrEqual(2);
    });

    test("can load from card reader", () => {
        const state = new State();
        const cardReader = state.getDevice(16) as CardReader;
        for (const card of programToRawCards(loadingProgram.split('\n'))) {
            cardReader.cards.push(card);
        }
        state.go();
        expect(state.halt).toBeTrue();
        expect(state.IP).toStrictEqual(16);
    });
});