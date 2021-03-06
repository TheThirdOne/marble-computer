exports = exports || {};
exports.parse = function(str){
  return parseTopLevel(str2in(str));
};
exports.codegen = function(modules){
  return codegen(modules, makeContext());
};


function getToken(input){
  var lastChar = input.getChar();
  
  //whitespace
  while(lastChar && !!lastChar.match(/\s/)){
    lastChar = input.getChar();
  }
  
  //comments
  if(lastChar === '/'){
    lastChar = input.getChar();
    if(lastChar === '/'){
      while(lastChar !== '\n' && lastChar !== ''){
        lastChar = input.getChar();
      }
    }else if(lastChar === '*'){
      do{
        lastChar = input.getChar();
        while(lastChar !== '*' && lastChar !== ''){
          lastChar = input.getChar();
        }
      }while(lastChar !== '/' && lastChar !== '');
    }else{
      input.returnChar();
      return {token:'/',index:input.getIndex()};
    }
    input.returnChar();
    return getToken(input);
  }
  // All single character tokens
  if(!lastChar){
    return {token:'EOF'};
  }
  if(lastChar === '('){
    return {token:'(',index:input.getIndex()};
  }
  if(lastChar === ')'){
    return {token:')',index:input.getIndex()};
  }
  if(lastChar === '{'){
    return {token:'{',index:input.getIndex()};
  }
  if(lastChar === '}'){
    return {token:'}',index:input.getIndex()};
  }
  if(lastChar === '['){
    return {token:'[',index:input.getIndex()};
  }
  if(lastChar === ']'){
    return {token:']',index:input.getIndex()};
  }
  if(lastChar === ','){
    return {token:',',index:input.getIndex()};
  }
  if(lastChar === ';'){
    return {token:';',index:input.getIndex()};
  }
  if(lastChar === '='){
    return {token:'=',index:input.getIndex()};
  }
  if(lastChar === '_'){
    return {token:'_',index:input.getIndex()};
  }

  //continue grabbing characters until a special character pops up
  var text = '';
  while(!!lastChar.match(/[^(){}\[\],;=_\/\s]/)){
    text += lastChar;
    lastChar = input.getChar();
  }
  input.returnChar();

  //check keywords
  if(text === 'module'){
    return {token:'module',index:input.getIndex()};
  }
  if(text === 'for'){
    return {token:'for',index:input.getIndex()};
  }
  if(text === 'to'){
    return {token:'to',index:input.getIndex()};
  }
  if(text === 'delay'){
    return {token:'delay',index:input.getIndex()};
  }
  if(text === 'catch'){
    return {token:'catch',index:input.getIndex()};
  }
  return {token: 'other',
          data:   text,
          index:  input.getIndex()};
}

function error(str,tok){
  throw "Parse Error: " + str + '; ' + (JSON.stringify(tok)||'');
}
function parseTopLevel(input){
  var tok = getToken(input);
  var modules = {};
  while(tok.token === 'module'){
    tmp = parseModule(input);
    modules[tmp.name] = tmp;
    tok = getToken(input);
  }
  if(tok.token !== 'EOF'){
    error('Unexpected token expected EOF or module',tok);
  }
  return modules;
  
}

function parseModule(input){
  var name = getToken(input);
  if(name.token !== 'other'){
    error('First token in module must be a name',name);
  }
  name = name.data;
  return {name:name,inputs:parseArgs(input), outputs:parseArgs(input),body:parseBlock(input)};
}

function parseArgs(input){
  var tmp,inputs = [],tok = getToken(input);
  if(tok.token !==  '('){
    error('Args starts with (',tok);
  }
  tok = getToken(input);
  while(tok.token !== ')' && tok.token !== 'EOF'){
    if(!tmp){
      if(tok.token !== 'other'){
        error('Inputs must start with identifiers',tok);
      }
      tmp = {name:tok.data};
    }else if(tok.token === '['){
      if(tmp.size || tmp.vector){
        error("unexpected [",tok);
      }
      tmp.vector = true;
    }else if(tok.token === 'other'){
      if(tmp.vector === true){
        tmp.size = tok.data;
      }else{
        error("unexpected identifier",tok);
      }
    }else if(tok.token === ']'){
      if(!tmp.vector || !tmp.size){
        error("unexpected ]",tok);
      }
    }else if(tok.token === ','){
      if(tmp.vector && !tmp.size){
        error("unexpected , expected size");
      }
      inputs.push(tmp);
      tmp = undefined;
    }else{
      error('unexpected token',tok);
    }
    tok = getToken(input);
  }
  if(tmp){
    inputs.push(tmp);
  }
  if(tok.token === 'EOF'){
    error('Unexpected eof');
  }
  return inputs
}

function parseLH(tok,input){
  var tmp = {name: ''},lh = [];
  while(tok.token !== '=' && tok.token !== 'EOF'){
    if(tok.token === 'catch' || tok.token === 'delay'){
      tmp.option = tok.token;
      tok = getToken(input);
      if(tok.token !== '('){
        error('Expect (',tok);
      }
      tok = getToken(input);
      while(tok.token !== ')' && tok.token !== 'EOF'){
        if(tok.token === '[' || tok.token === ']'){
          tmp.name += tok.token;
        }else if(tok.token === 'other'){
          tmp.name += tok.data;
        }
        tok = getToken(input);
      }
      
    }else if(tok.token === '[' || tok.token === ']'){
      tmp.name += tok.token;
    }else if(tok.token === 'other'){
      tmp.name += tok.data;
    }else if(tok.token === '_'){
      tmp.name = '_';
    } else if(tok.token === ','){
      lh.push(tmp);
      tmp = {name: ''}
    }else{
      error('unexpected token',tok);
    }
    tok = getToken(input);
  }
  if(tmp.name){
    lh.push(tmp);
  }
  if(tok.token === 'EOF'){
    error('Unexpected eof');
  }
  return lh
}

function parseBlock(input){
  var tok = getToken(input);
  if(tok.token !== '{'){
    error('Blocks must start with {',tok);
  }
  var statements = [];
  
  var tok = getToken(input);
  while(tok.token !== '}' && tok.token !== 'EOF'){
    if(tok.token === 'other' || tok.token === '_'){
      var lh = parseLH(tok,input);
      tok = getToken(input);
      if(tok.token !== 'other'){
        error('Expected identifier on Right side of =',tok);
      }
      var module = tok.data;
      var inputs = parseArgs(input);
      tok = getToken(input);
      if(tok.token !== ';'){
        error('Expected ; at end of statement',tok);
      }
      
      statements.push({type:'statement',module:module,args:inputs,assign:lh});
    }else if(tok.token === 'for'){
      var name = getToken(input);
      if(name.token !== 'other'){
        error("Expected identifier for index",name);
      }
      name = name.data;
      tok = getToken(input);
      if(tok.token !== '='){
        error("Expected =",tok);
      }
      var lb = getToken(input);
      if(lb.token !== 'other'){
        error("Expected identifier",lb);
      }
      tok = getToken(input);
      if(tok.token !== 'to'){
        error("Expected to",tok);
      }
      var ub = getToken(input);
      if(ub.token !== 'other'){
        error("Expected identifier",ub);
      }
      statements.push({type:'for',index:name,lowerBound:lb,upperBound:ub,block:parseBlock(input)});
    }else{
      error("Expected for or identifier at start of statement",tok);
    }
    tok = getToken(input);
  }
  if(tok.token === 'EOF'){
    error('Unexpected eof');
  }
  return statements;
}
function str2in(str){
  var out = {src:str,
             i: 0,
             getIndex: function(){return this.i;},
             getChar: function(){return this.src[this.i++];},
             returnChar: function(){this.i--;}
            };
  return out;
}

function codegenStatement(statement,context){
  if(statement.type === 'for'){
    if(context.constants[statement.index]){
      error('index already in use',statement);
    }
    var lb = context.eval(statement.lowerBound.data);
    var ub = context.eval(statement.upperBound.data);
    var out = [];
    for(var i = lb; i < ub; i++){
      context.constants[statement.index] = i;
      out = out.concat(codegenBlock(statement.block,context));
    }
    delete context.constants[statement.index];
    return out;
  }else if(statement.module === 'link'){
    if(statement.assign.length !== 1){
      error('links require 1 and only 1 ouput',statement);
    }

    if(context.links[statement.assign[0]]){
      error('cannot assign link to existing variable',statement);
    }
    if(statement.args.length !== 0){
      error('links require 0 args',statement);
    }
    context.getLink(statement.assign[0].name+'['+(statement.assign[0].size||0)+']');
  }else if(statement.module === 'dup' || statement.module === 'flip' || statement.module === 'switch'){
    if(statement.assign.length !== 2){
      error('fundemental modules require 2 and only 2 ouput',statement);
    }
    var links = [];
    for(var i = 1; i < statement.args.length; i++){
      var name = statement.args[i].name.split(/(-|:)/);
      var rst = false, neg = false;
      for(var k = 1; k < name.length; k+=2){
        if(name[i] == ':'){
          rst = true;
        }
        if(name[i] == '-'){
          neg = true;
        }
      }
      name = name[name.length-1];
      links.push((neg?'-':'') + (rst?':':'')+context.getLink(name+'['+(statement.args[i].size||0)+']'));
    }
    name = statement.args[0].name+'['+(statement.args[0].size||0)+']';
    var out = [];
    out[0] = {dup:'D',flip:'F','switch':'S'}[statement.module];
    out[1] = context.getPipe(name,true);
    out[2] = context.getPipe(statement.assign[0].name);
    out[3] = context.getPipe(statement.assign[1].name);
    out[4] = links;
    out[5] = {'catch':1,delay:2}[statement.assign[0].option]||0;
    out[6] = {'catch':1,delay:2}[statement.assign[1].option]||0;
    return [out];
  }else{
    if(!context.modules[statement.module]){
      error('Module not found',statement);
    }
    if(context.modules[statement.module].inputs.length !== statement.args.length){
      error('Number of inputs wrong',statement);
    }
    if(context.modules[statement.module].outputs.length !== statement.assign.length){
      error('Number of outputs wrong',statement);
    }
    return codegenModule(context.modules[statement.module],statement.args,statement.assign,context);
  }
}

function codegenBlock(block,context){
  var out = [];
  for(var i = 0; i < block.length; i++){
    out = out.concat(codegenStatement(block[i],context)||[]);
  }
  return out;
}
function codegenModule(module,args,out,context){
  var pipes = {}, constants = {};
  for(var i = 0; i < args.length; i++){
    if(module.inputs[i].size){
      var tmp = constants[module.inputs[i].size] = context.eval(args[i].size);
      for(var k = 0; k < tmp; k++){
        context.remap(args[i].name+'['+k+']',module.inputs[i].name+'['+k+']',pipes);
      }
    }else{
      context.remap(args[i].name,module.inputs[i].name+'[0]',pipes);
    }
  }
  for(var i = 0; i < out.length; i++){
    if(module.outputs[i].size){
      var t = context.lookup(out[i].name).replace(']').split('[');
      var name = t[0];
      var tmp = constants[module.outputs[i].size] = context.eval(t[1]);
      
      for(var k = 0; k < tmp; k++){
        context.remap(name+'['+k+']',module.outputs[i].name+'['+k+']',pipes);
      }
    }else{
      context.remap(out[i].name,module.outputs[i].name+'[0]',pipes);
    }
  }
  var savPipes = context.pipeMap, savConst = context.constants,savLinks = context.linkMap;
  context.save(pipes, constants);
  var code = codegenBlock(module.body,context);
  context.restore();
  return code;
  
}

function codegen(modules,context){
  if(!modules.main){
    error('Must have a main module');
  }
  context.modules = modules;
  var main = modules.main;
  var inputs = [];
  for(var i = 0; i < main.inputs.length; i++){
    if(main.inputs[i].size){
      var tmp = parseInt(main.inputs[i].size);
      for(var k = 0; k < tmp; k++){
        inputs.push(context.getPipe(main.inputs[i].name+'['+k+']'));
      }
    }else{
      inputs.push(context.getPipe(main.inputs[i].name+'[0]'));
    }
  }
  for(var i = 0; i < main.outputs.length; i++){
    if(main.outputs[i].size){
      var tmp = parseInt(main.outputs[i].size);
      for(var k = 0; k < tmp; k++){
        context.getPipe(main.outputs[i].name+'['+k+']');
      }
    }else{
      context.getPipe(main.outputs[i].name+'[0]');
    }
  }
  return {pipes:context.pipes, links: context.links, inputs: inputs, insts:codegenBlock(main.body,context)};
}
function makeContext(){
  var out = { pipes: 0, links: 0, pipeMap:{}, pipeRead: [], linkMap:{}, constants: {}, stack:[]};
    out.getLink = function(name){
      console.log(name);
      var name = this.lookup(name);
      if(this.linkMap[name]){
        return this.linkMap[name];
      }else{
        this.linkMap[name] = ++this.links;
        return this.links;
      }
    };
    out.getPipe = function(name,read){
      if(name === '_'){
        return 0;
      }
      var name = this.lookup(name);
      if(this.pipeMap[name]){
        if(this.pipeRead[this.pipeMap[name]]){
          error('Cannot access pipe: '+name +' already read from');
        }
        if(read && this.pipeMap[name] !== 0){
          this.pipeRead[this.pipeMap[name]] = true;
        }
        return this.pipeMap[name];
      }else{
        if(read){
          error('Cannot access pipe: '+name +' not created yet');
        }
        this.pipeMap[name] = ++this.pipes;
        return this.pipes
      }
    };
    out.lookup = function(name){
      var parts = name.replace(']','').split('[');
      if(parts.length > 2){
        error('Name has multiple [\'s',name)
      }
      name = parts[0];
      var index = 0;
      if(parts.length === 2){
        index = this.eval(parts[1]);
      }
      
      return name + '[' + index + ']';
    };
    out.eval = function(str){
      var str = str.split(/(\+|-)/);
      var val = 0;
      for(var i = 0; i < str.length; i+=2){
        if(str[i] === ''){ // for a[-N]
          continue;
        }
        if(this.constants[str[i]] !== undefined){
          val += this.constants[str[i]]*((str[i-1] === '-')?-1:1);
        }else{
          val += parseInt(str[i])*((str[i-1] === '-')?-1:1);
        }
      }
      return val;
    };
    out.remap = function(name,newName,map){
      map[newName] = this.getPipe(name);
    };
    out.save = function(pipes,consts){
      this.stack.push(this.pipeMap);
      this.stack.push(this.linkMap);
      this.stack.push(this.constants);
      
      this.pipeMap = pipes;
      this.linkMap = [];
      this.constants = consts;
    };
    out.restore = function(){
      this.constants = this.stack.pop();
      this.linkMap = this.stack.pop();
      this.pipeMap = this.stack.pop();
    };
    return out;
}