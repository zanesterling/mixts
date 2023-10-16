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
        const opCode = "LDA";
        const index = this.I === 0 ? "" : "," + this.I;
        let fieldSpec = "";
        if (this.F !== 5) { // TODO: Actually check if F is normal.
            // TODO: Special-case the I/O instructions.
            const left = this.F >> 3
            const right = this.F % 8;
            fieldSpec = `(${left}:${right})`;
        }
        return `${opCode}  ${indexToString(this.AA)}${index}${fieldSpec}`
    }

    static fromText(str: string): Instruction {
        throw NotImplementedError("toText");
    }

    static fromWord(word: Word): Instruction {
        return new Instruction(...word);
    }

    static opCodes = [];
}

/** Util **/

function NotImplementedError(funcName: string) {
    return new Error(`Function ${funcName} not implemented.`);
}

console.log("Hello via Bun!");