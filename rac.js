/**
 * Summary. Compiler for MIC-1 instructions to machine code
 * 
 * @file RAC - Really Awful Compiler
 * @author Nikola Glavina
 * 
 */

/*

MIT License

Copyright (c) 2020 Nikola Glavina

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/


// ORDER MATTERS!
const REGISTER_ARRAY = [
    {
        "register" : "pc",
        "mutable"  : true,
        "readable" : true
    },
    {
        "register" : "ac",
        "mutable"  : true,
        "readable" : true
    },
    {
        "register" : "sp",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "ir",
        "mutable"  : true,
        "readable" : true
    },
    {
        "register" : "tir",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "0",
        "mutable"  : false,
        "readable" : true 
    },
    {
        "register" : "1",
        "mutable"  : false,
        "readable" : true
    },
    {
        "register" : "-1",
        "mutable"  : false,
        "readable" : true 
    },
    {
        "register" : "amask",
        "mutable"  : false,
        "readable" : true  
    },
    {
        "register" : "smask",
        "mutable"  : false,
        "readable" : true  
    },
    {
        "register" : "a",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "b",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "c",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "d",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "e",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "f",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "mar",
        "mutable"  : true,
        "readable" : false 
    },
    {
        "register" : "mbr",
        "mutable"  : true,
        "readable" : true 
    },
    {
        "register" : "alu",
        "mutable"  : true,
        "readable" : false 
    }
];



const operations = [":=", "+", "rd", "wr", "halt"];
const param_operations = ["band", "lshift", "rshift", "inv"];
const if_keywords = ["if", "then", "goto"];
const jump_conditions = ["z", "n"];
const subinstruction_separator = [";", ","];
const label_definer = [":"];
const wrappers = ["(", ")"];
const whitespaces = [" ", "\t"];
const newline = ["\n"];


// by design, labels are only [a-zA-Z0-9]
// so we only need sets that contains
// items with numbers and/or word

function registerFromString(val){
    let rtn = null;
    REGISTER_ARRAY.forEach(r => {
        if(r["register"] == val) rtn = r;
    });
    return rtn;
}

function indexOfRegister(reg){

    for(let i = 0; i < REGISTER_ARRAY.length; i++){
        if(REGISTER_ARRAY[i] == reg){
            return i;
        }
    }

    return -1;
}
function isRegister(reg){
    return REGISTER_ARRAY.includes(reg);
}

const RESERVERD_KEYWORDS = REGISTER_ARRAY
                            .concat(operations)
                            .concat(if_keywords)
                            .concat(jump_conditions);

class InputStream{
    constructor(string){
        this._inputstring = string.trim();
    
        this._pos = this._coll = this._line = 0;
    }

    peek(pos = this._pos){
        if (pos >= this._inputstring.length) return "";
        return this._inputstring[pos];
    }

    peekRelative(pos = 0){
        return this.peek(this._pos + pos);
    }

    peekNext(len = 1){
        return this._inputstring.substring(this._pos, this._pos + len);
    }

    consume(){
        if (this.peek() == '\n') {
            this._line++;
            this._coll = 0;
        }
        this._coll++;
        return this.peek(this._pos++);
    }

    isEof(){
        return this._pos >= this._inputstring.length;
    }
}

console.log(REGISTER_ARRAY);

class Tokenizer extends InputStream{

    constructor(...args){
        super(...args);

        // for compatibility
        // newline counts as end of instruction
        this._currentToken = {
            type: "newline",
            value: "\n"
        };
    }

    get currentToken(){
        return this._currentToken;
    }
    set currentToken(token){
        return this._currentToken = token;
    }

    throwError(message){
        throw new Error("Error at line: " + this._line + " col: " + this._coll +": " + message);
    }

    // lets start with metods that check first element in string
    is_character(val){
        return /[a-zA-Z]/i.test(val);
    }
    is_number(val){
        // minus sign not allowed anywhere else
        return /[\-0-9]+/i.test(val);
    }
    is_operation_char(val){
        // remove regular letters
        return operations.join('').split('').filter(x => !/[a-zA-Z]/i.test(x)).includes(val);
    }


    // category functions
    is_register(val){
        return REGISTER_ARRAY.map(x => x["register"]).includes(val);
    }
    is_operation(val){
        return operations.includes(val);
    }
    is_param_operation(val){
        return param_operations.includes(val);
    }
    is_if_keyword(val){
        return if_keywords.includes(val);
    }
    // most of them are single chars, so we can use them directly here
    is_jump_condition(val){
        return jump_conditions.includes(val);
    }
    is_subinstruction_separator(val){
        return subinstruction_separator.includes(val);
    }
    is_label_definer(val){
        return label_definer.includes(val);
    }
    is_wrapper(val){
        return wrappers.includes(val);
    }
    is_label(val){
        // two rules for labels
        // next char is ":", or previous token is
        // a keyword from if (goto)
        if(!RESERVERD_KEYWORDS.includes(val)
            && /[a-zA-Z0-9]+/i.test(val)){
                if(this.is_label_definer(this.peek())
                    || this._currentToken.type == "if_keyword"){
                        return true;
                    }
        }
        return false;
    }

    is_label_improved(val){
        // two rules for labels
        // last char is ":", or previous token is
        // a keyword from if (goto)
        if(!RESERVERD_KEYWORDS.includes(val)
            && /[a-zA-Z0-9]+/i.test(val)){
                if( (this.currentToken.type == "newline" || this.currentToken.value == "goto")
                    && this.peekNext(2) != ":=" ){
                        return true;
                    }
        }
        return false;
    }


    is_whitespace(val){
        return whitespaces.includes(val);
    }
    is_newline(val){
        return newline.includes(val);
    }

    // reading / consuming methods
    
    consumeUntil(fun){
        // consumes and returns characters
        // while function evalues true
        let buffer = "";
        while(fun(this.peek()) == true){
            buffer += this.consume();
        }
        return buffer;
    }

    consumeCharacters(){
        return this.consumeUntil(x => this.is_character(x));
    }

    consumeNumber(){
        return this.consumeUntil(x => this.is_number(x));
    }
    consumeWhitespaces(){
        return this.consumeUntil(x => this.is_whitespace(x));
    }

    tryConsumeLabel(){
        // read label
        let buffer = this.consumeUntil(x => this.is_number(x) || this.is_character(x));
        // check if label is valid of sytax error

        return buffer;
    }

    tryRegisterOrLabel(val){
        // returns register, or label or error

        if(this.currentToken.type == "newline"){ 
            if(this.peek() != ":"){
                // label, just incomplete
                val += this.tryConsumeLabel();
                //this.consume(); // eat :
                return{
                    type: "label",
                    value: val,
                    line: this._line
                }
            }else if(this.peekRelative(1) != "="){
                // label, complete
                return{
                    type: "label",
                    value: val,
                    line: this._line
                }
            }else{
                // try register
                if(this.is_register(val) == true){
                    return registerFromString(val)
                }
            }
        // try label
        }else if(this.currentToken.value == "goto"){
            val += this.tryConsumeLabel();
            //this.consume(); // eat ;
            return{
                type: "label",
                value: val,
                line: this._line
            }
        }else{
            if(this.is_register(val) == true){
                return registerFromString(val)
            }
        }

        // throw error

        if(this.currentToken.type == "newline"){ 
            this.throwError("Expecting register or label");
        }
        else if(this.currentToken.value == "goto"){
            this.throwError("Expecting label");
        }else{
            debugger;
            this.throwError("GENERAL ERROR; STILL NEEDS HANDING: Expecting register");
        }
        
        debugger;
        
        return null;
    }

    doRead(){
        // main function
        // reads next expressions and returns it
        // if eof returns null
        // if not recognized throws error
        
        console.log("Col: "+ this._coll);
        console.log("Line "+ this._line)
        this.consumeWhitespaces();
        if(this.is_newline(this.peek())){
            let val = this.consumeUntil(x => this.is_newline(x));
            return {
                type:"newline",
                value: val
            }
        }
        if(this.is_subinstruction_separator(this.peek())){
            let val = this.consume();
            return {
                type:"subinstruction_separator",
                value: val
            }
        }
        if( this.is_label_definer(this.peek()) &&  !this.is_operation_char(this.peekRelative(1)) ){
            let val = this.consume();
            return {
                type:"label_definer",
                value: val
            }
        }
        if(this.is_operation_char(this.peek())){
            let val = this.consumeUntil(x => this.is_operation_char(x));
            return {
                type:"operation",
                value: val
            }
        }
        if(this.is_wrapper(this.peek())){
            let val = this.consume();
            return {
                type:"wrapper",
                value: val
            }
        }

        if(this.is_number(this.peek())){
            let tempValue = this.consumeNumber();
            // register or label?
            return this.tryRegisterOrLabel(tempValue);
            
        }
        else if(this.is_character(this.peek())){
            let tempValue = this.consumeCharacters();
            // from short to wider
            if(this.is_jump_condition(tempValue)){
                return {
                    type: "jump_condition",
                    value: tempValue
                }
            }
            if(this.is_if_keyword(tempValue)){
                return {
                    type: "if_keyword",
                    value: tempValue
                }
            }
            if(this.is_operation(tempValue)){
                return {
                    type: "operation",
                    value: tempValue
                }
            }
            if(this.is_param_operation(tempValue)){
                return {
                    type: "param_operation",
                    value: tempValue
                }
            }
            // register or label? maybe even error
            return this.tryRegisterOrLabel(tempValue);
        }
        this.throwError("Unable to parse instruction");
        return null;

    }

    doFullRead(){
        this.currentToken = this.doRead();
        return this.currentToken;
    }
    
}





class ASTmaker{
    constructor(tokenList){
        this.tokenList = tokenList;
        this._lastToken = {
            type: "newline",
            value: "\n"
        }
    }

    get lastToken(){
        return this._lastToken;
    }

    set lastToken(token){
        this._lastToken = token;
    }

    peek(pos = 0 ){
        // compatibility obj
        return this.tokenList.length > pos ? this.tokenList[pos] : {type: ""};
    }

    consume(){
        this.lastToken = this.tokenList.shift();
        return this.lastToken;
    }

    tryPeekRegister(){
        // Peeks if next is register, needed for ()
        if( REGISTER_ARRAY.includes(this.peek())){
            return this.peek();
        }else if(this.peek()["value"] == "(" && REGISTER_ARRAY.includes(this.peekRelative(1)) ){
            return this.peekRelative(1);
        }
        return null;
    }

    throwError(msg){
        // set line / ins / sub ins for object property to remember them
        alert("Error: " + msg);
        debugger;
    }

    parse_register(){
        // checks if reg is inside brackers
        let reg;
        if(this.peek()["value"] == "(" && this.peek(2)["value"] == ")"){
            // reg is wrapped
            this.consume(); // eat (
            reg = this.consume();
            this.consume(); // eat )
        }else{
            reg = this.consume();
        }
        return reg;
    }

    parse_add(){
        // TODO
        // Add explicit check for +
        let reg_Left = this.parse_register();
        return {
            ...this.consume(),
            body: {
                left: reg_Left,
                right: this.parse_register()
            }
        }
    }

    parse_band(){
        let reg_Left = this.parse_register()
      
        // eat , check if this is truly ","
        if(this.peek()["value"] != ","){
            this.throwError("band: delimiter is not \",\"");
            return null;
        }
        this.consume();
        return{
            left: reg_Left,
            right: this.parse_register()
        }
    }

    parse_assign_right_side(){
        let obj = null;
        // band is special, always takes two args
        // separated by ,
        if(this.peek()["type"] == "param_operation"){
            let op = this.consume();
            // param_operation is always contains paranthesies
            
            if(this.peek()["value"] != ("(")){
                alert("Error: param op dosent conatain opening \"(\"");
                debugger;
            }else{
                this.consume();
            }
            if(op["value"] == "band"){
                obj = {
                    ...op,
                    body: this.parse_band()
                }
            }else{
                // parse other param ops
                // this can also contain add op
                
                // first is surely register
                if(this.peek(1)["value"] == "+" || this.peek(3)["value"] == "+"){
                    obj = {
                        ...op,
                        body: this.parse_add()
                    }
                }else{
                    obj = {
                        ...op,
                        body: this.parse_register()
                    }
                }
            }
            if(this.peek()["value"] != (")")){
                alert("Error: param op dosent conatain closing \")\"");
                debugger;
            }else{
                this.consume();
            }
        }else if( this.tryPeekRegister() != null ){
            let reg_maybeLeft = this.parse_register();
            if(this.peek()["value"] != ";"){
                if(this.peek()["value"] != "+"){
                    alert("Error: only + is allowed after register in assignment op");
                    debugger;
                }
                else{
                    return {
                        ...this.consume(),
                        body: {
                            left: reg_maybeLeft,
                            right: this.parse_register()
                        }
                    }
                }
            }else{
                return reg_maybeLeft;
            }

        }else{
            alert("Error: right side of := not containing register or suboperation");
            debugger;
        }

        if(obj == null){
            alert("AST error pase");
            debugger;
        }
        return obj;
    }

    parse_assign(){
        let reg_Left = this.parse_register();
        return {
            ...this.consume(),
            left: reg_Left,
            body: this.parse_assign_right_side()
        }
    }

    parse_goto(){
        return this.consume();
    }

    parse_rdwr(){
        return this.consume();
    }

    parse_label_definition(){
        let label = this.consume();
        if(this.peek()["type"] != "label_definer"){
            alert("Error parsing label deifintion, \":\" not found after definition");
            debugger;
        }
        this.consume(); // eat :
        return label;
    }

    parse_if(){
        let if_clause = this.consume();
        let flag = this.consume();
        this.consume(); // eat then
        this.consume(); // eat goto
        return{
            type: if_clause, // if clause
            body: {
                left: flag, // when to jump
                right: this.parse_goto()
            }
        }
    }

    parse_subinstruction(){
        if(REGISTER_ARRAY.includes(this.peek()) == true){
            return this.parse_assign();
        }else if(this.peek()["value"] == "goto"){
            return {
                type: this.consume(),
                body: this.parse_goto()
            }
        }else if(this.peek()["value"] == "rd" || this.peek()["value"] == "wr"){
            return this.parse_rdwr();
        }
        else if(this.peek()["value"] == "if"){
            return this.parse_if();
        }else if(this.peek()["type"] == "label"){
            if(this.lastToken["type"] != "newline"){
                alert("Label definition only allowed at start of instruction");
                debugger;
            }
            return this.parse_label_definition();
        }
        else if(this.peek()["value"] == "halt"){
            console.log("Halt");
            this.consume();
            return {type: "halt"};
        }
        else{
            alert("Instruction not allowed");
            debugger;
        }
    }

    parse_instruction(){
        
        let obj;
        
        if(this.peek()["type"] == "label"){
            obj = this.parse_label_definition();
        }else{
            // since it has no label,
            // it cannot jump, so line is negative
            obj={
                type: "label",
                value: "",
                line: -1
            }
        }

        let sub_ins = new Array();
        while(this.tokenList.length > 0 && this.peek()["type"] != "newline"){

            if(sub_ins.length > 6){
                // max length of subins, label def counts as sub ins
                alert("Max number of sub instruction reached");
                debugger;
            }

            let resp = this.parse_subinstruction();
            if(this.peek()["value"] != ";"){
                alert("Subinstuctions not parsed until end");
                debugger;
            }else{
                sub_ins.push(resp);
                this.consume();
            }
        }

        obj["body"] = sub_ins;

        return obj;

    }

    parse_program(){
        
        let ins = new Array();
        while(this.tokenList.length > 0){
            if(this.peek()["type"] != "newline" && this.peek()["type"] != ""){
                alert("Error parsing instruction!");
                debugger;
            }
            this.consume();
            ins.push(this.parse_instruction());
        }
        return ins;
    }

    parse_full_program(){
        return {
            type: "prog",
            body: this.parse_program()
        }
    }
}




class MicCodeGenerator{
        
    constructor(program){
        this._program_body = program;

        this._label_jumps = new Array();
        this._label_defs = new Array();


        // state sets

        this._amux = 0;
        this._cond = 0;
        this._alu = null;
        this._sh = null;
        this._mbr = 0;
        this._mar = 0;
        this._rd = 0;
        this._wr = 0;
        this._enc = 0;
        this._c = null;
        this._b = null;
        this._a = null;
        this._addr = null;


        this._instructions = new Array();

    }

    get program(){
        return this._program_body;
    }

    get label_defs(){
        return this._label_defs;
    }
    get label_jumps(){
        return this._label_jumps;
    }

    isBusFreeOrSame(bus, reg){
        return bus == null || bus == reg;
    }

    isAfreeOrSame(reg){
        // if amux is set, a bus is disabled
        return this._amux == 0 && this.isBusFreeOrSame(this._a, indexOfRegister(reg));
    }
    isBfreeOrSame(reg){
        return this.isBusFreeOrSame(this._b, indexOfRegister(reg));
    }
    isCfreeOrSame(reg){
        // wrapper for compatibility
        return this.checkOutputRegister(reg);
    }

    setAbusToReg(reg){
        if(reg["register"] == "mbr"){
            this._amux = 1;
        }else{
            this._a = indexOfRegister(reg);
        }
    }
    setBbusToReg(reg){
        this._b = indexOfRegister(reg);
    }

    setCbusToReg(reg){
        // wrapper for compatibility
        this.setOutputRegister(reg);
    }

    setOutputRegister(reg){
        if(reg["register"] == "mbr"){
            this._mbr = 1;
        }
        else if(reg["register"] == "mar"){
            this._mar = 1;
        }
        else{
            if(reg["register"] != "alu"){
                this._enc = 1;
                this._c = indexOfRegister(reg);
            }
        }
    }
    
    checkOutputRegister(reg){
        // checks if outputs are clear
        if(reg["register"] == "mbr"){
            return this._mbr == 0;
        }
        else if(reg["register"] == "mar"){
            // input from b bus
            
            // TODO
            // mar should accept instruction if b bus is the same, eg:
            // tir:=a+b:mar:=b;
            // extra comment:
            // i think this is fixed at other place

            return this.isBfreeOrSame(reg);
        }
        else{
            return (this._c == indexOfRegister(reg) || this._c == null) && this._enc == 0;
        }
    }

    isAluFreeOrSame(op_code){
        return this._alu == null || this._alu == op_code;
    }
    isShifterFreeOrSame(op_code){
        return this._sh == null || this._alu == op_code;
    }


    throwError(msg){
        alert("Error: " + msg);
        debugger;
    }

    isLabelDefined(label){
        let flag = false;
        this.label_defs.forEach(x => {
            if(label["value"] == x["value"])
                flag = true;
            });
        return flag;
    }

    isAdressClear(){
        return this._addr;
    }

    isJumpClear(){
        return this._cond == 0;
    }

    getLineForLabel(label_obj){
        let label = label_obj["value"];
        let _label = -1;
        this.label_defs.forEach(x => {
            if(label == x["value"]){
                _label = x["line"];
            }
        });

        return _label;
    }

    clearStatesForNextInstruction(){
        // same as init
        this._amux = 0;
        this._cond = 0;
        this._alu = null;
        this._sh = null;
        this._mbr = 0;
        this._mar = 0;
        this._rd = 0;
        this._wr = 0;
        this._enc = 0;
        this._c = null;
        this._b = null;
        this._a = null;
        this._addr = null;
    }

    initRestOfFlags(){
        this._alu = this._alu == null ? 0 : this._alu;
        this._sh = this._sh == null ? 0 : this._sh;
        this._c = this._c == null ? 0 : this._c;
        this._b = this._b == null ? 0 : this._b;
        this._a = this._a == null ? 0 : this._a;
        this._addr = this._addr == null ? 0 : this._addr;
    }

    setStateForHalt(){
        // sets all flags to max value
        this._amux = 0b1;
        this._cond = 0b11;
        this._alu = 0b11;
        this._sh = 0b11;
        this._mbr = 0b1;
        this._mar = 0b1;
        this._rd = 0b1;
        this._wr = 0b1;
        this._enc = 0b1;
        this._c = 0b1111;
        this._b = 0b1111;
        this._a = 0b1111;
        this._addr = 0b11111111;
    }


    flushInstruction(){
        // easy enough
        this.initRestOfFlags();

        let bitstring = "";

        bitstring += this._amux.toString(2);
        bitstring += this._cond.toString(2).padStart(2, '0');
        bitstring += this._alu.toString(2).padStart(2, '0');
        bitstring += this._sh.toString(2).padStart(2, '0');
        bitstring += this._mbr.toString(2);
        bitstring += this._mar.toString(2);
        bitstring += this._rd.toString(2);
        bitstring += this._wr.toString(2);
        bitstring += this._enc.toString(2);
        bitstring += this._c.toString(2).padStart(4, '0');
        bitstring += this._b.toString(2).padStart(4, '0');
        bitstring += this._a.toString(2).padStart(4, '0');
        bitstring += this._addr.toString(2).padStart(8, '0');

        if(bitstring.length != 32){
            this.throwError("Instruction length mismatch");
            debugger;
        }

        let ins_code = parseInt(bitstring, 2);
        this._instructions.push(ins_code);
        this.clearStatesForNextInstruction();
    }

    
    compileLabels(){
        // compiles list of label definitions
        // and checks for errors
        this.program["body"].forEach((x) => {
          
                let label = x;
                
                if(x["body"][x["body"].length - 1] && x["body"][x["body"].length - 1]["type"]){
                    let last_elem = x["body"][x["body"].length - 1];
                    if(last_elem["type"] && last_elem["type"]["type"] == "if_keyword"){
                        if(last_elem["body"]){
                            if(last_elem["body"]["right"]){
                                // cond jump
                                this.label_jumps.push(last_elem["body"]["right"]);
                            }else{
                                // jump always
                                this.label_jumps.push(last_elem["body"]);
                            }
                        }
                    }
                }

                if(label["value"] != ""){
                    if(!this.isLabelDefined(label)){
                        this.label_defs.push(label);
                    }
                    else{
                        alert("Label \"" + label["value"] + "\" already defined");
                    }
                }
            
        });
        let tmp_array = new Array();
        this.label_jumps.forEach(x => {
            if(this.isLabelDefined(x) != true){
                tmp_array.push(x);
            }
        });
        if(tmp_array.length > 0) return tmp_array;
        return true;
    }

    compile_op_add(op_node){
        let reg_left = op_node["body"]["left"];
        let reg_right = op_node["body"]["right"];
        // must be registers and must be readable
        if( REGISTER_ARRAY.includes(reg_left) != true
            || REGISTER_ARRAY.includes(reg_right) != true ){
                this.throwError("Add: not registers");
                return;
        }
        if(reg_left["readable"] != true || reg_right["readable"] != true){
            this.throwError("Add: reading from unreadable registers");
            return;
        }
        // special case for mbr
        if(reg_left["register"] == "mbr" || reg_right["register"] == "mbr"){
            // a bus must be free, explicitly
            if(this._a != null){
                this.throwError("mbr read: a bus already taken");
                return;
            }
            
            this._amux = 1;
            // we will assign second register to reg_right, so we can compile it later
            reg_right = reg_left["register"] == "mbr" ? reg_right : reg_left;
        }else{
            // compile normal reg

            // if reg is already assigned to reg b
            // then swap registers and and other reg to A

            if(this._a == indexOfRegister(reg_left) && this._b == null && this._amux < 1){
                // no need to change, skip
            } 
            else if(this._b == indexOfRegister(reg_left)  && this._a == null && this._amux < 1){
                // swap regs
                this.setAbusToReg(reg_right);
                let tmp = reg_left;
                reg_left = reg_right;
                reg_right = tmp;
                
            }else if(this._a == null && this._amux < 1){
                 // check ok
                this.setAbusToReg(reg_left);
            }else{
                if(this._amux > 0){
                    this.throwError("op add: a bus, amux is set");
                }else{
                    this.throwError("op add: undefined branch");
                }
                return;
            }

        }
        // compile second reg
        // b bus must be free or same
        if(!this.isBfreeOrSame(reg_right)){
            this.throwError("Add op: b bus already taken");
            return;
        }

        // check ok
        this.setBbusToReg(reg_right);
        this._alu = 0; // alu op for add
        return true;   
    }

    compile_param_op(op){
        // check if single reg or two reg
        let flag;
        if(isRegister(op["body"])){
            // one reg
            // to pass trough, we need to use A
            let reg = op["body"];
            if(reg["value"] == "mbr"){
                if(!this.isAfreeOrSame(reg)){
                    this.throwError("op compile for mbr, a bus taken");
                }else{
                    this._amux = 1;
                    flag = true;
                }
            }else{
                if(this.isAfreeOrSame(reg)){
                    this.setAbusToReg(reg);
                    flag = true;
                }else{
                    this.throwError("op compile, A bus taken");
                }
            }
        }else if(isRegister(op["body"]["left"]) && isRegister(op["body"]["right"])){
            // two regs
            
            let reg_left = op["body"]["left"];
            let reg_right = op["body"]["right"];
            if(this.isAfreeOrSame(reg_left) && this.isBfreeOrSame(reg_right)){
                this.setAbusToReg(reg_left);
                this.setBbusToReg(reg_right);
                flag = true;
            }else{
                this.throwError("op: one or both regs taken");
            }
        }else if(op["body"]["value"] == "+"){
            let add = op["body"];
            this.compile_op_add(add);
        }

        // set appropriate op code
        let op_code = op["value"];
        let alu_op = this._alu;
        let sh_op = this._sh;

        // alu and/or shifter must be free for some op
        if(["band", "inv"].includes(op_code) == true && !this.isAluFreeOrSame(op_code)){
            this.throwError("Alu already preforming op");
        }
        if(["lshift", "rshift"].includes(op_code) == true && !this.isShifterFreeOrSame(op_code)){
            this.throwError("Shifter already preforming op");
        }

        switch(op_code){
            case "band":
                alu_op = 1;
                break;
            case "inv":
                alu_op = 3;
                break;
            case "lshift":
                sh_op = 2;
                break;
            case "rshift":
                sh_op = 1;
                break;
        }
        this._alu = alu_op;
        this._sh = sh_op;

        return flag;
    }

    compile_assign(op){
        let reg_Left = op["left"];

        if(reg_Left["mutable"] != true){
            this.throwError("Assign into mutable reg");
            return null;
        }

        if(!this.checkOutputRegister(reg_Left)){
            this.throwError("assign error");
            debugger;
            return null;
        }
        this.setOutputRegister(reg_Left);

        if(isRegister(op["body"])){
            // right is register
            // Bus A, passtrough on ALU and Shifter Unit
            if(!this.isAfreeOrSame(op["body"])){
                this.throwError("cant assign, a bus already taken");
                return;
            }
            // Note, op and shifter for passtrough is hardcoded
            if(!this.isAluFreeOrSame(2)){
                this.throwError("cant assign, alu is already taken");
                return;
            }
            if(!this.isShifterFreeOrSame(0)){
                this.throwError("cant assign, alu is already taken");
                return;
            }
            // check ok
            if(reg_Left["register"] == "mar"){
                this.setBbusToReg(op["body"]);
            }else{
                this.setAbusToReg(op["body"]);
                this._alu = 2;
                this._sh = 0;
            }
        }
        else if(    op["body"]["type"] == "param_operation"
                ||  op["body"]["type"] == "operation" )
        {
            // nested op
            let nested_op = op["body"];
            if(nested_op["value"] == "rd" || nested_op["value"] == "wr"){
                this.throwError("cant assign wr and rd");
                return;
            }
            if( nested_op["value"] == "+" ){
                return this.compile_op_add(nested_op);
            }else if(nested_op["type"] == "param_operation"){
                return this.compile_param_op(nested_op);
            }else{
                this.throwError("general assign error");
                debugger;
                return;
            }
        }   


    }

    compile_segment(line){

        // segment, or subinstruction

        if(line["type"] == "operation"){
            // wr|rd or :=
            if(line["value"] == "wr"){
                if(this._rd > 0){
                    this.throwError("Cant read and write in the same cycle");
                    return null;
                }else{
                    this._wr = 1;
                }
            }else if(line["value"] == "rd"){
                if(this._wr > 0){
                    this.throwError("Cant read and write in the same cycle");
                    return null;
                }else{
                    this._rd = 1;
                }
            }else if(line["value"] == ":="){
                // parse eq
                return this.compile_assign(line);
            }
            else{
                this.throwError("error at start of instruction");
                return null;
            }
        }
        else if(line["type"] && line["type"]["type"] == "if_keyword"){
            let op = line["type"];
            if(op["value"] == "if"){
                let jump_cond = line["body"]["left"];
                let to_label = line["body"]["right"];

                let line_number = this.getLineForLabel(to_label);
                let cond = this._cond;
                if(jump_cond["value"] == "z"){
                    cond = 2;
                }else if(jump_cond["value"] == "n"){
                    cond = 1;
                }else{
                    this.throwError("goto condition undefined");
                }
                this._addr = line_number;
                if(this._cond != 0){
                    this.throwError("jump condition already defined");
                }
                this._cond = cond;

            }else if(op["value"] == "goto"){
                let label = line["body"];
                let line_number = this.getLineForLabel(label);
                this._addr = line_number;
                if(this._cond != 0){
                    this.throwError("jump condition already defined");
                }
                this._cond = 3;
            }else{
                this.throwError("error at if keyword");
            }

        }else{
            if(line["type"] == "halt"){
                // TODO
                // acts like stop, or end of program
                // could be implemented as jump to end program adress

                // set all to 1
                // aka 0xFFFF FFFF FFFF FFFF
                // that way, we can differentiate halt in simulator 
                // and 0x0, which is NOOP
                this.setStateForHalt();
            }else{

                alert("Error compiling");
            }
        }

    }

    compile_line(line){

        let line_subs = line["body"];

        for(let i = 0; i < line_subs.length; i++){
            let _line = line_subs[i];
            this.compile_segment(_line);
        }
        this.flushInstruction();
        // clear ins, compile ins, flush instruction
    }

    compile_program(prog){
        let prog_body = prog["type"] == "prog" ? prog["body"] : prog;

        for(let i = 0; i < prog_body.length; i++){
            this.compile_line(prog_body[i]);
        }
    }
}


// Everything below is test code and/or dragons


let example_string = `
0:   mar := pc; rd;
1:   pc := pc +1; rd;
2:   ir := mbr; if n then goto 28;
3:   tir := lshift(ir + ir); if n then goto 19;
4:   tir := lshift(tir); if n then goto 11;
5:   alu := tir; if n then goto 9;
6:   mar:= ir; rd;
7:   rd;
8:   ac:= mbr; goto 0;
9:   mar := ir; mbr:= ac; wr;
10:  wr; goto 0;
11:  alu:= tir; if n then goto 15;
12:  mar := ir; rd;
13:  rd;
14:  ac:= mbr + ac; goto 0;
15:  mar := ir; rd;
16:  ac := ac + 1; rd;
17:  a := inv(mbr);
18:  ac := ac + a; goto 0;
19:  tir := lshift(tir); if n then goto 25;
20:  alu := tir; if n then goto 23;
21:  alu := ac; if n then goto 0;
22:  pc := band(ir, amask); goto 0;
23:  alu := ac; if z then goto 22;
24:  goto 0;
25:  alu := tir; if n then goto 27;
26:  pc := band(ir, amask); goto 0;
27:  ac := band(ir, amask); goto 0;
28:  tir := lshift(ir + ir); if n then goto 40;
29:  tir := lshift(tir); if n then goto 35;
30:  alu := tir; if n then goto 33;
31:  a := ir + sp;
32:  mar := a; rd; goto 7;
33:  a := ir + sp;
34:  mar := a; mbr := ac; wr; goto 10;
35:  alu := tir; if n then goto 38;
36:  a := ir + sp;
37:  mar := a; rd; goto 13;
38:  a:= ir + sp;
39:  mar:=a; rd;goto 16;
40:  tir := lshift(tir); if n then goto 46;
41:  alu := tir + tir; if z then goto 44;
42:  alu := ac; if n then goto 22;
43:  goto 0;
44:  alu:= ac; if z then goto 0;
45:  pc := band(ir,amask); goto 0;
46:  tir:= lshift(tir); if n then goto 50;
47:  sp := sp + (-1);
48:  mar := sp; mbr := pc; wr;
49:  pc := band(ir,amask); wr; goto 0;
50:  tir := lshift(tir); if n then goto 65;
51:  tir := lshift(tir); if n then goto 59;
52:  alu := tir; if n then goto 56;
53:  mar := ac; rd;
54:  sp := sp + (-1); rd;
55:  mar:= sp; wr; goto 10;
56:  mar := sp; sp:= sp + 1; rd;
57:  rd;
58:  mar := ac; wr; goto 10;
59:  alu := tir; if n then goto 62;
60:  sp:= sp + (-1);
61:  mar := sp; mbr := ac; wr; goto 10;
62:  mar := sp; sp := sp +1; rd;
63:  rd;
64:  ac:= mbr; goto 0;
65:  tir := lshift(tir); if n then goto 73;
66:  alu := tir; if n then goto 70;
67:  mar := sp; sp := sp +1; rd;
68:  rd;
69:  pc := mbr; goto 0;
70:  a := ac;
71:  ac := sp;
72:  sp := a; goto 0;
73:  tir := lshift(tir); if n then goto 76;
74:  a := band(ir, smask);
75:  sp := sp + a; goto 0;
76:  alu := tir; if n then goto 80;
77:  a := band(ir, smask);
78:  a := inv(a);
79:  a := a + 1; goto 75;
80:  halt;
81:  a:=1;
82:  halt;
`;


let input_string = `0:   mar := pc; rd;
1:   pc := pc +1; rd;
2:   ir := mbr; if n then goto 28;
3:   tir := lshift(ir + ir); if n then goto 19;
4:   tir := lshift(tir); if n then goto 11;
`;



// let text_output = document.getElementById("ins");
// text_output.value = "";

// cg._instructions.forEach(x => {
//     text_output.value = text_output.value + "0b" + (x >>> 0).toString(2).padStart(32, '0') + ",\n";
// });

document.getElementById("compile").onclick = () => {

    let text_input = document.getElementById("input").value;


    let lexer = new Tokenizer(text_input);


    let myarray = new Array();
    // push new line at start of list, for compatibility
    myarray.push(lexer.currentToken);
    
    while(!lexer.isEof()){
        let val = lexer.doFullRead();
        if(val == null){
            debugger;
        }else{
            myarray.push(val);
            console.log(val);
        }
    }
    
    let ast = new ASTmaker(myarray);
    
    let finish_ast = ast.parse_full_program();
    
    let cg = new MicCodeGenerator(finish_ast);

    let label_check = cg.compileLabels();
        
    if(label_check != true){
        let label_list = label_check.map(x => x["value"]);
        alert("Label compiling failed, following labels not found:\n" + label_list + ".");
        return;
    }
    
    console.log(cg.label_defs);
    console.log(cg.label_jumps);
    
    console.log("AST");
    console.log(finish_ast);
    
    cg.compile_program(finish_ast);

    let text_output = document.getElementById("output");
    text_output.value = "";
    cg._instructions.forEach(x => {
        text_output.value = text_output.value + "0b" + (x >>> 0).toString(2).padStart(32, '0') + "\n";
    });
};