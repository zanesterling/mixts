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

    static fromNumber(x: number): Index {
        const sign = x >= 0 ? Plus : Minus;
        x = Math.abs(x);
        return new Index(
            sign,
            (x >> 6) % 64,
             x       % 64,
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

function add(a: Index, b: Index): Word {
    throw NotImplementedError("add");
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

    constructor() {
        this.rIs = [Index.Zero, Index.Zero, Index.Zero, Index.Zero, Index.Zero, Index.Zero];
        this.contents = new Array(4000);
        for (const i in this.contents) {
            this.contents[i] = Word.Zero;
        }
    }

    exec(instr: Instruction) {
        const M = this.fetchIndex(instr.I).toNumber() + instr.AA.toNumber();
        switch (instr.C) {
            case 0: // NOP
                break;


            /* Arithmetic instructions */
            case 1: // ADD
                if (instr.F == 6) throw NotImplementedError("FADD");
                this.add(this.load(M, instr.F).toNumber());
                break;
            case 2: // SUB
                if (instr.F == 6) throw NotImplementedError("FSUB");
                this.add(-this.load(M, instr.F).toNumber());
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
                if (instr.F === 0 && this.rA.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rA.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rA.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rA.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rA.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rA.sign !== Plus) this.jump(M);
                break;
            case 41: // J1N, J1Z, J1P, J1NN, J1NZ, J1NP
                if (instr.F === 0 && this.rI1.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI1.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI1.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI1.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI1.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI1.sign !== Plus) this.jump(M);
                break;
            case 42: // J2N, J2Z, J2P, J2NN, J2NZ, J2NP
                if (instr.F === 0 && this.rI2.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI2.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI2.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI2.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI2.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI2.sign !== Plus) this.jump(M);
                break;
            case 43: // J3N, J3Z, J3P, J3NN, J3NZ, J3NP
                if (instr.F === 0 && this.rI3.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI3.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI3.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI3.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI3.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI3.sign !== Plus) this.jump(M);
                break;
            case 44: // J4N, J4Z, J4P, J4NN, J4NZ, J4NP
                if (instr.F === 0 && this.rI4.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI4.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI4.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI4.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI4.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI4.sign !== Plus) this.jump(M);
                break;
            case 45: // J5N, J5Z, J5P, J5NN, J5NZ, J5NP
                if (instr.F === 0 && this.rI5.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI5.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI5.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI5.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI5.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI5.sign !== Plus) this.jump(M);
                break;
            case 46: // J6N, J6Z, J6P, J6NN, J6NZ, J6NP
                if (instr.F === 0 && this.rI6.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rI6.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rI6.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rI6.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rI6.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rI6.sign !== Plus) this.jump(M);
                break;
            case 47: // JXN, JXZ, JXP, JXNN, JXNZ, JXNP
                if (instr.F === 0 && this.rX.sign === Minus) this.jump(M);
                else if (instr.F === 1 && this.rX.toNumber() === 0) this.jump(M);
                else if (instr.F === 2 && this.rX.sign === Plus) this.jump(M);
                else if (instr.F === 3 && this.rX.sign !== Minus) this.jump(M);
                else if (instr.F === 4 && this.rX.toNumber() !== 0) this.jump(M);
                else if (instr.F === 5 && this.rX.sign !== Plus) this.jump(M);
                break;


            /* Address transfer operators */
            case 48: /* INCA, DECA, ENTA, ENNA */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rA = Word.fromNumber(M);
                else if (instr.F === 3) this.rA = Word.fromNumber(-M);
                break;
            case 49: /* INC1, DEC1, ENT1, ENN1 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI1 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI1 = Index.fromNumber(-M);
                break;
            case 50: /* INC2, DEC2, ENT2, ENN2 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI2 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI2 = Index.fromNumber(-M);
                break;
            case 51: /* INC3, DEC3, ENT3, ENN3 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI3 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI3 = Index.fromNumber(-M);
                break;
            case 52: /* INC4, DEC4, ENT4, ENN4 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI4 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI4 = Index.fromNumber(-M);
                break;
            case 53: /* INC5, DEC5, ENT5, ENN5 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI5 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI5 = Index.fromNumber(-M);
                break;
            case 54: /* INC6, DEC6, ENT6, ENN6 */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
                else if (instr.F === 2) this.rI6 = Index.fromNumber(M);
                else if (instr.F === 3) this.rI6 = Index.fromNumber(-M);
                break;
            case 55: /* INCX, DECX, ENTX, ENNX */
                if (instr.F === 0) { this.add(M); }
                else if (instr.F === 1) { this.add(-M); }
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

        if (!this.jumped) this.IP++;
        this.jumped = false;
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
        const rABytes = this.rA.bytes().slice(5-N, 5);
        setn(bytes, L-1, R, rABytes);
        this.setmem(M, new Word(sign, bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]));
    }

    private load(M: number, F: Byte): Word {
        return ldApplyField(F, this.getmem(M));
    }

    add(x: number) {
        const val = this.rA.toNumber() + x;
        if (val > Word.MAX) this.overflow = true;
        const w = Word.fromNumber(val);
        this.rA = new Word(
            val > 0 ? Plus : val < 0 ? Minus : this.rA.sign,
            w.b1, w.b2, w.b3, w.b4, w.b5
        );
    }

    private jump(M: number) {
        this.rJ = Index.fromNumber(this.IP + 1);
        this.IP = M;
        this.jumped = true;
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

    address(state: State): Word {
        if (this.I === 0) return Word.fromIndex(this.AA);
        return add(this.AA, state.rIs[this.I - 1]);
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

    static fromText(str: string): Instruction {
        throw NotImplementedError("toText");
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
        new OpCode(25, "ST1", 2),
        new OpCode(26, "ST2", 2),
        new OpCode(27, "ST3", 2),
        new OpCode(28, "ST4", 2),
        new OpCode(29, "ST5", 2),
        new OpCode(30, "ST6", 2),
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
