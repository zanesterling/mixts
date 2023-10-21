import * as ReactDOM from 'react-dom/client';
import * as React from 'react';

import {
  State,
  Word, Index,
  Plus, Minus,
  Instruction,
} from './mix';

function Byte(props: {value: string}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "30px",
        width: "30px",
        border: "3px solid red",
        margin: "3px"
      }}
    >
      <span
        style={{ color: "red" }}
      >
        {props.value}
      </span>
    </div>
  );
}

function WordComp(props: {label: string, value: Word}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display:  "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "30px",
          width: "30px",
          fontWeight: "bold",
        }}
      >
        <span>{props.label}</span>
      </div>
      <Byte value={props.value.sign === Plus ? "+" : "-"}></Byte>
      <Byte value={"" + props.value.b1}></Byte>
      <Byte value={"" + props.value.b2}></Byte>
      <Byte value={"" + props.value.b3}></Byte>
      <Byte value={"" + props.value.b4}></Byte>
      <Byte value={"" + props.value.b5}></Byte>
    </div>
  );
}

function IndexComp(props: {label: string, value: Index}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display:  "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "30px",
          width: "30px",
        }}
      >
        <span>{props.label}</span>
      </div>
      <Byte value={props.value.sign === Plus ? "+" : "-"}></Byte>
      <Byte value={"" + props.value.b1}></Byte>
      <Byte value={"" + props.value.b2}></Byte>
    </div>
  );
}

function Component(props: {message: string}) {
  const [x, updateState] = React.useState(1);
  const step = () => {
    mixState.step();
    updateState(x+1);
  };

  const loadProgram = () => {
    const code = document.getElementById("code-input").value;
    const lines = code.split("\n");
    console.log(lines);
    const addr = Number(document.getElementById("addr").innerText);
    let j = 0;
    for (const line of lines) {
      if (!line) continue;
      const instr = Instruction.fromText(line);
      mixState.setmem(addr + j, instr.toWord());
      j++;
    }
  }

  const reset = () => {
    mixState = new State();
  }

  return (
    <div style={{
      display: "flex",
    }}>
      <div>
        <div style={{ color: "red", fontWeight: "bold" }}>
          <WordComp label="A" value={mixState.rA}></WordComp>
          <IndexComp label="I1" value={mixState.rI1}></IndexComp>
          <IndexComp label="I2" value={mixState.rI2}></IndexComp>
          <IndexComp label="I3" value={mixState.rI3}></IndexComp>
          <IndexComp label="I4" value={mixState.rI4}></IndexComp>
          <IndexComp label="I5" value={mixState.rI5}></IndexComp>
          <IndexComp label="I6" value={mixState.rI6}></IndexComp>
          <WordComp label="X" value={mixState.rX}></WordComp>
          <IndexComp label="J" value={mixState.rJ}></IndexComp>
          <IndexComp label="IP" value={Index.fromNumber(mixState.IP)}></IndexComp>
        </div>
        <div>
          <button onClick={step}>Step</button>

          <hr></hr>
          <input id="addr" placeholder="Target address"></input><br></br>
          <textarea style={{height: "200px", width: "300px"}} id="code-input"></textarea><br></br>
          <button onClick={loadProgram}>Load program</button>

          <hr></hr>
          <button onClick={() => {mixState = new State()}}>Reset</button>
        </div>
      </div>
      <div style={{
        color: "red",
        padding: "0px 0px 0px 100px"
      }}>
      </div>
    </div>
  );
}

let mixState = new State();
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Component message="Sup!"></Component>);
