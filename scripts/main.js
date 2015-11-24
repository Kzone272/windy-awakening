var gl;
var ratio;

function initGL() {
  var canvas = document.getElementById('window');
  gl = canvas.getContext('webgl');
  ratio = gl.drawingBufferWidth / gl.drawingBufferHeight;
}

function createShader(name) {
  var script = document.getElementById(name);
  var type;
  if (script.type == 'x-shader/x-vertex') {
    type = gl.VERTEX_SHADER;
  } else if (script.type == 'x-shader/x-fragment') {
    type = gl.FRAGMENT_SHADER;
  } else {
    console.error('INCORRECT SHADER TYPE');
  }
  var shaderString = script.textContent;
  var shader = gl.createShader(type);
  gl.shaderSource(shader, shaderString);
  gl.compileShader(shader);
  console.log(gl.getShaderInfoLog(shader));

  return shader;
}

function createProgram(name, properties) {
  var vertexShader = createShader(name + '-vs');
  var fragmentShader = createShader(name + '-fs');

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  console.log(gl.getProgramInfoLog(program));

  properties.forEach(function (property) {
    if (property[0] == 'u') {
      program[property] = gl.getUniformLocation(program, property);
    } else if (property[0] == 'a') {
      program[property] = gl.getAttribLocation(program, property);
    }
  });

  return program;
}

var voronoiProgram;
var blurProgram;

function initPrograms() {
  voronoiProgram = createProgram('voronoi', [
    'aPos',
    'uM',
    'uP',
    'uCol',
  ]);

  blurProgram = createProgram('blur', [
    'aPos',
    'aTexCoord',
    'uM',
    'uP',
    'uDir',
    'uTexture',
  ]);
}

function genCone() {
  verts = [];
  verts.push(0, 0, -2)

  var r = 2 * ratio;
  var numVerts = 32;
  for (var i = 0; i < numVerts + 1; i++) {
    var theta = i * 2 * Math.PI / numVerts;
    verts.push(
      r * Math.cos(theta),
      r * Math.sin(theta),
      -3
    );
  }

  return {
    verts: new Float32Array(verts)
  };
}

function genRect() {
  var verts = [
    -ratio,  1, 0,
     ratio,  1, 0,
    -ratio, -1, 0,
    -ratio, -1, 0,
     ratio,  1, 0,
     ratio, -1, 0
  ];

  var texCoords = [
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
  ];

  return {
    verts: new Float32Array(verts),
    texCoords: new Float32Array(texCoords)
  };
}

var coneBuffer;
var rectBuffer;
var rectTexBuffer;
var frameBuffer;
var frameBuffer2;

function initBuffers() {
  var cone = genCone();
  coneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cone.verts, gl.STATIC_DRAW)

  var rect = genRect();
  rectBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.verts, gl.STATIC_DRAW)

  rectTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.texCoords, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  frameBuffer = createFrameBuffer();
  frameBuffer2 = createFrameBuffer();
}

var regions = [];
function initRegions() {
  for (var i = 0; i < 200; i++) {
    regions.push({
      pos: [Math.random() * 2 * ratio - ratio, Math.random() * 2 - 1, 0],
      colour: [Math.random(), Math.random(), Math.random()]
    });
  }
}

var M = mat4.create();
var P = mat4.create();
var orthoProj = mat4.create();
var persProj = mat4.create();

var frame = 0;

function draw() {
  requestAnimationFrame(draw);

  gl.useProgram(voronoiProgram);

  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer.buffer);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.identity(M);

  gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
  gl.uniformMatrix4fv(voronoiProgram.uP, false, orthoProj);

  for (var i = 0; i < regions.length; i++) {
    //mat4.translate(M, mat4.create(), [regions[i].pos[0], regions[i].pos[1], 0]);
    mat4.translate(M, mat4.create(), regions[i].pos);

    regions[i].pos[0] += 0.008 * Math.random() - 0.004;
    regions[i].pos[1] += 0.008 * Math.random() - 0.004;

    gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
    gl.uniform3fv(voronoiProgram.uCol, regions[i].colour);

    gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
    gl.enableVertexAttribArray(voronoiProgram.aPos);
    gl.vertexAttribPointer(voronoiProgram.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 34);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer2.buffer);

  gl.useProgram(blurProgram);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.identity(M);
  mat4.translate(M, M, [0, 0, -6]);
  //mat4.rotateY(M, M, frame * 0.01 );
  //mat4.rotateX(M, M, -Math.PI / 4);
  //mat4.scale(M, M, [3, 3, 3]);

  gl.uniformMatrix4fv(blurProgram.uM, false, M);
  gl.uniformMatrix4fv(blurProgram.uP, false, orthoProj);
  gl.uniform2fv(blurProgram.uDir, [1, 0]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, frameBuffer.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  mat4.identity(M);
  mat4.translate(M, M, [0, -1, -6]);
  mat4.rotateX(M, M, -Math.PI / 3);
  mat4.rotateZ(M, M, frame * 0.01 );
  mat4.scale(M, M, [3, 3, 3]);

  gl.uniformMatrix4fv(blurProgram.uM, false, M);
  gl.uniformMatrix4fv(blurProgram.uP, false, persProj);
  gl.uniform2fv(blurProgram.uDir, [0, 1]);


  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, frameBuffer2.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  frame++;
}

function createTexture() {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function createRenderBuffer() {
  var renderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  return renderBuffer;
}

var i = 0;

function createFrameBuffer() {
  var texture = createTexture();
  var renderBuffer = createRenderBuffer();
  var buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  if (false) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, 0x8ce1, gl.TEXTURE_2D, texture, 0);
  } else {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  i++;

  return {
    texture: texture,
    buffer: buffer
  }
}

function main() {
  initGL();
  initPrograms();
  initBuffers();
  initRegions();

  mat4.ortho(orthoProj, -ratio, ratio, -1, 1, 0.1, 100);
  mat4.perspective(persProj, Math.PI / 4, ratio, 0.1, 100);

  gl.clearColor(0.2, 0.8, 1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  draw();
}

main();