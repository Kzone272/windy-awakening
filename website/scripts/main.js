var edgesCheckbox;
var blurCheckbox;
var blurCheckbos;
var canvas;

function initHtml() {
  edgesCheckbox = document.getElementById('edges');
  blurCheckbox = document.getElementById('blur');
  waterCheckbox = document.getElementById('water');

  canvas = document.getElementById('window');
  canvas.onclick = function() {
    canvas.requestPointerLock();
  };

  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  document.addEventListener('mousemove', mouseMove, false);
  document.addEventListener('wheel', scroll);
}

var gl;
var ratio;

function initGL() {
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

  var check = gl.getShaderInfoLog(shader);
  if (check) {
    console.log(name + ': ' + check);
  }

  return shader;
}

function createProgram(name, properties) {
  var vertexShader = createShader(name + '-vs');
  var fragmentShader = createShader(name + '-fs');

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  var check = gl.getProgramInfoLog(program);
  if (check) {
    console.log(name + ': ' + check);
  }

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

  edgesProgram = createProgram('edges', [
    'aPos',
    'aTexCoord',
    'uWidth',
    'uHeight',
    'uTexture',
  ]);

  blurProgram = createProgram('blur', [
    'aPos',
    'aTexCoord',
    'uWidth',
    'uHeight',
    'uDir',
    'uTexture',
  ]);

  waterProgram = createProgram('water', [
    'aPos',
    'aTexCoord',
    'uTexture',
  ]);

  sceneProgram = createProgram('scene', [
    'aPos',
    'aNorm',
    'aTexCoord',
    'uModelView',
    'uNormalMatrix',
    'uP',
    'uLightDir',
    'uTexture',
    'uFrame',
    'uIsWater',
  ]);
}

function genCone() {
  verts = [];
  verts.push(0, 0, -2)

  var r = 2 * ratio;
  var numVerts = 8;
  for (var i = 0; i < numVerts + 1; i++) {
    var theta = i * 2 * Math.PI / numVerts;
    verts.push(
      r * Math.cos(theta),
      r * Math.sin(theta),
      -3
    );
  }

  return {
    verts: new Float32Array(verts),
    numItems: numVerts + 2,
  };
}

function genRect() {
  var verts = [
    -1,  1, 0,
     1,  1, 0,
    -1, -1, 0,
    -1, -1, 0,
     1,  1, 0,
     1, -1, 0
  ];

  var texCoords = [
    0, 1,
    1, 1,
    0, 0,
    0, 0,
    1, 1,
    1, 0
  ];

  return {
    verts: new Float32Array(verts),
    texCoords: new Float32Array(texCoords),
    numItems: 6,
  };
}

function waterHeight(x, z) {
  var dist = vec2.length([x, z]);
  var height = 0.1 * Math.sin(20 * dist / (2 * Math.PI) + frame / 100);

  return height;
}

function genWater() {
  var size = 100;
  var density = 200;
  var width = size / density;
  var half = width / 2;

  var verts = [];
  var normals = [];
  var texCoords = [];

  for (var i = -density; i < density; i++) {
    for (var j = -density; j < density; j++) {
      verts.push(
              i * width, 0,       j * width,
        (i + 1) * width, 0,       j * width,
              i * width, 0, (j + 1) * width,
              i * width, 0, (j + 1) * width,
        (i + 1) * width, 0,       j * width,
        (i + 1) * width, 0, (j + 1) * width
      );
    }
  }

  for (var i = 0; i < 2 * density; i++) {
    for (var j = 0; j < 2 * density; j++) {
      texCoords.push(
              i * width,       j * width,
        (i + 1) * width,       j * width,
              i * width, (j + 1) * width,
              i * width, (j + 1) * width,
        (i + 1) * width,       j * width,
        (i + 1) * width, (j + 1) * width
      );
    }
  }

  for (var i = 0; i < verts.length; i += 3) {
    normals.push(0, 1, 0);
  }

  return {
    verts: new Float32Array(verts),
    normals: new Float32Array(normals),
    texCoords: new Float32Array(texCoords),
    numItems:  6 * (2 * density) * (2 * density),
  };
}

function genObj(object) {
  var textures = {};

  for (var key in object.textures) {
    textures[key] = createTexture(null, null, object.textures[key]);
  }

  return {
    verts: new Float32Array(object.verts),
    normals: new Float32Array(object.normals),
    texCoords: new Float32Array(object.texCoords),
    numItems: object.verts.length / 3,
    groups: object.groups,
    textures: textures,
  }
}

function createTexture(width, height, image) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (image) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function createRenderBuffer(width, height) {
  var renderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  return renderBuffer;
}

function createFrameBuffer(width, height) {
  var texture = createTexture(width, height);
  var renderBuffer = createRenderBuffer(width, height);
  var buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  if (false) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, 0x8ce1, gl.TEXTURE_2D, texture, 0);
  } else {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    texture: texture,
    buffer: buffer,
    width: width,
    height: height,
  }
}

var coneBuffer;
var rectBuffer;
var rectTexBuffer;
var waterBuffer;
var waterNormBuffer;
var waterTexBuffer;
var link;
var linkBuffer;
var linkNormBuffer;
var linkTexBuffer;

var lastFrame;
var voronoiFrame;
var edgesFrame;
var horizontalBlurFrame;
var blurFrame;
var waterFrame;

function initBuffers() {
  var cone = genCone();
  coneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cone.verts, gl.STATIC_DRAW)
  coneBuffer.numItems = cone.numItems;

  var rect = genRect();
  rectBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.verts, gl.STATIC_DRAW)
  rectBuffer.numItems = rect.numItems;

  rectTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.texCoords, gl.STATIC_DRAW);

  var water = genWater();
  waterBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.verts, gl.STATIC_DRAW)
  waterBuffer.numItems = water.numItems;

  waterNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.normals, gl.STATIC_DRAW);

  waterTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.texCoords, gl.STATIC_DRAW);

  link = genObj(toonLink);
  linkBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.verts, gl.STATIC_DRAW);

  linkNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.normals, gl.STATIC_DRAW);

  linkTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.texCoords, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  voronoiFrame = createFrameBuffer(1024, 1024);
  edgesFrame = createFrameBuffer(1024, 1024);
  horizontalBlurFrame = createFrameBuffer(1024, 1024);
  blurFrame = createFrameBuffer(1024, 1024);
  waterFrame = createFrameBuffer(1024, 1024);
}

var regions = [];
function initRegions() {
  for (var i = 0; i < 30; i++) {
    regions.push({
      pos: [Math.random() * 2 - 1, Math.random() * 2 - 1, 0],
      colour: [Math.random(), Math.random(), Math.random()],
      dir: 2 * Math.PI * Math.random(),
      speed: 0.001 * Math.random() + 0.001,
    });
  }
}

function moveRegions() {
  regions.forEach(function (region) {
    region.pos[0] += region.speed * Math.cos(region.dir);
    region.pos[1] += region.speed * Math.sin(region.dir);
    region.direction += 0.4 * Math.random() - 0.2;

    if (region.pos[0] > 1) {
      region.pos[0] = -1;
    } else if (region.pos[0] < -1) {
      region.pos[0] = 1;
    }
    if (region.pos[1] > 1) {
      region.pos[1] = -1;
    } else if (region.pos[1] < -1) {
      region.pos[1] = 1;
    }
  });
}

var M = mat4.create();
var V = mat4.create();
var P = mat4.create();
var orthoProj = mat4.create();
var perspProj = mat4.create();

function drawVoronoi() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, voronoiFrame.buffer);
  gl.useProgram(voronoiProgram);
  gl.viewport(0, 0, voronoiFrame.width, voronoiFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var ratio = voronoiFrame.width / voronoiFrame.height;
  mat4.identity(M);
  mat4.ortho(P, -1, 1, -1, 1, 0, 10);

  gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
  gl.uniformMatrix4fv(voronoiProgram.uP, false, P);

  for (var i = 0; i < 9; i++) {
    var x = Math.floor(i / 3);
    var y = i % 3;
    var zone = [2 * ratio * (x - 1), 2 * (y - 1), 0]

    for (var j = 0; j < regions.length; j++) {
      mat4.translate(M, mat4.create(), vec3.add([], regions[j].pos, zone));

      gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
      gl.uniform3fv(voronoiProgram.uCol, regions[j].colour);

      gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
      gl.enableVertexAttribArray(voronoiProgram.aPos);
      gl.vertexAttribPointer(voronoiProgram.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, coneBuffer.numItems);
    }
  }

  moveRegions();

  lastFrame = voronoiFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawEdges() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, edgesFrame.buffer);
  gl.useProgram(edgesProgram);
  gl.viewport(0, 0, edgesFrame.width, edgesFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(edgesProgram.uWidth, edgesFrame.width);
  gl.uniform1i(edgesProgram.uHeight, edgesFrame.height);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(edgesProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(edgesProgram.aPos);
  gl.vertexAttribPointer(edgesProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(edgesProgram.aTexCoord);
  gl.vertexAttribPointer(edgesProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = edgesFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawBlur() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, horizontalBlurFrame.buffer);
  gl.useProgram(blurProgram);
  gl.viewport(0, 0, horizontalBlurFrame.width, horizontalBlurFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(blurProgram.uWidth, horizontalBlurFrame.height);
  gl.uniform1i(blurProgram.uHeight, horizontalBlurFrame.height);
  gl.uniform2fv(blurProgram.uDir, [1, 0]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = horizontalBlurFrame;

  gl.bindFramebuffer(gl.FRAMEBUFFER, blurFrame.buffer);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform2fv(blurProgram.uDir, [0, 1]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = blurFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawWater() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, waterFrame.buffer);
  gl.useProgram(waterProgram);
  gl.viewport(0, 0, waterFrame.width, waterFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(waterProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(waterProgram.aPos);
  gl.vertexAttribPointer(waterProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(waterProgram.aTexCoord);
  gl.vertexAttribPointer(waterProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = waterFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawScene() {
  gl.useProgram(sceneProgram);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.identity(M);

  var cameraPos = [0, 0, 0];
  vec3.add(cameraPos, camera.pos, [boat.pos[0], 0, boat.pos[2]]);

  mat4.identity(V);
  mat4.lookAt(V, cameraPos, boat.pos, [0, 1, 0]);

  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  var normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelView);
  mat4.transpose(normalMatrix, normalMatrix);

  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);
  gl.uniformMatrix4fv(sceneProgram.uNormalMatrix, false, normalMatrix);
  gl.uniformMatrix4fv(sceneProgram.uP, false, perspProj);
  gl.uniform1i(sceneProgram.uFrame, frame);
  gl.uniform1i(sceneProgram.uIsWater, true);

  var lightDir = [0, -1, -0.5, 0];
  vec4.transformMat4(lightDir, lightDir, V);
  lightDir = [lightDir[0], lightDir[1], lightDir[2]]
  gl.uniform3fv(sceneProgram.uLightDir, lightDir);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(sceneProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, waterBuffer.numItems);

  mat4.identity(M);
  mat4.translate(M, M, boat.pos);
  mat4.rotateY(M, M, boat.direction);
  mat4.rotateX(M, M, -boat.pitch);
  mat4.translate(M, M, [0, 0, boat.offset]);
  mat4.scale(M, M, [0.002, 0.002, 0.002]);

  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  var normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelView);
  mat4.transpose(normalMatrix, normalMatrix);

  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);
  gl.uniformMatrix4fv(sceneProgram.uNormalMatrix, false, normalMatrix);
  gl.uniform1i(sceneProgram.uIsWater, false);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  for (var i = 0; i < link.groups.length; i++) {
    var group = link.groups[i];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, link.textures[group.material]);
    gl.uniform1i(sceneProgram.uTexture, 0);

    gl.drawArrays(gl.TRIANGLES, group.offset, group.size);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

var frame = 0;

function draw(e) {
  requestAnimationFrame(draw);

  tick();

  drawVoronoi();
  if (edgesCheckbox.checked) {
    drawEdges();
  }
  if (blurCheckbox.checked) {
    drawBlur();
    drawBlur();
  }
  if (waterCheckbox.checked) {
    drawWater();
  }

  drawScene();

  frame++;
}

var camera = {
  pos: [0, 1, -2],
  direction: 0,
  height: Math.PI / 4,
  distance: 2,
  zoom: 0.2,
}

var boat = {
  pos: [0, 0, 0],
  direction: 0,
  velocity: [0, 0, 0],
  acceleration: 0.003,
  offset: 0.15,
  pitch: 0,
}

function tick() {
  if (keys['up']) {
    var force = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
    vec3.scale(force, force, boat.acceleration);
    vec3.add(boat.velocity, boat.velocity, force);
  }
  if (keys['down']) {
    var force = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
    vec3.scale(force, force, -boat.acceleration);
    vec3.add(boat.velocity, boat.velocity, force);
  }
  if (keys['left']) {
    boat.direction += 0.04;
  }
  if (keys['right']) {
    boat.direction -= 0.04;
  }

  vec3.scale(boat.velocity, boat.velocity, Math.min(24 * Math.pow(vec3.length(boat.velocity), 0.7), 0.95));
  vec3.add(boat.pos, boat.pos, boat.velocity);

  var offsetPos = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
  vec3.scale(offsetPos, offsetPos, -boat.offset);
  vec3.add(offsetPos, offsetPos, boat.pos);

  var frontHeight = waterHeight(boat.pos[2], boat.pos[0])
  var backHeight = waterHeight(offsetPos[2], offsetPos[0])
  boat.pos[1] = 0.03 + backHeight;

  var front = [0.1, frontHeight];
  var back = [0, backHeight];
  boat.pitch = Math.atan2(frontHeight - backHeight, boat.offset);

  camera.pos[1] = camera.distance * Math.cos(camera.height);
  camera.pos[0] = camera.distance * Math.cos(camera.direction) * Math.sin(camera.height);
  camera.pos[2] = camera.distance * Math.sin(camera.direction) * Math.sin(camera.height);
}

function main() {
  initHtml();
  initGL();
  initPrograms();
  initBuffers();
  initRegions();

  mat4.perspective(perspProj, Math.PI / 4, ratio, 0.1, 100);

  gl.clearColor(0.2, 0.8, 1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  draw();
}

var toonLink = parseObjMtl('assets/linkboat/linkboat', function () {
  main();
});

function mouseMove(e) {
  var dx = e.movementX;
  var dy = e.movementY;

  camera.direction += 2 * Math.PI * dx / gl.drawingBufferWidth;
  camera.height -= Math.PI / 2 * dy / gl.drawingBufferHeight;
  camera.height = Math.min(Math.max(camera.height, 0.01), Math.PI / 2 - 0.1);
}

function scroll(e) {
  if (e.wheelDelta > 0) {
    camera.distance -= camera.zoom;
  } else if (e.wheelDelta < 0) {
    camera.distance += camera.zoom;
  }
}

var keys = {};

function mapKey(keyCode) {
  var key = String.fromCharCode(keyCode);

  if (keyCode == 37 || key == 'A') {
    key = 'left';
  } else if (keyCode == 38 || key == 'W') {
    key = 'up';
  } else if (keyCode == 39 || key == 'D') {
    key = 'right';
  } else if (keyCode == 40 || key == 'S') {
    key = 'down';
  }

  return key;
}

function keyDown(e) {
  keys[mapKey(e.keyCode)] = true;
}

function keyUp(e) {
  keys[mapKey(e.keyCode)] = false;
}