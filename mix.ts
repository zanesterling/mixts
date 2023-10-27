/**  Numbers and Math  **/

// A Byte may contain any value from 0 to 63.
// It might also be allowed to represent values from 64 to 99. (?)
export type Byte = number;
export type Sign = number & {readonly Sign: unique symbol};
export const Plus: Sign = 1 as Sign;
export const Minus: Sign = -1 as Sign;
function signof(x: bigint): Sign { return x < 0 ? Minus : Plus; }
export type Comparison = "LESS" | "EQUAL" | "GREATER";
function compare(a: number, b: number): Comparison {
    return a < b ? "LESS" : a === b ? "EQUAL" : "GREATER";
}

export const CLOCK_US: number = 8; // One clock cycle is 8 microseconds.

export class Word {
    static MAX = (1 << 30) - 1;

    constructor(
        readonly sign: Sign,
        readonly b1: Byte,
        readonly b2: Byte,
        readonly b3: Byte,
        readonly b4: Byte,
        readonly b5: Byte,
    ) {}

    static fromIndex(x: Index): Word {
        return new Word(x.sign, 0, 0, 0, x.b1, x.b2);
    }

    static fromNumber(x: number): Word {
        const sign = x >= 0 ? Plus : Minus;
        x = Math.abs(x);
        return new Word(
            sign,
            (x >> 24) % 64,
            (x >> 18) % 64,
            (x >> 12) % 64,
            (x >>  6) % 64,
             x        % 64,
        );
    }

    static fromSignNumber(sign: Sign, x: number): Word {
        x = Math.abs(x);
        return new Word(
            sign,
            (x >> 24) % 64,
            (x >> 18) % 64,
            (x >> 12) % 64,
            (x >>  6) % 64,
             x        % 64,
        );
    }

    static Zero: Word = new Word(Plus, 0, 0, 0, 0, 0);

    toNumber(): number {
        return this.sign * (
            (this.b1 << 24) |
            (this.b2 << 18) |
            (this.b3 << 12) |
            (this.b4 << 6)  |
             this.b5
        );
    }

    toIndex(): Index {
        if (this.b1 !== 0 || this.b2 !== 0 || this.b3 !== 0) {
            throw new Error("tried to convert non-zero Word to Index");
        }
        return new Index(this.sign, this.b4, this.b5);
    }

    negate(): Word {
        return new Word((this.sign * -1) as Sign, this.b1, this.b2, this.b3, this.b4, this.b5);
    }

    bytes(): Byte[] {
        return [this.b1, this.b2, this.b3, this.b4, this.b5];
    }
}

export class Index {
    constructor(
        readonly sign: Sign,
        readonly b1: Byte,
        readonly b2: Byte,
    ) {}

    static MAX: number = 64 * 64 - 1;

    static fromNumber(x: number): Index {
        const sign = x >= 0 ? Plus : Minus;
        const xAbs = Math.abs(x);
        if (xAbs > Index.MAX) throw new Error(`too big for index: ${x}`)
        return new Index(
            sign,
            (xAbs >> 6) % 64,
             xAbs       % 64,
        );
    }

    static Zero: Index = new Index(Plus, 0, 0);

    toNumber(): number {
        return this.sign * ((this.b1 << 6) | this.b2);
    }

    toString(): string { return `${this.toNumber()}`; }

    toWord(): Word { return new Word(this.sign, 0, 0, 0, this.b1, this.b2); }
}

function ldApplyField(F: Byte, word: Word): Word {
    let L = F >> 3;
    const R = F % 8;
    let sign = Plus;
    if (L === 0) {
        L = 1;
        sign = word.sign;
    }
    const [b5, b4, b3, b2, b1] = [word.b1, word.b2, word.b3, word.b4, word.b5]
        .slice(L-1, R)
        // Reverse and assign into b5..b1 so so that shorter slices shift
        // towards lower values.
        .reverse();
    return new Word(sign ?? Plus, b1 ?? 0, b2 ?? 0, b3 ?? 0, b4 ?? 0, b5 ?? 0);
}


/** Machine State **/

export class State {
    rA: Word = Word.Zero;
    rX: Word = Word.Zero;
    rIs: [Index, Index, Index, Index, Index, Index];
    get rI1(): Index { return this.rIs[0]};
    get rI2(): Index { return this.rIs[1]; };
    get rI3(): Index { return this.rIs[2]; };
    get rI4(): Index { return this.rIs[3]; };
    get rI5(): Index { return this.rIs[4]; };
    get rI6(): Index { return this.rIs[5]; };
    set rI1(val: Index) { this.rIs[0] = val; };
    set rI2(val: Index) { this.rIs[1] = val; };
    set rI3(val: Index) { this.rIs[2] = val; };
    set rI4(val: Index) { this.rIs[3] = val; };
    set rI5(val: Index) { this.rIs[4] = val; };
    set rI6(val: Index) { this.rIs[5] = val; };
    _rJ: Index = Index.Zero; // Behaves as if its sign was always +.
    get rJ(): Index { return new Index(this._rJ.sign, this._rJ.b1, this._rJ.b2); }
    set rJ(val: Index) { this._rJ = val; }
    overflow: boolean = false;
    comparison: Comparison = "EQUAL";
    IP: number = 0;
    jumped: boolean = false;
    contents: Array<Word>;

    clock: bigint = 0n;
    halt: boolean = false;
    memfault: boolean = false;
    ios: InputOutput[];

    getDevice(unitNumber: number) {
        if (unitNumber < 1 || unitNumber > 20) {
            throw new Error(`no such IO unit: ${unitNumber}`);
        }
        return this.ios[unitNumber-1];
    }

    constructor() {
        this.rIs = [Index.Zero, Index.Zero, Index.Zero, Index.Zero, Index.Zero, Index.Zero];
        this.contents = new Array(4000);
        for (let i = 0; i < this.contents.length; i++) {
            this.contents[i] = Word.Zero;
        }
        this.ios = new Array(20);
        this.ios[15] = new CardReader();
    }

    exec(instr: Instruction) {
        this.jumped = false;
        const M = this.fetchIndex(instr.I).toNumber() + instr.AA.toNumber();
        switch (instr.C) {
            case 0: // NOP
                break;


            /* Arithmetic instructions */
            case 1: // ADD
                if (instr.F == 6) throw NotImplementedError("FADD");
                this.rA = this.add(this.load(M, instr.F).toNumber(), this.rA);
                break;
            case 2: // SUB
                if (instr.F == 6) throw NotImplementedError("FSUB");
                this.rA = this.add(-this.load(M, instr.F).toNumber(), this.rA);
                break;
            case 3: { // MUL
                if (instr.F == 6) throw NotImplementedError("FMUL");
                const val = BigInt(this.rA.toNumber()) *
                    BigInt(this.load(M, instr.F).toNumber());
                const sign = signof(val);
                const valA = BigInt.asIntN(30, abs(val) >> 30n);
                const valX = BigInt.asIntN(30, abs(val) % BigInt(1 << 30));
                this.rA = Word.fromSignNumber(sign, Number(valA));
                this.rX = Word.fromSignNumber(sign, Number(valX));
                break;
            }
            case 4: { // DIV
                if (instr.F == 6) throw NotImplementedError("FDIV");
                if (this.load(M, instr.F).toNumber() === 0) {
                    this.overflow = true;
                    break;
                }
                const presign = this.rA.sign;
                const rAX = (BigInt(this.rA.toNumber()) << 30n) +
                            BigInt(presign * Math.abs(this.rX.toNumber()));
                const vn = BigInt(this.load(M, instr.F).toNumber());
                const [quot, rem] = [rAX / vn, rAX % vn];
                this.rA = Word.fromNumber(Number(quot));
                this.rX = Word.fromSignNumber(presign, Number(rem));
                break;
            }


            case 5: // NUM, CHAR, HLT
                if (instr.F === 0) { // NUM
                    const bytes = this.rA.bytes().concat(this.rX.bytes());
                    let val = 0;
                    for (let i = 0; i < bytes.length; i++) {
                        val = val*10 + bytes[i] % 10;
                    }
                    if (val > Word.MAX) {
                        val = val % (Word.MAX+1);
                        this.overflow = true;
                    }
                    this.rA = Word.fromSignNumber(this.rA.sign, val);
                } else if (instr.F === 1) { // CHAR
                    const bs: number[] = new Array(10);
                    let val = Math.abs(this.rA.toNumber());
                    for (let i = 0; i < 10; i++) {
                        bs[10-i-1] = 30 + val % 10;
                        val = Math.floor(val / 10);
                    }
                    this.rA = new Word(this.rA.sign, bs[0], bs[1], bs[2], bs[3], bs[4]);
                    this.rX = new Word(this.rX.sign, bs[5], bs[6], bs[7], bs[8], bs[9]);
                } else if (instr.F === 2) { // HLT
                    this.halt = true;
                }
                break;

            
            case 6: // SLA, SRA, SLAX, SRAX, SLC, SRC
                if (instr.F === 0) { // SLA
                    const bytes = this.rA.bytes().slice(M, 5);
                    const [b1, b2, b3, b4, b5] = padRight(bytes, 5, 0);
                    this.rA = new Word(this.rA.sign, b1, b2, b3, b4, b5);
                } else if (instr.F === 1) { // SRA
                    const bytes = this.rA.bytes().slice(0, 5-M);
                    const [b1, b2, b3, b4, b5] = padLeft(bytes, 5, 0);
                    this.rA = new Word(this.rA.sign, b1, b2, b3, b4, b5);
                } else if (instr.F === 2) { // SLAX
                    const bytes = [...this.rA.bytes(), ...this.rX.bytes()]
                        .slice(M, 10);
                    const [a1, a2, a3, a4, a5, x1, x2, x3, x4, x5] =
                        padRight(bytes, 10, 0);
                    this.rA = new Word(this.rA.sign, a1, a2, a3, a4, a5);
                    this.rX = new Word(this.rX.sign, x1, x2, x3, x4, x5);
                } else if (instr.F === 3) { // SRAX
                    const bytes = [...this.rA.bytes(), ...this.rX.bytes()]
                        .slice(0, 10-M);
                    const [a1, a2, a3, a4, a5, x1, x2, x3, x4, x5] =
                        padLeft(bytes, 10, 0);
                    this.rA = new Word(this.rA.sign, a1, a2, a3, a4, a5);
                    this.rX = new Word(this.rX.sign, x1, x2, x3, x4, x5);
                } else if (instr.F === 4) { // SLC
                    const bytes = [...this.rA.bytes(), ...this.rX.bytes()];
                    const [a1, a2, a3, a4, a5, x1, x2, x3, x4, x5] =
                        leftRot(bytes, M);
                    this.rA = new Word(this.rA.sign, a1, a2, a3, a4, a5);
                    this.rX = new Word(this.rX.sign, x1, x2, x3, x4, x5);
                } else if (instr.F === 5) { // SRC
                    const bytes = [...this.rA.bytes(), ...this.rX.bytes()];
                    const [a1, a2, a3, a4, a5, x1, x2, x3, x4, x5] =
                        rightRot(bytes, M);
                    this.rA = new Word(this.rA.sign, a1, a2, a3, a4, a5);
                    this.rX = new Word(this.rX.sign, x1, x2, x3, x4, x5);
                }
                break;


            case 7: // MOVE
                const rI1 = this.rI1.toNumber();
                for (let i = 0; i < instr.F; i++) {
                    this.setmem(rI1 + i, this.getmem(M + i));
                }
                this.rI1 = Index.fromNumber(rI1 + instr.F);
                break;


            /* Load instructions */
            case 8: // LDA
                this.rA = ldApplyField(instr.F, this.getmem(M));
                break;
            case 9:  // LD1
            case 10: // LD2
            case 11: // LD3
            case 12: // LD4
            case 13: // LD5
            case 14: // LD6
                this.rIs[instr.C - 9] = ldApplyField(instr.F, this.getmem(M)).toIndex();
                break;
            case 15: // LDX
                this.rX = ldApplyField(instr.F, this.getmem(M));
                break;

            case 16: // LDAN
                this.rA = ldApplyField(instr.F, this.getmem(M)).negate();
                break;
            case 17: // LD1N
            case 18: // LD2N
            case 19: // LD3N
            case 20: // LD4N
            case 21: // LD5N
            case 22: // LD6N
                this.rIs[instr.C - 17] = ldApplyField(instr.F, this.getmem(M))
                    .negate()
                    .toIndex();
                break;
            case 23: // LDXN
                this.rX = ldApplyField(instr.F, this.getmem(M)).negate();
                break;


            /* Store instructions */
            case 24: /* STA */ this.store(M, instr.F, this.rA); break;
            case 25: // ST1
            case 26: // ST2
            case 27: // ST3
            case 28: // ST4
            case 29: // ST5
            case 30: // ST6
                this.store(M, instr.F, this.rIs[instr.C-25].toWord());
                break;
            case 31: /* STX */ this.store(M, instr.F, this.rX); break;
            case 32: /* STJ */ this.store(M, instr.F, this.rJ.toWord()); break;
            case 33: /* STZ */ this.store(M, instr.F, Word.Zero); break;


            /* IO Instructions */
            case 34: { // JBUS
                if (!this.getDevice(instr.F).ready()) {
                    this.IP = M;
                    this.jumped = true;
                }
                break;
            }
            case 35: // IOC
                throw NotImplementedError("IOC");
                break;
            case 36: { // IN
                const device = this.getDevice(instr.F);
                if (!device.canIn()) {
                    throw new Error(`device ${instr.F} doesn't support IN`);
                }
                const op = device.wait();
                if (op !== null) this.applyOp(op);
                device.in(this.clock, M);
                break;
            }
            case 37: { // OUT
                const device = this.getDevice(instr.F);
                if (!device.canOut()) {
                    throw new Error(`device ${instr.F} doesn't support OUT`);
                }
                const op = device.wait();
                if (op !== null) this.applyOp(op);
                device.out(this.clock, M, this.contents);
                break;
            }
            case 38: { // JRED
                if (this.getDevice(instr.F).ready()) {
                    this.IP = M;
                    this.jumped = true;
                }
                break;
            }


            /* Jump instructions */
            case 39: // JMP, JSJ, JOV, JNOV, JL, JE, JG, JGE, JNE, JLE
                if (instr.F === 0) this.jump(M)
                else if (instr.F === 1) {
                    this.IP = M;
                    this.jumped = true;
                } else if (instr.F === 2) {
                    if (this.overflow) this.jump(M)
                    this.overflow = false;
                } else if (instr.F === 3) {
                    if (!this.overflow) this.jump(M);
                    this.overflow = false;
                }
                else if (instr.F === 4 && this.comparison === "LESS") this.jump(M);
                else if (instr.F === 5 && this.comparison === "EQUAL") this.jump(M);
                else if (instr.F === 6 && this.comparison === "GREATER") this.jump(M);
                else if (instr.F === 7 && this.comparison !== "LESS") this.jump(M);
                else if (instr.F === 8 && this.comparison !== "EQUAL") this.jump(M);
                else if (instr.F === 9 && this.comparison !== "GREATER") this.jump(M);
                break;
            case 40: // JAN, JAZ, JAP, JANN, JANZ, JANP
                if      (instr.F === 0 && this.rA.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rA.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rA.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rA.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rA.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rA.toNumber() <=  0) this.jump(M);
                break;
            case 41: // J1N, J1Z, J1P, J1NN, J1NZ, J1NP
                if      (instr.F === 0 && this.rI1.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI1.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI1.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI1.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI1.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI1.toNumber() <=  0) this.jump(M);
                break;
            case 42: // J2N, J2Z, J2P, J2NN, J2NZ, J2NP
                if      (instr.F === 0 && this.rI2.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI2.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI2.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI2.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI2.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI2.toNumber() <=  0) this.jump(M);
                break;
            case 43: // J3N, J3Z, J3P, J3NN, J3NZ, J3NP
                if      (instr.F === 0 && this.rI3.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI3.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI3.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI3.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI3.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI3.toNumber() <=  0) this.jump(M);
                break;
            case 44: // J4N, J4Z, J4P, J4NN, J4NZ, J4NP
                if      (instr.F === 0 && this.rI4.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI4.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI4.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI4.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI4.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI4.toNumber() <=  0) this.jump(M);
                break;
            case 45: // J5N, J5Z, J5P, J5NN, J5NZ, J5NP
                if      (instr.F === 0 && this.rI5.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI5.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI5.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI5.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI5.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI5.toNumber() <=  0) this.jump(M);
                break;
            case 46: // J1N, J1Z, J1P, J1NN, J1NZ, J1NP
                if      (instr.F === 0 && this.rI6.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rI6.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI6.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rI6.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rI6.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI6.toNumber() <=  0) this.jump(M);
                break;
            case 47: // JXN, JXZ, JXP, JXNN, JXNZ, JXNP
                if      (instr.F === 0 && this.rX.toNumber() <   0) this.jump(M);
                else if (instr.F === 1 && this.rX.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rX.toNumber() >   0) this.jump(M);
                else if (instr.F === 3 && this.rX.toNumber() >=  0) this.jump(M);
                else if (instr.F === 4 && this.rX.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rX.toNumber() <=  0) this.jump(M);
                break;


            /* Address transfer operators */
            case 48: /* INCA, DECA, ENTA, ENNA */
                if      (instr.F === 0) this.rA = this.add(M, this.rA);
                else if (instr.F === 1) this.rA = this.add(-M, this.rA);
                else if (instr.F === 2) this.rA = Word.fromNumber(M);
                else if (instr.F === 3) this.rA = Word.fromNumber(-M);
                break;
            case 49: /* INC1, DEC1, ENT1, ENN1 */
                const regI = instr.C - 49;
                if      (instr.F === 0) this.rI1 = this.addIndex(M, this.rI1);
                else if (instr.F === 1) this.rI1 = this.addIndex(-M, this.rI1);
                else if (instr.F === 2) this.rI1 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI1 = Index.fromNumber(-M);
                break;
            case 50: /* INC2, DEC2, ENT2, ENN2 */
                if      (instr.F === 0) this.rI2 = this.addIndex(M, this.rI2);
                else if (instr.F === 1) this.rI2 = this.addIndex(-M, this.rI2);
                else if (instr.F === 2) this.rI2 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI2 = Index.fromNumber(-M);
                break;
            case 51: /* INC3, DEC3, ENT3, ENN3 */
                if      (instr.F === 0) this.rI3 = this.addIndex(M, this.rI3);
                else if (instr.F === 1) this.rI3 = this.addIndex(-M, this.rI3);
                else if (instr.F === 2) this.rI3 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI3 = Index.fromNumber(-M);
                break;
            case 52: /* INC4, DEC4, ENT4, ENN4 */
                if      (instr.F === 0) this.rI4 = this.addIndex(M, this.rI4);
                else if (instr.F === 1) this.rI4 = this.addIndex(-M, this.rI4);
                else if (instr.F === 2) this.rI4 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI4 = Index.fromNumber(-M);
                break;
            case 53: /* INC5, DEC5, ENT5, ENN5 */
                if      (instr.F === 0) this.rI5 = this.addIndex(M, this.rI5);
                else if (instr.F === 1) this.rI5 = this.addIndex(-M, this.rI5);
                else if (instr.F === 2) this.rI5 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI5 = Index.fromNumber(-M);
                break;
            case 54: /* INC6, DEC6, ENT6, ENN6 */
                if      (instr.F === 0) this.rI6 = this.addIndex(M, this.rI6);
                else if (instr.F === 1) this.rI6 = this.addIndex(-M, this.rI6);
                else if (instr.F === 2) this.rI6 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI6 = Index.fromNumber(-M);
                break;
            case 55: /* INCX, DECX, ENTX, ENNX */
                if      (instr.F === 0) this.rX = this.add(M, this.rX);
                else if (instr.F === 1) this.rX = this.add(-M, this.rX);
                else if (instr.F === 2) this.rX = Word.fromNumber(M);
                else if (instr.F === 3) this.rX = Word.fromNumber(-M);
                break;


            /* Comparison operators */
            case 56: { // CMPA
                const A = ldApplyField(instr.F, this.rA).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 57: { // CMP1
                const A = ldApplyField(instr.F, this.rI1.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 58: { // CMP2
                const A = ldApplyField(instr.F, this.rI2.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 59: { // CMP3
                const A = ldApplyField(instr.F, this.rI3.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 60: { // CMP4
                const A = ldApplyField(instr.F, this.rI4.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 61: { // CMP5
                const A = ldApplyField(instr.F, this.rI5.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 62: { // CMP6
                const A = ldApplyField(instr.F, this.rI6.toWord()).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }
            case 63: { // CMPX
                const A = ldApplyField(instr.F, this.rX).toNumber();
                const B = ldApplyField(instr.F, this.getmem(M)).toNumber();
                this.comparison = compare(A, B);
                break;
            }


            default:
                throw new Error(`instruction not implemented: "${instr.toText()}"`)
        }

        if (instr.C === 1 || instr.C === 2 || instr.C === 6 ||
            (8 <= instr.C && 33 <= instr.C) || instr.C >= 56) {
            this.clock += 2n;
        } else if (instr.C === 7) { // MOVE
            this.clock += 1n + 2n*BigInt(instr.F);
        } else if (
            instr.C === 3 ||
            (instr.C === 5 && (instr.F === 0 || instr.F === 1))) {
            this.clock += 10n;
        } else if (instr.C === 4) {
            this.clock += 12n;
        } else {
            this.clock += 1n;
            // TODO: Implement float timings.
        }

        if (!this.jumped) this.IP++;
    }

    step() {
        if (this.IP < 0 || this.IP >= this.contents.length) {
            this.memfault = true;
            this.halt = true;
        }
        const instr = this.contents[this.IP];
        this.exec(Instruction.fromWord(instr));
    }

    go() {
        this.halt = false;
        this.memfault = false;

        // Load first card in.
        this.ios[15].in(this.clock, 0);
        const op = this.ios[15].wait();
        if (op === null) throw new Error("card reader has no card");
        this.applyOp(op);

        // Jump to 0.
        this.IP = 0;
        this.rJ = Index.Zero;

        while (!this.halt) this.step();
    }

    getmem(addr: number): Word {
        if (addr < 0 || addr > this.contents.length) {
            throw new Error(`Memory address out of bounds: ${addr}`)
        }
        return this.contents[addr];
    }

    setmem(addr: number, val: Word) {
        if (addr < 0 || addr > this.contents.length) {
            throw new Error(`Memory address out of bounds: ${addr}`)
        }
        this.contents[addr] = val;
    }

    private fetchIndex(index: number): Index {
        if (index === 0) return Index.Zero;
        if (index > 6) throw new Error(`tried to fetch bad rI: ${index}`);
        return this.rIs[index-1];
    }

    // Pull the last `N` bytes from `reg` and put them into bytes L':R in CONTENTS[M].
    // `N` = `R-L'+1`
    // `L'` = `L === 0 ? 1 : L`
    // `F` = `8*L + R`
    private store(M: number, F: Byte, reg: Word) {
        const mem = this.getmem(M);
        let L = F >> 3;
        const R = F % 8;
        let sign = mem.sign;
        if (L === 0) {
            L = 1;
            sign = this.rA.sign;
        }
        const N = R - L + 1;
        const bytes = mem.bytes();
        const regBytes = reg.bytes().slice(5-N, 5);
        setn(bytes, L-1, R, regBytes);
        this.setmem(M, new Word(sign, bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]));
    }

    private load(M: number, F: Byte): Word {
        return ldApplyField(F, this.getmem(M));
    }

    add(x: number, y: Word|Index): Word {
        const val = y.toNumber() + x;
        if (val > Word.MAX) this.overflow = true;
        const w = Word.fromNumber(val);
        return new Word(
            val > 0 ? Plus : val < 0 ? Minus : y.sign,
            w.b1, w.b2, w.b3, w.b4, w.b5
        );
    }

    addIndex(x: number, y: Index): Index {
        const val = y.toNumber() + x;
        if (val > Index.MAX) throw new Error("index overflowed!");
        const ret = Index.fromNumber(val);
        return new Index(val > 0 ? Plus : val < 0 ? Minus : y.sign,
            ret.b1, ret.b2);
    }

    private jump(M: number) {
        this.rJ = Index.fromNumber(this.IP + 1);
        this.IP = M;
        this.jumped = true;
    }

    private applyOp(op: OpIn|OpOut|OpControl) {
        if (op instanceof OpIn) {
            this.clock = op.finishedClock;
            for (let i = 0; i < op.mem.length; i++) {
                this.contents[op.addr + i] = op.mem[i];
            }
        } else if (op instanceof OpOut) {
            this.clock = op.finishedClock;
        } else if (op instanceof OpControl) {
            throw NotImplementedError("IOC");
        } else {
            throw new Error("unreachable");
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

    constructor(AA: Index, I: Byte, F: Byte, C: Byte) {
        this.AA = AA;
        this.I = I;
        this.F = F;
        this.C = C;
    }

    toText(): string {
        if (this.C < 0 || this.C > 63) {
            throw Error(`bad byte: instr.C: ${this.C}`);
        }
        const opCode = Instruction.opCode(this.C, this.F);
        const symbName = opCode.symbName;
        const index = this.I === 0 ? "" : "," + this.I;
        let AA = opCode.showArg ? this.AA.toString() : "";
        let fieldSpec = "";
        if (this.F !== opCode.normalF) {
            // TODO: Special-case the I/O instructions.
            fieldSpec = `(${this.F >> 3}:${this.F % 8})`;
        }
        const suffix = `${AA}${index}${fieldSpec}`;
        if (suffix === "") return symbName;
        return `${symbName}  ${suffix}`
    }

    toWord(): Word {
        return new Word(
            this.AA.sign, this.AA.b1, this.AA.b2, this.I, this.F, this.C);
    }

    static fromText(line: string): Instruction {
        // regex matches things like:
        //     LDA 2000,2(0:3)
        // Where the ",2" and "(0:3)" are optional.
        const regex = /^\W*([a-zA-Z1-6]+)\W+(-?[0-9]+)(,[0-5])?(\([0-9]:[0-9]\))?\W*$/;
        const r = line.match(regex);
        if (r === null) {
            throw new Error(`failed to parse instruction from line:\n${line}`);
        }
        const [s, symbName, Astr, Istr, Fstr] = r;
        const opCode = Instruction.opCodesByName().get(symbName);
        if (opCode === undefined) {
            throw new Error(`bad opcode name: "${symbName}" in line "${line}"`);
        }
        const I = Istr ? Number(Istr.slice(1)) : 0;
        const F = Fstr
            ? 8 * Number(Fstr.slice(1, 2)) + Number(Fstr.slice(3,4))
            : opCode.normalF;
        return new Instruction(
            Index.fromNumber(Number(Astr)), I, F, opCode.opCode);
    }

    static fromWord(w: Word): Instruction {
        return new Instruction(new Index(w.sign, w.b1, w.b2), w.b3, w.b4, w.b5);
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
        new OpCode(7, "MOVE", 1),
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
        new OpCode(32, "STJ", 5),
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


    static _opCodesByName = new Map<string, OpCode>();
    static opCodesByName(): Map<string, OpCode> {
        if (Instruction._opCodesByName.size === 0) {
            const codes: Array<[string, OpCode]> = [
                ["NOP", new OpCode(0, "NOP", 0, false)],
                ["FADD", new OpCode(1, "FADD", 6)],
                ["ADD", new OpCode(1, "ADD", 5)],
                ["FSUB", new OpCode(2, "FSUB", 6)],
                ["SUB", new OpCode(2, "SUB", 5)],
                ["FMUL", new OpCode(3, "FMUL", 6)],
                ["MUL", new OpCode(3, "MUL", 5)],
                ["FDIV", new OpCode(4, "FDIV", 6)],
                ["DIV", new OpCode(4, "DIV", 5)],
                ["NUM", new OpCode(5, "NUM", 0)],
                ["CHAR", new OpCode(5, "CHAR", 1)],
                ["HLT", new OpCode(5, "HLT", 2)],
                ["SLA", new OpCode(6, "SLA", 0)],
                ["SRA", new OpCode(6, "SRA", 1)],
                ["SLAX", new OpCode(6, "SLAX", 2)],
                ["SRAX", new OpCode(6, "SRAX", 3)],
                ["SLC", new OpCode(6, "SLC", 4)],
                ["SRC", new OpCode(6, "SRC", 5)],
                ["MOVE", new OpCode(7, "MOVE", 1)],
                ["LDA", new OpCode(8,  "LDA", 5)],
                ["LD1", new OpCode(9,  "LD1", 5)],
                ["LD2", new OpCode(10, "LD2", 5)],
                ["LD3", new OpCode(11, "LD3", 5)],
                ["LD4", new OpCode(12, "LD4", 5)],
                ["LD5", new OpCode(13, "LD5", 5)],
                ["LD6", new OpCode(14, "LD6", 5)],
                ["LDX", new OpCode(15, "LDX", 5)],
                ["LDAN", new OpCode(16, "LDAN", 5)],
                ["LD1N", new OpCode(17, "LD1N", 5)],
                ["LD2N", new OpCode(18, "LD2N", 5)],
                ["LD3N", new OpCode(19, "LD3N", 5)],
                ["LD4N", new OpCode(20, "LD4N", 5)],
                ["LD5N", new OpCode(21, "LD5N", 5)],
                ["LD6N", new OpCode(22, "LD6N", 5)],
                ["LDXN", new OpCode(23, "LDXN", 5)],
                ["STA", new OpCode(24, "STA", 5)],
                ["ST1", new OpCode(25, "ST1", 5)],
                ["ST2", new OpCode(26, "ST2", 5)],
                ["ST3", new OpCode(27, "ST3", 5)],
                ["ST4", new OpCode(28, "ST4", 5)],
                ["ST5", new OpCode(29, "ST5", 5)],
                ["ST6", new OpCode(30, "ST6", 5)],
                ["STX", new OpCode(31, "STX", 5)],
                ["STJ", new OpCode(32, "STJ", 5)],
                ["STZ", new OpCode(33, "STZ", 5)],
                ["JBUS", new OpCode(34, "JBUS", 0)],
                ["IOC", new OpCode(35, "IOC", 0)],
                ["IN", new OpCode(36, "IN", 0)],
                ["OUT", new OpCode(37, "OUT", 0)],
                ["JRED", new OpCode(38, "JRED", 0)],
                ["JMP", new OpCode(39, "JMP", 0)],
                ["JSJ", new OpCode(39, "JSJ", 1)],
                ["JOV", new OpCode(39, "JOV", 2)],
                ["JNOV", new OpCode(39, "JNOV", 3)],
                ["JL", new OpCode(39, "JL", 4)],
                ["JE", new OpCode(39, "JE", 5)],
                ["JG", new OpCode(39, "JG", 6)],
                ["JGE", new OpCode(39, "JGE", 7)],
                ["JNE", new OpCode(39, "JNE", 8)],
                ["JLE", new OpCode(39, "JLE", 9)],
                ["FCMP", new OpCode(56, "FCMP", 6)],
                ["CMPA", new OpCode(56, "CMPA", 5)],
                ["CMP1", new OpCode(57, "CMP1", 5)],
                ["CMP2", new OpCode(58, "CMP2", 5)],
                ["CMP3", new OpCode(59, "CMP3", 5)],
                ["CMP4", new OpCode(60, "CMP4", 5)],
                ["CMP5", new OpCode(61, "CMP5", 5)],
                ["CMP6", new OpCode(62, "CMP6", 5)],
                ["CMPX", new OpCode(63, "CMPX", 5)],
            ];
            const moreCodes = [
                JRegByName(40, "JA"),
                JRegByName(41, "J1"),
                JRegByName(42, "J2"),
                JRegByName(43, "J3"),
                JRegByName(44, "J4"),
                JRegByName(45, "J5"),
                JRegByName(46, "J6"),
                JRegByName(47, "JX"),
                IncRegByName(48, "A"),
                IncRegByName(49, "1"),
                IncRegByName(50, "2"),
                IncRegByName(51, "3"),
                IncRegByName(52, "4"),
                IncRegByName(53, "5"),
                IncRegByName(54, "6"),
                IncRegByName(55, "X"),
            ].flat();
            for (const [name, opCode] of codes) {
                this._opCodesByName.set(name, opCode);
            }
            for (const [name, opCode] of moreCodes) {
                this._opCodesByName.set(name, opCode);
            }
        }
        return Instruction._opCodesByName;
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
function JRegByName(opCode: number, symb: string): Array<[string, OpCode]> {
    return [
        [`${symb}N`, new OpCode(opCode, `${symb}N`, 0)],
        [`${symb}Z`, new OpCode(opCode, `${symb}Z`, 1)],
        [`${symb}P`, new OpCode(opCode, `${symb}P`, 2)],
        [`${symb}NN`, new OpCode(opCode, `${symb}NN`, 3)],
        [`${symb}NZ`, new OpCode(opCode, `${symb}NZ`, 4)],
        [`${symb}NP`, new OpCode(opCode, `${symb}NP`, 5)],
    ]
}
function IncReg(opCode: number, reg: string) {
    return Cases(opCode, new Map([
        [0, new OpCode(opCode, `INC${reg}`, 0)],
        [1, new OpCode(opCode, `DEC${reg}`, 1)],
        [2, new OpCode(opCode, `ENT${reg}`, 2)],
        [3, new OpCode(opCode, `ENN${reg}`, 3)],
    ]))
}
function IncRegByName(opCode: number, reg: string): Array<[string, OpCode]> {
    return [
        [`INC${reg}`, new OpCode(opCode, `INC${reg}`, 0)],
        [`DEC${reg}`, new OpCode(opCode, `DEC${reg}`, 1)],
        [`ENT${reg}`, new OpCode(opCode, `ENT${reg}`, 2)],
        [`ENN${reg}`, new OpCode(opCode, `ENN${reg}`, 3)],
    ];
}


const characterCode = " ABCDEFGHIJKLMNOPQRΣΠSTUVWXYZ0123456789.,()+-*/=$<>@;:'";



/** Util **/

function NotImplementedError(funcName: string) {
    return new Error(`Function ${funcName} not implemented.`);
}

function NotSupportedError(funcName: string) {
    return new Error(`Function ${funcName} not supported.`);
}


function setn<T>(xs: Array<T>, start: number, end: number, ys: Array<T>) {
    for (let i = 0; i < end-start; i++) {
        xs[start+i] = ys[i];
    }
}

function abs(x: bigint): bigint {
    return x > 0n ? x : -x;
}

export function padLeft<T>(xs: Array<T>, n: number, x: T): Array<T> {
    const ret = new Array(n);
    for (let i = 0; i < n - xs.length; i++) {
        ret[i] = x;
    }
    for (let i = 0; i < xs.length; i++) {
        ret[i + (n-xs.length)] = xs[i];
    }
    return ret;
}

export function padRight<T>(xs: Array<T>, n: number, x: T): Array<T> {
    const ret = new Array(n);
    for (let i = 0; i < xs.length; i++) {
        ret[i] = xs[i];
    }
    for (let i = xs.length; i < n; i++) {
        ret[i] = x;
    }
    return ret;
}

export function leftRot<T>(xs: Array<T>, n: number): Array<T> {
    const ret = new Array(xs.length);
    const len = xs.length;
    for (let i = 0; i < xs.length; i++) {
        ret[i] = xs[((i+n) % len + len) % len];
    }
    return ret;
}

export function rightRot<T>(xs: Array<T>, n: number): Array<T> {
    const ret = new Array(xs.length);
    const len = xs.length;
    for (let i = 0; i < xs.length; i++) {
        ret[i] = xs[((i-n) % len + len) % len];
    }
    return ret;
}

class OpIn {
    constructor(
        readonly finishedClock: bigint,
        readonly addr: number,
        readonly mem: Array<Word>,
    ) {}
}
class OpOut {
    constructor(
        readonly finishedClock: bigint,
    ) {}
}
class OpControl {}

export interface InputOutput {
    canIn(): boolean;
    canOut(): boolean;

    ready(): boolean;
    in(now: bigint, M: number): void;
    out(now: bigint, M: number, mem: Array<Word>): void;
    control(M: number): void;

    wait(): OpIn|OpOut|OpControl|null;
}

type Card = Array<Word>;
export class CardReader implements InputOutput {
    // The IBM 1130 could read 300 cards per minute and punch 80 cards
    // per minute. To read one card then takes 200ms, 200,000us, or
    // 25,000 clock cycles.
    // https://artsandculture.google.com/story/punched-card-machines-the-national-museum-of-computing/bwWBrooyeGKPiA?hl=en
    static READ_TIME_CYCLES: bigint = 25n * 1000n;

    cards: Array<Card> = []; // Stack of cards.
    ongoingRead: OpIn|null = null;

    ready(): boolean {
        return this.ongoingRead === null;
    }

    canIn(): boolean { return true; }
    in(now: bigint, M: number) {
        if (this.ongoingRead !== null) { throw new Error("IN in progress"); }
        const card = this.cards.pop();
        if (card === undefined) return; // There are no cards in the deck.
        this.ongoingRead =
            new OpIn(now+CardReader.READ_TIME_CYCLES, M, card);
    }

    canOut(): boolean { return false; }
    out(now: bigint, M: number, mem: Array<Word>) {
        throw NotSupportedError("CardReader.out()");
    }
    control(M: number) { throw NotSupportedError("CardReader.control()"); }

    wait(): OpIn|OpOut|OpControl|null {
        const ret = this.ongoingRead;
        this.ongoingRead = null;
        return ret;
    }
}


const WORDS_PER_CARD: number = 16;

function punchable(b: number) {
    return !(b >= 48 || b === 20 || b === 21);
}

export function programToRawCards(lines: string[]): Card[] {
    const cards: Card[] = [];
    let words: Word[] = [];
    for (let i=0; i < lines.length; i++) {
        let line = lines[i];
        const match = line.match(/[^#]*/);
        if (match === null) throw new Error(`could not parse line: ${line}`);
        line = match[0];
        if (!line) continue;

        const w = Instruction.fromText(line).toWord();
        if (w.bytes().some(b => !punchable(b))) {
            throw new Error(
                `unpunchable byte in line ${i}: "${line}": ${w.bytes()}`);
        }
        words.push(w);
        if (words.length === WORDS_PER_CARD) cards.push(words);
    }
    if (words.length > 0) {
        while (words.length < WORDS_PER_CARD) words.push(Word.Zero);
        cards.push(words);
    }
    return cards;
}

export const loadingProgram: string = await Bun.file('load.mix').text();

export function punchProgram(filename: string): Card[] {
    const cards: Card[] = programToRawCards(loadingProgram.split('\n'));
    return cards;
}
