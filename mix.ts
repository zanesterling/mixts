/**  Numbers and Math  **/

// A Byte may contain any value from 0 to 63.
// It might also be allowed to represent values from 64 to 99. (?)
export type Byte = number;
export type Sign = number & {readonly Sign: unique symbol};
export const Plus: Sign = 1 as Sign;
export const Minus: Sign = -1 as Sign;
export type Word = [Sign, Byte, Byte, Byte, Byte, Byte];
export const ZeroWord: Word = [Plus, 0 as Byte, 0 as Byte, 0 as Byte, 0 as Byte, 0 as Byte];
export type Index = [Sign, Byte, Byte];
export const ZeroIndex: Index = [Plus, 0 as Byte, 0 as Byte];

function indexToWord(x: Index): Word {
    return [x[0], 0 as Byte, 0 as Byte, 0 as Byte, x[1], x[2]];
}

function indexToString(index: Index): string {
    const [sign, upper, lower] = index;
    const val = sign * (upper * 64 + lower);
    return "" + val;
}

function add(a: Index, b: Index): Word {
    throw NotImplementedError("add");
}


/** Machine State **/

class State {
    rA: Word;
    rX: Word;
    rIs: [Index, Index, Index, Index, Index, Index];
    get rI1(): Index { return this.rIs[0]};
    get rI2(): Index { return this.rIs[1]; };
    get rI3(): Index { return this.rIs[2]; };
    get rI4(): Index { return this.rIs[3]; };
    get rI5(): Index { return this.rIs[4]; };
    get rI6(): Index { return this.rIs[5]; };
    set rI1(val: Index ) { this.rIs[0] = val; };
    set rI2(val: Index ) { this.rIs[1] = val; };
    set rI3(val: Index ) { this.rIs[2] = val; };
    set rI4(val: Index ) { this.rIs[3] = val; };
    set rI5(val: Index ) { this.rIs[4] = val; };
    set rI6(val: Index ) { this.rIs[5] = val; };
    rJ: [Byte, Byte]; // Behaves as if its sign was always +.

    memory: Array<Word>;

    constructor() {
        this.rA = Array.from(ZeroWord) as Word;
        this.rX = Array.from(ZeroWord) as Word;
        this.rIs = [ZeroIndex, ZeroIndex, ZeroIndex, ZeroIndex, ZeroIndex, ZeroIndex];
        this.rJ = [0 as Byte, 0 as Byte];
        this.memory = new Array(4000);
        for (const i in this.memory) {
            this.memory[i] = Array.from(ZeroWord) as Word;
        }
    }
}

/** Instructions **/

class OpCode {
    readonly opCode: number;
    readonly symbName: string;
    readonly normalF: Byte;
    readonly showArg: boolean;

    constructor(opCode: number, symbName: string, normalF: Byte, showArg: boolean = true) {
        this.opCode = opCode;
        this.symbName = symbName;
        this.normalF = normalF;
        this.showArg = showArg;
    }
}


export class Instruction {
    readonly AA: Index;
    readonly I: Byte;
    readonly F: Byte;
    readonly C: Byte;

    constructor(bAS: Sign, bA1: Byte, bA2: Byte, bI: Byte, bF: Byte, bC: Byte) {
        this.AA = [bAS, bA1, bA2];
        this.I = bI;
        this.F = bF;
        this.C = bC;
    }

    address(state: State): Word {
        if (this.I === 0) return indexToWord(this.AA);
        return add(this.AA, state.rIs[this.I - 1]);
    }

    toText(): string {
        if (this.C < 0 || this.C > 63) {
            throw Error(`bad byte: instr.C: ${this.C}`);
        }
        const opCode = Instruction.opCode(this.C, this.F);
        const symbName = opCode.symbName;
        const index = this.I === 0 ? "" : "," + this.I;
        let AA = opCode.showArg ? indexToString(this.AA) : "";
        let fieldSpec = "";
        if (this.F !== opCode.normalF) {
            // TODO: Special-case the I/O instructions.
            fieldSpec = `(${this.F >> 3}:${this.F % 8})`;
        }
        const suffix = `${AA}${index}${fieldSpec}`;
        if (suffix === "") return symbName;
        return `${symbName}  ${suffix}`
    }

    static fromText(str: string): Instruction {
        throw NotImplementedError("toText");
    }

    static fromWord(word: Word): Instruction {
        return new Instruction(...word);
    }

    static opCodes: Array<OpCode | ((F: Byte) => OpCode)> = [
        new OpCode(0, "NOP", 0, false),
        (F: Byte) => F === 6 ? new OpCode(1, "FADD", 6)
                             : new OpCode(1, "ADD", 5),
        (F: Byte) => F === 6 ? new OpCode(2, "FSUB", 6)
                             : new OpCode(2, "SUB", 5),
        (F: Byte) => F === 6 ? new OpCode(3, "FMUL", 6)
                             : new OpCode(3, "MUL", 5),
        (F: Byte) => F === 6 ? new OpCode(4, "FDIV", 6)
                             : new OpCode(4, "DIV", 5),
        Cases(5, new Map([
            [0, new OpCode(5, "NUM", 0)],
            [1, new OpCode(5, "CHAR", 1)],
            [2, new OpCode(5, "HLT", 2)],
        ])),
        Cases(6, new Map([
            [0, new OpCode(6, "SLA", 0)],
            [1, new OpCode(6, "SRA", 1)],
            [2, new OpCode(6, "SLAX", 2)],
            [3, new OpCode(6, "SRAX", 3)],
            [4, new OpCode(6, "SLC", 4)],
            [5, new OpCode(6, "SRC", 5)],
        ])),
        Cases(7, new Map([[1, new OpCode(7, "MOVE", 1)]])),
        new OpCode(8,  "LDA", 5),
        new OpCode(9,  "LD1", 5),
        new OpCode(10, "LD2", 5),
        new OpCode(11, "LD3", 5),
        new OpCode(12, "LD4", 5),
        new OpCode(13, "LD5", 5),
        new OpCode(14, "LD6", 5),
        new OpCode(15, "LDX", 5),
        new OpCode(16, "LDAN", 5),
        new OpCode(17, "LD1N", 5),
        new OpCode(18, "LD2N", 5),
        new OpCode(19, "LD3N", 5),
        new OpCode(20, "LD4N", 5),
        new OpCode(21, "LD5N", 5),
        new OpCode(22, "LD6N", 5),
        new OpCode(23, "LDXN", 5),
        new OpCode(24, "STA", 5),
        new OpCode(25, "ST1", 5),
        new OpCode(26, "ST2", 5),
        new OpCode(27, "ST3", 5),
        new OpCode(28, "ST4", 5),
        new OpCode(29, "ST5", 5),
        new OpCode(30, "ST6", 5),
        new OpCode(31, "STX", 5),
        new OpCode(32, "STJ", 2),
        new OpCode(33, "STZ", 5),
        Cases(34, new Map([[0, new OpCode(34, "JBUS", 0)]])),
        Cases(35, new Map([[0, new OpCode(35, "IOC", 0)]])),
        Cases(36, new Map([[0, new OpCode(36, "IN", 0)]])),
        Cases(37, new Map([[0, new OpCode(37, "OUT", 0)]])),
        Cases(38, new Map([[0, new OpCode(38, "JRED", 0)]])),
        Cases(39, new Map([
            [0, new OpCode(39, "JMP", 0)],
            [1, new OpCode(39, "JSJ", 1)],
            [2, new OpCode(39, "JOV", 2)],
            [3, new OpCode(39, "JNOV", 3)],
            [4, new OpCode(39, "JL", 4)],
            [5, new OpCode(39, "JE", 5)],
            [6, new OpCode(39, "JG", 6)],
            [7, new OpCode(39, "JGE", 7)],
            [8, new OpCode(39, "JNE", 8)],
            [9, new OpCode(39, "JLE", 9)],
        ])),
        JReg(40, "JA"),
        JReg(41, "J1"),
        JReg(42, "J2"),
        JReg(43, "J3"),
        JReg(44, "J4"),
        JReg(45, "J5"),
        JReg(46, "J6"),
        JReg(47, "JX"),
        IncReg(48, "A"),
        IncReg(49, "1"),
        IncReg(50, "2"),
        IncReg(51, "3"),
        IncReg(52, "4"),
        IncReg(53, "5"),
        IncReg(54, "6"),
        IncReg(55, "X"),
        (F: Byte) => F === 6 ? new OpCode(56, "FCMP", 6)
                             : new OpCode(56, "CMPA", 5),
        new OpCode(57, "CMP1", 5),
        new OpCode(58, "CMP2", 5),
        new OpCode(59, "CMP3", 5),
        new OpCode(60, "CMP4", 5),
        new OpCode(61, "CMP5", 5),
        new OpCode(62, "CMP6", 5),
        new OpCode(63, "CMPX", 5),
    ];
    static opCode(C: Byte, F: Byte) {
        const x = Instruction.opCodes[C];
        if (!x) throw new Error(`bad opcode: C=${C}, F=${F}`)
        if (x instanceof OpCode) return x;
        return x(F);
    }
}

function Cases(opCode: number, codes: Map<number, OpCode>): ((F: Byte) => OpCode) {
    return (F: Byte) => {
        if (codes.has(F)) return codes.get(F)!;
        throw new Error(`bad opcode: C=${opCode}, F=${F}`);
    };
}
function JReg(opCode: number, symb: string) {
    return Cases(opCode, new Map([
        [0, new OpCode(opCode, `${symb}N`, 0)],
        [1, new OpCode(opCode, `${symb}Z`, 1)],
        [2, new OpCode(opCode, `${symb}P`, 2)],
        [3, new OpCode(opCode, `${symb}NN`, 3)],
        [4, new OpCode(opCode, `${symb}NZ`, 4)],
        [5, new OpCode(opCode, `${symb}NP`, 5)],
    ]));
}
function IncReg(opCode: number, reg: string) {
    return Cases(opCode, new Map([
        [0, new OpCode(opCode, `INC${reg}`, 0)],
        [1, new OpCode(opCode, `DEC${reg}`, 1)],
        [2, new OpCode(opCode, `ENT${reg}`, 2)],
        [3, new OpCode(opCode, `ENN${reg}`, 3)],
    ]))
}


const characterCode = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,()+-*/=$<>@;:'";

/** Util **/

function NotImplementedError(funcName: string) {
    return new Error(`Function ${funcName} not implemented.`);
}

console.log("Hello via Bun!");