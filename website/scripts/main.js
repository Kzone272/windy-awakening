var gl;
var ratio;

function initGL() {
  var canvas = document.getElementById('window');
  gl = canvas.getContext('webgl');
  ratio = gl.drawingBufferWidth / gl.drawingBufferHeight;
}

var program;

function initShaders() {
  var vertexShaderString = document.getElementById('vertexShader').textContent;
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderString);
  gl.compileShader(vertexShader);
  console.log(gl.getShaderInfoLog(vertexShader));

  var fragmentShaderString = document.getElementById('fragmentShader').textContent;
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderString);
  gl.compileShader(fragmentShader);
  console.log(gl.getShaderInfoLog(fragmentShader));

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  console.log(gl.getProgramInfoLog(program));

  program.posAtt = gl.getAttribLocation(program, "position");
  program.mUni = gl.getUniformLocation(program, "M");
  program.vUni = gl.getUniformLocation(program, "V");
  program.pUni = gl.getUniformLocation(program, "P");
  program.colUni = gl.getUniformLocation(program, "colour");
}

function genCone() {
  verts = [];
  verts.push(0, 0, -1)

  var r = 3;
  var numVerts = 32;
  for (var i = 0; i < numVerts + 1; i++) {
    var theta = i * 2 * Math.PI / numVerts;
    verts.push(
      r * Math.cos(theta),
      r * Math.sin(theta),
      -2
    );
  }

  return new Float32Array(verts);
}

var coneBuffer;

function initBuffers() {
  coneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, genCone(), gl.STATIC_DRAW)
}

var M = mat4.create();
var V = mat4.create();
var P = mat4.create();

var regions = [];
function initRegions() {
  for (var i = 0; i < 50; i++) {
    regions.push({
      pos: [Math.random() * 2 * ratio - ratio, Math.random() * 2 - 1, 0],
      colour: [Math.random(), Math.random(), Math.random()]
    });
  }
}

function draw() {
  requestAnimationFrame(draw);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  for (var i = 0; i < regions.length; i++) {
    mat4.translate(M, mat4.create(), regions[i].pos);

    regions[i].pos[0] += 0.001 * Math.random() - 0.0005;
    regions[i].pos[1] += 0.001 * Math.random() - 0.0005;

    gl.uniformMatrix4fv(program.mUni, false, M);
    gl.uniformMatrix4fv(program.vUni, false, V);
    gl.uniformMatrix4fv(program.pUni, false, P);

    gl.uniform3fv(program.colUni, regions[i].colour);

    gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
    gl.enableVertexAttribArray(program.posAtt)
    gl.vertexAttribPointer(program.posAtt, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 34);
  }
}

function main() {
  initGL();
  initShaders();
  initBuffers();
  initRegions();

  mat4.ortho(P, -ratio, ratio, -1, 1, 0.1, 10);

  gl.clearColor(0.2, 0.8, 1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  gl.useProgram(program);

  draw();
}

main();